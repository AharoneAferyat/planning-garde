import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, adminFetchAll, watchEvents } from '../lib/firebase';
import { semesterLabel } from '../lib/semester';

export default function AdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState('events');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin(user)) return;
    adminFetchAll().then((d) => { setData(d); setLoading(false); });
    return watchEvents(setEvents);
  }, [user]);

  if (!isAdmin(user)) {
    return (
      <div className="empty" style={{ paddingTop: '3rem' }}>
        <h2>Accès réservé</h2>
        <p>Cette page est réservée à l'administrateur.</p>
      </div>
    );
  }

  const membersOf = (pid) => (data?.membres || []).filter((m) => m.planningId === pid);

  return (
    <>
      <div className="page-head">
        <h1>Administration</h1>
        <p>Vue globale sur toute la plateforme.</p>
      </div>

      {/* chiffres clés */}
      <div className="grid cols-3" style={{ marginBottom: '1.25rem' }}>
        <div className="stat"><div className="ic blue">▤</div><div><div className="v">{data?.plannings.length ?? '…'}</div><div className="l">Plannings</div></div></div>
        <div className="stat"><div className="ic green">✉</div><div><div className="v">{data?.invitations.length ?? '…'}</div><div className="l">Invitations</div></div></div>
        <div className="stat"><div className="ic purple">◎</div><div><div className="v">{data?.users.length ?? '…'}</div><div className="l">Utilisateurs</div></div></div>
      </div>

      <div className="tabs">
        {['events', 'plannings', 'invitations', 'users'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ events: 'Journal d\'activité', plannings: 'Plannings', invitations: 'Invitations', users: 'Utilisateurs' }[t]}
          </div>
        ))}
      </div>

      {loading && tab !== 'events' ? (
        <div className="loading-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-b" style={{ padding: 0 }}>
            {tab === 'events' && (
              <table className="tbl">
                <thead><tr><th>Type</th><th>Qui</th><th>Détail</th><th>Quand</th></tr></thead>
                <tbody>
                  {events.length === 0 && <tr><td colSpan={4}><div className="empty">Aucun événement enregistré pour l'instant.</div></td></tr>}
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td><span className={`badge ${eventColor(e.type)}`}>{eventLabel(e.type)}</span></td>
                      <td><div style={{ fontWeight: 600 }}>{e.nom}</div><div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>{e.email}</div></td>
                      <td style={{ color: 'var(--muted)' }}>{e.detail}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(e.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'plannings' && (
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Période</th><th>Propriétaire</th><th>Internes</th><th>Membres</th><th>Créé le</th></tr></thead>
                <tbody>
                  {data.plannings.length === 0 && <tr><td colSpan={6}><div className="empty">Aucun planning.</div></td></tr>}
                  {data.plannings.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nom || semesterLabel(p.annee, p.type)}</td>
                      <td style={{ color: 'var(--muted)' }}>{semesterLabel(p.annee, p.type)}</td>
                      <td>{p.ownerNom}<div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>{p.ownerEmail}</div></td>
                      <td>{p.internes?.length || 0}</td>
                      <td>{membersOf(p.id).length}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{p.createdAt ? fmtDateTime(p.createdAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'invitations' && (
              <table className="tbl">
                <thead><tr><th>Code</th><th>Planning</th><th>Rôle</th><th>Créée par</th><th>Utilisée par</th></tr></thead>
                <tbody>
                  {data.invitations.length === 0 && <tr><td colSpan={5}><div className="empty">Aucune invitation.</div></td></tr>}
                  {data.invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{inv.code}</td>
                      <td>{inv.planningNom}</td>
                      <td><span className={`badge ${inv.role === 'editeur' ? 'green' : 'gray'}`}>{inv.role === 'editeur' ? 'Éditeur' : 'Invité'}</span></td>
                      <td style={{ fontSize: '.82rem' }}>{inv.createdBy}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                        {(inv.usedBy?.length || 0) === 0 ? '—' : inv.usedBy.map((u) => u.email).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'users' && (
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Email</th><th>Dernière connexion</th></tr></thead>
                <tbody>
                  {data.users.length === 0 && <tr><td colSpan={3}><div className="empty">Aucun utilisateur.</div></td></tr>}
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.nom}</td>
                      <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{u.lastLogin ? fmtDateTime(u.lastLogin) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function eventLabel(t) {
  return { login: 'Connexion', join: 'A rejoint', create_planning: 'Planning créé', create_invitation: 'Invitation créée' }[t] || t;
}
function eventColor(t) {
  return { login: 'gray', join: 'green', create_planning: 'blue', create_invitation: 'amber' }[t] || 'gray';
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
