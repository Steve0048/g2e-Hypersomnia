# Hypersomnia pour Game2Earn

Cette branche (`game2earn`) contient seulement ce que Game2Earn ajoute au jeu officiel de TeamHypersomnia (https://github.com/TeamHypersomnia/Hypersomnia, licence GNU AGPL-3.0) :

- `.github/workflows/web-game2earn.yml` : compile le client web (WebAssembly) à partir du code officiel, à une version figée (`UPSTREAM_SHA`), avec les changements ci-dessous ;
- `game2earn/fichiers/` : des fichiers ajoutés ou remplacés dans le code officiel (par exemple la page d'accueil Game2Earn) ;
- `game2earn/patches/` : des modifications du code officiel, appliquées dans l'ordre.

Le code source complet de ce qui est proposé aux joueurs de Game2Earn est donc : le code officiel à `UPSTREAM_SHA`, plus le contenu de cette branche.
