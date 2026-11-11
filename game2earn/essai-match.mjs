// Game2Earn : un match de bout en bout, sans Edgegap ni hypersomnia.io.
//
// node essai-match.mjs preparer
//   Crée les clés de compte des deux places (comme le Worker g2e-hypersomnia) et écrit essai.env, les variables du
//   serveur du match : un tournoi à deux, chaque place liée à son compte, un mot de passe.
// node essai-match.mjs <dossier du client web> <adresse ws/wss de la mise en relation>
//   Le serveur du match (notre image) tourne déjà avec essai.env. On sert le client comme la plateforme (dans un cadre),
//   avec un faux Worker qui donne l'accès à la place 1 ; Chrome reçoit « demarrer » et doit entrer dans le match tout
//   seul : pseudo, mot de passe, clé de compte et mise en relation donnés par la page, rien à taper.
import { createServer } from "node:http"
import { generateKeyPairSync } from "node:crypto"
import { createReadStream, readFileSync, statSync, writeFileSync } from "node:fs"
import { extname, join, normalize } from "node:path"

const cle = () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519")
    const graine = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32).toString("hex")
    const publique = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex")
    return { cle: `hypersomnia-key-v1:${graine}`, compte: `0x${publique}` }
}

if (process.argv[2] === "preparer") {
  const places = [{ pseudo: "Testeur_G2E", ...cle() }, { pseudo: "Adversaire", ...cle() }]
  writeFileSync("essai-places.json", JSON.stringify(places))
  writeFileSync(
    "essai.env",
    [
      "HYPERSOMNIA_TOURNAMENT_TEAM_SIZE=1",
      `HYPERSOMNIA_TOURNAMENT_TEAMS=${places.map((p) => `${p.pseudo}=${p.compte}`).join("; ")}`,
      "HYPERSOMNIA_TOURNAMENT_MAPS=de_cyberaqua",
      "HYPERSOMNIA_TOURNAMENT_NAME=Game2Earn essai",
      "HYPERSOMNIA_TOURNAMENT_ROUND_1_MAX_WAIT=10",
      "HYPERSOMNIA_TOURNAMENT_PAGE=off",
      "HYPERSOMNIA_PASSWORD=essai",
      "HYPERSOMNIA_SERVER_NAME=Game2Earn essai",
      "HYPERSOMNIA_DAILY_UPDATE=off",
    ].join("\n") + "\n"
  )
  console.log("Places :", places.map((p) => `${p.pseudo}=${p.compte.slice(0, 10)}...`).join(", "))
  process.exit(0)
}

const { default: puppeteer } = await import("puppeteer-core")
const [dossier, signalisation] = process.argv.slice(2)
if (!dossier || !signalisation) throw new Error("Usage : node essai-match.mjs <client> <ws://hôte:port>")
const places = JSON.parse(readFileSync("essai-places.json", "utf8"))

const BANC = `<!doctype html><meta charset="utf-8"><title>Banc Game2Earn</title>
<style>body{margin:0;background:#111}iframe{width:100vw;height:100vh;border:0}</style>
<iframe id="f" src="index.html" sandbox="allow-scripts allow-same-origin allow-pointer-lock"></iframe>
<script>
const f = document.getElementById("f")
window.journal = []
window.addEventListener("message", (e) => { if (e.source === f.contentWindow) window.journal.push(e.data) })
window.demarrer = () => f.contentWindow.postMessage({ source: "g2e-plateforme", type: "demarrer", graine: 7, son: false, niveau: 3, langue: "fr",
  salle: { serveur: location.origin, code: "essai00000", place: 0, jeton: "0123456789abcdef0123456789abcdef", pause: false } }, "*")
</script>`

// L'accès que le faux Worker donne à la page : celui de la place 1, puis celui d'un imposteur.
const acces = (pseudo, cle) => ({ etat: "pret", lien: "https://jeu.example/game/127.0.0.1:8412", signalisation, pseudo, motDePasse: "essai", cle })
let ACCES = acces(places[0].pseudo, places[0].cle)

// Le SDK de la plateforme, réduit au protocole (Jeux/sdk/g2e-sdk.js de Game2Earn) : la release n'a pas le sien.
const SDK = `const integre = window.parent !== window
const ecouteurs = { demarrer: [] }
const envoyer = (m) => integre && window.parent.postMessage({ source: "g2e-jeu", ...m }, "*")
window.addEventListener("message", (e) => {
  if (e.source !== window.parent || !e.data || e.data.source !== "g2e-plateforme") return
  for (const f of ecouteurs[e.data.type] ?? []) f(e.data)
})
export const g2e = { integre, pret: () => envoyer({ type: "pret" }), score: (n) => envoyer({ type: "score", score: n }),
  fin: (n) => envoyer({ type: "fin", score: n }), surDemarrer: (f) => ecouteurs.demarrer.push(f) }`

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".data": "application/octet-stream", ".ico": "image/x-icon" }
createServer((req, res) => {
  const chemin = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]))
  if (chemin === "/banc.html" || chemin === "/") return res.writeHead(200, { "content-type": TYPES[".html"] }).end(BANC)
  if (chemin.startsWith("/salles/")) return res.writeHead(200, { "content-type": TYPES[".json"] }).end(JSON.stringify(ACCES))
  if (chemin === "/g2e-sdk.js") return res.writeHead(200, { "content-type": TYPES[".js"] }).end(SDK)
  if (chemin === "/server_list") return res.writeHead(200, { "content-type": "application/octet-stream" }).end()
  const fichier = join(dossier, chemin === "/index.html" ? "Hypersomnia.html" : chemin)
  try {
    const taille = statSync(fichier).size
    res.writeHead(200, { "content-type": TYPES[extname(fichier)] ?? "application/octet-stream", "content-length": taille })
    createReadStream(fichier).pipe(res)
  } catch {
    res.writeHead(404).end()
  }
}).listen(8765)

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const navigateur = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  headless: true,
  protocolTimeout: 1_800_000,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--window-size=1280,720"],
})
const t0 = Date.now()
const temps = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s`

// Un joueur ouvre la page du jeu, reçoit « demarrer » et entre seul dans le match. Rend s'il est entré, et s'il a été
// refusé ou sorti.
async function jouer(nom, capture) {
  const page = await navigateur.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  let entre = false
  let echec = ""
  page.on("console", (m) => {
    const t = m.text()
    if (t.startsWith("set_status: Downloading data")) return
    console.log(temps(), `[${nom}]`, t.slice(0, 240))
    if (t.includes("Sent initial client configuration to the server")) entre = true
    if (/hypersomnia\.io/.test(t)) console.log(temps(), "!!! appel à hypersomnia.io :", t.slice(0, 200))
    if (/Wrong password|password is incorrect|Disconnected|Connection failed|kicked|wrong match|not on the roster|taken/i.test(t)) echec = echec || t.slice(0, 200)
  })
  page.on("pageerror", (e) => console.log(temps(), "[erreur page]", String(e.stack || e).slice(0, 3000)))
  page.on("request", (r) => {
    if (/hypersomnia\.io/.test(r.url())) console.log(temps(), "!!! requête vers hypersomnia.io :", r.url())
  })

  await page.goto("http://localhost:8765/banc.html", { waitUntil: "domcontentloaded" })

  for (let i = 0; i < 600; i++) {
    await attendre(1000)
    const j = await page.evaluate(() => window.journal.map((m) => m.type))
    if (j.includes("pret")) break
  }
  console.log(temps(), "« pret » reçu, « demarrer » envoyé")
  await page.evaluate(() => window.demarrer())

  for (let i = 0; i < 600 && !entre && !echec; i++) await attendre(1000)
  // 30 secondes dans le match : le serveur vérifie le compte de la place juste après l'entrée.
  if (entre) for (let i = 0; i < 30 && !echec; i++) await attendre(1000)
  await page.screenshot({ path: capture })
  await page.close()
  return { entre, echec }
}

const vrai = await jouer("joueur", "essai-match.png")
if (!vrai.entre || vrai.echec) {
  await navigateur.close()
  console.log(`ÉCHEC : le joueur n'est pas entré dans le match, ou en a été sorti. ${vrai.echec}`)
  process.exit(1)
}
console.log(temps(), "RÉUSSI : le joueur est entré dans le match par notre mise en relation.")

// Essai négatif : un imposteur prend le pseudo de l'adversaire, avec une autre clé que celle de sa place. Le serveur
// doit le sortir (« Connected to a wrong match »).
ACCES = acces(places[1].pseudo, cle().cle)
const faux = await jouer("imposteur", "essai-imposteur.png")
await navigateur.close()
if (faux.entre && !faux.echec) {
  console.log("ÉCHEC : un joueur sans la clé de la place est resté dans le match.")
  process.exit(1)
}
console.log(temps(), `RÉUSSI : le joueur sans la bonne clé n'a pas pris la place (${faux.echec || "pas entré"}).`)
process.exit(0)
