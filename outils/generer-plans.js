// Génère les fiches de pratique Markdown à partir de modeles.js, et les images des diagrammes
// Usage : node outils/generer-plans.js
// Vérifie aussi que chaque plan respecte le temps disponible et les ratios (±5 points).
// Diagrammes : écrit un SVG par diagramme dans outils/diagrammes-svg/ et insère l'image de chaque
// situation (systemes.js) sous sa section dans M11-B/ et M15-C/systeme-de-jeu.md.
// Site : refait ensuite les pages HTML (accueil, équipes, contenus) avec generer-site.js.

const fs = require("fs");
const path = require("path");
const { CATEGORIES, EQUIPES, EXERCICES, faisable } = require("./exercices.js");
const { MODELES } = require("./modeles.js");
const { DIAGRAMMES } = require("./diagrammes-donnees.js");
const { SITUATIONS, NOMS_SYSTEME } = require("./systemes.js");
const { dessinerDiagramme } = require("./diagrammes.js");

const PAR_ID = Object.fromEntries(EXERCICES.map((e) => [e.id, e]));
const DOSSIERS = { M11: "M11-B", M15: "M15-C" };
const MARGE = 5;
const racine = path.join(__dirname, "..");
let erreurs = 0;

// ─── Images des diagrammes ───
const dossierSvg = path.join(__dirname, "diagrammes-svg");
fs.mkdirSync(dossierSvg, { recursive: true });
const NOMS = Object.fromEntries([...EXERCICES, ...SITUATIONS].map((e) => [e.id, e.nom]));
for (const f of fs.readdirSync(dossierSvg)) if (f.endsWith(".svg") && !DIAGRAMMES[f.slice(0, -4)]) fs.unlinkSync(path.join(dossierSvg, f));
for (const [id, d] of Object.entries(DIAGRAMMES)) {
  if (!NOMS[id]) { console.warn(`! diagramme ${id} : aucun exercice ni situation avec ce code`); continue; }
  const noms = SITUATIONS.some((s) => s.id === id) ? NOMS_SYSTEME : undefined;
  fs.writeFileSync(path.join(dossierSvg, `${id}.svg`), dessinerDiagramme(d, { titre: NOMS[id], noms }));
}
console.log(`✓ ${Object.keys(DIAGRAMMES).length} diagrammes dans outils/diagrammes-svg/`);

// Image de chaque situation sous le titre de sa section (remplace le croquis texte qui suivait le titre)
for (const [equipe, dossier] of Object.entries(DOSSIERS)) {
  const fichier = path.join(racine, dossier, "systeme-de-jeu.md");
  let lignes = fs.readFileSync(fichier, "utf8").split("\n");
  for (const s of SITUATIONS.filter((x) => x.equipe === equipe)) {
    const i = lignes.indexOf(`### ${s.section}`);
    if (i < 0) { console.error(`✗ ${dossier}/systeme-de-jeu.md : section « ${s.section} » introuvable`); erreurs++; continue; }
    const image = `![${s.nom}](../outils/diagrammes-svg/${s.id}.svg)`;
    let j = i + 1;
    while (lignes[j] === "") j++;
    if (lignes[j].startsWith("![")) lignes.splice(i + 1, j - i); // ancienne image (et lignes vides) : retirée
    else if (!DIAGRAMMES[s.id]) continue; // pas encore de diagramme : on garde le croquis texte
    else if (lignes[j].startsWith("```")) { // croquis texte : remplacé par l'image
      const fin = lignes.indexOf("```", j + 1);
      lignes.splice(i + 1, fin - i + (lignes[fin + 1] === "" ? 1 : 0));
    } else lignes.splice(i + 1, j - i - 1);
    while (lignes[i + 1] === "") lignes.splice(i + 1, 1);
    lignes.splice(i + 1, 0, "", ...(DIAGRAMMES[s.id] ? [image, ""] : []));
  }
  fs.writeFileSync(fichier, lignes.join("\n"));
}

const heure = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const virgule = (n) => n.toFixed(1).replace(".", ",").replace(",0", "");

for (const m of MODELES) {
  const equipe = EQUIPES[m.equipe];
  const disponible = m.dureeGlace - m.consignes;
  const minutes = { T: 0, TI: 0, TC: 0 };

  for (const l of m.lignes) {
    const e = PAR_ID[l.id];
    if (!e) { console.error(`✗ ${m.id} : exercice inconnu ${l.id}`); erreurs++; continue; }
    if (!e.equipes.includes(m.equipe)) console.warn(`! ${m.id} : ${l.id} n'est pas recommandé pour ${equipe.nom}`);
    if (!faisable(e, m.equipe)) { console.error(`✗ ${m.id} : ${l.id} demande une pleine glace (${equipe.nom} : ${equipe.glace})`); erreurs++; }
    minutes[e.categorie] += l.minutes;
  }
  const total = minutes.T + minutes.TI + minutes.TC;
  if (total !== disponible) { console.error(`✗ ${m.id} : ${total} min d'exercices, ${disponible} disponibles`); erreurs++; }

  let md = `# ${equipe.nom} – ${m.titre}\n\n`;
  md += `**Thème :** ${m.theme}  \n`;
  md += `**Glace :** ${equipe.glace}, ${m.dureeGlace} min (${disponible} min d'exercices + ${m.consignes} min de consignes et transitions)\n\n`;
  md += `> Fiche générée à partir de \`outils/modeles.js\`. Pour la modifier, ouvre \`outils/plan-pratique.html\` et charge le modèle « ${equipe.nom} – ${m.titre} ».\n\n`;
  md += `## Objectifs\n\n${m.objectifs.map((o) => `- ${o}`).join("\n")}\n\n`;
  md += `## Tableau (vestiaire)\n\n${m.tableau}\n\n`;

  md += `## Déroulement\n\n| Heure | Code | Exercice | Catégorie | Min | Notes |\n|---|---|---|---|---|---|\n`;
  let debut = 0;
  for (const l of m.lignes) {
    const e = PAR_ID[l.id];
    if (!e) continue;
    md += `| ${heure(debut)}–${heure(debut + l.minutes)} | ${e.id} | ${e.nom} | ${CATEGORIES[e.categorie].nom} | ${l.minutes} | ${l.notes || ""} |\n`;
    debut += l.minutes;
  }

  md += `\n## Répartition du temps\n\n| Catégorie | Minutes | % réel | Cible Hockey Québec |\n|---|---|---|---|\n`;
  for (const [cle, cat] of Object.entries(CATEGORIES)) {
    const pct = (minutes[cle] / total) * 100;
    const cible = equipe.cibles[cle];
    const ok = Math.abs(pct - cible) <= MARGE;
    if (!ok) { console.error(`✗ ${m.id} : ${cat.nom} ${pct.toFixed(0)} % (cible ${cible} %)`); erreurs++; }
    md += `| ${cat.nom} | ${minutes[cle]} | ${virgule(pct)} % | ${cible} % ${ok ? "✓" : "✗"} |\n`;
  }

  md += `\n## Détail des exercices\n`;
  for (const id of [...new Set(m.lignes.map((l) => l.id))]) {
    const e = PAR_ID[id];
    if (!e) continue;
    md += `\n### ${e.id} – ${e.nom}\n\n`;
    md += `*${CATEGORIES[e.categorie].nom} · ${e.espace}${e.iq ? " · Décisionnel (IQ)" : ""}*\n\n`;
    if (DIAGRAMMES[e.id]) md += `![Diagramme ${e.id}](../../outils/diagrammes-svg/${e.id}.svg)\n\n`;
    md += `**Objectif :** ${e.objectif}\n\n**Organisation :** ${e.organisation}\n\n`;
    if (equipe.glace === "Demi-glace" && e.demi) md += `> **Adaptation demi-glace :** ${e.demi}\n\n`;
    md += e.deroulement.map((d, i) => `${i + 1}. ${d}`).join("\n") + "\n\n";
    md += `**Points clés :** ${e.pointsCles.join(" · ")}\n`;
  }

  const dossier = path.join(racine, DOSSIERS[m.equipe], "pratiques");
  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, `${m.id.replace(/^M1[15]-/, "")}.md`);
  fs.writeFileSync(fichier, md);
  console.log(`✓ ${path.relative(racine, fichier)} – T ${minutes.T} / TI ${minutes.TI} / TC ${minutes.TC} min`);
}

require("./generer-site.js").genererSite();

process.exit(erreurs ? 1 : 0);
