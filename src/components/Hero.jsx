import { usePhoto } from '../contexts/PhotoContext';

// En-tête visuel : photo hôpital (header) + dégradé + motif médical.
export default function Hero({ badge, title, subtitle, children }) {
  const { header } = usePhoto();
  return (
    <div className="hero">
      {header?.url && <div className="hero-img" style={{ backgroundImage: `url(${header.url})` }} />}
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
      {header?.author && (
        <a className="hero-credit" href={header.link} target="_blank" rel="noreferrer">
          Photo : {header.author} / Unsplash
        </a>
      )}
    </div>
  );
}
