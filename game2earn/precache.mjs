// Game2Earn : génère le cache du jeu (cartes néon, etc.) une fois, à la compilation, pour que les joueurs ne le
// calculent pas au premier lancement (la page ne répondait plus pendant ce calcul).
//
// node precache.mjs <dossier du client web>
// Lance le client dans Chrome sans écran, attend que /user/cache ne bouge plus, et l'écrit dans g2e-cache.bin
// (format : voir cmake/web/assets/g2e-cache.js).
import { createServer } from "node:http"
import { createReadStream, statSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { extname, join, normalize } from "node:path"
import puppeteer from "puppeteer-core"

const dossier = process.argv[2]
if (!dossier) throw new Error("Usage : node precache.mjs <dossier du client web>")

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".data": "application/octet-stream", ".ico": "image/x-icon" }
const serveur = createServer((req, res) => {
  const chemin = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]))
  const fichier = join(dossier, chemin === "/" ? "Hypersomnia.html" : chemin)
  try {
    const taille = statSync(fichier).size
    res.writeHead(200, { "content-type": TYPES[extname(fichier)] ?? "application/octet-stream", "content-length": taille })
    createReadStream(fichier).pipe(res)
  } catch {
    res.writeHead(404).end()
  }
}).listen(8765)

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))
const minutes = (t0) => ((Date.now() - t0) / 60000).toFixed(1)

const navigateur = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  headless: true,
  protocolTimeout: 3_600_000,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--window-size=1280,720"],
})
const page = await navigateur.newPage()
await page.setViewport({ width: 1280, height: 720 })
page.on("console", (m) => {
  const t = m.text()
  if (!t.startsWith("set_status: Downloading data")) console.log("[jeu]", t.slice(0, 200))
})
page.on("pageerror", (e) => console.log("[erreur page]", String(e).slice(0, 300)))

const t0 = Date.now()
await page.goto("http://localhost:8765/Hypersomnia.html", { waitUntil: "domcontentloaded" })

// Le cache est prêt quand son contenu ne bouge plus pendant 2 minutes (et après 3 minutes au moins).
const etatCache = () =>
  page.evaluate(() => {
    try {
      let n = 0
      let octets = 0
      const parcourir = (d) => {
        for (const e of FS.readdir(d)) {
          if (e === "." || e === "..") continue
          const p = `${d}/${e}`
          const s = FS.stat(p)
          if (FS.isDir(s.mode)) parcourir(p)
          else {
            n++
            octets += s.size
          }
        }
      }
      parcourir("/user/cache")
      return `${n}:${octets}`
    } catch {
      return "0:0"
    }
  })

let precedent = ""
let stableDepuis = Date.now()
const limite = Date.now() + 40 * 60_000
while (Date.now() < limite) {
  await attendre(20_000)
  const etat = await etatCache()
  console.log(`${minutes(t0)} min : cache ${etat} (fichiers:octets)`)
  if (etat !== precedent) {
    precedent = etat
    stableDepuis = Date.now()
  } else if (etat !== "0:0" && Date.now() - stableDepuis >= 120_000 && Date.now() - t0 >= 180_000) break
}

const liste = await page.evaluate(() => {
  const trouve = []
  const parcourir = (d) => {
    for (const e of FS.readdir(d)) {
      if (e === "." || e === "..") continue
      const p = `${d}/${e}`
      if (FS.isDir(FS.stat(p).mode)) parcourir(p)
      else trouve.push(p.slice("/user/cache/".length))
    }
  }
  parcourir("/user/cache")
  return trouve.sort()
})
if (!liste.length) throw new Error("Aucun fichier dans /user/cache : rien à livrer.")

const fichiers = []
for (const p of liste) {
  const b64 = await page.evaluate((chemin) => {
    const octets = FS.readFile(`/user/cache/${chemin}`)
    let s = ""
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000))
    return btoa(s)
  }, p)
  fichiers.push({ p, donnees: Buffer.from(b64, "base64") })
}

const empreinte = createHash("sha256")
for (const f of fichiers) empreinte.update(f.p).update(f.donnees)
const entete = Buffer.from(JSON.stringify({ version: empreinte.digest("hex").slice(0, 16), fichiers: fichiers.map((f) => ({ p: f.p, n: f.donnees.length })) }))
const longueur = Buffer.alloc(4)
longueur.writeUInt32LE(entete.length)
const sortie = join(dossier, "g2e-cache.bin")
writeFileSync(sortie, Buffer.concat([longueur, entete, ...fichiers.map((f) => f.donnees)]))
console.log(`g2e-cache.bin : ${fichiers.length} fichiers, ${(statSync(sortie).size / 1048576).toFixed(1)} Mo, en ${minutes(t0)} min`)
for (const f of fichiers.slice(0, 15)) console.log("  ", f.p, f.donnees.length)

await navigateur.close()
serveur.close()
