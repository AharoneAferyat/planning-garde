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
