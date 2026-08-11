import { useEffect, useState, useCallback } from 'react';

// Clé Unsplash (Access Key — prévue pour un usage côté client).
const UNSPLASH_ACCESS_KEY = 'UU2P4v_bV_ycZuzUENQiIy092ggSEuOGJ6Ee4kAKW2s';
// Thèmes piochés au hasard pour varier les photos.
const QUERIES = ['hospital', 'hospital corridor', 'medical', 'healthcare', 'clinic', 'nurse hospital'];

// En-tête visuel : photo hôpital aléatoire (Unsplash) derrière un dégradé + motif médical.
// Fallback propre sur le dégradé seul si l'API ne répond pas.
export default function Hero({ badge, title, subtitle, children }) {
  const [photo, setPhoto] = useState(null); // { url, author, authorLink, link }

  const fetchPhoto = useCallback(async () => {
    if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY.startsWith('VOTRE_')) return;
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&orientation=landscape&content_filter=high`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
      );
      if (!res.ok) return; // 403/limite → on garde le dégradé seul
      const d = await res.json();
      setPhoto({
        url: d.urls?.regular,
        author: d.user?.name,
        authorLink: d.user?.links?.html,
        link: d.links?.html,
      });
    } catch { /* réseau : fallback dégradé */ }
  }, []);

  useEffect(() => { fetchPhoto(); }, [fetchPhoto]);

  return (
    <div className="hero">
      {photo?.url && <div className="hero-img" style={{ backgroundImage: `url(${photo.url})` }} />}
      <div className="hero-pattern">
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 200">
          <defs>
            <pattern id="crosses" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M26 14h8v10h10v8H34v10h-8V32H16v-8h10z" fill="rgba(255,255,255,.06)" />
            </pattern>
          </defs>
          <rect width="800" height="200" fill="url(#crosses)" />
          <path d="M0 140 H180 l14 -46 l18 92 l16 -60 l12 30 H320 l14 -46 l18 92 l16 -60 l12 30 H800"
            fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
      <div className="hero-inner">
        {badge && <div className="hero-badge">{badge}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
      <button className="hero-refresh" title="Changer la photo" onClick={fetchPhoto}>⟳</button>
      {photo?.author && (
        <a className="hero-credit" href={photo.link} target="_blank" rel="noreferrer">
          Photo : {photo.author} / Unsplash
        </a>
      )}
    </div>
  );
}
