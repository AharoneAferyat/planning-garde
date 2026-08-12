// Firebase — configuration + helpers Firestore/Auth (architecture multi-utilisateurs)
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, collectionGroup, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAt3JrURwTIHSlaVG453ICFMExssgsq6to',
  authDomain: 'planning-garde-97741.firebaseapp.com',
  projectId: 'planning-garde-97741',
  storageBucket: 'planning-garde-97741.firebasestorage.app',
  messagingSenderId: '325106918534',
  appId: '1:325106918534:web:9afe2d81679e561031dd07',
  measurementId: 'G-GHGBR18PTP',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ============ AUTH ============
export const loginGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);

// Enregistre / met à jour le profil user à la connexion.
export const upsertUser = async (u) => {
  if (!u?.email) return;
  await setDoc(doc(db, 'users', u.email), {
    email: u.email,
    nom: u.displayName || u.email,
    photo: u.photoURL || '',
    uid: u.uid,
    lastLogin: Date.now(),
  }, { merge: true });
};

// ============ PLANNINGS ============
// doc: { nom, annee, type, ownerEmail, ownerNom, internes:[{nom,couleur,maxMois,maxSem}],
//        gardes:{iso:{garde,code}}, statut:'actif'|'brouillon', createdAt }
const planningsCol = collection(db, 'plannings');

export const createPlanning = (data, owner) =>
  addDoc(planningsCol, {
    ...data,
    ownerEmail: owner.email,
    ownerNom: owner.nom || owner.email,
    statut: data.statut || 'actif',
    createdAt: Date.now(),
  });

export const deletePlanning = (id) => deleteDoc(doc(db, 'plannings', id));
export const updatePlanning = (id, data) => updateDoc(doc(db, 'plannings', id), data);
export const watchPlanning = (id, cb) =>
  onSnapshot(doc(db, 'plannings', id), (d) =>
    cb(d.exists() ? { id: d.id, ...d.data() } : null));
export const updatePlanningGardes = (id, gardes) =>
  updateDoc(doc(db, 'plannings', id), { gardes });
export const updatePlanningInternes = (id, internes) =>
  updateDoc(doc(db, 'plannings', id), { internes });
export const updatePlanningPresences = (id, presences) =>
  updateDoc(doc(db, 'plannings', id), { presences });

// "Je suis untel" : relie l'utilisateur courant à un interne du planning.
// idx = index de l'interne dans le tableau ; prenom = nouveau nom affiché.
export const claimInterne = async (planningId, idx, prenom, userEmail) => {
  const ref = doc(db, 'plannings', planningId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const internes = (data.internes || []).map((it, i) =>
    i === idx ? { ...it, nom: prenom, email: userEmail } : it);
  await updateDoc(ref, { internes });
};

// Plannings dont je suis owner
export const watchMyPlannings = (email, cb) =>
  onSnapshot(
    query(planningsCol, where('ownerEmail', '==', email)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

// ============ MEMBRES (sous-collection) ============
// plannings/{id}/membres/{email} => { email, nom, role:'proprietaire'|'editeur'|'invite', addedAt }
export const membresCol = (planningId) => collection(db, 'plannings', planningId, 'membres');
export const watchMembres = (planningId, cb) =>
  onSnapshot(membresCol(planningId), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const addMembre = (planningId, email, nom, role) =>
  setDoc(doc(db, 'plannings', planningId, 'membres', email),
    { email, nom: nom || email, role, addedAt: Date.now() });
export const updateMembreRole = (planningId, email, role) =>
  updateDoc(doc(db, 'plannings', planningId, 'membres', email), { role });
export const removeMembre = (planningId, email) =>
  deleteDoc(doc(db, 'plannings', planningId, 'membres', email));

// Plannings où je suis membre (via collectionGroup)
export const watchSharedPlanningIds = (email, cb) =>
  onSnapshot(
    query(collectionGroup(db, 'membres'), where('email', '==', email)),
    (snap) => {
      // chaque doc membre a un parent = planning
      const items = snap.docs.map((d) => ({
        planningId: d.ref.parent.parent.id,
        role: d.data().role,
      }));
      cb(items);
    }
  );

// ============ HISTORIQUE (traçabilité) ============
// plannings/{id}/historique/{auto} => { email, nom, action, detail, at }
export const logAction = (planningId, user, action, detail) =>
  addDoc(collection(db, 'plannings', planningId, 'historique'), {
    email: user.email, nom: user.nom || user.email,
    action, detail: detail || '', at: Date.now(),
  });
export const watchHistorique = (planningId, cb, n = 20) =>
  onSnapshot(
    query(collection(db, 'plannings', planningId, 'historique'), orderBy('at', 'desc'), limit(n)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

// ============ INVITATIONS ============
// invitations/{code} => { code, planningId, planningNom, role, createdBy, createdAt, usedBy:[] }
const invitationsCol = collection(db, 'invitations');
export const genCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export const createInvitation = async (planningId, planningNom, role, createdBy) => {
  const code = genCode();
  await setDoc(doc(db, 'invitations', code), {
    code, planningId, planningNom, role,
    createdBy: createdBy.email, createdAt: Date.now(), usedBy: [],
  });
  return code;
};
export const getInvitation = async (code) => {
  const snap = await getDoc(doc(db, 'invitations', code.toUpperCase()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};
export const watchInvitations = (planningId, cb) =>
  onSnapshot(
    query(invitationsCol, where('planningId', '==', planningId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
export const deleteInvitation = (code) => deleteDoc(doc(db, 'invitations', code));

// Rejoindre un planning via code d'invitation
export const joinViaCode = async (code, user) => {
  const inv = await getInvitation(code);
  if (!inv) return { error: "Code d'invitation invalide." };
  await addMembre(inv.planningId, user.email, user.nom, inv.role);
  await updateDoc(doc(db, 'invitations', inv.code), {
    usedBy: [...(inv.usedBy || []), { email: user.email, at: Date.now() }],
  });
  return { ok: true, planningId: inv.planningId, planningNom: inv.planningNom, role: inv.role };
};

// ============ ADMIN : journal global d'événements ============
// events/{auto} => { type:'login'|'join'|'create_planning'|'create_invitation', email, nom, detail, at }
export const ADMIN_EMAIL = 'aaferyat@gmail.com';
export const isAdmin = (u) => u?.email === ADMIN_EMAIL;

export const logEvent = (type, user, detail = '') =>
  addDoc(collection(db, 'events'), {
    type, email: user?.email || '?', nom: user?.nom || user?.email || '?',
    detail, at: Date.now(),
  });

export const watchEvents = (cb, n = 200) =>
  onSnapshot(
    query(collection(db, 'events'), orderBy('at', 'desc'), limit(n)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

// Récupère TOUT (admin only) : tous les plannings, toutes les invitations, tous les membres.
export const adminFetchAll = async () => {
  const safe = async (p) => {
    try { return await p; } catch (e) { console.warn('adminFetchAll: échec partiel', e?.code || e); return null; }
  };
  const [plansSnap, invSnap, memSnap, usersSnap] = await Promise.all([
    safe(getDocs(collection(db, 'plannings'))),
    safe(getDocs(collection(db, 'invitations'))),
    safe(getDocs(collectionGroup(db, 'membres'))),
    safe(getDocs(collection(db, 'users'))),
  ]);
  const plannings = plansSnap ? plansSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  const invitations = invSnap ? invSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  const membres = memSnap ? memSnap.docs.map((d) => ({ planningId: d.ref.parent.parent.id, ...d.data() })) : [];
  const users = usersSnap ? usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  return { plannings, invitations, membres, users };
};
