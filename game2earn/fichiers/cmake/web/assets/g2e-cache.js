// Game2Earn : le cache du jeu (cartes néon, etc.) préparé à la compilation et installé au premier lancement.
//
// Sans lui, le premier lancement calcule toutes les cartes néon sur l'unique fil de la page : elle ne répond plus
// pendant un long moment et le navigateur propose de « quitter ». Le cache est généré une fois sur GitHub Actions
// (game2earn/precache.mjs), livré dans g2e-cache.bin, et copié ici dans /user/cache, la sauvegarde du navigateur,
// avant que le jeu démarre. Une version différente du cache (nouveau build) le remplace.
//
// Format de g2e-cache.bin : 4 octets (longueur de l'en-tête, petit-boutiste), l'en-tête JSON
// { "version": "...", "fichiers": [{ "p": "chemin sous /user/cache", "n": taille }, ...] }, puis les fichiers à la suite.

function g2e_installer_cache(suite) {
  var marque = "/user/cache/.g2e-precache";
  var fini = false;
  var terminer = function () {
    if (fini) return;
    fini = true;
    suite();
  };

  var lireMarque = function () {
    try {
      return FS.analyzePath(marque).exists ? FS.readFile(marque, { encoding: "utf8" }) : "";
    } catch (e) {
      return "";
    }
  };

  var creerDossier = function (chemin) {
    var parties = chemin.split("/").filter(Boolean);
    var courant = "";
    for (var i = 0; i < parties.length; i++) {
      courant += "/" + parties[i];
      if (!FS.analyzePath(courant).exists) FS.mkdir(courant);
    }
  };

  if (Module.idbfs_failed || Module.idbfs_readonly) return terminer();

  // Le jeu attend au plus 60 s : sans réseau ou sans cache, il démarre quand même et calcule lui-même.
  setTimeout(terminer, 60000);

  fetch(new URL("g2e-cache.bin", document.baseURI), { cache: "force-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("g2e-cache.bin : " + r.status);
      return r.arrayBuffer();
    })
    .then(function (tampon) {
      if (fini) return;
      var vue = new DataView(tampon);
      var longueur = vue.getUint32(0, true);
      var entete = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 4, longueur)));
      if (lireMarque() === entete.version) {
        console.log("Game2Earn : cache déjà installé (" + entete.version + ")");
        return terminer();
      }
      var position = 4 + longueur;
      var debut = performance.now();
      for (var i = 0; i < entete.fichiers.length; i++) {
        var f = entete.fichiers[i];
        var chemin = "/user/cache/" + f.p;
        creerDossier(chemin.substring(0, chemin.lastIndexOf("/")));
        FS.writeFile(chemin, new Uint8Array(tampon, position, f.n));
        position += f.n;
      }
      creerDossier("/user/cache");
      FS.writeFile(marque, entete.version);
      console.log("Game2Earn : cache installé, " + entete.fichiers.length + " fichiers en " + Math.round(performance.now() - debut) + " ms");
      // Gardé dans la sauvegarde du navigateur pour les visites suivantes.
      FS.syncfs(false, function (err) {
        if (err) console.warn("Game2Earn : cache non enregistré", err);
      });
      terminer();
    })
    .catch(function (e) {
      console.warn("Game2Earn : pas de cache préparé, le jeu le calculera", e);
      terminer();
    });
}
