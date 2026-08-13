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

// Supprime un planning + ses invitations + ses membres (mais PAS les comptes users).
export const deletePlanning = async (id) => {
  try {
    // 1) invitations liées à ce planning
    const invSnap = await getDocs(query(collection(db, 'invitations'), where('planningId', '==', id)));
    await Promise.all(invSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    // 2) membres (sous-collection)
    const memSnap = await getDocs(collection(db, 'plannings', id, 'membres'));
    await Promise.all(memSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    // 3) historique (sous-collection) — nettoyage
    const hisSnap = await getDocs(collection(db, 'plannings', id, 'historique'));
    await Promise.all(hisSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch (e) { console.warn('deletePlanning cascade', e?.code || e); }
  // 4) le planning lui-même
  return deleteDoc(doc(db, 'plannings', id));
};
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
        planningId: d.ref.parent?.parent?.id,
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

// Récupération ponctuelle (admin) de l'historique d'un planning.
export const fetchHistorique = async (planningId, n = 100) => {
  const snap = await getDocs(
    query(collection(db, 'plannings', planningId, 'historique'), orderBy('at', 'desc'), limit(n))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Toutes les modifs de tous les plannings (admin) — vue globale inter-plannings.
export const fetchAllHistorique = async (n = 300) => {
  try {
    const snap = await getDocs(
      query(collectionGroup(db, 'historique'), orderBy('at', 'desc'), limit(n))
    );
    return snap.docs.map((d) => ({ id: d.id, planningId: d.ref.parent?.parent?.id, ...d.data() }));
  } catch (e) { console.warn('fetchAllHistorique', e?.code || e); return []; }
};

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

// Accès fermé : un email est autorisé s'il est admin, propriétaire d'un planning,
// ou membre d'au moins un planning (= il a déjà rejoint par le passé).
export const checkAccess = async (email) => {
  if (!email) return false;
  if (email === ADMIN_EMAIL) return true;
  try {
    // banni ? -> accès refusé même s'il est encore membre quelque part
    const ban = await getDoc(doc(db, 'banned', email));
    if (ban.exists()) return false;
    // membre d'au moins un planning ?
    const memSnap = await getDocs(
      query(collectionGroup(db, 'membres'), where('email', '==', email))
    );
    if (!memSnap.empty) return true;
    // propriétaire d'au moins un planning ?
    const ownSnap = await getDocs(
      query(collection(db, 'plannings'), where('ownerEmail', '==', email))
    );
    return !ownSnap.empty;
  } catch (e) {
    console.warn('checkAccess', e?.code || e);
    return false;
  }
};

// Bannir / débannir un utilisateur (admin). Un banni retombe sur l'écran d'invitation.
export const banUser = (email, by) => setDoc(doc(db, 'banned', email), { email, at: Date.now(), by: by?.email || '?' });
export const unbanUser = (email) => deleteDoc(doc(db, 'banned', email));
export const watchBanned = (cb) => onSnapshot(collection(db, 'banned'), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

// Retirer un utilisateur de TOUS les plannings d'un coup (révocation globale, admin).
export const revokeEverywhere = async (email) => {
  try {
    const memSnap = await getDocs(query(collectionGroup(db, 'membres'), where('email', '==', email)));
    await Promise.all(memSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch (e) { console.warn('revokeEverywhere', e?.code || e); }
};

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

// Suppression d'événements (admin).
export const deleteEvent = (id) => deleteDoc(doc(db, 'events', id));
export const clearEvents = async (ids) => {
  // supprime en parallèle une liste d'ids d'événements
  await Promise.all(ids.map((id) => deleteDoc(doc(db, 'events', id)).catch(() => {})));
};

// Suppression d'une entrée d'historique d'un planning (admin).
export const deleteHistorique = (planningId, docId) =>
  deleteDoc(doc(db, 'plannings', planningId, 'historique', docId));
export const clearHistorique = async (entries) => {
  // entries : [{ planningId, id }]
  await Promise.all(entries.map((e) => deleteDoc(doc(db, 'plannings', e.planningId, 'historique', e.id)).catch(() => {})));
};

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
  const membres = memSnap ? memSnap.docs.map((d) => ({ planningId: d.ref.parent?.parent?.id, ...d.data() })) : [];
  const users = usersSnap ? usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
  return { plannings, invitations, membres, users };
};

// ============ NOTIFICATIONS IN-APP ============
// notifications/{email}/items/{auto} : { type, text, planningId?, read, at }
export const pushNotif = (email, notif) =>
  addDoc(collection(db, 'notifications', email, 'items'), {
    ...notif, read: false, at: Date.now(),
  });

// Envoie une notif à plusieurs destinataires (emails).
export const pushNotifMany = async (emails, notif) => {
  await Promise.all((emails || []).filter(Boolean).map((e) => pushNotif(e, notif).catch(() => {})));
};

export const watchNotifs = (email, cb, n = 30) =>
  onSnapshot(
    query(collection(db, 'notifications', email, 'items'), orderBy('at', 'desc'), limit(n)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const markNotifRead = (email, id) =>
  updateDoc(doc(db, 'notifications', email, 'items', id), { read: true });

export const markAllNotifsRead = async (email, ids) => {
  await Promise.all((ids || []).map((id) => markNotifRead(email, id).catch(() => {})));
};

export const deleteNotif = (email, id) =>
  deleteDoc(doc(db, 'notifications', email, 'items', id));

// ============ ÉCHANGES DE GARDES ============
// plannings/{pid}/echanges/{auto} : { iso, dateLabel, fromNom, fromEmail, status:'ouvert'|'accepte'|'annule', takenByNom?, takenByEmail?, at }
export const createEchange = (pid, data) =>
  addDoc(collection(db, 'plannings', pid, 'echanges'), { ...data, status: 'ouvert', at: Date.now() });

export const watchEchanges = (pid, cb) =>
  onSnapshot(
    query(collection(db, 'plannings', pid, 'echanges'), orderBy('at', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const updateEchange = (pid, id, data) =>
  updateDoc(doc(db, 'plannings', pid, 'echanges', id), data);

export const deleteEchange = (pid, id) =>
  deleteDoc(doc(db, 'plannings', pid, 'echanges', id));

// ============ DUPLICATION DE SEMESTRE ============
// Duplique un planning (internes + réglages) SANS les gardes/présences (nouveau semestre vierge).
export const duplicatePlanning = async (sourceId, newData, owner) => {
  const src = await getDoc(doc(db, 'plannings', sourceId));
  if (!src.exists()) return null;
  const s = src.data();
  const ref = await addDoc(planningsCol, {
    nom: newData.nom || `${s.nom} (copie)`,
    annee: newData.annee ?? s.annee,
    type: newData.type ?? s.type,
    internes: (s.internes || []).map((it) => ({ ...it, email: '' })), // on garde les internes, on délie les identités
    gardes: {}, presences: {}, changed: {}, wasRandom: false, editsSinceRandom: 0,
    ownerEmail: owner.email, ownerNom: owner.nom || owner.email,
    statut: 'actif', createdAt: Date.now(),
  });
  await setDoc(doc(db, 'plannings', ref.id, 'membres', owner.email), {
    email: owner.email, nom: owner.nom || owner.email, role: 'proprietaire', addedAt: Date.now(),
  });
  return ref.id;
};
