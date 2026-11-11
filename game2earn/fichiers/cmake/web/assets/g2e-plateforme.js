// Game2Earn : le pont entre le jeu (WebAssembly) et la plateforme.
//
// 1. La page télécharge le moteur et les données, installe le cache préparé (g2e-cache.js), fige les dates : le moteur
//    est prêt, mais le jeu ne démarre pas encore (noInitialRun). On prévient la plateforme : « pret ».
// 2. Au départ donné par la plateforme (« demarrer »), le jeu démarre avec la bonne entrée :
//    - entraînement : le tutoriel du jeu (/tutorial) ;
//    - défi : directement le serveur du match (/game/<adresse>:8412), avec le pseudo et le mot de passe du joueur.
//    Avant le démarrage, la session est écrite pour le moteur (src/game2earn/g2e.h) : contexte, langue de la
//    plateforme (français par défaut), mot de passe, et la table de traduction de cette langue.
// 3. Hors de la plateforme (essai en local), le jeu démarre seul, sur son menu, en anglais et sans changement.
//
// Le SDK (g2e-sdk.js) est un module ES : il est chargé par import() depuis ce script classique.

var g2e_etat = { moteurPret: false, sdk: null, lance: false, attenteDepart: null, contexte: "", traductions: {} };

// La table de la langue par défaut se télécharge pendant le chargement du jeu.
var G2E_LANGUE_DEFAUT = "fr";
var g2e_tables = {};

function g2e_table(langue) {
  if (langue === "en") return Promise.resolve({});
  if (!g2e_tables[langue]) {
    g2e_tables[langue] = fetch("assets/g2e-langues/" + langue + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .catch(function (e) {
        console.warn("Game2Earn : pas de traduction « " + langue + " »", e);
        return langue === G2E_LANGUE_DEFAUT ? {} : g2e_table(G2E_LANGUE_DEFAUT);
      });
  }
  return g2e_tables[langue];
}
g2e_table(G2E_LANGUE_DEFAUT);

function g2e_message(texte) {
  var el = document.getElementById("g2e-message");
  if (!el) return;
  el.textContent = texte || "";
  el.hidden = !texte;
}

function g2e_ecrire(chemin, contenu) {
  var dossier = chemin.slice(0, chemin.lastIndexOf("/"));
  if (dossier && !FS.analyzePath(dossier).exists) FS.mkdirTree(dossier);
  FS.writeFile(chemin, contenu);
}

// Une ligne de session ou de traduction : « \ » et les retours à la ligne échappés (lus par g2e.h).
function g2e_ligne(texte) {
  return String(texte).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n");
}

// Le pseudo donné par Game2Earn (le jeu ne demande pas d'en choisir un) et nos serveurs : la liste des serveurs vient
// du Worker de Game2Earn (vide : on n'entre que dans son match) et la mise en relation du conteneur du match.
function g2e_ecrire_config(session) {
  try {
    var config = { prompted_for_sign_in_once: true };
    if (session.pseudo) config.client = { nickname: session.pseudo };
    if (session.listeServeurs) config.server_list_provider = session.listeServeurs;
    if (session.signalisation) config.webrtc_signalling_server_url = session.signalisation;
    g2e_ecrire("/user/conf.d/game2earn.json", JSON.stringify(config, null, 2));
  } catch (e) {
    console.warn("Game2Earn : configuration non écrite", e);
  }
}

// La clé de compte de la place du joueur (créée par Game2Earn, remise à lui seul) : le serveur du match n'admet à sa
// place que ce compte - personne d'autre ne peut la prendre, même avec son pseudo et le mot de passe.
function g2e_ecrire_cle(cle) {
  try {
    if (cle) g2e_ecrire("/hypersomnia_keys/account.key", cle + "\n");
  } catch (e) {
    console.warn("Game2Earn : clé de compte non écrite", e);
  }
}

// La session lue par le moteur au démarrage (src/game2earn/g2e.h).
function g2e_ecrire_session(session, table) {
  try {
    var lignes = ["actif=1", "contexte=" + (session.contexte || ""), "langue=" + session.langue];
    if (session.motDePasse) lignes.push("mot_de_passe=" + g2e_ligne(session.motDePasse));
    g2e_ecrire("/g2e/session.txt", lignes.join("\n") + "\n");
    var paires = [];
    for (var anglais in table) {
      if (Object.prototype.hasOwnProperty.call(table, anglais) && table[anglais]) paires.push(g2e_ligne(anglais), g2e_ligne(table[anglais]));
    }
    g2e_ecrire("/g2e/traduction.txt", paires.join("\n") + "\n");
  } catch (e) {
    console.warn("Game2Earn : session non écrite", e);
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

// Démarrer dans Game2Earn : la session et la configuration écrites, puis le jeu lancé sur son entrée.
function g2e_demarrer_dans_la_plateforme(langue, session, argument) {
  session.langue = langue;
  g2e_etat.contexte = session.contexte;
  g2e_table(langue).then(function (table) {
    g2e_etat.traductions = table;
    g2e_ecrire_config(session);
    g2e_ecrire_cle(session.cle);
    g2e_ecrire_session(session, table);
    g2e_lancer(argument);
  });
}

// Un texte de la page dans la langue du joueur (les messages de la page sont dans la même table que ceux du jeu).
function g2e_t(texte) {
  return g2e_etat.traductions[texte] || texte;
}

// Ce que la plateforme donne au départ : la langue, la salle du match (serveur g2e-hypersomnia), sinon rien.
function g2e_au_depart(donnees) {
  var langue = (donnees && donnees.langue) || G2E_LANGUE_DEFAUT;
  var salle = donnees && donnees.salle;
  if (!salle) return g2e_demarrer_dans_la_plateforme(langue, { contexte: "entrainement" }, "/tutorial");
  var listeServeurs = salle.serveur + "/server_list";
  g2e_table(langue).then(function (table) { g2e_etat.traductions = table; });
  g2e_message(g2e_t("Preparing the match..."));
  var lire = function () {
    fetch(salle.serveur + "/salles/" + salle.code + "/acces?jeton=" + encodeURIComponent(salle.jeton), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(function (a) {
        if (a.etat === "entrainement") {
          return g2e_demarrer_dans_la_plateforme(langue, { contexte: "entrainement", pseudo: a.pseudo, listeServeurs: listeServeurs }, "/tutorial");
        }
        if (a.etat === "preparation") {
          g2e_message(g2e_t("Your match server is starting near you... a few seconds."));
          return setTimeout(lire, 3000);
        }
        if (a.etat === "pret") {
          var adresse = String(a.lien || "").split("/game/")[1];
          if (!adresse) return g2e_message(g2e_t("The match is no longer available."));
          var session = { contexte: "defi", pseudo: a.pseudo, motDePasse: a.motDePasse, listeServeurs: listeServeurs, signalisation: a.signalisation, cle: a.cle };
          return g2e_demarrer_dans_la_plateforme(langue, session, "/game/" + adresse);
        }
        g2e_message(a.message || g2e_t("The match is no longer available."));
      })
      .catch(function () {
        g2e_message(g2e_t("Connecting to the match server... trying again in a moment."));
        setTimeout(lire, 4000);
      });
  };
  lire();
}

// Ce que le moteur signale (g2e::evenement dans src/game2earn/g2e.h).
function g2e_evenement(code) {
  if (code === 1) {
    // Le portail de fin du tutoriel : l'entraînement est terminé.
    console.log("Game2Earn : entraînement terminé");
    if (g2e_etat.sdk && g2e_etat.sdk.integre) g2e_etat.sdk.fin(0);
  } else if (code === 2) {
    // Le joueur a quitté le serveur du match : le résultat arrive par le serveur, à la fin du match.
    console.log("Game2Earn : serveur du match quitté");
    g2e_message(g2e_t("You left the match server. The result will appear on Game2Earn at the end of the match."));
  }
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
