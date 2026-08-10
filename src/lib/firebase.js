// Firebase — configuration + helpers Firestore/Auth
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc,
  setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
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

// ---- Auth ----
export const loginGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);

// ---- Firestore : Internes ----
const internesCol = collection(db, 'internes');
export const watchInternes = (cb) =>
  onSnapshot(query(internesCol, orderBy('nom')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const addInterne = (data) => addDoc(internesCol, data);
export const updateInterne = (id, data) => updateDoc(doc(db, 'internes', id), data);
export const deleteInterne = (id) => deleteDoc(doc(db, 'internes', id));

// ---- Firestore : Semestres ----
const semestresCol = collection(db, 'semestres');
export const watchSemestres = (cb) =>
  onSnapshot(query(semestresCol, orderBy('createdAt', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
export const createSemestre = (data) =>
  addDoc(semestresCol, { ...data, createdAt: Date.now() });
export const deleteSemestre = (id) => deleteDoc(doc(db, 'semestres', id));
export const watchSemestre = (id, cb) =>
  onSnapshot(doc(db, 'semestres', id), (d) =>
    cb(d.exists() ? { id: d.id, ...d.data() } : null));
export const updateSemestreGardes = (id, gardes) =>
  updateDoc(doc(db, 'semestres', id), { gardes });
export const updateSemestreInternes = (id, internes) =>
  updateDoc(doc(db, 'semestres', id), { internes });

// ---- Admins autorisés ----
export const ensureAdmin = async (email) => {
  if (!email) return false;
  const ref = doc(db, 'admins', email);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { role: 'admin', createdAt: Date.now() });
    return true;
  }
  return snap.data().role === 'admin';
};
