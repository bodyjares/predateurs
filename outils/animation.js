// Animation des diagrammes : fait jouer les étapes (numéros) d'un diagramme, avec un lecteur.
// Navigateur : AnimationDiagramme.creer(conteneur, diagramme, { titre?, noms?, auto? }) → { jouer, pause, aller, detruire, plan }
// Node : planifier(diagramme) calcule la ligne du temps sans DOM (sert à verifier-animations.js).
//
// Règles de lecture d'un diagramme :
//   - Les étapes jouent dans l'ordre des numéros. Des trajets avec le même numéro jouent en même temps.
//     Les trajets sans numéro jouent avec la première étape.
//   - Dans une étape, un trajet qui part de la fin d'un autre attend qu'il finisse : le même joueur
//     qui enchaîne (départ « depuisJoueur: false »), ou le joueur qui reçoit une passe puis repart.
//   - Une passe part au bon moment pour arriver en même temps que le joueur qui patine vers sa cible.
//   - La rondelle suit son porteur ; après une passe, le joueur à moins de 5 pi de l'arrivée la reçoit.
//     Sans receveur (ou après un tir), elle reste sur place et le prochain qui passe de là la reprend.
//     L'entraîneur (C) a toujours une rondelle. Une passe sans numéro, dans un diagramme numéroté, est une option :
//     elle reste affichée sans être animée. Deux passes d'étapes différentes qui partent du même endroit sont
//     des options : la rondelle revient au passeur.
//   - Une passe qui part d'un point de mise au jeu sans rondelle est une mise au jeu. Un joueur qui arrive sur
//     la ligne d'une passe (dans la même étape) l'intercepte. À la fin de son trajet, un joueur ramasse une
//     rondelle libre à moins de 8 pi (rondelle envoyée en profondeur).
//   - Un patin est coupé là où une passe d'une étape suivante part ou arrive en plein trajet (passes en mouvement).
//   - Vitesses à 1× (pi/s) : patin 15, arrière 10, avec rondelle 13, passe 50, tir 80.

(function (racine) {
  const O = racine.OutilsDiagramme || require("./diagrammes.js");
  const dessiner = racine.dessinerDiagramme || O.dessinerDiagramme;

  const VITESSE = { patin: 15, arriere: 10, rondelle: 13, passe: 50, tir: 80 };
  const MOUVEMENTS = new Set(["patin", "arriere", "rondelle"]);
  const DUREE_MIN = 0.35, ETAPE_MIN = 0.5, PAUSE = 0.4, DEPART = 0.3;
  const PRES = 4, RECEPTION = 5, LOIN = 8, PILE = 9;
  const PORTEE = [2.4, 1.9]; // rondelle portée : décalée du centre du joueur, comme dans le dessin

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const debutDe = (t) => t.points[0];
  const finDe = (t) => t.points[t.points.length - 1];
  const adoucir = (u) => 0.6 * u + 0.4 * u * u * (3 - 2 * u); // départ et arrêt un peu plus doux
  const numeroDe = (t) => (t.numero ? String(t.numero) : null);
  // Point de la ligne a→b le plus proche de p, s'il est à moins de 3 pi (et pas collé aux bouts)
  function surLigne(p, a, b) {
    const L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1;
    const u = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2;
    const c = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    return u > 0.1 && u < 0.9 && dist(c, p) <= 3 ? c : null;
  }
  // Points de mise au jeu : une passe qui en part sans rondelle est une mise au jeu
  const MISES_AU_JEU = [[31, 20.5], [31, 64.5], [169, 20.5], [169, 64.5], [80, 20.5], [80, 64.5], [120, 20.5], [120, 64.5], [100, 42.5]];
  // Près de la bande : une passe qui y finit sans receveur est un dégagement (vitre, bande, profondeur)
  const presBande = (p) => {
    if (p[1] <= 6 || p[1] >= 79 || p[0] <= 6 || p[0] >= 194) return true;
    // Coins arrondis (rayon 28 pi) : à moins de 6 pi de la courbe
    const cx = p[0] < 28 ? 28 : p[0] > 172 ? 172 : null, cy = p[1] < 28 ? 28 : p[1] > 57 ? 57 : null;
    return cx !== null && cy !== null && dist(p, [cx, cy]) >= 22;
  };

  function longueurs(pts) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i]));
    return L;
  }

  function pointA(pts, L, u) {
    const s = u * L[L.length - 1];
    let i = 1;
    while (i < L.length - 1 && L[i] < s) i++;
    const seg = L[i] - L[i - 1] || 1, v = Math.min(1, Math.max(0, (s - L[i - 1]) / seg));
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * v, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * v];
  }

  // ─── Ligne du temps ───
  function planifier(d) {
    const joueurs = d.joueurs || [], trajets = d.trajets || [];
    const piles = d.rondelles || [];
    const avertissements = [];
    const avertir = (code, trajet, message) => avertissements.push({ code, trajet, message });
    const nom = (i) => `trajet ${i + 1} (${trajets[i].type}${trajets[i].numero ? `, étape ${trajets[i].numero}` : ""})`;

    // Étapes : numéros triés (2 avant 10). Sans numéro : un mouvement joue avec la première étape,
    // une passe ou un tir est une option (affichée, pas animée).
    const valides = trajets.map((t, i) => i).filter((i) => (trajets[i].points || []).length >= 2);
    const numeros = [...new Set(valides.map((i) => numeroDe(trajets[i])).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    const etapeDe = {}, options = new Set();
    for (const i of valides) {
      const n = numeroDe(trajets[i]);
      if (!n && numeros.length && !MOUVEMENTS.has(trajets[i].type)) {
        options.add(i);
        avertir("trajet-sans-numero", i, `${nom(i)} sans numéro : affiché comme option, sans animation`);
        continue;
      }
      etapeDe[i] = n ? numeros.indexOf(n) : 0;
    }
    // Un mouvement sans numéro joue avec la première étape (ex. : les D qui reculent). À vérifier seulement
    // s'il part ou arrive là où commence ou finit un trajet d'une étape suivante (il devrait alors s'y enchaîner).
    for (const i of valides) {
      if (numeroDe(trajets[i]) || options.has(i) || !numeros.length) continue;
      const bouts = [debutDe(trajets[i]), finDe(trajets[i])];
      const lie = valides.some((j) => etapeDe[j] > 0 && [debutDe(trajets[j]), finDe(trajets[j])].some((q) => bouts.some((b) => dist(b, q) <= RECEPTION)));
      if (lie) avertir("trajet-sans-numero", i, `${nom(i)} sans numéro : joue avec l'étape ${numeros[0]}, mais semble lié à une étape suivante`);
    }
    // Sans numéros, tout joue en même temps (situations de position) : à vérifier s'il y a plusieurs passes ou tirs
    if (!numeros.length && valides.filter((i) => !MOUVEMENTS.has(trajets[i].type)).length > 1)
      avertir("sans-numero", null, "aucun numéro d'étape alors qu'il y a plusieurs passes ou tirs : tout joue en même temps");

    // Unités de temps. Un mouvement est coupé là où une passe d'une étape suivante part ou arrive
    // en plein trajet (passes en mouvement) : chaque morceau joue avec l'étape de sa passe.
    const unites = [], parties = trajets.map(() => []);
    const ajouterUnite = (src, t, a, b, etape, rang) => { parties[src].push(unites.length); unites.push({ src, t, a, b, etape, rang }); };
    const lances = valides.filter((i) => !MOUVEMENTS.has(trajets[i].type) && !options.has(i));
    for (const i of valides) {
      if (options.has(i)) continue;
      const t = trajets[i], e = etapeDe[i];
      if (!MOUVEMENTS.has(t.type)) { ajouterUnite(i, t, 0, 1, e, 0); continue; }
      const pts = O.lissage(t), L = longueurs(pts), tot = L[L.length - 1];
      const coupes = [];
      for (const j of lances) {
        if (etapeDe[j] < e) continue;
        for (const P of [debutDe(trajets[j]), finDe(trajets[j])]) {
          let m = 0;
          pts.forEach((q, n) => { if (dist(q, P) < dist(pts[m], P)) m = n; });
          if (dist(pts[m], P) > RECEPTION || L[m] < 3 || L[m] > tot - 3) continue;
          if (joueurs.some((jj) => dist([jj.x, jj.y], P) <= PRES)) continue; // un joueur attend déjà là
          const autre = valides.some((x) => x !== i && MOUVEMENTS.has(trajets[x].type) && etapeDe[x] === etapeDe[j] &&
            [debutDe(trajets[x]), finDe(trajets[x])].some((q) => dist(q, P) <= PRES));
          if (!autre) coupes.push({ n: m, s: L[m], e: etapeDe[j] });
        }
      }
      coupes.sort((a, b) => a.s - b.s);
      const gardees = [];
      for (const c of coupes) {
        const der = gardees[gardees.length - 1];
        if (der && c.s - der.s < 3) der.e = Math.min(der.e, c.e);
        else gardees.push(c);
      }
      if (!gardees.length) { ajouterUnite(i, t, 0, 1, e, 0); continue; }
      const bornes = [...gardees, { n: pts.length - 1, s: tot, e: gardees[gardees.length - 1].e }];
      let de = 0, etape = e;
      bornes.forEach((c, k) => {
        etape = k === 0 ? e : Math.max(etape, c.e);
        ajouterUnite(i, { type: t.type, points: pts.slice(de, c.n + 1), forme: "droit", depuisJoueur: k ? false : t.depuisJoueur }, L[de] / tot, c.s / tot, etape, k);
        de = c.n;
      });
    }
    const etapes = (numeros.length ? numeros : [null]).map((numero, e) => ({ numero, indices: unites.map((u, n) => n).filter((n) => unites[n].etape === e) }));

    // Mouvements des joueurs (triés par début) et phases des rondelles
    const mvts = joueurs.map(() => []);
    function posJoueur(k, T) {
      let p = [joueurs[k].x, joueurs[k].y];
      for (const m of mvts[k]) {
        if (T < m.t0) break;
        p = T >= m.t1 ? m.arrivee : m.point((T - m.t0) / (m.t1 - m.t0));
      }
      return p;
    }
    function joueurPres(p, T, tol, exclus = new Set()) {
      let meilleur = null, dMin = tol;
      joueurs.forEach((j, k) => {
        if (exclus.has(k)) return;
        const dk = dist(posJoueur(k, T), p);
        if (dk <= dMin) { dMin = dk; meilleur = k; }
      });
      return meilleur;
    }

    const rondelles = [];
    joueurs.forEach((j, k) => { if (j.rondelle) rondelles.push({ initiale: true, phases: [{ debut: -Infinity, mode: "porte", joueur: k }] }); });
    const phaseA = (r, T) => { let ph = null; for (const x of r.phases) if (x.debut <= T) ph = x; return ph; };
    const ajouterPhase = (r, ph) => { r.phases.push(ph); r.phases.sort((a, b) => a.debut - b.debut); return ph; };
    function posRondelle(r, T) {
      const ph = phaseA(r, T);
      if (!ph || ph.mode === "cache") return null;
      if (ph.mode === "porte") return plus(posJoueur(ph.joueur, T), PORTEE);
      if (ph.mode === "vol" && T < ph.fin) {
        const u = (T - ph.debut) / (ph.fin - ph.debut);
        return [ph.a[0] + (ph.b[0] - ph.a[0]) * u, ph.a[1] + (ph.b[1] - ph.a[1]) * u];
      }
      return ph.mode === "vol" ? ph.b : ph.p;
    }
    const rondelleDe = (k, T) => rondelles.find((r) => { const ph = phaseA(r, T); return ph && ph.mode === "porte" && ph.joueur === k; });
    const rondelleLibre = (p, T, tol = RECEPTION) => rondelles.find((r) => { const ph = phaseA(r, T); return ph && ph.mode === "libre" && dist(ph.p, p) <= tol; });
    const pilePres = (p) => piles.some((q) => dist(q, p) <= PILE);
    const nouvelleRondelle = () => { const r = { initiale: false, phases: [] }; rondelles.push(r); return r; };
    const lancesFaits = [];

    const res = unites.map(() => null);
    const plan = { etapes: [], unites, parties, resultats: res, rondelles, avertissements, duree: 0 };
    let T = DEPART;

    for (const [e, etape] of etapes.entries()) {
      const debut = T, idx = etape.indices, tr = (u) => unites[u].t;
      const porteurs = joueurs.map((j, k) => k).filter((k) => rondelleDe(k, debut));
      const porteurAu = (p) => porteurs.some((k) => dist(posJoueur(k, debut), p) <= PRES);
      const joueurAu = (p) => joueurPres(p, debut, PRES) !== null;
      const plusProche = (p, tol, filtre) => {
        let m, dMin = tol;
        for (const j of idx) if (filtre(j) && dist(finDe(tr(j)), p) <= dMin) { dMin = dist(finDe(tr(j)), p); m = j; }
        return m;
      };
      const estMouvement = (j) => MOUVEMENTS.has(tr(j).type), estPasse = (j) => tr(j).type === "passe";

      // Dépendances : unité qui doit finir avant (pred) et mouvement avec lequel une passe arrive (synchro)
      const pred = {}, synchro = {}, interceptions = {};
      const atteint = (i, cible) => {
        const vus = new Set(), pile = [i];
        while (pile.length) {
          const j = pile.pop();
          if (j === cible) return true;
          if (vus.has(j)) continue;
          vus.add(j);
          for (const x of [pred[j], synchro[j]]) if (x !== undefined) pile.push(x);
        }
        return false;
      };
      const lier = (table, i, j) => { if (j !== undefined && j !== i && !atteint(j, i)) table[i] = j; };
      for (const i of idx) {
        const t = tr(i), s = debutDe(t), autre = (f) => (j) => j !== i && f(j);
        if (MOUVEMENTS.has(t.type)) {
          if (t.type === "rondelle" && porteurAu(s)) continue;
          if (t.type === "rondelle") {
            const passe = plusProche(s, RECEPTION, autre(estPasse));
            if (passe !== undefined) { lier(pred, i, passe); continue; }
          }
          if (t.depuisJoueur === false || !joueurAu(s)) lier(pred, i, plusProche(s, PRES, autre(estMouvement)));
        } else {
          if (!porteurAu(s)) {
            const passe = plusProche(s, RECEPTION, autre(estPasse));
            lier(pred, i, passe !== undefined ? passe : plusProche(s, RECEPTION, autre(estMouvement)));
          }
          if (t.type !== "passe") continue;
          const mvtLibre = autre((j) => estMouvement(j) && dist(debutDe(tr(j)), s) > PRES);
          const cible = plusProche(finDe(t), RECEPTION, mvtLibre);
          if (cible !== undefined) { lier(synchro, i, cible); continue; }
          for (const j of idx) {
            if (!mvtLibre(j)) continue;
            const c = surLigne(finDe(tr(j)), s, finDe(t));
            if (c && dist(c, finDe(t)) >= LOIN) { lier(synchro, i, j); if (synchro[i] === j) interceptions[i] = c; break; }
          }
        }
      }

      // Ordre de résolution : chaque unité après ses dépendances
      const ordre = [], faits = new Set();
      while (ordre.length < idx.length) {
        const prets = idx.filter((i) => !faits.has(i) && [pred[i], synchro[i]].every((x) => x === undefined || faits.has(x)));
        for (const i of prets.length ? prets : idx.filter((i) => !faits.has(i)).slice(0, 1)) { ordre.push(i); faits.add(i); }
      }

      const partis = new Set(); // joueurs qui partent déjà de leur position au début de l'étape
      for (const i of ordre) {
        const t = tr(i), src = unites[i].src, s = debutDe(t), p = pred[i] !== undefined ? res[pred[i]] : null;
        const pret = p ? p.t1 : debut;

        if (MOUVEMENTS.has(t.type)) {
          const pts = O.lissage(t), L = longueurs(pts);
          const duree = Math.max(DUREE_MIN, L[L.length - 1] / VITESSE[t.type]);
          let k = null;
          if (p && !p.mouvement) k = p.receveur ?? joueurPres(s, pret, RECEPTION);
          else if (p) k = p.joueur;
          else {
            k = joueurPres(s, debut, PRES, partis);
            if (k === null) k = joueurPres(s, debut, LOIN, partis);
            if (k !== null) partis.add(k);
          }
          let t0 = pret;
          if (k === null) {
            avertir("sans-joueur", src, `${nom(src)} : aucun joueur au départ (seul le trait se dessine)`);
            res[i] = { type: t.type, joueur: null, t0, t1: t0 + duree, mouvement: true };
            continue;
          }
          // Receveur trouvé après coup : la passe précédente lui revient
          if (p && p.type === "passe" && p.receveur === null) {
            p.receveur = k;
            Object.assign(p.apres, { mode: "porte", joueur: k });
            p.vol.b = plus(posJoueur(k, p.t1), PORTEE);
          }
          for (const m of mvts[k]) if (m.t1 > t0 && m.t0 < t0 + duree) t0 = m.t1; // un joueur ne fait qu'un trajet à la fois
          const depart = posJoueur(k, t0), ecart = [depart[0] - pts[0][0], depart[1] - pts[0][1]];
          if (dist(depart, pts[0]) > PRES) avertir("loin-du-depart", src, `${nom(src)} : le joueur le plus proche est à ${dist(depart, pts[0]).toFixed(0)} pi du départ`);
          const m = {
            t0, t1: t0 + duree, arrivee: pts[pts.length - 1],
            // Le joueur glisse de sa position réelle vers le tracé pendant le trajet (pas de saut)
            point: (u) => { const v = adoucir(u), q = pointA(pts, L, v); return [q[0] + ecart[0] * (1 - v), q[1] + ecart[1] * (1 - v)]; },
          };
          mvts[k].push(m);
          mvts[k].sort((a, b) => a.t0 - b.t0);
          // Rondelle : le joueur la ramasse (libre ou dans une pile) ; la suite d'un trajet coupé après une passe n'en crée pas
          if (t.type === "rondelle" && !rondelleDe(k, t0) && unites[i].rang === 0) {
            const libre = rondelleLibre(s, t0, LOIN);
            if (!libre && !pilePres(s)) avertir("rondelle-creee", src, `${nom(src)} : le joueur n'a pas de rondelle (elle apparaît au départ)`);
            ajouterPhase(libre || nouvelleRondelle(), { debut: t0, mode: "porte", joueur: k });
          }
          res[i] = { type: t.type, joueur: k, t0, t1: t0 + duree, mouvement: true, arrivee: m.arrivee };
        } else {
          let k = null, r = null;
          if (p && !p.mouvement) { k = p.receveur; r = p.rondelle; }
          else if (p) k = p.joueur;
          else k = joueurPres(s, debut, LOIN, new Set(joueurs.map((j, q) => q).filter((q) => !porteurs.includes(q)))) ?? joueurPres(s, debut, PRES);
          const cible = interceptions[i] || (t.type === "tir" ? O.pointsTrajet(t, joueurs).slice(-1)[0] : finDe(t));
          const duree = Math.max(DUREE_MIN, dist(s, cible) / VITESSE[t.type]);
          let t0 = pret, receveur = null;
          const m = synchro[i] !== undefined ? res[synchro[i]] : null;
          if (m && m.joueur !== null && m.joueur !== k) { t0 = Math.max(t0, m.t1 - duree); receveur = m.joueur; }
          const t1 = t0 + duree;
          if (t.type === "passe" && receveur === null) receveur = joueurPres(cible, t1, RECEPTION, new Set(k === null ? [] : [k]));
          if (!r && k !== null) r = rondelleDe(k, t0);
          if (!r) r = rondelleLibre(s, t0) || rondelleLibre(k !== null ? posJoueur(k, t0) : s, t0, LOIN);
          let depart = null;
          if (!r) {
            // Même départ qu'une autre passe : c'est une autre option, la rondelle revient au passeur
            // (celle d'une étape précédente disparaît ; des options de la même étape partent ensemble)
            const option = lancesFaits.find((x) => x.etape <= e && dist(x.s, s) <= PRES);
            depart = MISES_AU_JEU.find((q) => dist(q, s) <= PRES) || null;
            if (option && option.etape < e) ajouterPhase(option.rondelle, { debut: t0, mode: "cache" });
            if (!option && !depart && !pilePres(s) && !(k !== null && joueurs[k].type === "C")) avertir("rondelle-creee", src, `${nom(src)} : ${k === null ? "aucun joueur ni rondelle au départ" : "le passeur n'a pas de rondelle"} (elle apparaît au départ)`);
            r = nouvelleRondelle();
          }
          const a = posRondelle(r, t0) || depart || (k !== null ? plus(posJoueur(k, t0), PORTEE) : s);
          const vol = ajouterPhase(r, { debut: t0, fin: t1, mode: "vol", a, b: receveur !== null ? plus(posJoueur(receveur, t1), PORTEE) : cible });
          const apres = ajouterPhase(r, receveur !== null ? { debut: t1, mode: "porte", joueur: receveur } : { debut: t1, mode: "libre", p: cible });
          lancesFaits.push({ s, rondelle: r, etape: e });
          res[i] = { type: t.type, joueur: k, receveur, rondelle: r, vol, apres, t0, t1, mouvement: false, cible };
        }
      }

      let fin = Math.max(debut + ETAPE_MIN, ...idx.map((i) => res[i].t1));
      // Rondelle libre près de l'arrivée d'un trajet : le joueur le plus proche la ramasse (ex. : rondelle dans le coin)
      const ramassages = idx.filter((i) => res[i].mouvement && res[i].joueur !== null)
        .map((i) => ({ x: res[i], r: rondelleLibre(res[i].arrivee, fin, LOIN) }))
        .filter((c) => c.r).sort((a, b) => dist(a.x.arrivee, phaseA(a.r, fin).p) - dist(b.x.arrivee, phaseA(b.r, fin).p));
      for (const { x, r } of ramassages) {
        if (rondelleDe(x.joueur, fin) || phaseA(r, fin).mode !== "libre") continue;
        ajouterPhase(r, { debut: Math.max(x.t1, phaseA(r, fin).debut), mode: "porte", joueur: x.joueur });
      }
      plan.etapes.push({ numero: etape.numero, debut, fin });
      T = fin + PAUSE;
    }

    res.forEach((x, i) => {
      if (!x || x.type !== "passe" || x.receveur !== null) return;
      const ramassee = x.rondelle.phases.some((ph) => ph.debut > x.t1 && ph.mode !== "libre");
      if (!ramassee && !presBande(x.cible)) avertir("sans-receveur", unites[i].src, `${nom(unites[i].src)} : personne à l'arrivée (la rondelle reste sur place)`);
    });
    plan.duree = plan.etapes[plan.etapes.length - 1].fin;
    plan.positionJoueur = posJoueur;
    plan.positionRondelle = (n, T) => posRondelle(rondelles[n], T);
    return plan;
  }

  // État du diagramme au temps T (secondes à 1×). trajets : part dessinée de chaque trajet (0 à 1).
  function evaluer(plan, T, joueurs) {
    let etape = 0;
    plan.etapes.forEach((e, n) => { if (T >= e.debut) etape = n; });
    const avance = (x) => {
      if (T >= x.t1) return 1;
      if (T <= x.t0) return 0;
      const u = (T - x.t0) / (x.t1 - x.t0);
      return x.mouvement ? adoucir(u) : u;
    };
    return {
      etape,
      joueurs: joueurs.map((j, k) => plan.positionJoueur(k, T)),
      rondelles: plan.rondelles.map((r, n) => plan.positionRondelle(n, T)),
      trajets: plan.parties.map((us) => (us.length ? us.reduce((s, u) => s + (plan.unites[u].b - plan.unites[u].a) * avance(plan.resultats[u]), 0) : 1)),
    };
  }

  // ─── Lecteur (navigateur) ───
  const NS = "http://www.w3.org/2000/svg";
  const ICONES = {
    jouer: '<path d="M4 2.5v11l9-5.5z"/>',
    pause: '<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/>',
    prec: '<path d="M2.5 2.5h2v11h-2zM14 2.5v11l-8-5.5z"/>',
    suiv: '<path d="M11.5 2.5h2v11h-2zM2 2.5v11l8-5.5z"/>',
  };
  const icone = (n) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">${ICONES[n]}</svg>`;
  const ROUGE = "#bf1e2d";
  let compteur = 0;

  function creer(conteneur, d, options = {}) {
    const plan = planifier(d);
    const id = `anim${++compteur}`;
    const N = plan.etapes.length;
    conteneur.innerHTML = `<div class="anim-scene">${dessiner(d, options)}</div>
<div class="lecteur" role="group" aria-label="Animation du diagramme">
  <button type="button" class="l-jouer" aria-label="Jouer">${icone("jouer")}</button>
  <button type="button" class="l-prec" aria-label="Étape précédente" title="Étape précédente">${icone("prec")}</button>
  <button type="button" class="l-suiv" aria-label="Étape suivante" title="Étape suivante">${icone("suiv")}</button>
  <input type="range" class="l-temps" min="0" max="1000" value="0" aria-label="Position dans l'animation">
  <span class="l-etape" aria-live="polite"></span>
  <select class="l-vitesse" aria-label="Vitesse"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
  <label class="l-option"><input type="checkbox" class="l-pas"> Arrêt à chaque étape</label>
  <label class="l-option"><input type="checkbox" class="l-boucle"> En boucle</label>
</div>`;
    const $ = (s) => conteneur.querySelector(s);
    const svg = $("svg"), glace = svg.querySelector("g.glace");
    const E = O.repere(d.vue).echelle;
    const defs = document.createElementNS(NS, "defs");
    glace.prepend(defs);

    // Trajets : une copie pâle montre le chemin à venir, un masque dévoile l'original au fil du trajet
    const traces = [...glace.querySelectorAll(":scope > g.trajet")].map((g) => {
      const i = +g.dataset.i;
      const pale = g.cloneNode(true);
      pale.setAttribute("class", "trajet-pale");
      pale.setAttribute("opacity", "0.2");
      pale.style.display = "none";
      g.before(pale);
      const masque = document.createElementNS(NS, "mask");
      masque.id = `${id}-t${i}`;
      for (const [a, v] of [["maskUnits", "userSpaceOnUse"], ["x", -1e4], ["y", -1e4], ["width", 3e4], ["height", 3e4]]) masque.setAttribute(a, v);
      const chemin = document.createElementNS(NS, "path");
      const pts = O.pointsTrajet(d.trajets[i], d.joueurs || []);
      chemin.setAttribute("d", "M" + pts.map((p) => `${(p[0] * E).toFixed(1)},${(p[1] * E).toFixed(1)}`).join("L"));
      for (const [a, v] of [["fill", "none"], ["stroke", "#fff"], ["stroke-width", 3.5 * E], ["pathLength", 1], ["stroke-dasharray", "1 1"]]) chemin.setAttribute(a, v);
      masque.append(chemin);
      defs.append(masque);
      return { g, pale, chemin, i };
    });
    const pions = [...glace.querySelectorAll(":scope > g.joueur")];
    const portees = [...glace.querySelectorAll(".rondelle-portee")];
    const numeros = [...glace.querySelectorAll(":scope > g.numero")].map((g) => ({
      g, numero: String(d.trajets[+g.dataset.i].numero), cercle: g.querySelector("circle"), texte: g.querySelector("text"),
    }));
    for (const n of numeros) n.origine = [n.cercle.getAttribute("fill"), n.cercle.getAttribute("stroke"), n.texte.getAttribute("fill")];
    const disques = plan.rondelles.map(() => {
      const c = document.createElementNS(NS, "circle");
      for (const [a, v] of [["r", 0.8 * E], ["fill", "#0b0b0b"], ["stroke", "#fff"], ["stroke-width", 1.2]]) c.setAttribute(a, v);
      c.style.display = "none";
      glace.append(c);
      return c;
    });

    let T = 0, anime = false, lecture = false, dernier = null, raf = 0, vitesse = 1;
    const bouton = $(".l-jouer"), temps = $(".l-temps"), libelle = $(".l-etape");

    function afficher() {
      const t = Math.min(T, plan.duree), ev = evaluer(plan, t, d.joueurs || []);
      for (const x of traces) {
        const p = ev.trajets[x.i];
        x.pale.style.display = "";
        x.g.style.visibility = p <= 0 ? "hidden" : "";
        if (p > 0 && p < 1) { x.g.setAttribute("mask", `url(#${id}-t${x.i})`); x.chemin.setAttribute("stroke-dashoffset", 1 - p); }
        else x.g.removeAttribute("mask");
      }
      for (const g of pions) {
        const k = +g.dataset.i, j = d.joueurs[k], p = ev.joueurs[k];
        g.setAttribute("transform", `translate(${((p[0] - j.x) * E).toFixed(1)},${((p[1] - j.y) * E).toFixed(1)})`);
      }
      for (const c of portees) c.style.display = "none";
      disques.forEach((c, n) => {
        const p = ev.rondelles[n];
        c.style.display = p ? "" : "none";
        if (p) { c.setAttribute("cx", (p[0] * E).toFixed(1)); c.setAttribute("cy", (p[1] * E).toFixed(1)); }
      });
      const courant = plan.etapes[ev.etape].numero;
      for (const n of numeros) {
        const actif = n.numero === courant;
        n.cercle.setAttribute("fill", actif ? ROUGE : n.origine[0]);
        n.cercle.setAttribute("stroke", actif ? ROUGE : n.origine[1]);
        n.texte.setAttribute("fill", actif ? "#fff" : n.origine[2]);
      }
      temps.value = Math.round((t / plan.duree) * 1000);
      libelle.textContent = `Étape ${ev.etape + 1} / ${N}`;
    }

    function statique() {
      for (const x of traces) { x.pale.style.display = "none"; x.g.style.visibility = ""; x.g.removeAttribute("mask"); }
      for (const g of pions) g.removeAttribute("transform");
      for (const c of portees) c.style.display = "";
      for (const c of disques) c.style.display = "none";
      numeros.forEach((n) => { n.cercle.setAttribute("fill", n.origine[0]); n.cercle.setAttribute("stroke", n.origine[1]); n.texte.setAttribute("fill", n.origine[2]); });
      temps.value = 0;
      libelle.textContent = N > 1 ? `${N} étapes` : "1 étape";
    }

    function etatBouton() {
      bouton.innerHTML = icone(lecture ? "pause" : "jouer");
      bouton.setAttribute("aria-label", lecture ? "Pause" : "Jouer");
    }

    function boucle(maintenant) {
      if (!lecture) return;
      const avant = T;
      T += dernier === null ? 0 : ((maintenant - dernier) / 1000) * vitesse;
      dernier = maintenant;
      if ($(".l-pas").checked) {
        const arret = plan.etapes.find((e, n) => n < N - 1 && avant < e.fin && T >= e.fin);
        if (arret) { T = arret.fin; pause(); afficher(); return; }
      }
      if (T >= plan.duree + ($(".l-boucle").checked ? 1.2 : 0)) {
        if ($(".l-boucle").checked) T = 0;
        else { T = plan.duree; pause(); afficher(); return; }
      }
      afficher();
      raf = requestAnimationFrame(boucle);
    }

    function jouer() {
      if (lecture) return;
      if (!anime || T >= plan.duree) T = 0;
      anime = lecture = true;
      dernier = null;
      etatBouton();
      raf = requestAnimationFrame(boucle);
    }
    function pause() { lecture = false; cancelAnimationFrame(raf); etatBouton(); }
    function aller(t) { anime = true; T = Math.max(0, Math.min(plan.duree, t)); afficher(); }

    // Arrêts des boutons d'étape : le départ, puis la fin de chaque étape
    const arrets = [0, ...plan.etapes.map((e) => e.fin)];
    bouton.addEventListener("click", () => (lecture ? pause() : jouer()));
    $(".l-suiv").addEventListener("click", () => { pause(); aller(arrets.find((a) => a > T + 0.01) ?? plan.duree); });
    $(".l-prec").addEventListener("click", () => { pause(); aller([...arrets].reverse().find((a) => a < T - 0.01) ?? 0); });
    temps.addEventListener("input", () => { pause(); aller((temps.value / 1000) * plan.duree); });
    $(".l-vitesse").addEventListener("change", (e) => { vitesse = +e.target.value; });

    statique();
    if (options.auto) jouer();
    return { plan, jouer, pause, aller, statique, detruire: pause };
  }

  const AnimationDiagramme = { planifier, evaluer, creer };
  racine.AnimationDiagramme = AnimationDiagramme;
  if (typeof module !== "undefined") module.exports = AnimationDiagramme;
})(typeof window !== "undefined" ? window : globalThis);
