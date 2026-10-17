# Coaching hockey 2026-2027 – M11-B et M15-C

**Ouvre [index.html](index.html) dans un navigateur** : c'est le site des Prédateurs (couleurs de l'AHMVR). On y trouve l'accueil, une page par équipe ([M11-B](M11-B/index.html), [M15-C](M15-C/index.html)) avec le système de jeu illustré, la saison en blocs et les pratiques, ainsi que les outils. Aucune installation n'est nécessaire.

## Contenu

| Élément | M11-B | M15-C |
|---|---|---|
| **Système de jeu évolutif** (3 phases) | [M11-B/systeme-de-jeu.md](M11-B/systeme-de-jeu.md) | [M15-C/systeme-de-jeu.md](M15-C/systeme-de-jeu.md) |
| **Planification de saison** (24 semaines) | [M11-B/planification-saison.md](M11-B/planification-saison.md) | [M15-C/planification-saison.md](M15-C/planification-saison.md) |
| **Plans de pratique** (semaines 1 et 2) | [M11-B/pratiques/](M11-B/pratiques/) | [M15-C/pratiques/](M15-C/pratiques/) |

**Outils (à ouvrir dans un navigateur, aucune installation nécessaire) :**

- [outils/banque-exercices.html](outils/banque-exercices.html) : les 53 exercices avec leur diagramme (clique dessus pour l'agrandir, ou sur « ▶ Animer » pour voir les étapes jouer), avec filtres par équipe, catégorie, thème, exercices décisionnels (IQ) et liens avec le système. Imprimable. Le filtre « Faisable en demi-glace » se coche automatiquement pour les M11.
- [outils/plan-pratique.html](outils/plan-pratique.html) : planificateur de pratique. Choisis ton équipe et tes exercices, et il calcule les ratios par rapport aux cibles de Hockey Québec et avertit si un exercice demande une pleine glace. Il permet aussi d'enregistrer, d'exporter et d'imprimer une feuille de pratique (avec le détail et le diagramme de chaque exercice pour tes assistants).
- [outils/editeur-diagrammes.html](outils/editeur-diagrammes.html) : éditeur des diagrammes des exercices et des situations du système de jeu (en bas de la liste). Tu peux placer, déplacer ou supprimer des joueurs, cônes, rondelles et textes, et tracer des trajets (patin, patin arrière, avec rondelle, passe, tir). Pour ajuster une courbe, double-clique sur la ligne pour ajouter un point et glisse-le (les passes et les tirs restent droits). Avec l’outil « Étape », tu ajoutes les numéros d’étapes ; clique un numéro pour le modifier, le déplacer ou le supprimer. Avec « Synchroniser avec… », un trajet part et finit exactement en même temps qu'un autre. L'outil « Étiquette » ajoute un texte encadré (une consigne comme « APPUIE! ») qui peut n'apparaître que pendant certaines étapes de l'animation. Le bouton « ＋ Nouveau » crée un diagramme libre, qui n'est rattaché à aucun exercice (il apparaît dans la liste sous « Mes diagrammes »). Exporte en image (SVG ou PNG) ou en animation (GIF). « Charger un fichier » reprend un `diagrammes-donnees.js` déjà enregistré, pour continuer sur un autre navigateur ou un autre ordinateur. Le bouton « ▶ Animer » montre l'aperçu de l'animation et liste ce qui est ambigu. Clique un outil pour revenir à l'édition.

## Animation des diagrammes

Le lecteur (`outils/animation.js`) fait jouer les étapes d'un diagramme : lecture et pause, étape précédente ou suivante, curseur, vitesse, arrêt à chaque étape et lecture en boucle. Pour qu'un diagramme s'anime bien :

- **Numérote les trajets** avec l'outil « Étape ». Les étapes jouent dans l'ordre, et des trajets avec le même numéro jouent en même temps. Un patin sans numéro joue avec la première étape (ex. : les défenseurs qui reculent). Une passe ou un tir sans numéro est une option : il reste affiché sans être animé. Un diagramme de position (sans numéros et avec au plus une passe) joue tout en même temps.
- **Les options** (MUR, MILIEU, REVERS…) : donne un numéro à chacune. Une passe qui part du même point qu'une passe précédente est une autre option : la rondelle revient au passeur et repart.
- **Enchaîne les trajets** : un trajet qui part de la fin d'un autre (même joueur, ou joueur qui reçoit une passe) attend qu'il finisse. Une passe part au bon moment pour arriver avec le joueur qui patine vers sa cible. Une passe qui part d'un point en plein trajet d'un patineur (passe en mouvement) coupe son trajet à cet endroit.
- **La rondelle** part du joueur qui a la rondelle (case « rondelle » du joueur). L'entraîneur, les piles de rondelles et les points de mise au jeu en fournissent aussi. Après une passe, le joueur à moins de 5 pi de l'arrivée la reçoit. Un joueur qui arrive sur la ligne d'une passe dans la même étape l'intercepte. Une rondelle laissée libre (dans le coin, en profondeur) est ramassée par le joueur le plus proche qui finit son trajet à moins de 8 pi. Une passe qui finit près de la bande sans receveur est un dégagement.
- **Synchroniser deux trajets** : sélectionne le trajet à synchroniser, clique « Synchroniser avec… », puis clique le trajet principal. Le premier partira et finira exactement avec le second (sa vitesse s'ajuste) et jouera dans la même étape que lui. Utile pour un appui qui doit arriver pile en même temps qu'un porteur, ou pour deux joueurs qui doivent bouger ensemble malgré des distances différentes.
- **Les étiquettes encadrées** s'affichent pendant les étapes choisies (champs « Apparaît à partir de » et « Disparaît après »), ou tout le temps si tu ne choisis rien. Sur le diagramme fixe (banque, feuille imprimée), elles s'affichent toujours.
- **Enregistrer l'animation en GIF** : dans l'éditeur, « Animation GIF » produit un fichier qui joue en boucle, à envoyer par message ou par courriel. Il fait environ 100 ko, et l'encodeur est dans `outils/gif.js` (aucune installation, fonctionne hors ligne).
- Pour lister les diagrammes ambigus (sans numéros, rondelle sans source, passe sans receveur…), lance `node outils/verifier-animations.js`. Ajoute un code pour en vérifier un seul (ex. : `node outils/verifier-animations.js T04`).

## Ratios Hockey Québec

| | Technique | Tactique individuelle | Tactique collective |
|---|---|---|---|
| M11-B | 50 % | 25 % | 25 % |
| M15-C | 35 % | 30 % | 35 % |

## Horaire

| | Pratiques | Glace |
|---|---|---|
| M11-B | 1 par semaine, 50 min de glace | **Demi-glace** |
| M15-C | 1 par semaine, 50 min de glace | Pleine glace |

- Plage de 60 min moins ~10 min de resurfaçage = 50 min de glace. Avec environ 5 min de consignes et de transitions, il reste **45 min d'exercices** par pratique. Dans le planificateur, tu peux changer la durée de la glace et le temps de consignes.
- Chaque exercice pleine glace utilisé par les M11 a une **adaptation en demi-glace**. Elle s'affiche dans la banque, dans le planificateur et sur la feuille imprimée.
- **Saison du 28 sept. 2026 à la fin mars 2027**, avec une pause pendant les Fêtes. Chaque ligne de la planification de saison correspond à une pratique.
- Avec une seule pratique par semaine, **le match devient la 2e séance**. Chaque planification de saison explique comment fixer un objectif de match lié au thème de la semaine.

## Comment les pièces s'emboîtent

1. Le **système de jeu** définit quoi enseigner et dans quel ordre (phases 1 → 2 → 3, avec des critères pour passer à la phase suivante).
2. La **planification de saison** place chaque notion du système dans une semaine et choisit les exercices techniques et tactiques qui la soutiennent.
3. La **banque d'exercices** fournit le détail de chaque exercice (code T, TI ou TC). Les exercices liés au système indiquent l'équipe et la phase.
4. Le **planificateur** assemble une pratique et vérifie les ratios.

## Ajouter ou modifier du contenu

- **Exercices** : modifie `outils/exercices.js`. La banque et le planificateur se mettent à jour automatiquement.
- **Diagrammes** : utilise l'éditeur. « ＋ Nouveau » crée un diagramme qui n'est rattaché à aucun exercice : il porte un nom, s'enregistre dans le même fichier et s'exporte en SVG, PNG ou GIF, mais il n'apparaît pas dans la banque ni dans le planificateur. La banque et le planificateur affichent tout de suite tes changements, même avant l'enregistrement. Tes changements sont gardés dans le navigateur jusqu'à ce que tu cliques « Enregistrer le fichier » : dans Chrome ou Edge, choisis `outils/diagrammes-donnees.js` la première fois, et les enregistrements suivants écrivent directement dedans. Dans les autres navigateurs, le fichier est téléchargé et tu remplaces `outils/diagrammes-donnees.js` par celui-ci. **« Charger un fichier »** fait l'inverse : il reprend un `diagrammes-donnees.js` déjà enregistré et remplace tous les diagrammes affichés (il refuse un fichier qui n'en contient pas, et te dit ce qui change). Dans Chrome ou Edge, les enregistrements suivants écrivent directement dans le fichier que tu viens de charger.
- **Images des diagrammes** (fiches Markdown et systèmes de jeu) : après avoir enregistré le fichier, lance `node outils/generer-plans.js`. Il refait les images dans `outils/diagrammes-svg/` et place chaque diagramme de situation sous sa section dans `systeme-de-jeu.md`. La liste des situations est dans `outils/systemes.js`.
- **Plans de pratique modèles** : ajoute un plan dans `outils/modeles.js`, puis lance `node outils/generer-plans.js`. Le script génère les fiches Markdown (avec les diagrammes) et vérifie le temps, les ratios et, pour les M11, que chaque exercice se fait en demi-glace.
- **Pages du site** : les pages HTML des équipes et des contenus sont générées à partir des fichiers `.md` et des données des outils. Après une modification, lance `node outils/generer-plans.js` (ou seulement `node outils/generer-site.js`). Ne modifie pas les `.html` générés à la main. L'en-tête et le pied de page communs sont dans `outils/site.js`, et le style dans `outils/style.css`.
- **Plans personnels** : ceux que tu enregistres dans le planificateur restent dans ton navigateur. Utilise « Exporter » pour les garder en fichier ou les partager.
