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
