import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function TopBar() {
  const { user, isAdmin, login, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="topbar">
      <Link to="/" className="brand" style={{ color: '#fff', textDecoration: 'none' }}>
        <span className="dot" /> Gardes des Internes
      </Link>
      <div className="spacer" />
      {isAdmin && (
        <button className="btn ghost sm" onClick={() => nav('/internes')}>
          Internes
        </button>
      )}
      {user ? (
        <>
          <span className="who">
            {user.displayName || user.email}{isAdmin ? ' · admin' : ''}
          </span>
          <button className="btn ghost sm" onClick={logout}>Déconnexion</button>
        </>
      ) : (
        <button className="btn ghost sm" onClick={login}>Connexion Google</button>
      )}
    </div>
  );
}
