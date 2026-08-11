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
