import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';
import { isAdmin, adminFetchAll, watchEvents, fetchHistorique, fetchAllHistorique, deleteEvent, clearEvents, deleteHistorique, clearHistorique, banUser, unbanUser, watchBanned, revokeEverywhere, logEvent, deleteInvitation } from '../lib/firebase';
import { semesterLabel } from '../lib/semester';

export default function AdminPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [banned, setBanned] = useState([]);
  const [allHisto, setAllHisto] = useState(null);   // vue globale des modifs
  const [detail, setDetail] = useState(null);       // { planning, histo } détail d'un planning
  const [tab, setTab] = useState('connexions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin(user)) return;
    adminFetchAll()
      .then((d) => setData(d))
      .catch(() => setData({ plannings: [], invitations: [], membres: [], users: [] }))
      .finally(() => setLoading(false));
    const unsubE = watchEvents(setEvents);
    const unsubB = watchBanned(setBanned);
    return () => { unsubE && unsubE(); unsubB && unsubB(); };
  }, [user]);

  const isBanned = (email) => banned.some((b) => b.email === email);

  const revokeAll = async (email) => {
    if (!confirm(`Retirer ${email} de TOUS les plannings ?`)) return;
    try {
      const n = await revokeEverywhere(email);
      logEvent('revoke_all', user, `A retiré ${email} de tous les plannings (${n})`);
      await adminFetchAll().then(setData);
      alert(n > 0 ? `${email} retiré de ${n} planning(s).` : `${email} n'était membre d'aucun planning.`);
    } catch (e) {
      alert(`Échec : ${e?.code || e}. Si c'est "failed-precondition", il faut créer l'index Firestore (voir console F12).`);
    }
  };
  const toggleBan = async (email) => {
    try {
      if (isBanned(email)) {
        await unbanUser(email);
        logEvent('unban', user, `A débanni ${email}`);
      } else {
        if (!confirm(`Bannir ${email} ? Il devra une nouvelle invitation pour revenir.`)) return;
        await banUser(email, user);
        const n = await revokeEverywhere(email); // bannir = retirer de partout aussi
        logEvent('ban', user, `A banni ${email} (retiré de ${n} planning(s))`);
        await adminFetchAll().then(setData);
      }
    } catch (e) {
      alert(`Échec : ${e?.code || e}. Si "failed-precondition", crée l'index Firestore (console F12).`);
    }
  };

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
        {['connexions', 'actions', 'modifs', 'plannings', 'invitations', 'users', 'bannis'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ connexions: 'Connexions', actions: 'Actions', modifs: 'Modifs plannings', plannings: 'Plannings', invitations: 'Invitations', users: 'Utilisateurs', bannis: `Bannis${banned.length ? ` (${banned.length})` : ''}` }[t]}
          </div>
        ))}
      </div>

      {loading && tab !== 'connexions' && tab !== 'actions' ? (
        <div className="loading-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-b" style={{ padding: 0 }}>
            {tab === 'connexions' && (() => {
              const rows = events.filter((e) => e.type === 'login');
              return (
                <>
                  <div className="row" style={{ justifyContent: 'flex-end', padding: '.7rem 1rem', borderBottom: '1px solid var(--line)' }}>
                    <button className="btn danger sm" disabled={rows.length === 0}
                      onClick={() => { if (confirm('Vider tous les logs de connexion ?')) clearEvents(rows.map((r) => r.id)); }}>
                      Vider les connexions
                    </button>
                  </div>
                  <table className="tbl">
                    <thead><tr><th>Qui</th><th>Email</th><th>Quand</th><th></th></tr></thead>
                    <tbody>
                      {rows.length === 0 && <tr><td colSpan={4}><div className="empty">Aucune connexion enregistrée.</div></td></tr>}
                      {rows.map((e) => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.nom}</td>
                          <td style={{ color: 'var(--muted)' }}>{e.email}</td>
                          <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(e.at)}</td>
                          <td><button className="btn-icon" title="Supprimer" onClick={() => deleteEvent(e.id)}><X size={15} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {tab === 'actions' && (() => {
              const rows = events.filter((e) => e.type !== 'login');
              return (
                <>
                  <div className="row" style={{ justifyContent: 'flex-end', padding: '.7rem 1rem', borderBottom: '1px solid var(--line)' }}>
                    <button className="btn danger sm" disabled={rows.length === 0}
                      onClick={() => { if (confirm('Vider tous les logs d\'action ?')) clearEvents(rows.map((r) => r.id)); }}>
                      Vider les actions
                    </button>
                  </div>
                  <table className="tbl">
                    <thead><tr><th>Type</th><th>Qui</th><th>Détail</th><th>Quand</th><th></th></tr></thead>
                    <tbody>
                      {rows.length === 0 && <tr><td colSpan={5}><div className="empty">Aucune action enregistrée.</div></td></tr>}
                      {rows.map((e) => (
                        <tr key={e.id}>
                          <td><span className={`badge ${eventColor(e.type)}`}>{eventLabel(e.type)}</span></td>
                          <td><div style={{ fontWeight: 600 }}>{e.nom}</div><div style={{ fontSize: '.76rem', color: 'var(--muted)' }}>{e.email}</div></td>
                          <td style={{ color: 'var(--muted)' }}>{e.detail}</td>
                          <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(e.at)}</td>
                          <td><button className="btn-icon" title="Supprimer" onClick={() => deleteEvent(e.id)}><X size={15} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {tab === 'modifs' && (
              allHisto === null ? (
                <div className="loading-screen" style={{ minHeight: 140 }}><div className="spinner" /></div>
              ) : (
                <>
                  <div className="row" style={{ justifyContent: 'flex-end', padding: '.7rem 1rem', borderBottom: '1px solid var(--line)' }}>
                    <button className="btn danger sm" disabled={allHisto.length === 0}
                      onClick={async () => {
                        if (!confirm('Vider TOUTES les modifs de TOUS les plannings ? (irréversible)')) return;
                        await clearHistorique(allHisto.map((h) => ({ planningId: h.planningId, id: h.id })));
                        setAllHisto([]);
                      }}>
                      Tout vider
                    </button>
                  </div>
                  <table className="tbl">
                    <thead><tr><th>Planning</th><th>Qui</th><th>Action</th><th>Détail</th><th>Quand</th><th></th></tr></thead>
                    <tbody>
                      {allHisto.length === 0 && <tr><td colSpan={6}><div className="empty">Aucune modification enregistrée.</div></td></tr>}
                      {allHisto.map((h) => {
                        const pl = data?.plannings.find((p) => p.id === h.planningId);
                        return (
                          <tr key={h.id}>
                            <td style={{ fontWeight: 600 }}>{pl ? (pl.nom || semesterLabel(pl.annee, pl.type)) : h.planningId?.slice(0, 6)}</td>
                            <td>{h.nom}</td>
                            <td><span className="badge gray">{h.action}</span></td>
                            <td style={{ color: 'var(--muted)' }}>{h.detail}</td>
                            <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</td>
                            <td><button className="btn-icon" title="Supprimer"
                              onClick={async () => { await deleteHistorique(h.planningId, h.id); setAllHisto((prev) => prev.filter((x) => x.id !== h.id)); }}><X size={15} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
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
                <thead><tr><th>Code</th><th>Planning</th><th>Rôle</th><th>Créée par</th><th>Utilisée par</th><th>Action</th></tr></thead>
                <tbody>
                  {data.invitations.length === 0 && <tr><td colSpan={6}><div className="empty">Aucune invitation.</div></td></tr>}
                  {data.invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{inv.code || inv.id}</td>
                      <td>{inv.planningNom || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>planning supprimé</span>}</td>
                      <td><span className={`badge ${inv.role === 'editeur' ? 'green' : 'gray'}`}>{inv.role === 'editeur' ? 'Éditeur' : 'Invité'}</span></td>
                      <td style={{ fontSize: '.82rem' }}>{inv.createdBy}</td>
                      <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                        {(inv.usedBy?.length || 0) === 0 ? '—' : inv.usedBy.map((u) => u.email).join(', ')}
                      </td>
                      <td>
                        <button className="btn danger sm" title="Supprimer cette invitation"
                          onClick={async () => {
                            try {
                              await deleteInvitation(inv.code || inv.id);
                              logEvent('delete_invitation', user, `A supprimé l'invitation ${inv.code || inv.id}`);
                              await adminFetchAll().then(setData);
                            } catch (e) { alert(`Échec : ${e?.code || e}`); }
                          }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'users' && (
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
                <tbody>
                  {data.users.length === 0 && <tr><td colSpan={5}><div className="empty">Aucun utilisateur.</div></td></tr>}
                  {data.users.map((u) => {
                    const admin = u.email === 'aaferyat@gmail.com';
                    const ban = isBanned(u.email);
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.nom}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                        <td>{admin ? <span className="badge blue">Admin</span> : ban ? <span className="badge red">Banni</span> : <span className="badge green">Actif</span>}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{u.lastLogin ? fmtDateTime(u.lastLogin) : '—'}</td>
                        <td>
                          {admin ? <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>—</span> : (
                            <div className="row" style={{ gap: '.4rem' }}>
                              <button className="btn secondary sm" onClick={() => revokeAll(u.email)}>Retirer de tout</button>
                              <button className={`btn sm ${ban ? '' : 'danger'}`} onClick={() => toggleBan(u.email)}>
                                {ban ? 'Débannir' : 'Bannir'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {tab === 'bannis' && (
              <table className="tbl">
                <thead><tr><th>Email banni</th><th>Banni le</th><th>Par</th><th>Action</th></tr></thead>
                <tbody>
                  {banned.length === 0 && <tr><td colSpan={4}><div className="empty">Aucun utilisateur banni.</div></td></tr>}
                  {banned.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.email}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{b.at ? fmtDateTime(b.at) : '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{b.by || '—'}</td>
                      <td>
                        <button className="btn secondary sm" onClick={() => toggleBan(b.email)}>Débannir</button>
                      </td>
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
                  <thead><tr><th>Qui</th><th>Action</th><th>Détail</th><th>Quand</th><th></th></tr></thead>
                  <tbody>
                    {detail.histo.map((h) => (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 600 }}>{h.nom}</td>
                        <td><span className="badge gray">{h.action}</span></td>
                        <td style={{ color: 'var(--muted)' }}>{h.detail}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>{fmtDateTime(h.at)}</td>
                        <td><button className="btn-icon" title="Supprimer"
                          onClick={async () => { await deleteHistorique(detail.planning.id, h.id); setDetail((d) => ({ ...d, histo: d.histo.filter((x) => x.id !== h.id) })); }}><X size={15} /></button></td>
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
    revoke_all: 'Retiré de tout', ban: 'Banni', unban: 'Débanni',
  }[t] || t;
}
function eventColor(t) {
  return {
    login: 'gray', join: 'green',
    create_planning: 'blue', delete_planning: 'red',
    create_invitation: 'amber', delete_invitation: 'red',
    remove_member: 'red', change_role: 'amber',
    revoke_all: 'red', ban: 'red', unban: 'green',
  }[t] || 'gray';
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
