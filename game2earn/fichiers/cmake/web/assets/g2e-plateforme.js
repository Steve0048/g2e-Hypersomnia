// Game2Earn : le pont entre le jeu (WebAssembly) et la plateforme.
//
// 1. La page télécharge le moteur et les données, installe le cache préparé (g2e-cache.js), fige les dates : le moteur
//    est prêt, mais le jeu ne démarre pas encore (noInitialRun). On prévient la plateforme : « pret ».
// 2. Au départ donné par la plateforme (« demarrer »), le jeu démarre avec la bonne entrée :
//    - entraînement : le tutoriel du jeu (/tutorial) ;
//    - défi : directement le serveur du match (/game/<adresse>:8412), avec le pseudo du joueur.
// 3. Hors de la plateforme (essai en local), le jeu démarre seul, sur son menu.
//
// Le SDK (g2e-sdk.js) est un module ES : il est chargé par import() depuis ce script classique.

var g2e_etat = { moteurPret: false, sdk: null, lance: false, attenteDepart: null };

function g2e_message(texte) {
  var el = document.getElementById("g2e-message");
  if (!el) return;
  el.textContent = texte || "";
  el.hidden = !texte;
}

// Le pseudo (et plus tard l'identité) donnés par Game2Earn, écrits dans la configuration du joueur avant le démarrage.
function g2e_ecrire_config(config) {
  try {
    if (!FS.analyzePath("/user/conf.d").exists) FS.mkdir("/user/conf.d");
    FS.writeFile("/user/conf.d/game2earn.json", JSON.stringify(config, null, 2));
  } catch (e) {
    console.warn("Game2Earn : configuration non écrite", e);
  }
}

function g2e_lancer(argument) {
  if (g2e_etat.lance) return;
  g2e_etat.lance = true;
  g2e_message("");
  console.log("Game2Earn : démarrage du jeu sur " + argument);
  // La fonction globale d'Emscripten : lire Module.callMain quand elle n'est pas exportée arrête le moteur (garde-fou).
  if (typeof callMain === "function") callMain([argument]);
  else console.error("Game2Earn : callMain introuvable, le jeu ne peut pas démarrer");
}

// Ce que la plateforme donne au départ : la salle du match (serveur g2e-hypersomnia), sinon rien (entraînement libre).
function g2e_au_depart(donnees) {
  var salle = donnees && donnees.salle;
  if (!salle) return g2e_lancer("/tutorial");
  g2e_message("Préparation du match…");
  var lire = function () {
    fetch(salle.serveur + "/salles/" + salle.code + "/acces?jeton=" + encodeURIComponent(salle.jeton), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (a) {
        if (a.pseudo) g2e_ecrire_config({ client: { nickname: a.pseudo } });
        if (a.etat === "entrainement") return g2e_lancer("/tutorial");
        if (a.etat === "preparation") {
          g2e_message("Ton serveur de match démarre près de chez toi… quelques secondes.");
          return setTimeout(lire, 3000);
        }
        if (a.etat === "pret") {
          var adresse = String(a.lien || "").split("/game/")[1];
          if (a.motDePasse) g2e_message("Mot de passe du match : " + a.motDePasse);
          return g2e_lancer(adresse ? "/game/" + adresse : "/tutorial");
        }
        g2e_message(a.message || "Le match n'est plus disponible.");
      })
      .catch(function () {
        g2e_message("Connexion au serveur du match… nouvel essai dans un instant.");
        setTimeout(lire, 4000);
      });
  };
  lire();
}

function g2e_brancher_sdk() {
  import("../g2e-sdk.js")
    .then(function (m) {
      var g2e = m.g2e;
      g2e_etat.sdk = g2e;
      if (!g2e.integre) {
        // Essai en dehors de la plateforme : le jeu démarre dès que le moteur est prêt, sur son menu.
        g2e_etat.attenteDepart = function () { g2e_lancer("/"); };
      } else {
        g2e.surDemarrer(function (d) {
          if (g2e_etat.moteurPret) g2e_au_depart(d);
          else g2e_etat.attenteDepart = function () { g2e_au_depart(d); };
        });
      }
      if (g2e_etat.moteurPret) g2e_moteur_pret();
    })
    .catch(function (e) {
      console.warn("Game2Earn : SDK introuvable, le jeu démarre seul", e);
      g2e_etat.attenteDepart = function () { g2e_lancer("/"); };
      if (g2e_etat.moteurPret) g2e_moteur_pret();
    });
}

function g2e_moteur_pret() {
  g2e_etat.moteurPret = true;
  if (g2e_etat.sdk && g2e_etat.sdk.integre) g2e_etat.sdk.pret();
  if (g2e_etat.attenteDepart) {
    var suite = g2e_etat.attenteDepart;
    g2e_etat.attenteDepart = null;
    suite();
  }
}

function g2e_preparer_module(Module) {
  // Le jeu ne démarre qu'au départ donné par la plateforme.
  Module.noInitialRun = true;
  Module.onRuntimeInitialized = function () {
    g2e_figer_dates();
    g2e_moteur_pret();
  };
  // Dans le cadre de la plateforme, la page ne change pas d'adresse (le jeu le ferait pour ses propres liens).
  Module.setBrowserLocation = function () {};
  g2e_brancher_sdk();
}
