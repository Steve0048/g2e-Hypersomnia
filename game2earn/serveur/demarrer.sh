#!/bin/sh
# Game2Earn : le serveur maître puis le serveur du match, dans le même conteneur.
set -eu
cd /home/hypersomniac

# Le serveur maître a son propre dossier (clés, journaux) et son propre dossier d'extraction, et aucune des
# variables HYPERSOMNIA_* du match. Il écoute la mise en relation (WebSocket, 8000) et les annonces (UDP 8430, local).
mkdir -p maitre/tmp
env -i HOME=/home/hypersomniac/maitre TMPDIR=/home/hypersomniac/maitre/tmp PATH="$PATH" \
  ./Hypersomnia-Headless.AppImage --appimage-extract-and-run --masterserver --no-update-on-launch &

# Réglages du serveur du match sans variable d'environnement : aucune carte demandée à hypersomnia.io (les cartes
# officielles sont dans l'image ; une autre carte se télécharge depuis le serveur du match lui-même).
mkdir -p .config/Hypersomnia/user/conf.d
cat > .config/Hypersomnia/user/conf.d/game2earn.json <<'JSON'
{
  "server": {
    "external_arena_files_provider": ""
  }
}
JSON

# Le port WebRTC (navigateurs) : avec le « 1:1 Port Mapping » d'Edgegap sur le port nommé « web », le port est tiré
# au hasard mais identique dedans et dehors ; Edgegap le donne dans ARBITRIUM_PORT_WEB_INTERNAL. Le serveur doit écouter
# sur ce port-là, sinon il annonce aux navigateurs un port (9000) que personne ne peut joindre de l'extérieur.
if [ -n "${ARBITRIUM_PORT_WEB_INTERNAL:-}" ]; then
  export HYPERSOMNIA_WEB_PORT="$ARBITRIUM_PORT_WEB_INTERNAL"
  echo "Game2Earn : port WebRTC $HYPERSOMNIA_WEB_PORT (Edgegap, 1:1)"
fi

# Le serveur du match (réglé par les variables HYPERSOMNIA_* données par Edgegap) ; il s'arrête avec le conteneur.
sleep 3
exec ./Hypersomnia-Headless.AppImage --appimage-extract-and-run --no-update-on-launch
