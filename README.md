# Gardes des Internes — Plateforme multi-utilisateurs

Application de planification des gardes d'internes, multi-utilisateurs avec
espaces personnels, partage de plannings, rôles et traçabilité.
React + Firebase, déployée sur Netlify.

## Nouveautés de cette version
- **Authentification obligatoire** en accueil (rien de visible sans connexion Google).
- **Espaces personnels** : chacun a ses plannings, les retrouve à chaque connexion.
- **Plannings nommés** (« Rotation Cardiologie 2026 »…), chacun avec **ses propres internes**.
- **Partage & invitations** : QR code + code + lien, avec rôles.
- **Rôles** : Propriétaire (tous droits), Éditeur (modifie), Invité (lecture seule).
- **Traçabilité** : chaque modification est enregistrée (onglet Activité).
- **Interface refondue** : sidebar + pages, responsive mobile (bottom-nav).

## Pages
- **Tableau de bord** : prochaines gardes, actions rapides, chiffres clés.
- **Mes plannings** : onglets « Mes plannings » / « Partagés avec moi ».
- **Planning** (par planning) : onglets Planning · Internes · Statistiques · Équipe · Activité.
- **Invitations** : génère code/lien/QR par planning, avec rôle.

## Setup Firebase
Config déjà intégrée (`src/lib/firebase.js`). Il faut :
1. **Authentication → Google** activé.
2. **Firestore → Règles** : colle le contenu de `FIRESTORE_RULES.txt`, puis Publier.
3. Après déploiement Netlify : **Authentication → Settings → Domaines autorisés**
   → ajoute ton domaine `xxx.netlify.app`.

> ⚠️ Sécurité : les règles fournies autorisent tout utilisateur **connecté**
> à lire/écrire les plannings (le filtrage d'accès se fait dans l'app via la
> liste des membres). C'est suffisant pour démarrer en équipe de confiance.
> Pour un usage large/public, il faudra durcir les règles (vérifier l'appartenance
> aux `membres` côté serveur) — on le fera dans un second temps.

## Déploiement Netlify (via GitHub)
1. Pousse le projet sur GitHub (fichiers à la **racine** du repo).
2. Netlify → Import from GitHub → le `netlify.toml` configure tout.
3. Build : `npm install && npm run build` · Publish : `dist` · Node 18.

## Modèle de données (Firestore)
```
users/{email}                    profil (nom, photo, uid)
plannings/{id}                   nom, annee, type, ownerEmail, internes[], gardes{}, statut
plannings/{id}/membres/{email}   email, nom, role (proprietaire|editeur|invite)
plannings/{id}/historique/{auto} email, nom, action, detail, at   (traçabilité)
invitations/{code}               planningId, planningNom, role, createdBy, usedBy[]
```

## Structure du code
```
src/
  main.jsx / App.jsx                routing + auth gate
  contexts/AuthContext.jsx          auth Google + profil
  lib/firebase.js                   config + helpers Firestore/Auth
  lib/semester.js                   logique métier (dates, blocs, V+D, doublons, stats)
  lib/usePlannings.js               hook : mes plannings + partagés
  components/
    AuthGate.jsx                    écran de connexion
    Layout.jsx                      sidebar + bottom-nav mobile
    Dashboard.jsx                   tableau de bord
    PlanningsList.jsx               liste (onglets Mes / Partagés)
    NewPlanningModal.jsx            création de planning
    PlanningView.jsx                planning + internes + stats + équipe + activité
    Invitations.jsx                 génération code/lien/QR
    JoinPage.jsx                    rejoindre via /join/:code
    QRCode.jsx                      QR code (api.qrserver.com)
  styles/index.css                  design system
```

## Ajouter une vraie photo d'hôpital dans le header (optionnel)
Le header utilise par défaut un dégradé bleu + motif médical (aucune dépendance,
ne casse jamais). Si tu veux une **vraie photo** :
1. Va sur https://unsplash.com, cherche « hospital corridor » (ou autre), ouvre une photo.
2. Clic droit → « Copier l'adresse de l'image » (URL en `images.unsplash.com/...`).
3. Ouvre `src/components/Hero.jsx`, colle l'URL dans la constante `HOSPITAL_IMG`.
   La photo s'affichera derrière le dégradé (opacité réduite pour la lisibilité).

## Mise à jour — planning avancé
- **Planning en lignes aérées** : plus lisible, repos affiché, V+D marqué.
- **Bornes réelles** : le semestre va du **1er lundi** au **dernier dimanche** (plus du 1er au 30).
- **Présences** (onglet dédié + lié aux gardes) : statuts P, G, RS, CA, FCP, FCC, AB.
  G (jour de garde) et RS (lendemain) sont **automatiques** ; le reste se saisit en cliquant.
- **Conflit signalé** : un interne de garde marqué absent apparaît en **rouge** (« absent ! »)
  sans bloquer la saisie.
- **Statistiques « à ce jour »** : gardes **faites** vs **à venir**, actualisées selon la date.
- **Répartition automatique** (bouton ⚡) : remplit équitablement en respectant
  max/mois, max/semestre, jamais 2 gardes de suite, et équilibrage des week-ends.

## Mise à jour — valorisation, fériés, invitations liées
- **Planning en tableau dense** (plus lisible), mois en lignes (Mai/Juin/Juil puis Août/Sept/Oct).
- **Bornes** : 1er lundi du mois de départ → dimanche avant le 1er lundi du semestre suivant.
- **Jours fériés France** (11 nationaux, calculés dynamiquement) marqués dans le planning.
- **Valorisation** : semaine 1× · samedi 1,5× · dimanche & fériés 2× (colonne Val. + Points en stats).
- **Couleurs internes franches** (bien contrastées).
- **Répartition auto multi-critères** : équilibre nombre de gardes + points + week-ends/fériés,
  jamais 2 de suite, respecte plafonds et absences. Modifiable ensuite à la main.
- **Internes liés aux invitations** : en rejoignant via lien, chacun choisit « je suis untel »
  et met son prénom → le planning se met à jour, et le dashboard « prochaine garde »
  repère tes gardes (★).

## Mise à jour — onglet Présences façon grille + fond photo Unsplash
- **Onglet Présences** refait en **grille internes × jours** (façon planning mural) :
  clic sur une case → menu (Garde, RS, Congé, FCP, FCC, Absence, Vide).
  Poser « Garde » crée la garde du jour (G) ; RS se met auto le lendemain.
  Les gardes sont modifiables depuis le Planning ET depuis cette grille.
- **Résumé de la période** : cartes de totaux (gardes, RS, congés, FCP, FCC, absences).
- **Fond photo aléatoire** : le header du tableau de bord charge une photo d'hôpital
  Unsplash différente à chaque ouverture (bouton ⟳ pour changer, crédit photographe,
  fallback dégradé si l'API ne répond pas). Clé Access Unsplash intégrée.

## Mise à jour — responsive mobile complet
- **Détection automatique** de la taille d'écran (bascule desktop/mobile).
- **Planning mobile** : un mois à la fois avec sélecteur ‹ mois › (au lieu des 6 mois côte à côte).
- **Présences mobile** : vue par semaine empilée verticalement, chaque jour affiche les internes
  en chips cliquables. **Aucun scroll horizontal** — on scrolle seulement vers le bas.
- Desktop inchangé (grille complète + 6 mois).

## Mise à jour — header cadré + fond de page estompé
- **Header** à hauteur fixe (150px) avec la photo Unsplash **bien cadrée** (cover centré), plus déformée.
- **Fond de page** : la même photo aléatoire en **très estompé (7%)** derrière le contenu,
  pour casser le blanc sans gêner la lecture. Header et fond partagent la même image
  (cohérence visuelle) et changent ensemble à chaque ouverture / via le bouton ⟳.

## Mise à jour — 2 images distinctes + plafond horaire
- **Deux photos différentes** : une pour le header, une autre pour le fond de page (plus la même).
- **Plus de bouton refresh** : les images changent uniquement à l'ouverture / actualisation de la page.
- **Plafond de 5 changements par heure** : au-delà (rechargements fréquents), les images restent
  figées jusqu'à ce que l'heure tourne. Mémorisé dans le navigateur (localStorage), ce qui économise
  aussi le quota Unsplash.

## Mise à jour — équité, visuel présences, indicateur modifié
- **Répartition auto vraiment équitable** : équilibre séparément samedis, dimanches, fériés
  (chaque catégorie répartie le plus également possible entre tous), puis points et nb de gardes.
- **FCP / FCC** : pastilles élargies, les libellés ne débordent plus (légende, cases, menu).
- **Samedi / dimanche / férié distinctifs** dans la grille présences : cases vides en motif rayé
  (on n'est pas présent par défaut le WE) ; un statut posé reprend sa couleur pleine.
- **Indicateur « modifié » (jaune)** : après un random, la 1re modif ne marque pas, la 2e+ oui ;
  un planning fait à la main marque dès la 1re modif ; un nouveau random remet à zéro.

## Mise à jour — "C'est moi" pour tous + page Admin
- **S'identifier comme interne** : dans l'onglet Internes, chaque membre (propriétaire inclus)
  peut cliquer « C'est moi » sur une ligne, mettre son prénom → l'interne est renommé et lié
  à son compte. Le dashboard « prochaine garde » repère alors ses gardes (★).
- **Page Administration** (réservée à aaferyat@gmail.com) : vue globale sur tous les plannings,
  toutes les invitations, tous les utilisateurs, et un **journal d'activité** (connexions,
  créations de planning, créations d'invitation, personnes ayant rejoint via un code).
  Les connexions sont enregistrées à partir de ce déploiement.

> ⚠️ Sécurité : l'accès admin est vérifié côté application (email). Les règles Firestore
> actuelles restent permissives (tout utilisateur connecté peut lire). Pour un verrouillage
> côté serveur (empêcher un autre compte de lire ces données via l'API), il faudra durcir
> les règles — à faire dans un second temps.

## Mise à jour — sécurisation des règles Firestore
Les règles (`FIRESTORE_RULES.txt`) ne sont plus permissives. Désormais :
- **Plannings** : lisibles seulement par le propriétaire, les membres, ou l'admin.
  Modifiables par propriétaire/membres (éditeurs) ; supprimables par propriétaire/admin.
- **Membres** : on ne peut s'ajouter que soi-même (via invitation) ; le propriétaire/admin gère les autres.
- **Historique** : lisible/écrit par les membres, jamais modifiable après coup.
- **Invitations** : lisibles par les connectés (pour rejoindre via code), créées par leur auteur.
- **Événements (journal)** : écrits par les connectés, **lisibles uniquement par l'admin**.
- **Profils users** : chacun le sien ; l'admin peut tout lire.

### Comment appliquer (0 crédit Netlify — c'est côté Firebase)
1. Firebase Console → Firestore Database → onglet **Règles**.
2. Colle tout le contenu de `FIRESTORE_RULES.txt`.
3. **Publier**. C'est immédiat, aucun rebuild de l'app nécessaire.

> Note : l'admin est identifié par l'email `aaferyat@gmail.com` (en dur dans les règles ET
> dans le code). Si tu changes d'email admin, il faut le modifier aux deux endroits.

## Mise à jour — logs suppressions + logs par planning
- **Journal global** (admin, onglet « Journal global ») : ajoute les **suppressions** (planning,
  invitation), **retraits de membres** et **changements de rôle**, en plus des créations,
  connexions et joins. Chaque type a un badge coloré (rouge pour les suppressions/retraits).
- **Modifs plannings** (nouvel onglet admin) : vue globale de TOUTES les modifications de TOUS
  les plannings (gardes, présences, internes…) via collectionGroup.
- **Détail par planning** : dans l'onglet Plannings de l'admin, cliquer une ligne ouvre
  l'historique complet de ce planning.

### Règles Firestore : à republier
Ce lot ajoute une règle collectionGroup pour `historique` (vue globale admin).
Republie `FIRESTORE_RULES.txt` dans Firebase (0 crédit) en plus du déploiement de l'app.

## Mise à jour — suppression des logs + séparation connexions/actions
- **Onglets séparés** dans l'admin : **Connexions** (les logins seuls) et **Actions**
  (créations, suppressions, rôles, joins…).
- **Suppression des logs** : croix ✕ par ligne + bouton « Vider » — sur Connexions, Actions,
  et Modifs plannings (+ suppression dans le détail par planning).
- **Règles Firestore** : l'admin peut désormais supprimer les événements et les entrées
  d'historique (les autres utilisateurs ne peuvent toujours pas). À republier.

## Mise à jour — accès fermé (sur invitation) + suppression en cascade
- **Accès fermé** : on n'entre sur le site que si l'email est autorisé = admin, ou déjà
  membre/propriétaire d'au moins un planning (déjà rejoint par le passé). Sinon → écran
  « Il te faut une invitation » (message + champ pour coller un code OU un lien).
  Un lien /join/CODE reste toujours accessible (c'est le moyen d'entrer).
  Une fois entré, on peut créer ses propres plannings.
- **Suppression en cascade** : supprimer un planning supprime aussi ses invitations, ses
  membres et son historique. Les comptes utilisateurs (déjà « connus ») ne sont PAS supprimés.
  → corrige le compteur d'invitations qui comptait des invitations orphelines.

### Règles Firestore : à republier (elles ont changé)
Cette fois la règle `historique` autorise aussi le propriétaire à supprimer (nécessaire à la
cascade). Republie `FIRESTORE_RULES.txt`.

## Mise à jour — révocation, admin en bas, thème jour/nuit
- **Révocation (3 niveaux)** : par planning (onglet Équipe), « Retirer de tout » (tous les
  plannings d'un coup), et « Bannir » (retire de tout + bloque le retour : la personne retombe
  sur l'écran d'invitation). Débannissage possible. Le tout dans l'admin, onglet Utilisateurs.
- **Administration en bas** de la sidebar (près du profil), plus dans la liste principale.
- **Thème jour/nuit** : automatique selon l'heure (sombre 20h–7h, clair sinon) + bouton
  ☀/☾ dans la sidebar pour forcer manuellement. Le choix manuel est mémorisé.

### Règles Firestore : CHANGÉES (à republier)
Ajout d'une collection `banned` (bannissement) avec ses règles. Republie `FIRESTORE_RULES.txt`.

## Mise à jour — thème "Système" ajouté
Le bouton thème (☀/☾/◑/🖥, sidebar + barre mobile) cycle maintenant entre 4 modes :
- **Auto (heure)** — défaut : sombre 20h–7h, clair sinon.
- **Système** : suit les préférences clair/sombre de l'appareil (PC/navigateur/téléphone),
  et bascule tout seul si tu changes le thème de ton OS.
- **Clair** / **Sombre** : forcé manuellement.
Le mode choisi est mémorisé. (Règles Firestore inchangées.)

## Révision / audit (nettoyage + robustesse)
- **Icônes** : remplacement des glyphes unicode (◑ 🖥 ▦ ▤ ✉ ⚙ ☰ ◈…) par une vraie
  librairie d'icônes SVG (lucide-react) → rendu identique sur tous les appareils/navigateurs,
  fini les icônes qui buggaient.
- **Responsive** : les tableaux de l'admin scrollent horizontalement sur mobile au lieu de
  casser la mise en page.
- **Robustesse** : accès `parent.parent` sécurisés (optional chaining), thème purple adapté
  au mode sombre.
- **Code mort** : aucun fichier/export réellement inutilisé (QRCode, tous les helpers firebase
  sont utilisés). Les `console.warn` restants sont des diagnostics d'erreur volontaires.
- (Règles Firestore inchangées.)

## Bloc 1 — Notifications in-app + envoi par email (mailto)
- **Cloche de notifications** (sidebar + barre mobile) : badge de non-lus, panneau déroulant,
  clic sur une notif → ouvre le planning concerné, « tout marquer lu », suppression.
- **Envoi d'invitation par email** : après avoir généré un code, un bloc « Envoyer par email »
  permet de choisir les destinataires (checkboxes par membre + « tout cocher / aucun » +
  champ pour d'autres emails), puis « Ouvrir l'email » ouvre ta messagerie avec le message
  prérempli (lien + code). Aucun serveur, aucun risque de spam.

### Règles Firestore : CHANGÉES (à republier)
Ajout de la collection `notifications` (in-app). Republie `FIRESTORE_RULES.txt`.

> À venir : Bloc 2 (indispos + échange de gardes), Bloc 3 (PDF + .ics), Bloc 4 (confort).
> Email automatique (Resend) : optionnel, guidé plus tard.

## Bloc 2 — Indisponibilités + Échange de gardes
- **Indisponibilités (souhaits)** : nouveau statut « INDISPO » posable dans les présences.
  L'algo de répartition auto ÉVITE de donner une garde à un interne sur ses jours indispo
  (souple : il n'y va que s'il n'y a aucun autre choix). Testé : 0 garde sur jours indispo.
- **Échange de gardes** (onglet « Échanges ») : un interne identifié propose une de ses gardes
  à venir → les autres membres reçoivent une notif → un autre la reprend (la garde change de
  main + notif de confirmation au proposeur). Historique des échanges. Annulation possible.

### Règles Firestore : CHANGÉES (à republier)
Ajout de la sous-collection `echanges`. (déjà inclus avec `notifications` du Bloc 1.)

## Bloc 3 — Export PDF + Calendrier (.ics)
- **PDF / Impression** : bouton « PDF » dans le planning → ouvre l'impression du navigateur
  (choisir « Enregistrer en PDF »). Mise en page épurée (sidebar/onglets masqués, tous les mois,
  thème clair forcé, orientation paysage). Zéro librairie ajoutée.
- **Calendrier (.ics)** : bouton « Calendrier » → télécharge un fichier .ics de TES gardes
  (si tu es identifié comme interne) importable dans Google Agenda / Apple Calendar / Outlook.
  Événements « journée entière ». (Règles Firestore inchangées pour ce bloc.)

## Bloc 4 — Confort
- **Vue « Mes gardes »** : case à cocher dans le planning qui met en avant tes gardes (le reste estompé).
- **Équilibre en temps réel** : barres par interne + indicateur d'écart (vert/ambre/rouge),
  mis à jour à chaque modification.
- **Notes par jour** : colonne « Note » dans le planning (ex. « garde double », « senior : Dr X »).
- **Duplication de semestre** : bouton copier dans « Mes plannings » → repart des mêmes internes
  et réglages, sans les gardes (nouveau semestre vierge).
- **Validation du planning** (rôle chef de service) : le propriétaire peut « Valider » le planning
  → badge « Validé » + notification à tous les membres.
- (Stats annuelles cross-semestre : non incluse — nécessite d'agréger 2 plannings, à faire dédié.)

### Règles Firestore : inchangées depuis le Bloc 2 (echanges + notifications déjà couverts).

## Correctifs — conflit "repos" + index Firestore
- **Marquage rouge réparé** : une garde posée sur quelqu'un qui devrait être en REPOS DE SÉCURITÉ
  (déjà de garde la veille) est de nouveau signalée en rouge, EN PLUS du cas garde-pendant-absence.
- **Index Firestore** : l'erreur "The query requires an index" vient de requêtes collectionGroup.
  Deux solutions :
  1. SIMPLE : dans la console du navigateur (F12), clique sur le lien d'erreur Firebase
     (commence par https://console.firebase.google.com/...). Il ouvre l'index pré-rempli →
     "Créer l'index" → attendre 1-2 min. Répète pour chaque lien d'erreur.
  2. PROPRE : le fichier firestore.indexes.json contient les index nécessaires
     (membres.email en COLLECTION_GROUP, historique.at en COLLECTION_GROUP), déployables via
     Firebase CLI (firebase deploy --only firestore:indexes).
  C'est à faire UNE fois, 0 crédit Netlify.

## Correctifs — révocation + onglet Bannis
- **Révocation réparée** : la fonction ne masque plus les erreurs silencieusement. Elle retourne
  le nombre de plannings dont l'utilisateur a été retiré et affiche un message de confirmation
  (ou l'erreur exacte). NOTE : si le message est "failed-precondition", c'est l'INDEX Firestore
  collectionGroup(membres) qui manque → clique le lien d'erreur en console (F12) pour le créer.
- **Onglet "Bannis"** dans l'admin : liste des utilisateurs bannis (email, date, par qui) avec
  bouton "Débannir" pour chacun.

## Correctifs responsive mobile (v2)
- **Onglets scrollables** horizontalement (Planning/Présences/…/Échanges/Équipe/Activité et
  les onglets admin) : plus de débordement hors écran, on swipe la barre d'onglets.
- **En-têtes de page** : sur mobile, le titre passe au-dessus et les boutons (Valider/Retour)
  en dessous, chacun à sa place (fini l'écrasement titre+boutons).
- **Toolbar planning** : boutons PDF/Calendrier/Mes gardes alignés, « Proposer une répartition »
  en pleine largeur.
- **Boutons plus grands** (min 40px) pour le tactile, **modales pleine largeur**, tableaux qui
  scrollent dans leur carte. (Règles Firestore inchangées.)

## Correctifs (lot du 14) — thème sombre, invitations, admin mobile
- **Thème sombre lisible** : le panneau de notifications et ses textes ont maintenant des
  couleurs explicites (fini le gris sur gris illisible).
- **Suppression d'invitations** : l'onglet Invitations de l'admin a enfin un bouton Supprimer
  (croix rouge) — utile pour les invitations orphelines (planning supprimé). Les plannings
  supprimés affichent "planning supprimé" au lieu d'un vide.
- **Accès admin sur mobile** : lien "Admin" ajouté dans la barre de navigation du bas (visible
  uniquement pour l'admin), puisque la sidebar est masquée sur téléphone.
- **Boutons du bas de la sidebar (PC)** : restructurés en 2 lignes (profil / boutons) — ils ne
  débordent plus des 230px.
- **.row** passe à la ligne (flex-wrap) : plus de débordement de boutons sur écrans étroits.

### ⚠️ INDEX FIRESTORE OBLIGATOIRE (cause du "failed-precondition")
La révocation, "mes plannings partagés" et l'accès nécessitent un index collectionGroup.
Tant qu'il n'est pas créé, ces fonctions échouent avec "failed-precondition".
