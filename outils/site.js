// En-tête et pied de page communs du site (couleurs des Prédateurs de l'AHMVR).
// Navigateur : <script src="site.js" data-racine=".." data-actif="banque"></script> juste après <body>.
// Node : generer-site.js utilise entete() et pied() pour les pages générées.
// racine = chemin relatif de la page vers le dossier du projet (ex. : "..", "../..").

(function (racine) {
  const LIENS = [
    ["accueil", "Accueil", "index.html"],
    ["M11", "M11-B", "M11-B/index.html"],
    ["M15", "M15-C", "M15-C/index.html"],
    ["banque", "Exercices", "outils/banque-exercices.html"],
    ["plan", "Planificateur", "outils/plan-pratique.html"],
    ["editeur", "Diagrammes", "outils/editeur-diagrammes.html"],
  ];

  const lien = (r, chemin) => (r ? `${r}/${chemin}` : chemin);

  function entete(r, actif) {
    const nav = LIENS.map(([cle, nom, chemin]) =>
      `<a href="${lien(r, chemin)}"${cle === actif ? ' aria-current="page"' : ""}>${nom}</a>`).join("");
    return `<header class="site-entete">
  <a class="marque" href="${lien(r, "index.html")}"><img src="${lien(r, "outils/logo-predateurs.png")}" alt="" width="70" height="40"><span>Prédateurs<small>Coaching 2026-2027</small></span></a>
  <nav class="site-nav" aria-label="Navigation principale">${nav}</nav>
</header>`;
  }

  function pied(r) {
    return `<footer class="site-pied">
  <div class="page">
    <img src="${lien(r, "outils/logo-predateurs.png")}" alt="Prédateurs" width="105" height="60">
    <p><strong>Prédateurs – M11-B et M15-C</strong><br>Système de jeu, planification de saison, pratiques et exercices 2026-2027.</p>
    <p class="petit">Ratios de Hockey Québec · Couleurs des Prédateurs de l'AHMVR</p>
  </div>
</footer>`;
  }

  racine.Site = { entete, pied };
  if (typeof module !== "undefined") module.exports = { entete, pied };

  // Dans le navigateur : insère l'en-tête à la place de la balise script et le pied de page à la fin
  if (typeof document !== "undefined" && document.currentScript) {
    const s = document.currentScript, r = s.dataset.racine ?? "..";
    s.insertAdjacentHTML("beforebegin", entete(r, s.dataset.actif));
    document.addEventListener("DOMContentLoaded", () => document.body.insertAdjacentHTML("beforeend", pied(r)));
  }
})(typeof window !== "undefined" ? window : globalThis);
