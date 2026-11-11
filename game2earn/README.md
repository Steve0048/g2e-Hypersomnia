# Hypersomnia pour Game2Earn

Cette branche (`game2earn`) contient seulement ce que Game2Earn ajoute au jeu officiel de TeamHypersomnia (https://github.com/TeamHypersomnia/Hypersomnia, licence GNU AGPL-3.0) :

- `.github/workflows/web-game2earn.yml` : compile le client web (WebAssembly) à partir du code officiel, à une version figée (`UPSTREAM_SHA`), avec les changements ci-dessous ;
- `game2earn/fichiers/` : des fichiers ajoutés ou remplacés dans le code officiel (par exemple la page d'accueil Game2Earn) ;
- `game2earn/patches/` : des modifications du code officiel, appliquées dans l'ordre.
- `game2earn/serveur/` et `.github/workflows/serveur-game2earn.yml` : l'image du serveur d'un match (serveur du match et serveur maître dans le même conteneur) ;
- `game2earn/essai-match.mjs` et `.github/workflows/essai-match-game2earn.yml` : un match de bout en bout sur la machine de GitHub. Le joueur doit entrer seul dans le match avec la clé de sa place ; un imposteur avec une autre clé doit être refusé.

Le code source complet de ce qui est proposé aux joueurs de Game2Earn est donc : le code officiel à `UPSTREAM_SHA`, plus le contenu de cette branche.
