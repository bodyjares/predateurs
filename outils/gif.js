// Encodeur GIF89a animé, sans dépendance (fonctionne hors ligne, dans le navigateur).
// Sert à « Animation GIF » dans l'éditeur de diagrammes (voir animation.js).
//
//   const pal = EncodeurGIF.palette([rgba1, rgba2, ...]);        // couleurs communes à toutes les images
//   const enc = EncodeurGIF.debut({ largeur, hauteur, palette: pal });
//   enc.ajouter(rgba, 8);                                        // délai en centièmes de seconde
//   const blob = enc.finir();                                    // image/gif
//
// Les images sont réduites à 255 couleurs (coupe médiane) et compressées en LZW. Seule la partie
// qui change d'une image à l'autre est enregistrée : le reste est transparent et laisse voir l'image
// précédente, ce qui garde les fichiers petits (la patinoire ne bouge pas).

(function (racine) {
  const MAX_COULEURS = 255; // la dernière entrée de la palette sert à la transparence
  const cle15 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

  // ─── Palette : coupe médiane sur un histogramme de 32768 cases (5 bits par canal) ───
  function palette(images, max = MAX_COULEURS) {
    const nb = new Uint32Array(32768), sommes = new Float64Array(32768 * 3);
    for (const rgba of images) {
      // Un pixel sur deux suffit pour choisir les couleurs
      for (let i = 0; i < rgba.length; i += 8) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], k = cle15(r, g, b);
        nb[k]++; sommes[k * 3] += r; sommes[k * 3 + 1] += g; sommes[k * 3 + 2] += b;
      }
    }
    const cases = [];
    for (let k = 0; k < 32768; k++) if (nb[k]) cases.push(k);
    if (!cases.length) return new Uint8Array(3);

    // Étalement d'une boîte : le plus grand écart entre ses couleurs, multiplié par son poids
    const canal = (k, c) => (c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31);
    function mesurer(boite) {
      const min = [31, 31, 31], max = [0, 0, 0];
      let poids = 0;
      for (const k of boite) {
        poids += nb[k];
        for (let c = 0; c < 3; c++) { const v = canal(k, c); if (v < min[c]) min[c] = v; if (v > max[c]) max[c] = v; }
      }
      let large = 0, ecart = -1;
      for (let c = 0; c < 3; c++) if (max[c] - min[c] > ecart) { ecart = max[c] - min[c]; large = c; }
      return { large, ecart, poids, score: ecart * Math.log2(poids + 1) };
    }
    let boites = [{ cases, ...mesurer(cases) }];
    while (boites.length < max) {
      let choix = -1, meilleur = 0;
      boites.forEach((b, i) => { if (b.cases.length > 1 && b.ecart > 0 && b.score > meilleur) { meilleur = b.score; choix = i; } });
      if (choix < 0) break;
      const b = boites[choix];
      const triees = b.cases.slice().sort((x, y) => canal(x, b.large) - canal(y, b.large));
      // Coupe à la médiane pondérée : chaque moitié porte à peu près autant de pixels
      let cumul = 0, coupe = 0;
      for (let i = 0; i < triees.length - 1; i++) { cumul += nb[triees[i]]; coupe = i + 1; if (cumul * 2 >= b.poids) break; }
      const gauche = triees.slice(0, coupe), droite = triees.slice(coupe);
      boites.splice(choix, 1, { cases: gauche, ...mesurer(gauche) }, { cases: droite, ...mesurer(droite) });
    }

    const pal = new Uint8Array(boites.length * 3);
    boites.forEach((b, i) => {
      let poids = 0, s = [0, 0, 0];
      for (const k of b.cases) { poids += nb[k]; for (let c = 0; c < 3; c++) s[c] += sommes[k * 3 + c]; }
      for (let c = 0; c < 3; c++) pal[i * 3 + c] = Math.round(s[c] / Math.max(1, poids));
    });
    return pal;
  }

  // Couleur la plus proche dans la palette, avec mémoire des résultats déjà calculés
  function indexeur(pal) {
    const cache = new Int16Array(32768).fill(-1), n = pal.length / 3;
    return (r, g, b) => {
      const k = cle15(r, g, b);
      let v = cache[k];
      if (v >= 0) return v;
      let choix = 0, min = Infinity;
      for (let i = 0; i < n; i++) {
        const dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2];
        const e = dr * dr * 3 + dg * dg * 6 + db * db; // l'œil voit surtout le vert, peu le bleu
        if (e < min) { min = e; choix = i; }
      }
      cache[k] = choix;
      return choix;
    };
  }

  // ─── Compression LZW (variante GIF) ───
  function lzw(indices, minCode, sortie) {
    const CLEAR = 1 << minCode, FIN = CLEAR + 1;
    let taille = minCode + 1, maxCode = (1 << taille) - 1, suivant = FIN + 1;
    let dico = new Map(), accu = 0, bits = 0;
    const bloc = [];
    const vider = () => { sortie.push(bloc.length, ...bloc); bloc.length = 0; };
    const ecrire = (code) => {
      accu |= code << bits; bits += taille;
      while (bits >= 8) { bloc.push(accu & 255); accu >>= 8; bits -= 8; if (bloc.length === 255) vider(); }
    };
    ecrire(CLEAR);
    let prefixe = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], cle = prefixe * 256 + k, v = dico.get(cle);
      if (v !== undefined) { prefixe = v; continue; }
      ecrire(prefixe);
      // Le décodeur ajoute ses entrées une étape plus tard : on élargit le code avant d'ajouter la nôtre,
      // sinon les deux côtés ne lisent plus le même nombre de bits.
      if (suivant > maxCode && taille < 12) { taille++; maxCode = (1 << taille) - 1; }
      if (suivant < 4096) {
        dico.set(cle, suivant++);
      } else {
        ecrire(CLEAR);
        dico = new Map(); suivant = FIN + 1; taille = minCode + 1; maxCode = (1 << taille) - 1;
      }
      prefixe = k;
    }
    ecrire(prefixe);
    ecrire(FIN);
    if (bits > 0) { bloc.push(accu & 255); if (bloc.length === 255) vider(); }
    if (bloc.length) vider();
    sortie.push(0); // fin des blocs de données
  }

  // ─── Fichier ───
  function debut({ largeur, hauteur, palette: pal, boucle = 0 }) {
    const n = pal.length / 3;
    const transparent = n; // index réservé : laisse voir l'image précédente
    let bitsTable = 1;
    while ((1 << bitsTable) < n + 1) bitsTable++; // table de 2, 4, 8 … 256 couleurs
    const taillePal = 1 << bitsTable;
    const octets = (a) => new Uint8Array(a);
    const mot = (v) => [v & 255, (v >> 8) & 255];
    const morceaux = [];
    const index = indexeur(pal);

    // En-tête, écran logique et palette globale
    const table = new Uint8Array(taillePal * 3);
    table.set(pal);
    morceaux.push(octets([...[..."GIF89a"].map((c) => c.charCodeAt(0)),
      ...mot(largeur), ...mot(hauteur), 0x80 | (bitsTable - 1), 0, 0]), table);
    // Répétition en boucle (extension NETSCAPE)
    morceaux.push(octets([0x21, 0xff, 11, ...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)), 3, 1, ...mot(boucle), 0]));

    let avant = null;
    const total = largeur * hauteur;

    function ajouter(rgba, delai = 8) {
      const courant = new Uint8Array(total);
      for (let p = 0, i = 0; p < total; p++, i += 4) courant[p] = index(rgba[i], rgba[i + 1], rgba[i + 2]);
      // Cadre des pixels qui changent : seule cette zone est enregistrée
      let x0 = 0, y0 = 0, x1 = largeur - 1, y1 = hauteur - 1;
      if (avant) {
        x0 = largeur; y0 = hauteur; x1 = -1; y1 = -1;
        for (let y = 0; y < hauteur; y++) {
          const l = y * largeur;
          for (let x = 0; x < largeur; x++) {
            if (courant[l + x] === avant[l + x]) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        if (x1 < 0) { x0 = y0 = x1 = y1 = 0; } // image identique : un seul pixel suffit
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const zone = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const src = (y + y0) * largeur + x0, dst = y * w;
        for (let x = 0; x < w; x++) {
          const v = courant[src + x];
          zone[dst + x] = avant && v === avant[src + x] ? transparent : v;
        }
      }
      // Contrôle graphique (délai, transparence, on garde l'image précédente) puis l'image
      morceaux.push(octets([0x21, 0xf9, 4, (1 << 2) | (avant ? 1 : 0), ...mot(Math.max(2, Math.round(delai))), transparent, 0,
        0x2c, ...mot(x0), ...mot(y0), ...mot(w), ...mot(h), 0]));
      const donnees = [Math.max(2, bitsTable)];
      lzw(zone, Math.max(2, bitsTable), donnees);
      morceaux.push(octets(donnees));
      avant = courant;
    }

    const finir = () => {
      morceaux.push(octets([0x3b]));
      return new Blob(morceaux, { type: "image/gif" });
    };
    return { ajouter, finir, transparent };
  }

  const EncodeurGIF = { palette, debut };
  racine.EncodeurGIF = EncodeurGIF;
  if (typeof module !== "undefined") module.exports = EncodeurGIF;
})(typeof window !== "undefined" ? window : globalThis);
