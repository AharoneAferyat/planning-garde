import { createContext, useContext, useEffect, useState } from 'react';
import { watchAuth, upsertUser, loginGoogle, logout, logEvent } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // { email, nom, photo, uid }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return watchAuth(async (u) => {
      if (u) {
        const profile = {
          email: u.email,
          nom: u.displayName || u.email,
          photo: u.photoURL || '',
          uid: u.uid,
        };
        setUser(profile);
        try { await upsertUser(u); } catch { /* offline ok */ }
        // journal des connexions : une fois par session navigateur
        try {
          const key = `pg_login_${u.email}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            logEvent('login', profile, 'Connexion');
          }
        } catch { /* ignore */ }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login: loginGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
