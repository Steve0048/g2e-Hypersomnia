// Game2Earn : jouer à Hypersomnia au doigt (téléphone, tablette) et à la manette.
//
// Tactile (seulement sur un écran tactile, et seulement en pleine partie : dans un menu, le doigt touche le jeu) :
//   - moitié gauche : le joystick apparaît sous le doigt qui s'y pose, et suit son glissement (déplacement ;
//     poussé jusqu'au bord : sprint) ;
//   - moitié droite : glisser le doigt vise ; le gros bouton tire (et vise aussi si le doigt glisse dessus) ;
//   - boutons : tir secondaire, recharger, esquive, interagir (désamorcer, porte), arme précédente ; en haut : bombe,
//     acheter, scores, pause ; « + » ouvre la panoplie (armes 1 et 2, couteaux, grenades, sorts, lâcher, ranger, laser,
//     silence) ; la roue dentée ouvre la disposition (déplacer et agrandir les boutons, joystick, visée, opacité),
//     gardée sur l'appareil.
// Manette (API Gamepad, disposition standard) : stick gauche déplacement (clic : sprint), stick droit visée, gâchettes tir et tir
// secondaire, A esquive, X recharger, B interagir, Y arme précédente, RB acheter, LB bombe, Start pause, Select scores.
//
// Le moteur reçoit les commandes comme le clavier et la souris (correctif 0008, src/augs/window_framework/window_sdl2.cpp) :
// Module._g2e_touche(numero, appuyee), Module._g2e_viser(dx, dy) ; Module._g2e_en_jeu() dit s'il est en pleine partie.

var G2E_TOUCHES = { haut: 0, gauche: 1, bas: 2, droite: 3, tir: 4, tir2: 5, recharger: 6, esquive: 7, interagir: 8, arme: 9, acheter: 10, bombe: 11, pause: 12, sprint: 13, scores: 14,
  arme1: 15, arme2: 16, grenade: 18, ped: 19, flash: 20, interf: 21, couteau: 22, couteaux: 23, sort1: 24, sort2: 25, sort3: 26,
  lacher: 27, ranger: 28, laser: 29, silence: 30 };

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
  tir2: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>',
  recharger: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  esquive: '<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>',
  interagir: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.5-1.7L8 15"/>',
  arme: '<path d="M4 9h11l3-3h2v6h-6l-2 3H9l-1 4H5l1-4H4z"/>',
  acheter: '<path d="M4 5h2l2 11h10l2-8H7"/><circle cx="9" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>',
  bombe: '<circle cx="11" cy="14" r="6"/><path d="M15 9l3-3M17 4l1 1M20 5l-1 1"/>',
  scores: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  // Le bouton de tir selon ce que tient le joueur : arme blanche, grenade, bombe.
  lame: '<path d="M4 20l9-9M13 11l6-7 1 1-7 6M4 20l2 0 0-2"/>',
  lancer: '<circle cx="17" cy="7" r="3"/><path d="M4 20c2-7 6-11 11-12"/><path d="M4 20l3-1"/>',
  poser: '<circle cx="12" cy="13" r="6"/><path d="M12 3v4M9 5l3 2 3-2M8 20h8"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};

// Les boutons : [identifiant, touches envoyées, groupe, contenu (icône ou texte), nom].
//   groupe « arc » : autour du bouton de tir ; « contexte » : un second arc, selon ce que porte le joueur ; « haut » :
//   la rangée du haut ; « panoplie » : ouverte par le bouton +, pour les actions rares.
var G2E_BOUTONS = [
  ["tir", ["tir"], "tir", "", "Tirer"],
  ["tir2", ["tir2"], "arc", "", "Tir secondaire, attaque forte"],
  // Selon la situation : une touche par type de grenade possédé, et le couteau à lancer.
  ["gren", ["grenade"], "contexte", "Grenade", "Grenade explosive"],
  ["flash", ["flash"], "contexte", "Flash", "Grenade aveuglante"],
  ["ped", ["ped"], "contexte", "PED", "Grenade PED"],
  ["interf", ["interf"], "contexte", "Interf.", "Grenade d'interférence"],
  ["couteau", ["couteau"], "contexte", "Couteau", "Lancer un couteau"],
  ["recharger", ["recharger"], "arc", "", "Recharger"],
  ["arme", ["arme"], "arc", "", "Arme précédente"],
  ["esquive", ["esquive"], "arc", "", "Esquive"],
  ["interagir", ["interagir"], "arc", "", "Interagir, désamorcer"],
  ["reglages", [], "haut", "", "Disposition des commandes"],
  ["plus", [], "haut", "", "Plus d'actions"],
  ["bombe", ["bombe"], "haut", "", "Bombe"],
  ["acheter", ["acheter"], "haut", "", "Acheter"],
  ["scores", ["scores"], "haut", "", "Scores"],
  ["pause", ["pause"], "haut", "", "Pause"],
  ["arme1", ["arme1"], "panoplie", "1", "Arme 1"],
  ["arme2", ["arme2"], "panoplie", "2", "Arme 2"],
  ["deux", ["arme1", "arme2"], "panoplie", "1+2", "Deux armes"],
  ["couteaux", ["couteaux"], "panoplie", "2 cout.", "Lancer deux couteaux"],
  ["sort1", ["sort1"], "panoplie", "Sort 1", "Sort 1"],
  ["sort2", ["sort2"], "panoplie", "Sort 2", "Sort 2"],
  ["sort3", ["sort3"], "panoplie", "Sort 3", "Sort 3"],
  ["lacher", ["lacher"], "panoplie", "Lâcher", "Lâcher l'arme"],
  ["ranger", ["ranger"], "panoplie", "Ranger", "Ranger l'arme"],
  ["laser", ["laser"], "panoplie", "Laser", "Laser de visée"],
  ["silence", ["silence"], "panoplie", "Silence", "Marcher en silence"],
];

function g2e_icone(nom) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + G2E_ICONES[nom] + "</svg>";
}

// Les réglages du joueur (positions, tailles, joystick, visée, transparence), gardés sur cet appareil.
var G2E_REGLAGES_CLE = "g2e-hypersomnia-commandes";
var G2E_REGLAGES_DEFAUT = { boutons: {}, joystick: 1, visee: 1, opacite: 1 };
function g2e_lire_reglages() {
  try {
    var r = JSON.parse(localStorage.getItem(G2E_REGLAGES_CLE) || "null");
    if (r && typeof r === "object") return { boutons: r.boutons || {}, joystick: +r.joystick || 1, visee: +r.visee || 1, opacite: +r.opacite || 1 };
  } catch (_) {}
  return JSON.parse(JSON.stringify(G2E_REGLAGES_DEFAUT));
}
function g2e_garder_reglages(r) {
  try { localStorage.setItem(G2E_REGLAGES_CLE, JSON.stringify(r)); } catch (_) {}
}

function g2e_style() {
  var s = document.createElement("style");
  s.textContent = [
    "#g2e-tactile{position:fixed;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;display:none;--op:1}",
    "#g2e-tactile.actif{display:block}",
    "#g2e-tactile .zone{position:absolute;top:0;bottom:0}",
    "#g2e-tactile .gauche{left:0;width:45%}",
    "#g2e-tactile .droite{right:0;width:55%}",
    // Le joystick : invisible au repos, il naît sous le doigt.
    "#g2e-joy{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;pointer-events:none;opacity:0;transition:opacity .12s;",
    "background:radial-gradient(circle,rgba(255,255,255,.10) 0,rgba(255,255,255,.04) 62%,rgba(255,255,255,0) 70%);border:2px solid rgba(255,255,255,.28);box-shadow:0 0 18px rgba(0,0,0,.35)}",
    "#g2e-joy.vu{opacity:1}",
    "#g2e-joy.sprint{border-color:rgba(255,190,90,.85);box-shadow:0 0 18px rgba(255,170,60,.45)}",
    "#g2e-joy i{position:absolute;left:50%;top:50%;width:42%;height:42%;margin:-21% 0 0 -21%;border-radius:50%;background:rgba(255,255,255,.42);",
    "border:2px solid rgba(255,255,255,.7);box-shadow:0 2px 10px rgba(0,0,0,.4);will-change:transform}",
    "#g2e-tactile button{position:absolute;display:flex;align-items:center;justify-content:center;padding:0;border-radius:50%;color:#fff;opacity:var(--op);",
    "background:rgba(10,14,20,.38);border:2px solid rgba(255,255,255,.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);",
    "font:600 12px/1.05 system-ui,sans-serif;text-align:center;letter-spacing:-.01em;text-shadow:0 1px 2px rgba(0,0,0,.6);",
    "touch-action:none;outline:none;-webkit-tap-highlight-color:transparent;transition:transform .06s,background .06s}",
    "#g2e-tactile button svg{width:46%;height:46%}",
    "#g2e-tactile button.appui{transform:scale(.92);background:rgba(255,255,255,.28)}",
    "#g2e-tactile .tir{border-color:rgba(255,120,110,.75);background:rgba(120,20,20,.35)}",
    // Selon la situation : un bouton inutile maintenant disparaît ; il réapparaît en douceur.
    "#g2e-tactile button.inutile{display:none}",
    "#g2e-tactile:not(.edition) button.surgit{animation:g2e-surgit .22s ease-out}",
    "@keyframes g2e-surgit{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:var(--op)}}",
    "#g2e-tactile .interagir.possible{border-color:#7cf5a0;box-shadow:0 0 14px rgba(124,245,160,.45)}",
    "#g2e-tactile [data-groupe=contexte]{font-size:11px}",
    "#g2e-tactile [data-groupe=panoplie]{display:none;border-radius:14px;background:rgba(10,14,20,.55)}",
    "#g2e-tactile.panoplie [data-groupe=panoplie],#g2e-tactile.edition [data-groupe=panoplie]{display:flex}",
    "#g2e-tactile.panoplie [data-id=plus]{background:rgba(255,255,255,.3)}",
    // Le mode disposition : les boutons se déplacent, la barre de réglages au milieu.
    "#g2e-tactile.edition button{opacity:1;border-style:dashed;animation:none}",
    "#g2e-tactile.edition button.inutile{display:flex}",
    "#g2e-tactile.edition button.choisi{border-color:#7cf5a0;border-style:solid;box-shadow:0 0 0 3px rgba(124,245,160,.35)}",
    "#g2e-edition{display:none;position:absolute;left:max(2vw,env(safe-area-inset-left));bottom:3vh;width:min(42vw,360px);max-height:72vh;overflow:auto;",
    "padding:12px 14px;border-radius:14px;background:rgba(8,12,18,.88);color:#e8f2ea;font:13px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);touch-action:auto}",
    "#g2e-tactile.edition #g2e-edition{display:block}",
    "#g2e-edition.droite{left:auto;right:max(2vw,env(safe-area-inset-right))}",
    "#g2e-edition h2{margin:0 0 4px;font-size:15px;cursor:pointer}",
    "#g2e-edition h2 small{font-weight:400;color:#a9c0b0;font-size:11px}",
    "#g2e-edition p{margin:0 0 8px;color:#a9c0b0;font-size:12px}",
    "#g2e-edition label{display:flex;align-items:center;gap:10px;margin:6px 0}",
    "#g2e-edition label span{flex:0 0 42%}",
    "#g2e-edition input[type=range]{flex:1;accent-color:#7cf5a0}",
    "#g2e-edition .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}",
    "#g2e-edition .actions span{position:static;display:inline-block;padding:8px 14px;border-radius:9px;background:rgba(255,255,255,.12);font-weight:600}",
    "#g2e-edition .actions .ok{background:#2f9e5b;color:#fff}",
  ].join("");
  document.head.appendChild(s);
}

// Les places par défaut, selon la taille de l'écran : le bouton de tir sous le pouce droit, au-dessus des barres de vie,
// d'armure et de munitions du jeu (en bas à droite) ; l'arc autour de lui ; la rangée du haut à droite ; la panoplie en
// deux lignes au milieu, sous la rangée du haut.
function g2e_places_defaut(cachees) {
  var L = window.innerWidth;
  var H = window.innerHeight;
  var p = {};
  var tir = Math.round(Math.min(H * 0.2, 96));
  var petit = Math.round(Math.min(H * 0.13, 60));
  var cx = L - Math.max(L * 0.05, 18) - tir / 2;
  var cy = H - H * 0.26 - tir / 2;
  p.tir = { x: cx, y: cy, t: tir };
  var r = tir / 2 + petit / 2 + Math.max(10, H * 0.025);
  // Angles en degrés (0 : à droite, 90 : en haut).
  [["recharger", 212], ["arme", 172], ["esquive", 132], ["interagir", 92], ["tir2", 50]].forEach(function (b) {
    var a = (b[1] * Math.PI) / 180;
    p[b[0]] = { x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r, t: petit };
  });
  // Le second arc : grenades possédées et couteau, plus loin du pouce, vers le haut.
  var r2 = r + petit * 1.12;
  [["gren", 168], ["flash", 146], ["ped", 124], ["interf", 102], ["couteau", 80]].forEach(function (b) {
    var a = (b[1] * Math.PI) / 180;
    p[b[0]] = { x: cx + Math.cos(a) * r2, y: cy - Math.sin(a) * r2, t: Math.round(petit * 0.86) };
  });
  var h = Math.round(Math.min(H * 0.095, 46));
  var pas = Math.min(H * 0.115, 56);
  var droite = L - Math.max(L * 0.03, 12) - h / 2;
  var haut = Math.max(H * 0.03, 8) + h / 2;
  // La rangée du haut, de droite à gauche, sans trou quand Acheter ou Bombe ne servent pas.
  ["pause", "scores", "acheter", "bombe", "plus", "reglages"].filter(function (id) { return !(cachees && cachees[id]); }).forEach(function (id, i) {
    p[id] = { x: droite - i * pas, y: haut, t: h };
  });
  // La panoplie : ses seuls boutons utiles maintenant, rangés sans trou.
  var pano = G2E_BOUTONS.filter(function (b) { return b[2] === "panoplie" && !(cachees && cachees[b[0]]); });
  var c = Math.round(Math.min(H * 0.12, 56));
  var parLigne = Math.ceil(pano.length / 2);
  var x0 = L / 2 - ((parLigne - 1) * (c + 8)) / 2;
  var y0 = haut + h / 2 + 14 + c / 2;
  pano.forEach(function (b, i) {
    p[b[0]] = { x: x0 + (i % parLigne) * (c + 8), y: y0 + Math.floor(i / parLigne) * (c + 8), t: c };
  });
  return p;
}

function g2e_placer(racine, reglages) {
  var L = window.innerWidth;
  var H = window.innerHeight;
  var cachees = {};
  if (!racine.classList.contains("edition")) {
    Array.prototype.forEach.call(racine.querySelectorAll("button.inutile"), function (el) { cachees[el.getAttribute("data-id")] = true; });
  }
  var defaut = g2e_places_defaut(cachees);
  Array.prototype.forEach.call(racine.querySelectorAll("button[data-id]"), function (el) {
    var id = el.getAttribute("data-id");
    var d = defaut[id];
    if (!d) return;
    var o = reglages.boutons[id] || {};
    var taille = Math.round(d.t * (o.s || 1));
    var x = o.x != null ? o.x * L : d.x;
    var y = o.y != null ? o.y * H : d.y;
    // Toujours entier à l'écran, même après une rotation ou un autre téléphone.
    x = Math.min(Math.max(x, taille / 2), L - taille / 2);
    y = Math.min(Math.max(y, taille / 2), H - taille / 2);
    el.style.width = el.style.height = taille + "px";
    el.style.left = Math.round(x - taille / 2) + "px";
    el.style.top = Math.round(y - taille / 2) + "px";
    el.style.fontSize = Math.max(10, Math.round(taille * 0.22)) + "px";
  });
  racine.style.setProperty("--op", String(reglages.opacite));
}

function g2e_creer_interface() {
  g2e_style();
  var reglages = g2e_lire_reglages();
  var racine = document.createElement("div");
  racine.id = "g2e-tactile";
  racine.innerHTML =
    '<div class="zone gauche"></div><div class="zone droite"></div><div id="g2e-joy"><i></i></div>' +
    G2E_BOUTONS.map(function (b) {
      var contenu = G2E_ICONES[b[0]] ? g2e_icone(b[0]) : b[3];
      return '<button type="button" data-id="' + b[0] + '" data-groupe="' + b[2] + '" class="' + b[0] + '" aria-label="' + b[4] + '">' + contenu + "</button>";
    }).join("") +
    '<div id="g2e-edition"><h2 data-action="cote">Disposition des commandes <small>(toucher : changer de côté)</small></h2>' +
    "<p>Glisse un bouton pour le déplacer. Touche-le pour le choisir, puis règle sa taille.</p>" +
    '<label><span>Taille du bouton choisi</span><input type="range" data-reglage="taille" min="0.5" max="2" step="0.05" value="1"></label>' +
    '<label><span>Taille du joystick</span><input type="range" data-reglage="joystick" min="0.7" max="1.6" step="0.05"></label>' +
    '<label><span>Sensibilité de la visée</span><input type="range" data-reglage="visee" min="0.4" max="2.5" step="0.05"></label>' +
    '<label><span>Opacité des boutons</span><input type="range" data-reglage="opacite" min="0.3" max="1" step="0.05"></label>' +
    '<div class="actions"><span data-action="defaut">Par défaut</span><span data-action="fini" class="ok">Terminé</span></div></div>';
  document.body.appendChild(racine);

  var joy = racine.querySelector("#g2e-joy");
  var bouton = joy.querySelector("i");
  var panneau = racine.querySelector("#g2e-edition");
  var choisi = null;
  var RAYON = 52;

  function appliquer() {
    g2e_placer(racine, reglages);
    RAYON = 52 * reglages.joystick;
    var t = Math.round(132 * reglages.joystick);
    joy.style.width = joy.style.height = t + "px";
    joy.style.margin = -t / 2 + "px 0 0 " + -t / 2 + "px";
    panneau.querySelector('[data-reglage="joystick"]').value = reglages.joystick;
    panneau.querySelector('[data-reglage="visee"]').value = reglages.visee;
    panneau.querySelector('[data-reglage="opacite"]').value = reglages.opacite;
    var o = choisi && reglages.boutons[choisi.getAttribute("data-id")];
    panneau.querySelector('[data-reglage="taille"]').value = (o && o.s) || 1;
  }
  appliquer();
  window.addEventListener("resize", appliquer);

  // Les curseurs du mode disposition (événements ordinaires : le panneau laisse le doigt agir normalement).
  panneau.addEventListener("input", function (e) {
    var cle = e.target.getAttribute("data-reglage");
    var v = Number(e.target.value);
    if (cle === "taille") {
      if (!choisi) return;
      var id = choisi.getAttribute("data-id");
      reglages.boutons[id] = Object.assign({}, reglages.boutons[id], { s: v });
    } else {
      reglages[cle] = v;
    }
    appliquer();
    g2e_garder_reglages(reglages);
  });
  panneau.addEventListener("click", function (e) {
    var cible = e.target.closest ? e.target.closest("[data-action]") : null;
    var action = cible && cible.getAttribute("data-action");
    if (action === "defaut") {
      reglages = JSON.parse(JSON.stringify(G2E_REGLAGES_DEFAUT));
      g2e_garder_reglages(reglages);
      appliquer();
    } else if (action === "cote") {
      panneau.classList.toggle("droite");
    } else if (action === "fini") {
      racine.classList.remove("edition");
      if (choisi) choisi.classList.remove("choisi");
      choisi = null;
      appliquer();
    }
  });
  ["touchstart", "touchmove", "touchend"].forEach(function (t) {
    panneau.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
  });

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
    // Pousser le joystick jusqu'au bord : sprinter (l'anneau s'allume).
    var sprint = l >= RAYON * 0.96;
    joy.classList.toggle("sprint", sprint);
    g2e_touche("sprint", "joy", sprint);
  }

  function touches(el) {
    var id = el.getAttribute("data-id");
    for (var i = 0; i < G2E_BOUTONS.length; i++) if (G2E_BOUTONS[i][0] === id) return G2E_BOUTONS[i][1];
    return [];
  }

  function fin(id) {
    var d = doigts[id];
    if (!d) return;
    delete doigts[id];
    if (d.role === "joy") {
      g2e_tout_relacher("joy");
      joy.classList.remove("vu", "sprint");
      bouton.style.transform = "";
    } else if (d.role === "bouton") {
      d.el.classList.remove("appui");
      touches(d.el).forEach(function (t) { g2e_touche(t, "doigt" + id, false); });
    } else if (d.role === "deplacer") {
      g2e_garder_reglages(reglages);
    }
  }

  // Les doigts, un par un (événements tactiles : ils marchent sur tous les téléphones, iPhone compris).
  function debut(t) {
    var el = t.target && t.target.closest ? t.target.closest("button[data-id]") : null;
    var edition = racine.classList.contains("edition");
    if (el && !edition && el.classList.contains("inutile")) el = null;
    if (el && edition) {
      // Mode disposition : le bouton touché est choisi et suit le doigt.
      if (choisi) choisi.classList.remove("choisi");
      choisi = el;
      el.classList.add("choisi");
      var r = el.getBoundingClientRect();
      doigts[t.identifier] = { role: "deplacer", el: el, dx: r.left + r.width / 2 - t.clientX, dy: r.top + r.height / 2 - t.clientY };
      appliquer();
      return;
    }
    if (edition) return;
    if (el) {
      var id = el.getAttribute("data-id");
      if (id === "reglages") {
        g2e_tactile.toutLacher();
        racine.classList.add("edition");
        appliquer();
        return;
      }
      if (id === "plus") {
        racine.classList.toggle("panoplie");
        return;
      }
      el.classList.add("appui");
      doigts[t.identifier] = { role: "bouton", el: el, touche: id, x: t.clientX, y: t.clientY };
      touches(el).forEach(function (n) { g2e_touche(n, "doigt" + t.identifier, true); });
      if (navigator.vibrate && id !== "tir") navigator.vibrate(8);
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
    if (d.role === "deplacer") {
      var id = d.el.getAttribute("data-id");
      reglages.boutons[id] = Object.assign({}, reglages.boutons[id], {
        x: (t.clientX + d.dx) / window.innerWidth,
        y: (t.clientY + d.dy) / window.innerHeight,
      });
      g2e_placer(racine, reglages);
      return;
    }
    if (d.role === "joy") {
      deplacement(d, t.clientX, t.clientY);
      return;
    }
    // Visée : en glissant dans la moitié droite, ou sur le bouton de tir (viser en tirant).
    if (d.role === "visee" || (d.role === "bouton" && d.touche === "tir")) {
      var s = g2e_echelle() * 1.35 * reglages.visee;
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

  // Ce que le joueur peut faire maintenant (Module._g2e_commandes, bits) : seuls les boutons utiles restent, et le
  // bouton de tir prend l'icône de ce qu'il tient. Bit 1 absent (moteur sans relevé, autre écran) : tous les boutons.
  var dernier = -1;
  var boutonTir = racine.querySelector('[data-id="tir"]');
  g2e_tactile.contexte = function (bits) {
    if (bits === dernier) return;
    dernier = bits;
    var connu = (bits & 1) !== 0;
    var enMain = (bits >> 5) & 7;
    var grenades = (bits >> 8) & 15;
    var utile = {
      recharger: !connu || (bits & 16) !== 0,
      interagir: !connu || (bits & 2) !== 0,
      acheter: !connu || (bits & 4) !== 0,
      bombe: !connu || ((bits & 8) !== 0 && enMain !== 4),
      tir2: !connu || enMain === 1 || enMain === 2,
      arme: !connu || (bits & 8192) !== 0 || enMain === 0,
      gren: connu && (grenades & 1) !== 0,
      ped: connu && (grenades & 2) !== 0,
      flash: connu && (grenades & 4) !== 0,
      interf: connu && (grenades & 8) !== 0,
      couteau: connu && (bits & 4096) !== 0,
      arme1: !connu || (bits & 8192) !== 0,
      arme2: !connu || (bits & 8192) !== 0,
      deux: !connu || (bits & 8192) !== 0,
      couteaux: !connu || (bits & 4096) !== 0,
    };
    Object.keys(utile).forEach(function (id) {
      var el = racine.querySelector('[data-id="' + id + '"]');
      if (!el) return;
      var avant = !el.classList.contains("inutile");
      el.classList.toggle("inutile", !utile[id]);
      if (utile[id] && !avant) {
        el.classList.remove("surgit");
        void el.offsetWidth;
        el.classList.add("surgit");
      }
    });
    racine.querySelector('[data-id="interagir"]').classList.toggle("possible", connu && (bits & 2) !== 0);
    g2e_placer(racine, reglages);
    var icone = enMain === 2 ? "lame" : enMain === 3 ? "lancer" : enMain === 4 ? "poser" : "tir";
    if (boutonTir.getAttribute("data-icone") !== icone) {
      boutonTir.setAttribute("data-icone", icone);
      boutonTir.innerHTML = g2e_icone(icone);
      boutonTir.setAttribute("aria-label", { tir: "Tirer", lame: "Frapper", lancer: "Lancer", poser: "Poser la bombe" }[icone]);
    }
  };

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
  g2e_touche("sprint", "manette", enJeu && b(10));
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
    if (g2e_tactile.contexte) g2e_tactile.contexte(typeof module._g2e_commandes === "function" ? module._g2e_commandes() : 0);
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
