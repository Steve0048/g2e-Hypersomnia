# Le serveur d'un match Game2Earn : le serveur officiel d'Hypersomnia et, dans le même conteneur, notre propre
# serveur maître (la mise en relation des joueurs dans le navigateur). Plus aucun appel à hypersomnia.io pendant un match.
#
#   8412/udp  le jeu (clients natifs) et la page des résultats du tournoi (tcp)
#   9000/udp  le jeu pour les navigateurs (WebRTC)
#   8000/tcp  la mise en relation des navigateurs (WebSocket ; Edgegap ajoute le TLS : wss://)
FROM ghcr.io/teamhypersomnia/hypersomnia-server:latest

USER root
COPY --chown=hypersomniac:hypersomniac demarrer.sh /home/hypersomniac/demarrer.sh
RUN chmod 755 /home/hypersomniac/demarrer.sh
USER hypersomniac

# Le serveur du match s'annonce à notre serveur maître, dans le conteneur ; pas de mise à jour pendant un match.
ENV HYPERSOMNIA_SERVER_LIST=127.0.0.1:8430
ENV HYPERSOMNIA_DAILY_UPDATE=off

EXPOSE 8412/udp
EXPOSE 8412/tcp
EXPOSE 9000/udp
EXPOSE 8000/tcp

CMD ["/home/hypersomniac/demarrer.sh"]
