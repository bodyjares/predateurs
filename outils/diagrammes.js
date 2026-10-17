// Moteur de diagrammes d'exercices – produit un SVG à partir d'une description.
// Fonctionne dans le navigateur (banque, planificateur) et dans Node (generer-plans.js).
//
// Coordonnées en PIEDS, patinoire de 200 × 85 pi :
//   x = 0 à la bande du fond (filet à gauche), 11 = ligne des buts, 75 = ligne bleue,
//   100 = ligne rouge, 125 = 2e ligne bleue, 189 = 2e ligne des buts, 200 = bande opposée.
//   y = 0 en haut, 85 en bas (42,5 = centre).
//
// Description d'un diagramme :
// {
//   vue: "zone" (0-80) | "demi" (0-100) | "pleine" (0-200),
//   joueurs:   [{ type: "X" | "O" | "D" | "G" | "C", x, y, etiquette?, rondelle? }],
//   trajets:   [{ type: "patin" | "arriere" | "rondelle" | "passe" | "tir", points: [[x, y], ...],
//                 forme?: "courbe" (défaut, passe par tous les points) | "droit", numero?, posNumero?, coteNumero?, depuisJoueur? }],
//                 Les passes et les tirs sont toujours droits (premier → dernier point).
//   cones:     [[x, y], ...],
//   rondelles: [[x, y], ...],   // pile de rondelles
//   notes:     [{ x, y, texte }],
//   etiquettes:[{ x, y, texte, de?, a? }]   // texte encadré ; de/a = numéros d'étapes où il s'affiche (animation)
// }
// Options de dessinerDiagramme : { titre?, legende?: false, noms?: { X, O } (légende des joueurs) }

(function (racine) {
  const COULEURS = {
    glace: "#ffffff",
    bande: "#52514e",
    rouge: "#e34948",
    bleu: "#2a78d6",
    attaque: "#2a78d6", // X
    defense: "#eb6834", // O
    encre: "#0b0b0b",
    muet: "#898781",
    filet: "#f47a20",
    etiquette: "#f1efe9",
  };
  const VUES = { zone: [0, 80], demi: [0, 100], pleine: [0, 200] };
  const E = 8; // pixels par pied

  const f = (n) => Math.round(n * E * 10) / 10;

  // ─── Géométrie : lissage Catmull-Rom et échantillonnage ───
  function lisser(points, pas = 0.6) {
    if (points.length < 3) return densifier(points, pas);
    const p = [points[0], ...points, points[points.length - 1]];
    const sortie = [];
    for (let i = 1; i < p.length - 2; i++) {
      const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / pas));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        sortie.push([0, 1].map((j) =>
          0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    sortie.push(points[points.length - 1]);
    return sortie;
  }

  function densifier(points, pas) {
    const sortie = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / pas));
      for (let k = 1; k <= n; k++) sortie.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return sortie;
  }

  // Coupe le trajet pour que la flèche ne touche pas le symbole du joueur
  function raccourcir(pts, debut, fin) {
    const couper = (liste, dist) => {
      let d = 0;
      for (let i = 1; i < liste.length; i++) {
        d += Math.hypot(liste[i][0] - liste[i - 1][0], liste[i][1] - liste[i - 1][1]);
        if (d >= dist) return liste.slice(i);
      }
      return liste.slice(-2);
    };
    let r = debut ? couper(pts, debut) : pts;
    if (fin) r = couper(r.slice().reverse(), fin).reverse();
    return r;
  }

  function normale(pts, i) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  }

  const chemin = (pts) => "M" + pts.map((p) => `${f(p[0])},${f(p[1])}`).join("L");

  function pointe(pts, couleur) {
    const b = pts[pts.length - 1], a = pts[Math.max(0, pts.length - 4)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const L = 2.6, l = 1.3;
    const g = [b[0] - L * Math.cos(ang) + l * Math.sin(ang), b[1] - L * Math.sin(ang) - l * Math.cos(ang)];
    const d = [b[0] - L * Math.cos(ang) - l * Math.sin(ang), b[1] - L * Math.sin(ang) + l * Math.cos(ang)];
    return `<path d="M${f(g[0])},${f(g[1])}L${f(b[0])},${f(b[1])}L${f(d[0])},${f(d[1])}Z" fill="${couleur}"/>`;
  }

  // ─── Trajets ───
  // Un tir s'arrête devant le premier joueur (souvent le gardien) qu'il croise, au lieu de passer sous son symbole
  function arreterDevantJoueur(pts, joueurs) {
    const rayon = 3;
    const obstacles = joueurs.filter((j) => Math.hypot(j.x - pts[0][0], j.y - pts[0][1]) > rayon);
    const i = pts.findIndex((p) => obstacles.some((j) => Math.hypot(j.x - p[0], j.y - p[1]) < rayon));
    return i > 3 ? pts.slice(0, i) : pts;
  }

  // Passes et tirs : toujours une ligne droite du premier au dernier point
  const DROITS = new Set(["passe", "tir"]);
  const courbable = (t) => !DROITS.has(t.type);
  const controle = (t) => (courbable(t) ? t.points : [t.points[0], t.points[t.points.length - 1]]);
  const lissage = (t) => (!courbable(t) || t.forme === "droit" ? densifier(controle(t), 0.6) : lisser(t.points));

  // Points réellement dessinés : décollés du joueur de départ, et le tir arrêté devant le gardien
  function pointsTrajet(t, joueurs = []) {
    const pts = raccourcir(lissage(t), t.depuisJoueur === false ? 0 : 2.2, t.type === "tir" ? 0 : 1);
    return t.type === "tir" ? arreterDevantJoueur(pts, joueurs) : pts;
  }

  // Centre du numéro d'étape : à posNumero (0-1) le long du trajet, à 3 pi du côté coteNumero (1 ou -1)
  function positionNumero(t, joueurs = []) {
    const pts = pointsTrajet(t, joueurs);
    const i = Math.min(pts.length - 1, Math.floor(pts.length * (t.posNumero ?? 0.5)));
    const [nx, ny] = normale(pts, i), cote = t.coteNumero === -1 ? -3 : 3;
    return [pts[i][0] + nx * cote, pts[i][1] + ny * cote];
  }

  function trajet(t, couleur, joueurs = []) {
    const pts = pointsTrajet(t, joueurs);
    const trait = `stroke="${couleur}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
    let svg = "";
    if (t.type === "patin") {
      svg = `<path d="${chemin(pts)}" ${trait} stroke-width="2.5"/>`;
    } else if (t.type === "arriere") {
      svg = `<path d="${chemin(pts)}" ${trait} stroke-width="2.5"/>`;
      for (let i = 4; i < pts.length - 3; i += 6) {
        const [nx, ny] = normale(pts, i), p = pts[i];
        svg += `<path d="M${f(p[0] - nx)},${f(p[1] - ny)}L${f(p[0] + nx)},${f(p[1] + ny)}" ${trait} stroke-width="2"/>`;
      }
    } else if (t.type === "rondelle") {
      const onde = pts.map((p, i) => {
        const [nx, ny] = normale(pts, i);
        const a = i < pts.length - 4 ? Math.sin(i * 0.9) * 0.9 : 0;
        return [p[0] + nx * a, p[1] + ny * a];
      });
      svg = `<path d="${chemin(onde)}" ${trait} stroke-width="2"/>`;
    } else if (t.type === "passe") {
      svg = `<path d="${chemin(pts)}" ${trait} stroke-width="2.2" stroke-dasharray="9 7"/>`;
    } else if (t.type === "tir") {
      for (const s of [-0.8, 0.8]) {
        const dec = pts.map((p, i) => { const [nx, ny] = normale(pts, i); return [p[0] + nx * s, p[1] + ny * s]; });
        svg += `<path d="${chemin(dec.slice(0, -3))}" ${trait} stroke-width="1.8"/>`;
      }
    }
    return svg + pointe(pts, couleur);
  }

  function numeroEtape(t, joueurs = []) {
    let svg = "";
    if (t.numero) {
      const c = positionNumero(t, joueurs);
      svg += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(1.7)}" fill="#fff" stroke="${COULEURS.muet}" stroke-width="1.2"/>` +
        `<text x="${f(c[0])}" y="${f(c[1])}" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${f(2.1)}" font-weight="600" fill="${COULEURS.bande}">${t.numero}</text>`;
    }
    return svg;
  }

  // ─── Joueurs et objets ───
  function joueur(j) {
    const x = f(j.x), y = f(j.y), police = `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="700"`;
    let svg;
    if (j.type === "G") {
      svg = `<rect x="${x - f(1.8)}" y="${y - f(1.8)}" width="${f(3.6)}" height="${f(3.6)}" rx="3" fill="#fff" stroke="${COULEURS.encre}" stroke-width="2"/>` +
        `<text x="${x}" y="${y}" dy="0.35em" text-anchor="middle" font-size="${f(2.6)}" ${police} fill="${COULEURS.encre}">G</text>`;
    } else if (j.type === "C") {
      svg = `<circle cx="${x}" cy="${y}" r="${f(2)}" fill="${COULEURS.encre}"/>` +
        `<text x="${x}" y="${y}" dy="0.35em" text-anchor="middle" font-size="${f(2.4)}" ${police} fill="#fff">C</text>`;
    } else {
      const couleur = j.type === "X" ? COULEURS.attaque : COULEURS.defense;
      svg = `<circle cx="${x}" cy="${y}" r="${f(2.1)}" fill="#fff" stroke="${couleur}" stroke-width="2.5"/>` +
        `<text x="${x}" y="${y}" dy="0.35em" text-anchor="middle" font-size="${f(2.6)}" ${police} fill="${couleur}">${j.type === "O" ? "O" : j.type}</text>`;
    }
    if (j.rondelle) svg += `<circle class="rondelle-portee" cx="${x + f(2.4)}" cy="${y + f(1.9)}" r="${f(0.75)}" fill="${COULEURS.encre}"/>`;
    if (j.etiquette) svg += `<text x="${x}" y="${y + f(4.4)}" text-anchor="middle" font-size="${f(2)}" ${police} fill="${COULEURS.encre}">${j.etiquette}</text>`;
    return svg;
  }

  function cone(c) {
    const [x, y] = [f(c[0]), f(c[1])];
    return `<path d="M${x},${y - f(1.3)}L${x + f(1.1)},${y + f(0.9)}L${x - f(1.1)},${y + f(0.9)}Z" fill="#eda100" stroke="#8a5d00" stroke-width="1"/>`;
  }

  // Pile de rondelles éparpillées : hasard fixe (tiré de la position) pour que la pile ne change pas à chaque rendu
  function pileRondelles(r) {
    let graine = Math.round(r[0] * 131 + r[1] * 977) || 1;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    const rondelles = [];
    for (let essai = 0; rondelles.length < 8 && essai < 200; essai++) {
      const a = hasard() * 2 * Math.PI, d = 2.6 * Math.sqrt(hasard());
      const p = [r[0] + d * Math.cos(a), r[1] + d * Math.sin(a) * 0.8];
      if (rondelles.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 1.25)) rondelles.push(p);
    }
    return rondelles.map((p) => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(0.55)}" fill="${COULEURS.encre}"/>`).join("");
  }

  // Étiquette encadrée : consigne qui s'affiche sur la glace (et pendant l'animation, voir animation.js)
  const POLICE = `font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"`;
  const largeurEtiquette = (e) => Math.max(5, String(e.texte).length * 1.32 + 2.6);
  function etiquette(e) {
    const l = largeurEtiquette(e), h = 4.4;
    return `<rect x="${f(e.x - l / 2)}" y="${f(e.y - h / 2)}" width="${f(l)}" height="${f(h)}" rx="${f(0.9)}" ` +
      `fill="${COULEURS.etiquette}" stroke="${COULEURS.bande}" stroke-width="1.6"/>` +
      `<text x="${f(e.x)}" y="${f(e.y)}" dy="0.36em" text-anchor="middle" font-size="${f(2.4)}" font-weight="700" ${POLICE} fill="${COULEURS.encre}">${e.texte}</text>`;
  }

  // Filet vu de haut : poteaux sur la ligne des buts, base arrondie de 3,7 pi de profondeur, mailles
  function filet(xg, sens) {
    const X = (dx) => f(xg - sens * dx), Y = f;
    const cadre = `M${X(0)},${Y(39.5)} L${X(1.9)},${Y(39.3)} Q${X(3.7)},${Y(39.3)} ${X(3.7)},${Y(41.1)} ` +
      `L${X(3.7)},${Y(43.9)} Q${X(3.7)},${Y(45.7)} ${X(1.9)},${Y(45.7)} L${X(0)},${Y(45.5)}`;
    let s = `<path d="${cadre}Z" fill="#fde8d7"/>`;
    for (let y = 40.3; y < 45.2; y += 0.75) s += `<line x1="${X(0.1)}" y1="${Y(y)}" x2="${X(3.4)}" y2="${Y(y)}" stroke="${COULEURS.filet}" stroke-width="0.6" opacity="0.55"/>`;
    for (let dx = 0.7; dx < 3.5; dx += 0.75) s += `<line x1="${X(dx)}" y1="${Y(39.7)}" x2="${X(dx)}" y2="${Y(45.3)}" stroke="${COULEURS.filet}" stroke-width="0.6" opacity="0.55"/>`;
    s += `<path d="${cadre}" fill="none" stroke="${COULEURS.filet}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const y of [39.5, 45.5]) s += `<circle cx="${X(0)}" cy="${Y(y)}" r="${f(0.45)}" fill="${COULEURS.filet}"/>`;
    return s;
  }

  // ─── Patinoire ───
  function patinoire(x0, x1) {
    const C = COULEURS;
    const cercle = (cx, cy, r, couleur, plein) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${plein ? couleur : "none"}" stroke="${couleur}" stroke-width="2"/>`;
    let s = "";
    // Bandes (coins arrondis de 28 pi seulement aux extrémités de la patinoire)
    const r = 28 * E;
    const g = x0 === 0, d = x1 === 200;
    s += `<path d="M${g ? f(0) + r : f(x0)},0 H${d ? f(200) - r : f(x1)} ${d ? `A${r},${r} 0 0 1 ${f(200)},${r} V${f(85) - r} A${r},${r} 0 0 1 ${f(200) - r},${f(85)}` : `V${f(85)}`} H${g ? r : f(x0)} ${g ? `A${r},${r} 0 0 1 0,${f(85) - r} V${r} A${r},${r} 0 0 1 ${r},0` : `V0`}Z" fill="${C.glace}" stroke="${C.bande}" stroke-width="3"/>`;
    // Lignes des buts, lignes bleues, ligne rouge
    for (const xg of [11, 189]) if (xg >= x0 && xg <= x1) {
      const retrait = 28 - Math.sqrt(28 * 28 - (28 - 11) * (28 - 11));
      s += `<line x1="${f(xg)}" y1="${f(retrait)}" x2="${f(xg)}" y2="${f(85 - retrait)}" stroke="${C.rouge}" stroke-width="2"/>`;
    }
    for (const xb of [75, 125]) if (xb >= x0 && xb <= x1) s += `<rect x="${f(xb - 0.5)}" y="0" width="${f(1)}" height="${f(85)}" fill="${C.bleu}" opacity="0.75"/>`;
    if (100 >= x0 && 100 <= x1) {
      s += `<rect x="${f(99.5)}" y="0" width="${f(1)}" height="${f(85)}" fill="${C.rouge}" opacity="0.75"/>`;
      s += cercle(100, 42.5, 15, C.bleu) + cercle(100, 42.5, 0.5, C.bleu, true);
    }
    // Cercles de mise au jeu et points
    for (const xc of [31, 169]) if (xc >= x0 && xc <= x1) for (const yc of [20.5, 64.5]) {
      s += cercle(xc, yc, 15, C.rouge) + cercle(xc, yc, 1, C.rouge, true);
      // Hash marks : 2 paires de traits de 2 pi à l'extérieur du cercle, côté bande et côté enclave
      for (const sens of [-1, 1]) for (const dx of [-2.9, 2.9]) {
        const xh = xc + dx, y1 = yc + sens * Math.sqrt(15 * 15 - dx * dx);
        s += `<line x1="${f(xh)}" y1="${f(y1)}" x2="${f(xh)}" y2="${f(yc + sens * 17)}" stroke="${C.rouge}" stroke-width="2"/>`;
      }
    }
    for (const xp of [80, 120]) if (xp >= x0 && xp <= x1) for (const yp of [20.5, 64.5]) s += cercle(xp, yp, 1, C.rouge, true);
    // Filets et demi-cercles du gardien
    for (const [xg, sens] of [[11, 1], [189, -1]]) if (xg >= x0 && xg <= x1) {
      s += `<path d="M${f(xg)},${f(36.5)} A${f(6)},${f(6)} 0 0 ${sens > 0 ? 1 : 0} ${f(xg)},${f(48.5)}" fill="#dcebfb" stroke="${C.rouge}" stroke-width="2"/>`;
      s += filet(xg, sens);
    }
    return s;
  }

  function legende(largeurPx, y, types, noms = {}) {
    const items = [
      ["patin", "Patin"], ["arriere", "Patin arrière"], ["rondelle", "Avec rondelle"],
      ["passe", "Passe"], ["tir", "Tir"],
    ].filter(([t]) => types.has(t));
    const joueurs = [["X", noms.X || "Attaquant"], ["O", noms.O || "Défenseur"]];
    let x = 10, s = `<g font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="13" fill="${COULEURS.encre}">`;
    for (const [t, nom] of joueurs) {
      const couleur = t === "X" ? COULEURS.attaque : COULEURS.defense;
      s += `<circle cx="${x + 9}" cy="${y}" r="9" fill="#fff" stroke="${couleur}" stroke-width="2"/><text x="${x + 9}" y="${y}" dy="0.35em" text-anchor="middle" font-weight="700" fill="${couleur}">${t}</text><text x="${x + 24}" y="${y}" dy="0.35em">${nom}</text>`;
      x += 34 + nom.length * 6.8;
    }
    for (const [t, nom] of items) {
      const pts = [[x / E, y / E], [(x + 50) / E, y / E]];
      s += trajet({ type: t, points: pts, depuisJoueur: false }, COULEURS.encre);
      s += `<text x="${x + 58}" y="${y}" dy="0.35em">${nom}</text>`;
      x += 70 + nom.length * 6.8;
    }
    return s + "</g>";
  }

  // Repère en pixels d'une vue : sert aussi à l'éditeur pour convertir la souris en pieds
  function repere(vue) {
    const [x0, x1] = VUES[vue || "demi"];
    const marge = 6;
    return { x0, x1, marge, echelle: E, largeur: f(x1 - x0) + 2 * marge, hauteurGlace: f(85) + 2 * marge };
  }

  function dessinerDiagramme(d, options = {}) {
    const { x0, x1, marge, largeur, hauteurGlace } = repere(d.vue);
    const types = new Set((d.trajets || []).map((t) => t.type));
    const hauteur = hauteurGlace + (options.legende === false ? 0 : 36);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${options.titre || "Diagramme d'exercice"}">`;
    s += `<rect width="100%" height="100%" fill="#fff"/>`;
    // Classes et data-i : repères pour l'animation (animation.js), sans effet sur le dessin
    s += `<g class="glace" transform="translate(${marge - f(x0)},${marge})">`;
    // Coupe les lignes qui dépassent la vue (ex. : cercle central en demi-glace). Même id pour une même vue : sans conflit dans une page.
    const coupe = `vue-${x0}-${x1}`, g = x0 === 0 ? marge : 1.5, dr = x1 === 200 ? marge : 1.5;
    s += `<clipPath id="${coupe}"><rect x="${f(x0) - g}" y="${-marge}" width="${f(x1 - x0) + g + dr}" height="${f(85) + 2 * marge}"/></clipPath>`;
    s += `<g clip-path="url(#${coupe})">${patinoire(x0, x1)}</g>`;
    for (const c of d.cones || []) s += cone(c);
    for (const r of d.rondelles || []) s += pileRondelles(r);
    (d.trajets || []).forEach((t, i) => { s += `<g class="trajet" data-i="${i}">${trajet(t, t.couleur || COULEURS.encre, d.joueurs || [])}</g>`; });
    (d.trajets || []).forEach((t, i) => { if (t.numero) s += `<g class="numero" data-i="${i}">${numeroEtape(t, d.joueurs || [])}</g>`; });
    (d.joueurs || []).forEach((j, i) => { s += `<g class="joueur" data-i="${i}">${joueur(j)}</g>`; });
    (d.etiquettes || []).forEach((e, i) => { s += `<g class="etiquette" data-i="${i}">${etiquette(e)}</g>`; });
    for (const n of d.notes || []) s += `<text x="${f(n.x)}" y="${f(n.y)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${f(2)}" fill="${COULEURS.encre}" font-style="italic">${n.texte}</text>`;
    s += "</g>";
    if (options.legende !== false) s += legende(largeur, hauteurGlace + 18, types, options.noms);
    return s + "</svg>";
  }

  // Diagramme à afficher : les modifications de l'éditeur pas encore enregistrées dans le fichier ont priorité
  function diagrammeDe(id) {
    try {
      const locales = JSON.parse(racine.localStorage.getItem("hockey.diagrammes.v1") || "{}");
      if (id in locales) return locales[id] || undefined;
    } catch (e) { /* pas de localStorage (Node, fichier bloqué) */ }
    return typeof DIAGRAMMES !== "undefined" ? DIAGRAMMES[id] : undefined;
  }

  racine.dessinerDiagramme = dessinerDiagramme;
  racine.diagrammeDe = diagrammeDe;
  racine.OutilsDiagramme = { repere, lissage, courbable, pointsTrajet, positionNumero, largeurEtiquette, VUES };
  if (typeof module !== "undefined") module.exports = { dessinerDiagramme, repere, lissage, courbable, pointsTrajet, positionNumero, largeurEtiquette };
})(typeof window !== "undefined" ? window : globalThis);
