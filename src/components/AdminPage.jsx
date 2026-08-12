import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, adminFetchAll, watchEvents, fetchHistorique, fetchAllHistorique } from '../lib/firebase';
import { semesterLabel } from '../lib/semester';

export default function AdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [allHisto, setAllHisto] = useState(null);   // vue globale des modifs
  const [detail, setDetail] = useState(null);       // { planning, histo } détail d'un planning
  const [tab, setTab] = useState('events');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin(user)) return;
    adminFetchAll()
      .then((d) => setData(d))
      .catch(() => setData({ plannings: [], invitations: [], membres: [], users: [] }))
      .finally(() => setLoading(false));
    return watchEvents(setEvents);
  }, [user]);

  // charge la vue globale des modifs quand on ouvre l'onglet
  useEffect(() => {
    if (tab === 'modifs' && allHisto === null && isAdmin(user)) {
      fetchAllHistorique().then(setAllHisto);
    }
  }, [tab, allHisto, user]);

  const openDetail = async (p) => {
    setDetail({ planning: p, histo: null });
    const h = await fetchHistorique(p.id);
    setDetail({ planning: p, histo: h });
  };

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
        {['events', 'modifs', 'plannings', 'invitations', 'users'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ events: 'Journal global', modifs: 'Modifs plannings', plannings: 'Plannings', invitations: 'Invitations', users: 'Utilisateurs' }[t]}
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

            {tab === 'modifs' && (
              allHisto === null ? (
                <div className="loading-screen" style={{ minHeight: 140 }}><div className="spinner" /></div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Planning</th><th>Qui</th><th>Action</th><th>Détail</th><th>Quand</th></tr></thead>
                  <tbody>
                    {allHisto.length === 0 && <tr><td colSpan={5}><div className="empty">Aucune modification enregistrée.</div></td></tr>}
                    {allHisto.map((h) => {
                      const pl = data?.plannings.find((p) => p.id === h.planningId);
                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>{pl ? (pl.nom || semesterLabel(pl.annee, pl.type)) : h.planningId?.slice(0, 6)}</td>
                          <td>{h.nom}</td>
                          <td><span className="badge gray">{h.action}</span></td>
                          <td style={{ color: 'var(--muted)' }}>{h.detail}</td>
                          <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {tab === 'plannings' && (
              <table className="tbl">
                <thead><tr><th>Nom (clic → historique)</th><th>Période</th><th>Propriétaire</th><th>Internes</th><th>Membres</th><th>Créé le</th></tr></thead>
                <tbody>
                  {data.plannings.length === 0 && <tr><td colSpan={6}><div className="empty">Aucun planning.</div></td></tr>}
                  {data.plannings.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p)}>
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

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              Historique — {detail.planning.nom || semesterLabel(detail.planning.annee, detail.planning.type)}
            </div>
            <div className="modal-b" style={{ padding: 0, maxHeight: '60vh', overflowY: 'auto' }}>
              {detail.histo === null ? (
                <div className="loading-screen" style={{ minHeight: 120 }}><div className="spinner" /></div>
              ) : detail.histo.length === 0 ? (
                <div className="empty">Aucune modification sur ce planning.</div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Qui</th><th>Action</th><th>Détail</th><th>Quand</th></tr></thead>
                  <tbody>
                    {detail.histo.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 600 }}>{h.nom}</td>
                        <td><span className="badge gray">{h.action}</span></td>
                        <td style={{ color: 'var(--muted)' }}>{h.detail}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-f">
              <button className="btn secondary" onClick={() => setDetail(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function eventLabel(t) {
  return {
    login: 'Connexion', join: 'A rejoint',
    create_planning: 'Planning créé', delete_planning: 'Planning supprimé',
    create_invitation: 'Invitation créée', delete_invitation: 'Invitation supprimée',
    remove_member: 'Membre retiré', change_role: 'Rôle changé',
  }[t] || t;
}
function eventColor(t) {
  return {
    login: 'gray', join: 'green',
    create_planning: 'blue', delete_planning: 'red',
    create_invitation: 'amber', delete_invitation: 'red',
    remove_member: 'red', change_role: 'amber',
  }[t] || 'gray';
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
