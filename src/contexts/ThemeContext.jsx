import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORE_KEY = 'pg_theme'; // 'auto' | 'system' | 'light' | 'dark'

// Cycle du bouton : Auto (heure) -> Système -> Clair -> Sombre -> Auto...
const CYCLE = ['auto', 'system', 'light', 'dark'];
const LABELS = { auto: 'Auto (heure)', system: 'Système', light: 'Clair', dark: 'Sombre' };

// Thème selon l'heure : sombre entre 20h et 7h.
function byHour() {
  const h = new Date().getHours();
  return (h >= 20 || h < 7) ? 'dark' : 'light';
}
// Thème selon les préférences de l'appareil.
function bySystem() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolve(mode) {
  if (mode === 'auto') return byHour();
  if (mode === 'system') return bySystem();
  return mode; // 'light' | 'dark'
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(STORE_KEY) || 'auto'; } catch { return 'auto'; }
  });
  const [effective, setEffective] = useState(() => resolve('auto'));

  // applique le thème résolu
  useEffect(() => {
    const eff = resolve(mode);
    setEffective(eff);
    document.documentElement.setAttribute('data-theme', eff);
  }, [mode]);

  // mode "heure" : re-vérifie toutes les 10 min
  useEffect(() => {
    if (mode !== 'auto') return;
    const id = setInterval(() => {
      const eff = byHour();
      setEffective(eff);
      document.documentElement.setAttribute('data-theme', eff);
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [mode]);

  // mode "système" : écoute les changements de préférence de l'appareil
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const eff = mq.matches ? 'dark' : 'light';
      setEffective(eff);
      document.documentElement.setAttribute('data-theme', eff);
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [mode]);

  const setTheme = useCallback((m) => {
    setMode(m);
    try { localStorage.setItem(STORE_KEY, m); } catch { /* ignore */ }
  }, []);

  // le bouton fait avancer dans le cycle
  const cycle = useCallback(() => {
    const i = CYCLE.indexOf(mode);
    setTheme(CYCLE[(i + 1) % CYCLE.length]);
  }, [mode, setTheme]);

  return (
    <ThemeContext.Provider value={{ mode, effective, label: LABELS[mode], setTheme, cycle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext) || { mode: 'auto', effective: 'light', label: 'Auto (heure)', setTheme: () => {}, cycle: () => {} };
