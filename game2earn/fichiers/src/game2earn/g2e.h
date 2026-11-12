#pragma once
/*
	Game2Earn : le jeu dans la plateforme Game2Earn (sa page, dans un cadre du site).

	Avant le démarrage du jeu, la page (cmake/web/assets/g2e-plateforme.js) écrit :
	  /g2e/session.txt    lignes « clé=valeur » : actif, contexte (entrainement, defi, tournoi), langue, mot_de_passe ;
	  /g2e/traduction.txt paires de lignes : le texte anglais du jeu, puis sa traduction (« \n » écrit « \\n »).

	Sans ces fichiers (jeu hors de la plateforme, serveur), rien ne change : actif() est faux et tr() rend le texte tel quel.
*/
#include <cstddef>
#include <fstream>
#include <functional>
#include <string>
#include <string_view>
#include <unordered_map>

#if PLATFORM_WEB
#include <emscripten.h>

/* Le crochet de traduction d'ImGui (patché dans imgui_draw.cpp : mesure et dessin du texte). */
extern bool (*GImGuiG2eTraduire)(const char** debut, const char** fin);
#endif

namespace g2e {
	struct hachage {
		using is_transparent = void;

		std::size_t operator()(const std::string_view s) const {
			return std::hash<std::string_view>{}(s);
		}
	};

	using table_type = std::unordered_map<std::string, std::string, hachage, std::equal_to<>>;

	struct etat_type {
		bool actif = false;
		std::string contexte;
		std::string langue = "en";
		std::string mot_de_passe;
		table_type traductions;
	};

	inline std::string lire_ligne(std::string s) {
		if (!s.empty() && s.back() == '\r') {
			s.pop_back();
		}

		std::string resultat;
		resultat.reserve(s.size());

		for (std::size_t i = 0; i < s.size(); ++i) {
			if (s[i] == '\\' && i + 1 < s.size()) {
				if (s[i + 1] == 'n') { resultat += '\n'; ++i; continue; }
				if (s[i + 1] == '\\') { resultat += '\\'; ++i; continue; }
			}

			resultat += s[i];
		}

		return resultat;
	}

	inline etat_type charger() {
		etat_type e;

		std::ifstream session("/g2e/session.txt");
		std::string ligne;

		while (std::getline(session, ligne)) {
			ligne = lire_ligne(ligne);

			const auto egal = ligne.find('=');

			if (egal == std::string::npos) {
				continue;
			}

			const auto cle = ligne.substr(0, egal);
			const auto valeur = ligne.substr(egal + 1);

			if (cle == "actif") e.actif = valeur == "1";
			else if (cle == "contexte") e.contexte = valeur;
			else if (cle == "langue") e.langue = valeur;
			else if (cle == "mot_de_passe") e.mot_de_passe = valeur;
		}

		if (e.actif) {
			std::ifstream traduction("/g2e/traduction.txt");
			std::string anglais;
			std::string traduit;

			while (std::getline(traduction, anglais) && std::getline(traduction, traduit)) {
				auto cle = lire_ligne(anglais);
				auto valeur = lire_ligne(traduit);

				if (!cle.empty() && !valeur.empty()) {
					e.traductions.emplace(std::move(cle), std::move(valeur));
				}
			}
		}

		return e;
	}

	inline const std::string* trouver(const std::string_view texte);

	inline etat_type& etat() {
		static etat_type e = []() {
			auto lu = charger();

#if PLATFORM_WEB
			if (!lu.traductions.empty()) {
				GImGuiG2eTraduire = [](const char** debut, const char** fin) {
					if (const auto t = trouver(std::string_view(*debut, static_cast<std::size_t>(*fin - *debut)))) {
						*debut = t->data();
						*fin = t->data() + t->size();
						return true;
					}

					return false;
				};
			}
#endif

			return lu;
		}();

		return e;
	}

	inline const std::string* trouver(const std::string_view texte) {
		const auto& t = etat().traductions;

		if (t.empty() || texte.empty()) {
			return nullptr;
		}

		const auto trouve = t.find(texte);
		return trouve == t.end() ? nullptr : std::addressof(trouve->second);
	}

	/* En pleine partie (pas de menu ni de fenêtre ouverte) : la page affiche alors les commandes tactiles. */
	inline bool& en_jeu() {
		static bool e = false;
		return e;
	}

	/*
		Ce que le joueur peut faire maintenant, relevé à chaque image par l'interface du mode de jeu
		(view/mode_gui/arena/arena_context_tip.h) : la page n'affiche que les commandes tactiles utiles.
		en_main : ce que tient la main principale (0 rien, 1 arme à feu, 2 arme blanche, 3 grenade, 4 bombe).
		grenades : 1 explosive, 2 PED, 4 aveuglante, 8 interférence.
	*/
	struct commandes_type {
		double le = 0.0;
		bool interagir = false;
		bool acheter = false;
		bool bombe = false;
		bool arme_a_feu = false;
		int en_main = 0;
		int grenades = 0;
		bool couteaux = false;
		int armes = 0;
	};

	inline commandes_type& commandes() {
		static commandes_type c;
		return c;
	}

	/* Le jeu tourne-t-il dans Game2Earn ? */
	inline bool actif() {
		return etat().actif;
	}

	inline bool entrainement() {
		return etat().contexte == "entrainement";
	}

	inline std::string tr(const std::string& texte) {
		if (const auto t = trouver(texte)) {
			return *t;
		}

		return texte;
	}

	/*
		Prévenir la page Game2Earn (fonction g2e_evenement de g2e-plateforme.js) :
		  1 : l'entraînement est terminé (le portail du menu principal, à la fin du tutoriel) ;
		  2 : le joueur a quitté le serveur du match (retour au menu demandé par le jeu).
	*/
	inline void evenement(const int code) {
#if PLATFORM_WEB
		EM_ASM({
			if (typeof g2e_evenement === "function") {
				g2e_evenement($0);
			}
		}, code);
#else
		(void)code;
#endif
	}
}
