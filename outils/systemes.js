// Situations des systèmes de jeu illustrées par un diagramme (dessin dans diagrammes-donnees.js, même code).
// section : titre exact (sans les « ### ») de la section du fichier systeme-de-jeu.md où l'image est insérée.
// Dans ces diagrammes, X = notre équipe (étiquettes D1, D2, C, A1, A2 ou F1, F2, F3) et O = l'adversaire.

const SITUATIONS = [
  { id: "M11_ZD", equipe: "M11", phase: 1, nom: "Zone défensive : PRESSION – SOUTIEN – FILET", section: "1. Zone défensive : « PRESSION – SOUTIEN – FILET »" },
  { id: "M11_SZ", equipe: "M11", phase: 1, nom: "Sortie de zone : MUR – MILIEU – REVERS", section: "2. Sortie de zone : « MUR – MILIEU – REVERS »" },
  { id: "M11_ATT", equipe: "M11", phase: 1, nom: "Entrée de zone : LARGE – FILET – SOUTIEN", section: "3. Attaque et entrée de zone : « LARGE – FILET – SOUTIEN »" },
  { id: "M11_ZO", equipe: "M11", phase: 1, nom: "Zone offensive : TIRE – FILET – POINTE", section: "4. Zone offensive : « TIRE – FILET – POINTE »" },
  { id: "M11_EA", equipe: "M11", phase: 1, nom: "Échec avant 1-2-2", section: "5. Échec avant 1-2-2 : « UN VA, DEUX LISENT, DEUX GARDENT »" },
  { id: "M11_REP", equipe: "M11", phase: 1, nom: "Repli défensif : MILIEU – HOMME – FILET", section: "6. Repli défensif : « MILIEU – HOMME – FILET »" },
  { id: "M11_SZ2", equipe: "M11", phase: 2, nom: "Sortie de zone : REVERS et courbe du centre", section: "Sortie de zone : ajout du changement de côté" },
  { id: "M11_CYC", equipe: "M11", phase: 2, nom: "Attaque : 3c2 en triangle et cycle simple", section: "Attaque : lecture 3 contre 2 et cycle simple" },
  { id: "M11_BOITE", equipe: "M11", phase: 2, nom: "Désavantage numérique : la boîte", section: "Unités spéciales (introduction)" },

  { id: "M15_ZD", equipe: "M15", phase: 1, nom: "Zone défensive : BOÎTE + 1", section: "1. Zone défensive : « BOÎTE + 1 »" },
  { id: "M15_SZ", equipe: "M15", phase: 1, nom: "Sortie de zone : MUR – VITRE – PROFOND", section: "2. Sortie de zone : « MUR – VITRE – PROFOND »" },
  { id: "M15_ZN", equipe: "M15", phase: 1, nom: "Zone neutre et entrée : ENTRE OU PROFOND", section: "3. Zone neutre et entrée : « ENTRE OU PROFOND »" },
  { id: "M15_ZO", equipe: "M15", phase: 1, nom: "Zone offensive : POINTE – BAS – FILET", section: "4. Zone offensive : « POINTE – BAS – FILET »" },
  { id: "M15_EA", equipe: "M15", phase: 1, nom: "Échec avant 1-2-2", section: "5. Échec avant 1-2-2 : « UN VA, DEUX LISENT, DEUX GARDENT »" },
  { id: "M15_REP", equipe: "M15", phase: 1, nom: "Repli : MILIEU – TÊTE SUR L'ÉPAULE – HOMME", section: "6. Repli : « MILIEU – TÊTE SUR L'ÉPAULE – HOMME »" },
  { id: "M15_MAJ", equipe: "M15", phase: 1, nom: "Mise au jeu en zone défensive", section: "7. Mises au jeu (positions fixes, dès la phase 1)" },
  { id: "M15_ZD2", equipe: "M15", phase: 2, nom: "Zone défensive : échange D-C", section: "Zone défensive : échange D-C" },
  { id: "M15_SZ2", equipe: "M15", phase: 2, nom: "Sortie de zone : REVERS et courbe du centre", section: "Sortie de zone : « REVERS » et courbe du centre" },
  { id: "M15_REG", equipe: "M15", phase: 2, nom: "Zone neutre : regroupement", section: "Zone neutre : regroupement" },
  { id: "M15_CYC", equipe: "M15", phase: 2, nom: "Zone offensive : cycle bas", section: "Zone offensive : cycle bas" },
  { id: "M15_EA2", equipe: "M15", phase: 2, nom: "Échec avant 2-1-2", section: "Échec avant : 2-1-2 (rondelle dans le coin adverse)" },
  { id: "M15_AN", equipe: "M15", phase: 2, nom: "Avantage numérique : surcharge côté fort", section: "Unités spéciales" },
];

// Légende des joueurs dans les diagrammes de système
const NOMS_SYSTEME = { X: "Notre équipe", O: "Adversaire" };

if (typeof module !== "undefined") module.exports = { SITUATIONS, NOMS_SYSTEME };
