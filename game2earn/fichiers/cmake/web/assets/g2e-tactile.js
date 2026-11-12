// Game2Earn : jouer à Hypersomnia au doigt (téléphone, tablette) et à la manette.
//
// Tactile (seulement sur un écran tactile, et seulement en pleine partie : dans un menu, le doigt touche le jeu) :
//   - moitié gauche : le joystick apparaît sous le doigt qui s'y pose, et suit son glissement (déplacement) ;
//   - moitié droite : glisser le doigt vise ; le gros bouton tire (et vise aussi si le doigt glisse dessus) ;
//   - boutons : recharger, esquive, interagir (désamorcer, porte), arme précédente, acheter, bombe, scores, pause.
// Manette (API Gamepad, disposition standard) : stick gauche déplacement, stick droit visée, gâchettes tir et tir
// secondaire, A esquive, X recharger, B interagir, Y arme précédente, RB acheter, LB bombe, Start pause, Select scores.
//
// Le moteur reçoit les commandes comme le clavier et la souris (correctif 0008, src/augs/window_framework/window_sdl2.cpp) :
// Module._g2e_touche(numero, appuyee), Module._g2e_viser(dx, dy) ; Module._g2e_en_jeu() dit s'il est en pleine partie.

var G2E_TOUCHES = { haut: 0, gauche: 1, bas: 2, droite: 3, tir: 4, tir2: 5, recharger: 6, esquive: 7, interagir: 8, arme: 9, acheter: 10, bombe: 11, pause: 12, scores: 14 };

var g2e_tactile = {
  module: null,
  enJeu: false,
  // Une touche n'est envoyée qu'à son changement ; chaque source (doigt, bouton, manette) tient ses propres touches.
  tenues: {},
  ecranTactile: false,
};

function g2e_touche(nom, source, appuyee) {
  var m = g2e_tactile.module;
  if (!m || typeof m._g2e_touche !== "function") return;
  var numero = G2E_TOUCHES[nom];
  var cle = nom;
  var sources = g2e_tactile.tenues[cle] || (g2e_tactile.tenues[cle] = {});
  var avant = Object.keys(sources).length > 0;
  if (appuyee) sources[source] = true;
  else delete sources[source];
  var apres = Object.keys(sources).length > 0;
  if (avant !== apres) m._g2e_touche(numero, apres ? 1 : 0);
}

function g2e_tout_relacher(prefixe) {
  Object.keys(g2e_tactile.tenues).forEach(function (nom) {
    Object.keys(g2e_tactile.tenues[nom]).forEach(function (source) {
      if (!prefixe || source.indexOf(prefixe) === 0) g2e_touche(nom, source, false);
    });
  });
}

// La visée : en pixels du canvas (qui peut être plus fin que la page), un reste fractionnaire gardé pour la suite.
var g2e_reste = { x: 0, y: 0 };
function g2e_viser(dx, dy) {
  var m = g2e_tactile.module;
  if (!m || typeof m._g2e_viser !== "function") return;
  g2e_reste.x += dx;
  g2e_reste.y += dy;
  var x = Math.trunc(g2e_reste.x);
  var y = Math.trunc(g2e_reste.y);
  if (x === 0 && y === 0) return;
  g2e_reste.x -= x;
  g2e_reste.y -= y;
  m._g2e_viser(x, y);
}

function g2e_echelle() {
  var c = document.getElementById("canvas");
  return c && c.clientWidth ? c.width / c.clientWidth : 1;
}

// --- Interface tactile -------------------------------------------------------------------------------------------

var G2E_ICONES = {
  tir: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  recharger: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  esquive: '<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>',
  interagir: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',
  arme: '<path d="M4 9h11l3-3h2v6h-6l-2 3H9l-1 4H5l1-4H4z"/>',
  acheter: '<path d="M4 5h2l2 11h10l2-8H7"/><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>',
  bombe: '<circle cx="11" cy="14" r="6"/><path d="M15 9l3-3M17 4l1 1M20 5l-1 1"/>',
  scores: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};

function g2e_icone(nom) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + G2E_ICONES[nom] + "</svg>";
}

function g2e_style() {
  var s = document.createElement("style");
  s.textContent = [
    "#g2e-tactile{position:fixed;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;display:none}",
    "#g2e-tactile.actif{display:block}",
    "#g2e-tactile .zone{position:absolute;top:0;bottom:0}",
    "#g2e-tactile .gauche{left:0;width:45%}",
    "#g2e-tactile .droite{right:0;width:55%}",
    // Le joystick : invisible au repos, il naît sous le doigt.
    "#g2e-joy{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .12s;",
    "background:radial-gradient(circle,rgba(255,255,255,.10) 0,rgba(255,255,255,.04) 62%,rgba(255,255,255,0) 70%);border:2px solid rgba(255,255,255,.28);box-shadow:0 0 18px rgba(0,0,0,.35)}",
    "#g2e-joy.vu{opacity:1}",
    "#g2e-joy i{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.42);",
    "border:2px solid rgba(255,255,255,.7);box-shadow:0 2px 10px rgba(0,0,0,.4);will-change:transform}",
    "#g2e-tactile button{position:absolute;display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;color:#fff;",
    "background:rgba(10,14,20,.38);border:2px solid rgba(255,255,255,.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);",
    "touch-action:none;outline:none;-webkit-tap-highlight-color:transparent;transition:transform .06s,background .06s}",
    "#g2e-tactile button svg{width:46%;height:46%}",
    "#g2e-tactile button.appui{transform:scale(.92);background:rgba(255,255,255,.28)}",
    // Le gros bouton de tir et l'arc de boutons autour de lui : placés par g2e_placer(), selon la taille de l'écran.
    "#g2e-tactile .tir{border-color:rgba(255,120,110,.75);background:rgba(120,20,20,.35)}",
    // En haut à droite, plus petits : acheter, bombe, scores, pause.
    "#g2e-tactile .h{width:min(9.5vh,46px);height:min(9.5vh,46px);top:max(3vh,env(safe-area-inset-top))}",
    "#g2e-tactile .pause{right:max(3vw,env(safe-area-inset-right))}",
    "#g2e-tactile .scores{right:calc(max(3vw,env(safe-area-inset-right)) + min(11.5vh,56px))}",
    "#g2e-tactile .acheter{right:calc(max(3vw,env(safe-area-inset-right)) + 2 * min(11.5vh,56px))}",
    "#g2e-tactile .bombe{right:calc(max(3vw,env(safe-area-inset-right)) + 3 * min(11.5vh,56px))}",
  ].join("");
  document.head.appendChild(s);
}

// Le bouton de tir sous le pouce droit, au-dessus des barres de vie, d'armure et de munitions du jeu (en bas à droite,
// environ le quart inférieur de l'écran) ; les autres en arc autour de lui, vers le centre de l'écran.
function g2e_placer(racine) {
  var L = window.innerWidth;
  var H = window.innerHeight;
  var tir = Math.round(Math.min(H * 0.2, 96));
  var petit = Math.round(Math.min(H * 0.13, 60));
  var cx = L - Math.max(L * 0.05, 18) - tir / 2;
  var cy = H - H * 0.26 - tir / 2;
  var poser = function (el, x, y, taille) {
    el.style.width = el.style.height = taille + "px";
    el.style.left = Math.round(x - taille / 2) + "px";
    el.style.top = Math.round(y - taille / 2) + "px";
  };
  poser(racine.querySelector(".tir"), cx, cy, tir);
  var r = tir / 2 + petit / 2 + Math.max(10, H * 0.025);
  // Angles en degrés (0 : à droite, 90 : en haut) : recharger en bas à gauche, arme à gauche, esquive, interagir en haut.
  [["recharger", 212], ["arme", 172], ["esquive", 132], ["interagir", 92]].forEach(function (b) {
    var a = (b[1] * Math.PI) / 180;
    poser(racine.querySelector("." + b[0]), cx + Math.cos(a) * r, cy - Math.sin(a) * r, petit);
  });
}

function g2e_creer_interface() {
  g2e_style();
  var racine = document.createElement("div");
  racine.id = "g2e-tactile";
  racine.innerHTML =
    '<div class="zone gauche"></div><div class="zone droite"></div><div id="g2e-joy"><i></i></div>' +
    [
      ["tir", "tir", "Tirer"],
      ["recharger", "b recharger", "Recharger"],
      ["esquive", "b esquive", "Esquive"],
      ["interagir", "b interagir", "Interagir"],
      ["arme", "b arme", "Arme précédente"],
      ["acheter", "h acheter", "Acheter"],
      ["bombe", "h bombe", "Bombe"],
      ["scores", "h scores", "Scores"],
      ["pause", "h pause", "Pause"],
    ]
      .map(function (b) {
        return '<button type="button" data-touche="' + b[0] + '" class="' + b[1] + '" aria-label="' + b[2] + '">' + g2e_icone(b[0]) + "</button>";
      })
      .join("");
  document.body.appendChild(racine);
  g2e_placer(racine);
  window.addEventListener("resize", function () { g2e_placer(racine); });

  var joy = racine.querySelector("#g2e-joy");
  var bouton = joy.querySelector("i");
  var RAYON = 52;
  var doigts = {}; // identifiant du doigt -> { role, x, y, ... }

  function deplacement(d, x, y) {
    var dx = x - d.x0;
    var dy = y - d.y0;
    var l = Math.hypot(dx, dy);
    // Le joystick suit un doigt qui va trop loin : il reste sous le pouce.
    if (l > RAYON * 1.6) {
      var k = (l - RAYON * 1.6) / l;
      d.x0 += dx * k;
      d.y0 += dy * k;
      joy.style.left = d.x0 + "px";
      joy.style.top = d.y0 + "px";
      dx = x - d.x0;
      dy = y - d.y0;
      l = Math.hypot(dx, dy);
    }
    var v = Math.min(l, RAYON);
    var ux = l ? dx / l : 0;
    var uy = l ? dy / l : 0;
    bouton.style.transform = "translate(" + ux * v + "px," + uy * v + "px)";
    // Huit directions : une touche par axe au-delà d'un petit seuil (cos 67,5° pour les diagonales).
    var actif = l > RAYON * 0.22;
    g2e_touche("droite", "joy", actif && ux > 0.38);
    g2e_touche("gauche", "joy", actif && ux < -0.38);
    g2e_touche("bas", "joy", actif && uy > 0.38);
    g2e_touche("haut", "joy", actif && uy < -0.38);
  }

  function fin(id) {
    var d = doigts[id];
    if (!d) return;
    delete doigts[id];
    if (d.role === "joy") {
      g2e_tout_relacher("joy");
      joy.classList.remove("vu");
      bouton.style.transform = "";
    } else if (d.role === "bouton") {
      d.el.classList.remove("appui");
      g2e_touche(d.touche, "doigt" + id, false);
    }
  }

  // Les doigts, un par un (événements tactiles : ils marchent sur tous les téléphones, iPhone compris).
  function debut(t) {
    var el = t.target && t.target.closest ? t.target.closest("button") : null;
    if (el) {
      var touche = el.getAttribute("data-touche");
      el.classList.add("appui");
      doigts[t.identifier] = { role: "bouton", el: el, touche: touche, x: t.clientX, y: t.clientY };
      g2e_touche(touche, "doigt" + t.identifier, true);
      if (navigator.vibrate && touche !== "tir") navigator.vibrate(8);
      return;
    }
    var gauche = t.clientX < window.innerWidth * 0.45;
    var dejaJoy = Object.keys(doigts).some(function (k) { return doigts[k].role === "joy"; });
    if (gauche && !dejaJoy) {
      doigts[t.identifier] = { role: "joy", x0: t.clientX, y0: t.clientY };
      joy.style.left = t.clientX + "px";
      joy.style.top = t.clientY + "px";
      joy.classList.add("vu");
      bouton.style.transform = "";
    } else {
      doigts[t.identifier] = { role: "visee", x: t.clientX, y: t.clientY };
    }
  }

  function glisse(t) {
    var d = doigts[t.identifier];
    if (!d) return;
    if (d.role === "joy") {
      deplacement(d, t.clientX, t.clientY);
      return;
    }
    // Visée : en glissant dans la moitié droite, ou sur le bouton de tir (viser en tirant).
    if (d.role === "visee" || (d.role === "bouton" && d.touche === "tir")) {
      var s = g2e_echelle() * 1.35;
      g2e_viser((t.clientX - d.x) * s, (t.clientY - d.y) * s);
      d.x = t.clientX;
      d.y = t.clientY;
    }
  }

  function chaque(f) {
    return function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) f(e.changedTouches[i]);
    };
  }

  racine.addEventListener("touchstart", chaque(debut), { passive: false });
  racine.addEventListener("touchmove", chaque(glisse), { passive: false });
  racine.addEventListener("touchend", chaque(function (t) { fin(t.identifier); }), { passive: false });
  racine.addEventListener("touchcancel", chaque(function (t) { fin(t.identifier); }), { passive: false });

  // Pas de menu contextuel ni de loupe sur un appui long.
  racine.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  g2e_tactile.toutLacher = function () {
    Object.keys(doigts).forEach(fin);
    g2e_tout_relacher("doigt");
    g2e_tout_relacher("joy");
  };
  return racine;
}

// --- Manette ---------------------------------------------------------------------------------------------------------

var G2E_MANETTE = { 0: "esquive", 1: "interagir", 2: "recharger", 3: "arme", 4: "bombe", 5: "acheter", 6: "tir2", 7: "tir", 8: "scores", 9: "pause" };
var g2e_derniere_image = 0;

function g2e_manette(t) {
  var dt = g2e_derniere_image ? Math.min(0.05, (t - g2e_derniere_image) / 1000) : 0;
  g2e_derniere_image = t;
  var manettes = navigator.getGamepads ? navigator.getGamepads() : [];
  var p = null;
  for (var i = 0; i < manettes.length; i++) if (manettes[i] && manettes[i].connected) { p = manettes[i]; break; }
  if (!p) {
    g2e_tout_relacher("manette");
    return;
  }
  var enJeu = g2e_tactile.enJeu;
  var b = function (n) { return !!(p.buttons[n] && (p.buttons[n].pressed || p.buttons[n].value > 0.5)); };
  // Pause et scores marchent aussi dans les menus (Start ferme le menu Échap) ; le reste seulement en partie.
  Object.keys(G2E_MANETTE).forEach(function (n) {
    var nom = G2E_MANETTE[n];
    var toujours = nom === "pause" || nom === "scores";
    g2e_touche(nom, "manette", (enJeu || toujours) && b(Number(n)));
  });
  var ax = p.axes[0] || 0;
  var ay = p.axes[1] || 0;
  var zone = 0.35;
  g2e_touche("droite", "manette", enJeu && (ax > zone || b(15)));
  g2e_touche("gauche", "manette", enJeu && (ax < -zone || b(14)));
  g2e_touche("bas", "manette", enJeu && (ay > zone || b(13)));
  g2e_touche("haut", "manette", enJeu && (ay < -zone || b(12)));
  // Visée au stick droit : vitesse progressive (au carré), environ 1 400 pixels par seconde au maximum.
  var rx = p.axes[2] || 0;
  var ry = p.axes[3] || 0;
  var l = Math.hypot(rx, ry);
  if (enJeu && l > 0.18 && dt > 0) {
    var v = Math.pow((l - 0.18) / 0.82, 2) * 1400 * dt * g2e_echelle();
    g2e_viser((rx / l) * v, (ry / l) * v);
  }
}

// --- Démarrage -------------------------------------------------------------------------------------------------------

// Sur un écran tactile, l'image est calculée à 1,5 fois la taille de la page au plus (au lieu de 3 sur bien des
// téléphones) : bien plus fluide, et l'interface du jeu reste lisible.
function g2e_ecran_tactile() {
  return (window.matchMedia && window.matchMedia("(any-pointer: coarse)").matches) || "ontouchstart" in window;
}

function g2e_taille_canvas() {
  if (!g2e_tactile.ecranTactile) return;
  var canvas = document.getElementById("canvas");
  if (!canvas) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var r = canvas.getBoundingClientRect();
  var w = Math.round(r.width * dpr);
  var h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function g2e_tactile_demarrer(module) {
  if (g2e_tactile.module) return;
  g2e_tactile.module = module;
  g2e_tactile.ecranTactile = g2e_ecran_tactile();
  var racine = g2e_tactile.ecranTactile ? g2e_creer_interface() : null;
  window.addEventListener("resize", g2e_taille_canvas);
  g2e_taille_canvas();

  function image(t) {
    var enJeu = typeof module._g2e_en_jeu === "function" ? module._g2e_en_jeu() === 1 : false;
    if (enJeu !== g2e_tactile.enJeu) {
      g2e_tactile.enJeu = enJeu;
      if (racine) racine.classList.toggle("actif", enJeu);
      // Un menu s'ouvre : rien ne reste appuyé.
      if (!enJeu && g2e_tactile.toutLacher) g2e_tactile.toutLacher();
    }
    g2e_taille_canvas();
    g2e_manette(t);
    requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
}

// Un message pour le joueur : tourner le téléphone (le jeu se joue en paysage).
(function () {
  if (!g2e_ecran_tactile()) return;
  var verifier = function () {
    var portrait = window.innerHeight > window.innerWidth;
    var el = document.getElementById("g2e-tourner");
    if (portrait && !el) {
      el = document.createElement("div");
      el.id = "g2e-tourner";
      el.style.cssText = "position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);color:#e6f2e7;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px";
      var texte = typeof g2e_t === "function" ? g2e_t("Turn your phone to play.") : "";
      el.textContent = texte && texte !== "Turn your phone to play." ? texte : "Tourne ton téléphone pour jouer.";
      document.body.appendChild(el);
    } else if (!portrait && el) {
      el.remove();
    }
  };
  window.addEventListener("resize", verifier);
  window.addEventListener("orientationchange", verifier);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", verifier);
  else verifier();
})();
