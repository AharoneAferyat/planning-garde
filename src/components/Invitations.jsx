import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlannings } from '../lib/usePlannings';
import { createInvitation, watchInvitations, deleteInvitation, logEvent } from '../lib/firebase';
import QRCode from './QRCode';

export default function Invitations() {
  const { user } = useAuth();
  const { mine } = usePlannings();
  const [planningId, setPlanningId] = useState('');
  const [role, setRole] = useState('editeur');
  const [invitations, setInvitations] = useState([]);
  const [lastCode, setLastCode] = useState('');
  const [copied, setCopied] = useState('');

  // sélectionne le 1er planning par défaut
  useEffect(() => {
    if (!planningId && mine.length) setPlanningId(mine[0].id);
  }, [mine, planningId]);

  useEffect(() => {
    if (!planningId) return;
    return watchInvitations(planningId, setInvitations);
  }, [planningId]);

  const planning = mine.find((p) => p.id === planningId);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (code) => `${origin}/join/${code}`;

  const generate = async () => {
    if (!planning) return;
    const code = await createInvitation(planning.id, planning.nom, role, user);
    logEvent("create_invitation", user, `A créé une invitation (${role}) pour « ${planning.nom} » : ${code}`);
    setLastCode(code);
  };

  const copy = (txt, key) => {
    navigator.clipboard?.writeText(txt);
    setCopied(key); setTimeout(() => setCopied(''), 1500);
  };

  if (mine.length === 0) {
    return (
      <>
        <div className="page-head"><h1>Invitations</h1>
          <p>Invite des internes à rejoindre tes plannings.</p></div>
        <div className="card"><div className="empty">
          Crée d'abord un planning pour pouvoir inviter des personnes.
        </div></div>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>Invitations</h1>
        <p>Invite des internes (éditeur) ou des observateurs (invité, lecture seule).</p></div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-h">Générer une invitation</div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="field">
              <label>Planning</label>
              <select value={planningId} onChange={(e) => { setPlanningId(e.target.value); setLastCode(''); }}>
                {mine.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Rôle accordé</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="editeur">Éditeur — peut modifier le planning</option>
                <option value="invite">Invité — lecture seule</option>
              </select>
            </div>
            <button className="btn" onClick={generate}>Générer un code d'invitation</button>

            {lastCode && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '.85rem', alignItems: 'center' }}>
                <QRCode value={linkFor(lastCode)} size={170} />
                <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Scanne pour rejoindre</div>
                <div className="row" style={{ width: '100%' }}>
                  <input className="mono" readOnly value={lastCode}
                    style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '.55rem .7rem', textAlign: 'center', fontWeight: 700, letterSpacing: '2px' }}
                    onClick={(e) => e.target.select()} />
                  <button className="btn secondary sm" onClick={() => copy(lastCode, 'code')}>
                    {copied === 'code' ? '✓' : 'Copier le code'}
                  </button>
                </div>
                <div className="row" style={{ width: '100%' }}>
                  <input className="mono" readOnly value={linkFor(lastCode)}
                    style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '.55rem .7rem', fontSize: '.78rem' }}
                    onClick={(e) => e.target.select()} />
                  <button className="btn secondary sm" onClick={() => copy(linkFor(lastCode), 'link')}>
                    {copied === 'link' ? '✓' : 'Copier le lien'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Invitations de ce planning</div>
          <div className="card-b" style={{ padding: 0 }}>
            {invitations.length === 0 ? (
              <div className="empty">Aucune invitation générée.</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Code</th><th>Rôle</th><th>Utilisée par</th><th></th></tr></thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontWeight: 700, letterSpacing: '1px' }}>{inv.code}</td>
                      <td><span className={`badge ${inv.role === 'editeur' ? 'green' : 'gray'}`}>
                        {inv.role === 'editeur' ? 'Éditeur' : 'Invité'}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                        {(inv.usedBy?.length || 0) === 0
                          ? '—'
                          : inv.usedBy.map((u) => u.email).join(', ')}
                      </td>
                      <td>
                        <button className="btn danger sm" onClick={() => deleteInvitation(inv.code)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
