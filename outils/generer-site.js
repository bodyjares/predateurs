// Génère les pages HTML du site à partir des fichiers Markdown et des données des outils.
// Usage : node outils/generer-site.js (aussi lancé à la fin de generer-plans.js)
//   index.html                  accueil
//   M11-B/index.html, M15-C/…   page de chaque équipe (système, saison, pratiques, outils)
//   M1x-x/*.html, pratiques/*   version HTML de chaque fichier .md, à côté du fichier
// Les pages utilisent outils/style.css et outils/site.js (en-tête et pied de page communs).

const fs = require("fs");
const path = require("path");
const { entete, pied } = require("./site.js");
const { CATEGORIES, EQUIPES, EXERCICES, faisable } = require("./exercices.js");
const { SITUATIONS } = require("./systemes.js");
const { DIAGRAMMES } = require("./diagrammes-donnees.js");

const racine = path.join(__dirname, "..");
const DOSSIERS = { M11: "M11-B", M15: "M15-C" };
const EXERCICES_PAR_PRATIQUE = 45; // 50 min de glace moins 5 min de consignes

// ─── Markdown → blocs → HTML (seulement ce que nos fichiers utilisent) ───
const echapper = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const texteBrut = (t) => t.replace(/\*\*|`|\*/g, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
const slug = (t) => texteBrut(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function lireBlocs(md) {
  const lignes = md.replace(/\r/g, "").split("\n"), blocs = [], ids = new Set();
  let i = 0;
  const idUnique = (t) => { let id = slug(t) || "section", n = 2; while (ids.has(id)) id = `${slug(t)}-${n++}`; ids.add(id); return id; };
  while (i < lignes.length) {
    const l = lignes[i];
    let m;
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { blocs.push({ type: "titre", niveau: m[1].length, texte: m[2].trim(), id: idUnique(m[2]) }); i++; continue; }
    if (/^-{3,}\s*$/.test(l)) { blocs.push({ type: "hr" }); i++; continue; }
    if (l.startsWith("|") && /^\|[\s:|-]+\|?\s*$/.test(lignes[i + 1] || "")) {
      const cellules = (x) => x.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const entetes = cellules(l), rangees = [];
      for (i += 2; i < lignes.length && lignes[i].startsWith("|"); i++) rangees.push(cellules(lignes[i]));
      blocs.push({ type: "table", entetes, rangees });
      continue;
    }
    if (l.startsWith(">")) {
      const interne = [];
      for (; i < lignes.length && lignes[i].startsWith(">"); i++) interne.push(lignes[i].replace(/^>\s?/, ""));
      blocs.push({ type: "citation", blocs: lireBlocs(interne.join("\n")) });
      continue;
    }
    if ((m = l.match(/^([-*]|\d+\.)\s+/))) {
      const ordonnee = /\d/.test(m[1]), items = [], debut = ordonnee ? parseInt(m[1], 10) : 1;
      const puce = ordonnee ? /^\d+\.\s+/ : /^[-*]\s+/;
      for (; i < lignes.length && lignes[i].trim(); i++) {
        if (puce.test(lignes[i])) items.push(lignes[i].replace(puce, ""));
        else items[items.length - 1] += " " + lignes[i].trim();
      }
      blocs.push({ type: ordonnee ? "ol" : "ul", items, debut });
      continue;
    }
    const para = [];
    for (; i < lignes.length && lignes[i].trim() && !/^(#{1,6}\s|>|\||-{3,}\s*$|[-*]\s|\d+\.\s)/.test(lignes[i]); i++) para.push(lignes[i]);
    const seul = para.length === 1 && para[0].match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    blocs.push(seul ? { type: "image", alt: seul[1], src: seul[2] } : { type: "p", texte: para.join("\n") });
  }
  return blocs;
}

// dossierMd : dossier du fichier .md, pour transformer `pratiques/S01.md` en lien vers la page HTML
function enLigne(t, dossierMd) {
  const codes = [];
  t = echapper(t).replace(/`([^`]+)`/g, (_, c) => {
    const cible = dossierMd && /^[\w./-]+\.md$/.test(c) && fs.existsSync(path.join(dossierMd, c));
    codes.push(cible ? `<a href="${c.replace(/\.md$/, ".html")}">${c.replace(/\.md$/, "").replace(/^pratiques\//, "")}</a>` : `<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, x, h) => `<a href="${/^https?:/.test(h) ? h : h.replace(/\.md(#|$)/, ".html$1")}">${x}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?=\S)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/ {2,}\n/g, "<br>\n");
  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => codes[n]);
}

function rendre(blocs, dossierMd) {
  const L = (t) => enLigne(t, dossierMd);
  return blocs.map((b) => {
    switch (b.type) {
      case "titre": {
        const n = Math.max(2, b.niveau), classe = n === 2 && /^PHASE\b/.test(b.texte) ? ' class="phase-h"' : "";
        return `<h${n} id="${b.id}"${classe}>${L(b.texte)}</h${n}>`;
      }
      case "hr": return "<hr>";
      case "p": return `<p>${L(b.texte)}</p>`;
      case "ul": return `<ul>${b.items.map((x) => `<li>${L(x)}</li>`).join("")}</ul>`;
      case "ol": return `<ol${b.debut !== 1 ? ` start="${b.debut}"` : ""}>${b.items.map((x) => `<li>${L(x)}</li>`).join("")}</ol>`;
      case "citation": return `<blockquote>${rendre(b.blocs, dossierMd)}</blockquote>`;
      case "image": {
        const legende = /^Diagramme [A-Z]/.test(b.alt) ? "" : `<figcaption>${echapper(b.alt)}</figcaption>`;
        return `<figure><a href="${b.src}" title="Ouvrir en grand"><img src="${b.src}" alt="${echapper(b.alt)}" loading="lazy"></a>${legende}</figure>`;
      }
      case "table":
        return `<div class="tableau"><table><thead><tr>${b.entetes.map((c) => `<th>${L(c)}</th>`).join("")}</tr></thead><tbody>` +
          b.rangees.map((r) => `<tr>${r.map((c) => `<td>${L(c)}</td>`).join("")}</tr>`).join("") + "</tbody></table></div>";
    }
    return "";
  }).join("\n");
}

// Blocs entre un titre et le prochain titre de même niveau ou plus haut
function sectionDe(blocs, filtre) {
  const i = blocs.findIndex((b) => b.type === "titre" && filtre(b));
  if (i < 0) return [];
  const fin = blocs.findIndex((b, j) => j > i && b.type === "titre" && b.niveau <= blocs[i].niveau);
  return blocs.slice(i + 1, fin < 0 ? undefined : fin);
}

// ─── Gabarit de page ───
function page({ r, actif, onglet, bandeau = "", corps }) {
  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${onglet} – Prédateurs</title>
<link rel="stylesheet" href="${r ? r + "/" : ""}outils/style.css">
<link rel="icon" href="${r ? r + "/" : ""}outils/logo-predateurs.png">
</head>
<body>
<!-- Page générée par outils/generer-site.js : modifie le fichier .md ou les données, puis relance le script. -->
${entete(r, actif)}
${bandeau}
${corps}
${pied(r)}
</body>
</html>
`;
}

const bandeauPage = ({ fil, surtitre, titre, texte }) => `<header class="bandeau">
  <div class="page">
    ${fil ? `<p class="fil">${fil}</p>` : ""}
    ${surtitre ? `<p class="surtitre">${surtitre}</p>` : ""}
    <h1>${titre}</h1>
    ${texte ? `<p>${texte}</p>` : ""}
  </div>
</header>`;

const ecrire = (relatif, html) => {
  fs.mkdirSync(path.dirname(path.join(racine, relatif)), { recursive: true });
  fs.writeFileSync(path.join(racine, relatif), html);
  console.log(`✓ ${relatif}`);
};

function barreRatios(cibles) {
  const cles = Object.keys(CATEGORIES);
  return `<div class="ratios"><div class="barre-ratio" role="img" aria-label="${cles.map((c) => `${CATEGORIES[c].nom} ${cibles[c]} %`).join(", ")}">` +
    cles.map((c) => `<span style="flex:${cibles[c]};background:${CATEGORIES[c].couleur}"></span>`).join("") + "</div><ul>" +
    cles.map((c) => `<li style="--c:${CATEGORIES[c].couleur}">${CATEGORIES[c].nom} <strong>${cibles[c]} %</strong></li>`).join("") + "</ul></div>";
}

// ─── Lecture du contenu de chaque équipe ───
function lireEquipe(cle) {
  const dossier = DOSSIERS[cle], abs = path.join(racine, dossier);
  const lire = (f) => lireBlocs(fs.readFileSync(path.join(abs, f), "utf8"));
  const systeme = lire("systeme-de-jeu.md"), saison = lire("planification-saison.md");
  const philo = sectionDe(systeme, (b) => b.niveau === 2 && /^Philosophie/.test(b.texte));
  const devise = philo.find((b) => b.type === "p" && /Devise/.test(b.texte));
  const phases = systeme.filter((b) => b.type === "titre" && b.niveau === 2 && /^PHASE\b/.test(b.texte)).map((h) => {
    const m = h.texte.match(/^PHASE\s+(\d+)\s*[–-]\s*(.*?)\s*(?:\(([^)]*)\))?$/);
    const blocs = sectionDe(systeme, (b) => b === h);
    return { h, numero: +m[1], nom: m[2], periode: m[3] || "", blocs };
  });
  const titreId = Object.fromEntries(systeme.filter((b) => b.type === "titre").map((b) => [b.texte, b.id]));
  const vue = sectionDe(saison, (b) => b.niveau === 2 && /^Vue d'ensemble/.test(b.texte)).find((b) => b.type === "table");
  const detail = sectionDe(saison, (b) => b.niveau === 2 && /^Détail par pratique/.test(b.texte)).find((b) => b.type === "table");
  const dossierPratiques = path.join(abs, "pratiques");
  const pratiques = (fs.existsSync(dossierPratiques) ? fs.readdirSync(dossierPratiques) : []).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const blocs = lireBlocs(fs.readFileSync(path.join(dossierPratiques, f), "utf8"));
    const para = blocs.find((b) => b.type === "p" && /\*\*Thème :\*\*/.test(b.texte))?.texte || "";
    return {
      fichier: f.replace(/\.md$/, ".html"), code: f.replace(/\.md$/, ""),
      titre: courtTitre(blocs.find((b) => b.type === "titre" && b.niveau === 1)?.texte || f),
      theme: (para.match(/\*\*Thème :\*\*\s*(.*)/) || [])[1]?.split("\n")[0].trim() || "",
    };
  });
  const nbPratiques = detail ? Math.max(...detail.rangees.flatMap((r) => (r[0].match(/\d+/g) || []).map(Number))) : 0;
  // Introduction : 1er paragraphe de la philosophie, sans la phrase qui annonce une liste (« … doit donc : »)
  const p1 = philo.find((b) => b.type === "p");
  const intro = p1 && p1.texte.replace(/(?<=[.!?])\s+[^.!?]*:\s*$/, "");
  return { cle, dossier, equipe: EQUIPES[cle], systeme, philo, intro, devise, phases, titreId, vue, detail, nbPratiques, pratiques };
}

// « Système de jeu – M11-B » → « Système de jeu » ; « M11-B – Semaine 1 » → « Semaine 1 »
const courtTitre = (t) => t.replace(/\s*[–-]\s*M1[15]-[BC]\b/, "").replace(/^M1[15]-[BC]\s*[–-]\s*/, "").trim();

// ─── Pages de contenu (une par fichier .md) ───
function pageContenu(relMd, equipe, precedente, suivante) {
  const abs = path.join(racine, relMd), blocs = lireBlocs(fs.readFileSync(abs, "utf8"));
  const h1 = blocs.find((b) => b.type === "titre" && b.niveau === 1);
  const corpsBlocs = blocs.filter((b) => b !== h1);
  const profondeur = relMd.split("/").length - 1, r = Array(profondeur).fill("..").join("/");
  const versEquipe = profondeur === 1 ? "index.html" : "../index.html";
  const titre = courtTitre(h1 ? h1.texte : path.basename(relMd, ".md"));
  const sections = corpsBlocs.filter((b) => b.type === "titre" && b.niveau === 2);
  const sommaire = sections.length > 1 ? `<nav class="sommaire" aria-label="Sur cette page"><p>Sur cette page</p><ol>${sections.map((s) => `<li><a href="#${s.id}">${enLigne(texteBrut(s.texte))}</a></li>`).join("")}</ol></nav>` : "<div></div>";
  const nav = `<nav class="navigation-pages no-print">
    <a class="bouton contour" href="${versEquipe}">← ${equipe.equipe.nom}</a>
    <span>${precedente ? `<a class="bouton contour" href="${precedente.lien}">← ${precedente.titre}</a> ` : ""}${suivante ? `<a class="bouton" href="${suivante.lien}">${suivante.titre} →</a>` : ""}</span>
  </nav>`;
  ecrire(relMd.replace(/\.md$/, ".html"), page({
    r, actif: equipe.cle, onglet: `${titre} – ${equipe.equipe.nom}`,
    bandeau: bandeauPage({
      fil: `<a href="${r}/index.html">Accueil</a> › <a href="${versEquipe}">${equipe.equipe.nom}</a> › ${titre}`,
      surtitre: `${equipe.equipe.nom} · ${equipe.equipe.glace}`, titre: enLigne(titre),
    }),
    corps: `<main class="page contenu-grille">${sommaire}<article class="texte">${rendre(corpsBlocs, path.dirname(abs))}${nav}</article></main>`,
  }));
}

// ─── Page d'une équipe ───
function pageEquipe(q) {
  const { equipe, cle } = q;
  const pourEquipe = EXERCICES.filter((e) => e.equipes.includes(cle) && faisable(e, cle));
  const situations = SITUATIONS.filter((s) => s.equipe === cle);
  const minutes = (c) => Math.round((EXERCICES_PAR_PRATIQUE * equipe.cibles[c]) / 100);

  const heros = `<section class="heros">
  <div class="page">
    <div>
      <p class="surtitre">Prédateurs · Saison 2026-2027</p>
      <h1>${equipe.nom}<em>${cle === "M11" ? "Lire le jeu" : "Simple · Sécuritaire · Ensemble"}</em></h1>
      ${q.intro ? `<p class="intro">${enLigne(q.intro)}</p>` : ""}
      <ul class="puces"><li>${equipe.glace}</li><li>1 pratique / semaine</li><li>50 min de glace</li><li>${q.nbPratiques} pratiques</li></ul>
      <div class="boutons-heros">
        <a class="bouton" href="systeme-de-jeu.html">Système de jeu</a>
        <a class="bouton clair" href="planification-saison.html">Planification</a>
        <a class="bouton contour" href="../outils/plan-pratique.html#${cle}">Préparer une pratique</a>
      </div>
    </div>
    <div class="chiffre-equipe" aria-hidden="true">${equipe.nom.split("-")[0]}<span>Catégorie ${equipe.nom.split("-")[1]}</span></div>
  </div>
</section>`;

  const ratios = `<section class="section"><div class="page">
  <div class="titre-section"><p class="surtitre">Hockey Québec</p><h2>Ratios de la saison</h2>
  <p>Répartition cible du temps d'exercices. Sur ${EXERCICES_PAR_PRATIQUE} min d'exercices par pratique, ça donne environ :</p></div>
  <div class="grille">${Object.entries(CATEGORIES).map(([c, cat]) => `<div class="ratio-grand" style="--c:${cat.couleur}"><strong>${equipe.cibles[c]} %</strong><span>${cat.nom}</span><p>≈ ${minutes(c)} min par pratique · ${pourEquipe.filter((e) => e.categorie === c).length} exercices dans la banque</p></div>`).join("")}</div>
</div></section>`;

  const phases = q.phases.map((p) => {
    const vignettes = situations.filter((s) => s.phase === p.numero && DIAGRAMMES[s.id]).map((s) => {
      const [titre, mots] = s.section.replace(/^\d+\.\s*/, "").split(/\s*:\s*/);
      return `<a class="situation" href="systeme-de-jeu.html#${q.titreId[s.section] || p.h.id}"><img src="../outils/diagrammes-svg/${s.id}.svg" alt="Diagramme : ${echapper(s.nom)}" loading="lazy"><p>${enLigne(titre)}${mots ? `<small>${enLigne(mots)}</small>` : ""}</p></a>`;
    });
    const premier = p.blocs.slice(0, p.blocs.findIndex((b) => b.type === "titre") >>> 0).find((b) => b.type === "p");
    const liste = !vignettes.length && p.blocs.find((b) => b.type === "ul");
    return `<div class="phase">
    <div class="phase-titre"><h3><b>Phase ${p.numero}</b> · ${enLigne(p.nom)}</h3><span>${p.periode}</span></div>
    ${premier ? `<p class="phase-texte">${enLigne(premier.texte)}</p>` : ""}
    ${vignettes.length ? `<div class="grille">${vignettes.join("")}</div>` : ""}
    ${liste ? `<div class="grille deux">${liste.items.map((x) => { const [t, ...reste] = x.split(/\s*:\s*/); const suite = reste.join(" : "); return `<div class="tuile"><h3>${enLigne(texteBrut(t))}</h3><p>${enLigne(suite.charAt(0).toUpperCase() + suite.slice(1))}</p></div>`; }).join("")}</div>` : ""}
  </div>`;
  }).join("");
  const systeme = `<section class="section"><div class="page">
  <div class="titre-section"><p class="surtitre">Système de jeu évolutif</p><h2>3 phases, une situation à la fois</h2>
  ${q.devise ? `<p>${enLigne(q.devise.texte)}</p>` : "<p>Chaque situation tient en 3 mots-clés que les joueurs crient sur la glace. Clique sur un diagramme pour voir le détail.</p>"}</div>
  ${phases}
  <p class="suite"><a class="bouton" href="systeme-de-jeu.html">Tout le système de jeu</a></p>
</div></section>`;

  const saison = q.vue ? `<section class="section sombre"><div class="page">
  <div class="titre-section"><p class="surtitre">Planification de saison</p><h2>La saison en ${q.vue.rangees.filter((r) => /\d/.test(r[0])).length} blocs</h2>
  <p>Chaque bloc place une partie du système dans les pratiques. Le match devient la 2e séance de la semaine.</p></div>
  <div class="frise">${q.vue.rangees.map(([bloc, semaines, periode, phase, theme]) => {
      const pause = !/\d/.test(bloc);
      return `<div${pause ? ' class="pause"' : ""}><div class="num">${pause ? "—" : bloc}</div><p class="quand">${semaines} · ${periode}</p>${pause ? "" : `<span class="phase-bloc">${phase}</span>`}<p>${enLigne(theme)}</p></div>`;
    }).join("")}</div>
  <p class="suite"><a class="bouton" href="planification-saison.html">Détail pratique par pratique</a></p>
</div></section>` : "";

  const pratiques = `<section class="section"><div class="page">
  <div class="titre-section"><p class="surtitre">Plans de pratique</p><h2>Pratiques prêtes à imprimer</h2>
  <p>Déroulement minute par minute, diagrammes et points clés pour les assistants.</p></div>
  <div class="grille">${q.pratiques.map((p) => `<a class="tuile" href="pratiques/${p.fichier}"><span class="numero">${p.code}</span><span class="etiquette">${equipe.glace} · 50 min</span><h3>${enLigne(p.titre)}</h3><p>${enLigne(p.theme)}</p><span class="plus">Voir la pratique →</span></a>`).join("")}
  <a class="tuile" href="../outils/plan-pratique.html#${cle}"><span class="numero">+</span><span class="etiquette">Planificateur</span><h3>Nouvelle pratique</h3><p>Choisis tes exercices : les ratios sont calculés automatiquement.</p><span class="plus">Ouvrir le planificateur →</span></a></div>
</div></section>`;

  const outils = `<section class="section"><div class="page">
  <div class="titre-section"><p class="surtitre">Banque d'exercices</p><h2>${pourEquipe.length} exercices pour les ${equipe.nom}</h2>
  <p>${cle === "M11" ? "Tous faisables en demi-glace (adaptation incluse au besoin). Les exercices décisionnels (IQ) développent la lecture du jeu." : "Exercices techniques sous pression et tactiques pour une équipe qui apprend vite."}</p></div>
  <p><a class="bouton" href="../outils/banque-exercices.html#${cle}">Voir les exercices</a></p>
</div></section>`;

  ecrire(`${q.dossier}/index.html`, page({ r: "..", actif: cle, onglet: equipe.nom, corps: `<main>${heros}${ratios}${systeme}${saison}${pratiques}${outils}</main>` }));
}

// ─── Accueil ───
function pageAccueil(equipes) {
  const nbSemaines = Math.max(...equipes.map((q) => q.nbPratiques));
  const heros = `<section class="heros">
  <div class="page">
    <div>
      <p class="surtitre">Saison 2026-2027</p>
      <h1>Prédateurs<em>M11-B · M15-C</em></h1>
      <p class="intro">Système de jeu, planification de saison, plans de pratique et banque d'exercices illustrés, alignés sur les ratios de Hockey Québec.</p>
      <div class="boutons-heros">${equipes.map((q, i) => `<a class="bouton${i ? " clair" : ""}" href="${q.dossier}/index.html">${q.equipe.nom}</a>`).join("")}
        <a class="bouton contour" href="outils/banque-exercices.html">Exercices</a></div>
    </div>
    <img class="visuel" src="outils/logo-predateurs.png" alt="Logo des Prédateurs" width="400" height="227">
  </div>
</section>
<section class="chiffres"><div class="page">
  <div><strong>${equipes.length}</strong><span>Équipes</span></div>
  <div><strong>${EXERCICES.length}</strong><span>Exercices</span></div>
  <div><strong>${Object.keys(DIAGRAMMES).length}</strong><span>Diagrammes</span></div>
  <div><strong>${nbSemaines}</strong><span>Pratiques par équipe</span></div>
  <div><strong>3</strong><span>Phases du système</span></div>
</div></section>`;

  const cartes = equipes.map((q) => {
    return `<a class="equipe-carte" href="${q.dossier}/index.html">
      <p class="surtitre">${q.equipe.glace} · 1 pratique / semaine</p>
      <p class="nom">${q.equipe.nom}</p>
      ${q.intro ? `<p>${enLigne(texteBrut(q.intro))}</p>` : ""}
      ${barreRatios(q.equipe.cibles)}
      <span class="plus">Voir l'équipe →</span>
    </a>`;
  }).join("");

  const tuiles = [
    ["01", "outils/banque-exercices.html", "Banque d'exercices", `Les ${EXERCICES.length} exercices avec leur diagramme, filtrés par équipe, catégorie, thème et exercices décisionnels (IQ).`],
    ["02", "outils/plan-pratique.html", "Planificateur", "Assemble une pratique, vérifie les ratios et imprime une feuille détaillée pour les assistants."],
    ["03", "outils/editeur-diagrammes.html", "Éditeur de diagrammes", "Dessine ou corrige les diagrammes des exercices et des situations du système de jeu."],
  ].map(([n, lien, titre, texte]) => `<a class="tuile" href="${lien}"><span class="numero">${n}</span><span class="etiquette">Outil</span><h3>${titre}</h3><p>${texte}</p><span class="plus">Ouvrir →</span></a>`).join("");

  const etapes = [
    ["Système de jeu", "Définit quoi enseigner et dans quel ordre (phases 1 → 2 → 3, avec des critères pour passer à la suivante)."],
    ["Planification", "Place chaque notion du système dans une semaine et choisit les exercices qui la soutiennent."],
    ["Banque d'exercices", "Donne le détail de chaque exercice (T, TI ou TC), avec l'équipe et la phase du système."],
    ["Pratique", "Le planificateur assemble la pratique et vérifie les ratios de Hockey Québec."],
  ].map(([t, x], i) => `<div class="tuile"><span class="numero">${i + 1}</span><h3>${t}</h3><p>${x}</p></div>`).join("");

  ecrire("index.html", page({
    r: "", actif: "accueil", onglet: "Coaching 2026-2027",
    corps: `<main>${heros}
<section class="section"><div class="page"><div class="titre-section"><p class="surtitre">Nos équipes</p><h2>Deux groupes, deux plans</h2><p>Chaque équipe a son système de jeu, sa planification de saison et ses pratiques, adaptés à son profil et à sa glace.</p></div><div class="grille deux">${cartes}</div></div></section>
<section class="section sombre"><div class="page"><div class="titre-section"><p class="surtitre">Outils du coach</p><h2>Préparer, dessiner, imprimer</h2><p>S'ouvrent dans le navigateur, sans installation. Tes plans et diagrammes restent dans ton navigateur jusqu'à ce que tu les exportes.</p></div><div class="grille">${tuiles}</div></div></section>
<section class="section"><div class="page"><div class="titre-section"><p class="surtitre">Méthode</p><h2>Comment les pièces s'emboîtent</h2></div><div class="grille">${etapes}</div></div></section>
</main>`,
  }));
}

// ─── Génération ───
function genererSite() {
  const equipes = Object.keys(DOSSIERS).map(lireEquipe);
  pageAccueil(equipes);
  for (const q of equipes) {
    pageEquipe(q);
    pageContenu(`${q.dossier}/systeme-de-jeu.md`, q, null, { lien: "planification-saison.html", titre: "Planification" });
    pageContenu(`${q.dossier}/planification-saison.md`, q, { lien: "systeme-de-jeu.html", titre: "Système de jeu" }, q.pratiques[0] && { lien: `pratiques/${q.pratiques[0].fichier}`, titre: q.pratiques[0].titre });
    q.pratiques.forEach((p, i) => {
      const lien = (x) => x && { lien: x.fichier, titre: x.titre };
      pageContenu(`${q.dossier}/pratiques/${p.code}.md`, q, lien(q.pratiques[i - 1]), lien(q.pratiques[i + 1]));
    });
  }
}

if (require.main === module) genererSite();
module.exports = { genererSite, lireBlocs, rendre };
