# Gardes des Internes — App web

Application de planification des gardes d'internes (semestres Nov→Avril / Mai→Oct),
avec grille 3 blocs de 2 mois, repos automatique, détection V+D et doublons,
statistiques par interne. React + Firebase, déployé sur Netlify.

## Stack
- **React 18 + Vite 5** — déployé sur Netlify
- **Firebase Firestore** — sync temps réel multi-appareils
- **Firebase Auth (Google)** — lecture libre, édition réservée aux admins

## Setup

### 1. Firebase
1. Crée un projet sur https://console.firebase.google.com
2. Active **Firestore Database** (mode test pour démarrer)
3. Active **Authentication → Google**
4. Copie ta config dans `src/lib/firebase.js` (remplace les `VOTRE_...`)

### 2. Règles Firestore (production conseillée)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /internes/{doc}  { allow read: if true; allow write: if request.auth != null; }
    match /semestres/{doc} { allow read: if true; allow write: if request.auth != null; }
    match /admins/{email}  { allow read: if true; allow write: if request.auth != null; }
  }
}
```
> Le 1er utilisateur Google qui se connecte devient automatiquement admin
> (collection `admins`). Pour restreindre, édite cette collection à la main ensuite.

### 3. Déploiement Netlify
Connecte le repo GitHub à Netlify :
- Build command : `npm install && npm run build`
- Publish directory : `dist`
- Variable d'env : `NODE_VERSION = 18`

Le fichier `netlify.toml` configure déjà le build et le fallback SPA.

### 4. Domaine autorisé
Dans Firebase → Authentication → Settings → Domaines autorisés,
ajoute ton domaine Netlify (`xxx.netlify.app`).

## Utilisation
1. Connecte-toi avec Google (bouton en haut à droite) → tu deviens admin.
2. **Gérer les internes** : ajoute noms, initiales, couleurs, plafonds.
3. **Nouveau semestre** : choisis année + type, coche les internes à reprendre.
4. Sur le planning : clique une case **Garde** (menu déroulant). Repos auto,
   V+D et doublons détectés. Colonne **Code** : CA / F / A / AR.
5. Les **stats** en bas se recalculent en direct.

## Structure
```
src/
  main.jsx / App.jsx           routing
  lib/firebase.js              config + helpers Firestore/Auth
  lib/semester.js              logique métier (dates, blocs, V+D, doublons, stats)
  contexts/AuthContext.jsx     auth Google + détection admin
  components/
    TopBar.jsx                 barre de navigation
    Home.jsx                   liste semestres + actions
    NewSemesterModal.jsx       création semestre + reprise internes
    PlanningView.jsx           grille 3 blocs + édition
    StatsPanel.jsx             tableau de stats + légende
    InternesManager.jsx        CRUD internes
  styles/index.css             design system
```
