import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const UNSPLASH_ACCESS_KEY = 'UU2P4v_bV_ycZuzUENQiIy092ggSEuOGJ6Ee4kAKW2s';
const QUERIES = ['hospital', 'hospital corridor', 'medical', 'healthcare', 'clinic', 'nurse hospital'];

const MAX_PER_HOUR = 5;          // plafond de changements d'images par heure
const STORE_KEY = 'pg_photos';   // { header, background, stamps: [ts,...] }

const PhotoContext = createContext(null);

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveStore(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

async function fetchOne() {
  if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.startsWith('VOTRE_')) return null;
  const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return { url: d.urls?.regular, author: d.user?.name, link: d.links?.html };
  } catch { return null; }
}

export function PhotoProvider({ children }) {
  const [header, setHeader] = useState(null);
  const [background, setBackground] = useState(null);

  const init = useCallback(async () => {
    const store = loadStore();
    const now = Date.now();
    const hourAgo = now - 3600 * 1000;
    const stamps = (store.stamps || []).filter((t) => t > hourAgo); // changements dans la dernière heure

    // Plafond atteint : on réutilise les images mémorisées, aucun nouvel appel.
    if (stamps.length >= MAX_PER_HOUR && store.header && store.background) {
      setHeader(store.header);
      setBackground(store.background);
      return;
    }

    // Sinon : on pioche 2 nouvelles images différentes.
    const [h, b] = await Promise.all([fetchOne(), fetchOne()]);
    const newHeader = h || store.header || null;
    let newBg = b || store.background || null;
    // éviter que header et fond soient identiques
    if (newHeader && newBg && newHeader.url === newBg.url) {
      const alt = await fetchOne();
      if (alt && alt.url !== newHeader.url) newBg = alt;
    }
    setHeader(newHeader);
    setBackground(newBg);

    // On enregistre le changement seulement si on a effectivement obtenu de nouvelles images.
    if (h || b) {
      saveStore({ header: newHeader, background: newBg, stamps: [...stamps, now] });
    } else if (store.header || store.background) {
      // fallback : réutilise l'existant sans consommer de crédit
      setHeader(store.header || null);
      setBackground(store.background || null);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  return (
    <PhotoContext.Provider value={{ header, background }}>
      {children}
    </PhotoContext.Provider>
  );
}

export const usePhoto = () => useContext(PhotoContext) || { header: null, background: null };
