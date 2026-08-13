import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Mail, Settings, Sun, Moon, MonitorSmartphone, Clock4, Power, Cross } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePhoto } from '../contexts/PhotoContext';
import { useTheme } from '../contexts/ThemeContext';
import { isAdmin } from '../lib/firebase';
import NotificationBell from './NotificationBell';

const NAV = [
  { to: '/', label: 'Tableau de bord', Icon: LayoutDashboard, end: true },
  { to: '/plannings', label: 'Mes plannings', Icon: CalendarDays },
  { to: '/invitations', label: 'Invitations', Icon: Mail },
];

const MOBILE = [
  { to: '/', label: 'Accueil', Icon: LayoutDashboard, end: true },
  { to: '/plannings', label: 'Plannings', Icon: CalendarDays },
  { to: '/invitations', label: 'Inviter', Icon: Mail },
];

function initials(nom = '') {
  return nom.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { background } = usePhoto();
  const { mode, label, cycle } = useTheme();
  const nav = useNavigate();
  const ThemeIcon = { auto: Clock4, system: MonitorSmartphone, light: Sun, dark: Moon }[mode] || Clock4;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <div className="mark"><Cross size={18} strokeWidth={2.5} /></div>
          <div className="txt">Planning<small>Garde</small></div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="ic"><n.Icon size={18} /></span> {n.label}
            </NavLink>
          ))}
        </nav>
        {isAdmin(user) && (
          <NavLink to="/admin" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
            <span className="ic"><Settings size={18} /></span> Administration
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
          <NotificationBell />
          <button className="btn-icon" title={`Thème : ${label} (cliquer pour changer)`} onClick={cycle}>
            <ThemeIcon size={17} />
          </button>
          <button className="btn-icon" title="Déconnexion" onClick={logout}><Power size={17} /></button>
        </div>
      </aside>

      <div className="main">
        {background?.url && (
          <div className="page-bg" style={{ backgroundImage: `url(${background.url})` }} aria-hidden="true" />
        )}
        <div className="mobile-top">
          <div className="mark"><Cross size={16} strokeWidth={2.5} /></div>
          <div className="brand">Planning Garde</div>
          <NotificationBell />
          <button className="btn-icon" onClick={cycle} title={`Thème : ${label}`}><ThemeIcon size={17} /></button>
          <button className="btn-icon" onClick={logout} title="Déconnexion"><Power size={17} /></button>
        </div>
        <div className="content">{children}</div>
      </div>

      <nav className="mobile-nav">
        {MOBILE.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="ic"><n.Icon size={20} /></span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
