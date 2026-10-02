// Aperçu PNG de diagrammes (pour vérifier un brouillon sans ouvrir l'éditeur)
// Usage : node outils/apercu-diagramme.js <fichier.js exportant { ID: diagramme }> [ID ...]
// Écrit /tmp/apercu-diagrammes/<ID>.png avec Chrome sans interface.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { dessinerDiagramme, repere } = require("./diagrammes.js");

const [fichier, ...ids] = process.argv.slice(2);
const module_ = require(path.resolve(fichier));
const diagrammes = module_.DIAGRAMMES || module_;
const sortie = "/tmp/apercu-diagrammes";
fs.mkdirSync(sortie, { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

for (const id of ids.length ? ids : Object.keys(diagrammes)) {
  const d = diagrammes[id];
  if (!d) { console.error(`✗ ${id} : introuvable`); continue; }
  // Situations de système (M11_…, M15_…) : X = notre équipe, O = l'adversaire
  const noms = /^M1[15]_/.test(id) ? { X: "Notre équipe", O: "Adversaire" } : undefined;
  const svg = dessinerDiagramme(d, { titre: id, noms });
  const r = repere(d.vue);
  const fsvg = path.join(sortie, `${id}.svg`), fpng = path.join(sortie, `${id}.png`);
  fs.writeFileSync(fsvg, svg);
  execFileSync(chrome, ["--headless", "--disable-gpu", "--hide-scrollbars", `--screenshot=${fpng}`, `--window-size=${Math.ceil(r.largeur)},${Math.ceil(r.hauteurGlace + 36)}`, `file://${fsvg}`], { stdio: "ignore" });
  console.log(`✓ ${fpng}`);
}
