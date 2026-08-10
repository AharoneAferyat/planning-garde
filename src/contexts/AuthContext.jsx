import { createContext, useContext, useEffect, useState } from 'react';
import { watchAuth, ensureAdmin, loginGoogle, logout } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return watchAuth(async (u) => {
      setUser(u);
      if (u) {
        try {
          const ok = await ensureAdmin(u.email);
          setIsAdmin(ok);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value = { user, isAdmin, loading, login: loginGoogle, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
