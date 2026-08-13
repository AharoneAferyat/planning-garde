import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePhoto } from '../contexts/PhotoContext';
import { useTheme } from '../contexts/ThemeContext';
import { isAdmin } from '../lib/firebase';

const NAV = [
  { to: '/', label: 'Tableau de bord', ic: '▦', end: true },
  { to: '/plannings', label: 'Mes plannings', ic: '▤' },
  { to: '/invitations', label: 'Invitations', ic: '✉' },
];

const MOBILE = [
  { to: '/', label: 'Accueil', ic: '▦', end: true },
  { to: '/plannings', label: 'Plannings', ic: '▤' },
  { to: '/invitations', label: 'Inviter', ic: '✉' },
];

function initials(nom = '') {
  return nom.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { background } = usePhoto();
  const { mode, label, cycle } = useTheme();
  const nav = useNavigate();
  const themeIcon = { auto: '◑', system: '🖥', light: '☀', dark: '☾' }[mode] || '◑';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="mark">✚</div>
          <div className="txt">Planning<small>Garde</small></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="ic">{n.ic}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        {isAdmin(user) && (
          <NavLink to="/admin" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <span className="ic">⚙</span> Administration
          </NavLink>
        )}
        <div className="foot">
          <div className="avatar">
            {user?.photo ? <img src={user.photo} alt="" /> : initials(user?.nom)}
          </div>
          <div className="who">
            <div className="n">{user?.nom}</div>
            <div className="r">{user?.email}</div>
          </div>
          <button className="btn-icon" title={`Thème : ${label} (cliquer pour changer)`} onClick={cycle}>
            {themeIcon}
          </button>
          <button className="btn-icon" title="Déconnexion" onClick={logout}>⏻</button>
        </div>
      </aside>

      <div className="main">
        {background?.url && (
          <div className="page-bg" style={{ backgroundImage: `url(${background.url})` }} aria-hidden="true" />
        )}
        <div className="mobile-top">
          <div className="mark">✚</div>
          <div className="brand">Planning Garde</div>
          <button className="btn-icon" onClick={cycle} title={`Thème : ${label}`}>{themeIcon}</button>
          <button className="btn-icon" onClick={logout} title="Déconnexion">⏻</button>
        </div>
        <div className="content">{children}</div>
      </div>

      <nav className="mobile-nav">
        {MOBILE.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="ic">{n.ic}</span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
