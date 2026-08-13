import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { watchNotifs, markNotifRead, markAllNotifsRead, deleteNotif } from '../lib/firebase';

export default function NotificationBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user?.email) return;
    return watchNotifs(user.email, setItems);
  }, [user?.email]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const openItem = (n) => {
    if (!n.read) markNotifRead(user.email, n.id);
    if (n.planningId) { setOpen(false); nav(`/planning/${n.planningId}`); }
  };

  return (
    <div className="notif" ref={ref}>
      <button className="btn-icon" title="Notifications" onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-h">
            <span>Notifications</span>
            {unread > 0 && (
              <button className="link-btn" onClick={() => markAllNotifsRead(user.email, items.filter((n) => !n.read).map((n) => n.id))}>
                <Check size={13} /> Tout marquer lu
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 && <div className="empty" style={{ padding: '1.5rem 1rem' }}>Aucune notification.</div>}
            {items.map((n) => (
              <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <div className="notif-txt">
                  <div>{n.text}</div>
                  <div className="notif-time">{fmtAgo(n.at)}</div>
                </div>
                <button className="notif-x" title="Supprimer"
                  onClick={(e) => { e.stopPropagation(); deleteNotif(user.email, n.id); }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}
