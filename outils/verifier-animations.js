// Vérifie comment chaque diagramme sera animé (même planificateur que animation.js).
// Liste les cas ambigus à corriger dans l'éditeur : diagrammes sans numéros, trajets sans numéro,
// trajets sans joueur au départ, passes ou tirs sans rondelle, passes sans receveur.
// Usage : node outils/verifier-animations.js [CODE ...]   (ex. : node outils/verifier-animations.js T01 TC05)

const { DIAGRAMMES } = require("./diagrammes-donnees.js");
const { EXERCICES } = require("./exercices.js");
const { SITUATIONS } = require("./systemes.js");
const { planifier } = require("./animation.js");

const NOMS = Object.fromEntries([...EXERCICES, ...SITUATIONS].map((e) => [e.id, e.nom]));
const CODES = {
  "sans-numero": "Sans numéros d'étape",
  "trajet-sans-numero": "Trajets sans numéro",
  "sans-joueur": "Trajets sans joueur au départ",
  "loin-du-depart": "Joueur loin du départ",
  "rondelle-creee": "Rondelle qui apparaît",
  "sans-receveur": "Passes sans receveur",
  "synchro-cassee": "Synchronisation impossible",
};

const demandes = process.argv.slice(2);
const ids = demandes.length ? demandes : Object.keys(DIAGRAMMES);
const total = Object.fromEntries(Object.keys(CODES).map((c) => [c, new Set()]));
let propres = 0;

for (const id of ids) {
  const d = DIAGRAMMES[id];
  if (!d) { console.log(`✗ ${id} : diagramme introuvable`); continue; }
  const plan = planifier(d);
  const duree = `${plan.etapes.length} étape${plan.etapes.length > 1 ? "s" : ""}, ${plan.duree.toFixed(1)} s`;
  if (!plan.avertissements.length) {
    propres++;
    if (demandes.length) console.log(`✓ ${id} ${NOMS[id] || ""} (${duree})`);
    continue;
  }
  console.log(`⚠ ${id} ${NOMS[id] || ""} (${duree})`);
  for (const a of plan.avertissements) {
    console.log(`    - ${a.message}`);
    total[a.code].add(id);
  }
}

console.log(`\n${propres} / ${ids.length} diagrammes sans ambiguïté.`);
for (const [code, nom] of Object.entries(CODES)) if (total[code].size) console.log(`  ${nom} : ${[...total[code]].join(", ")}`);
