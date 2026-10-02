// Plans de pratique modèles – chargeables dans plan-pratique.html
// et convertis en fiches Markdown par generer-plans.js (node outils/generer-plans.js)
//
// Hypothèses : 1 pratique par semaine (M11-B en demi-glace, M15-C en pleine glace),
// plage de 60 min moins ~10 min de resurfaçage = 50 min de glace,
// dont ~5 min de consignes et de transitions, soit 45 min d'exercices
// sur lesquelles on calcule les ratios.

const MODELES = [
  {
    id: "M11-S01",
    equipe: "M11",
    titre: "Semaine 1",
    theme: "Zone défensive : PRESSION – SOUTIEN – FILET",
    dureeGlace: 50,
    consignes: 5,
    objectifs: [
      "Introduire les rôles en zone défensive (phase 1).",
      "Tête sur l'épaule avant de toucher la rondelle.",
      "Lecture du 2c1 : « fais choisir le défenseur ».",
    ],
    tableau: "Vestiaire (3 min) : dessiner la zone défensive, les 4 rôles, et demander : « Pourquoi il faut toujours quelqu'un devant le filet? »",
    lignes: [
      { id: "T01", minutes: 5, notes: "Demi-glace : 3 groupes (2 cercles + demi-cercle central). Rondelle au 2e tour. Le coach lève des doigts : les joueurs crient le nombre." },
      { id: "T13", minutes: 6, notes: "Commencer par 2 couleurs, puis 3." },
      { id: "T12", minutes: 7, notes: "Tous les joueurs passent (pas seulement les D). Couleurs : bleu = MUR, rouge = MILIEU, blanc = REVERS." },
      { id: "T11", minutes: 5, notes: "L'ailier crie MUR! avant de recevoir." },
      { id: "TI03", minutes: 6, notes: "Après chaque essai, demander au porteur : « Qu'est-ce que le D a fait? »" },
      { id: "TI12", minutes: 5, notes: "Enchaîner : l'interception → sortie le long du MUR." },
      { id: "TC05", minutes: 5, notes: "Ralenti seulement. Arrêts sur image : chaque joueur nomme son rôle." },
      { id: "TC11", minutes: 6, notes: "Règle : un but compte seulement si un joueur est devant le filet (FILET!)." },
    ],
  },
  {
    id: "M11-S02",
    equipe: "M11",
    titre: "Semaine 2",
    theme: "Sortie de zone : MUR – MILIEU – REVERS",
    dureeGlace: 50,
    consignes: 5,
    objectifs: [
      "Introduire la sortie de zone (phase 1).",
      "Repli par le milieu.",
      "Rappel de la zone défensive (semaine 1).",
    ],
    tableau: "Vestiaire (3 min) : dessiner la sortie de zone, les 3 options et les 3 mots. Question : « Pourquoi jamais de passe au milieu de notre enclave? »",
    lignes: [
      { id: "T01", minutes: 5, notes: "Demi-glace : 3 groupes." },
      { id: "T04", minutes: 6, notes: "Départ de la ligne rouge. 2e minute : passes du revers seulement." },
      { id: "T16", minutes: 6, notes: "Passer à 2 rondelles rapidement." },
      { id: "T08", minutes: 6, notes: "" },
      { id: "TI06", minutes: 5, notes: "Départ à la ligne rouge. Insister : revenir par le MILIEU, pas le long de la bande." },
      { id: "TI01", minutes: 6, notes: "Tout le monde joue les deux rôles (avants aussi en défense)." },
      { id: "TC01", minutes: 6, notes: "Sortie réussie à la ligne rouge, virage, puis attaque du même filet. Ralenti → vitesse. Au début, le coach annonce l'option. Ensuite, le D décide." },
      { id: "TC11", minutes: 5, notes: "Règle : après une récupération, la rondelle doit passer par un joueur au MUR avant un tir." },
    ],
  },
  {
    id: "M15-S01",
    equipe: "M15",
    titre: "Semaine 1",
    theme: "Zone défensive : BOÎTE + 1",
    dureeGlace: 50,
    consignes: 5,
    objectifs: [
      "Introduire la zone défensive Boîte + 1 (phase 1).",
      "Options de sortie : MUR et VITRE.",
      "Réception au mur et patin avec rondelle.",
    ],
    tableau: "Vestiaire (3 min) : Boîte + 1, les 4 règles. Question : « Quand est-ce que VITRE est le meilleur jeu? »",
    lignes: [
      { id: "T01", minutes: 4, notes: "" },
      { id: "T18", minutes: 4, notes: "Insister sur les croisés AVEC la rondelle." },
      { id: "T11", minutes: 4, notes: "" },
      { id: "T19", minutes: 4, notes: "Coup droit, puis revers." },
      { id: "TI12", minutes: 6, notes: "" },
      { id: "TI09", minutes: 7, notes: "Féliciter la bonne décision, même si le geste rate." },
      { id: "TC05", minutes: 6, notes: "Boîte + 1. Vérifier à chaque arrêt : il y a un D au filet?" },
      { id: "TC01", minutes: 5, notes: "Le coach crie HOMME : on sort sur la VITRE." },
      { id: "TC11", minutes: 5, notes: "Règle : un but compte double sur un rebond." },
    ],
  },
  {
    id: "M15-S02",
    equipe: "M15",
    titre: "Semaine 2",
    theme: "Sortie de zone sous pression et mises au jeu",
    dureeGlace: 50,
    consignes: 5,
    objectifs: [
      "Sortie de zone MUR – VITRE – PROFOND contre une pression.",
      "Positions aux mises au jeu (défensives et offensives).",
      "Récupération derrière le filet et réception sur le revers.",
    ],
    tableau: "Vestiaire (3 min) : positions aux mises au jeu (défensive et offensive). Question : « Qui prend qui? »",
    lignes: [
      { id: "T02", minutes: 5, notes: "" },
      { id: "T05", minutes: 5, notes: "Réception sur le revers obligatoire à la 2e minute." },
      { id: "T12", minutes: 6, notes: "Options pour M15 : MUR, MILIEU, VITRE." },
      { id: "TI01", minutes: 7, notes: "" },
      { id: "TI08", minutes: 6, notes: "" },
      { id: "TC14", minutes: 4, notes: "" },
      { id: "TC02", minutes: 6, notes: "Sortie propre sur la VITRE = 1 point, comme une sortie en contrôle." },
      { id: "TC06", minutes: 6, notes: "Rappel de la Boîte + 1 de la semaine 1." },
    ],
  },
];

if (typeof module !== "undefined") {
  module.exports = { MODELES };
}
