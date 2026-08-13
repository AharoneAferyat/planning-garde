import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePlannings } from '../lib/usePlannings';
import { createInvitation, watchInvitations, deleteInvitation, logEvent, watchMembres } from '../lib/firebase';
import QRCode from './QRCode';

export default function Invitations() {
  const { user } = useAuth();
  const { mine } = usePlannings();
  const [planningId, setPlanningId] = useState('');
  const [role, setRole] = useState('editeur');
  const [invitations, setInvitations] = useState([]);
  const [members, setMembers] = useState([]);
  const [lastCode, setLastCode] = useState('');
  const [copied, setCopied] = useState('');
  const [extraEmails, setExtraEmails] = useState('');
  const [checked, setChecked] = useState({}); // email -> bool

  // sélectionne le 1er planning par défaut
  useEffect(() => {
    if (!planningId && mine.length) setPlanningId(mine[0].id);
  }, [mine, planningId]);

  useEffect(() => {
    if (!planningId) return;
    const u1 = watchInvitations(planningId, setInvitations);
    const u2 = watchMembres(planningId, setMembers);
    return () => { u1 && u1(); u2 && u2(); };
  }, [planningId]);

  const planning = mine.find((p) => p.id === planningId);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (code) => `${origin}/join/${code}`;

  // Destinataires cochés + emails saisis manuellement
  const selectedEmails = useMemo(() => {
    const fromMembers = members.filter((m) => checked[m.email]).map((m) => m.email);
    const fromText = extraEmails.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
    return [...new Set([...fromMembers, ...fromText])];
  }, [members, checked, extraEmails]);

  const buildMailto = (code) => {
    const link = linkFor(code);
    const subject = encodeURIComponent(`Invitation — planning de gardes « ${planning?.nom || ''} »`);
    const body = encodeURIComponent(
      `Bonjour,\n\nTu es invité(e) à rejoindre le planning de gardes « ${planning?.nom || ''} ».\n\n` +
      `Clique sur ce lien pour rejoindre :\n${link}\n\n` +
      `Ou entre ce code dans l'application : ${code}\n\n` +
      `À bientôt !`
    );
    const to = selectedEmails.join(',');
    return `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const toggleAll = (on) => {
    const next = {};
    if (on) members.forEach((m) => { if (m.email !== user.email) next[m.email] = true; });
    setChecked(next);
  };

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
                    {copied === 'code' ? <Check size={14} /> : 'Copier le code'}
                  </button>
                </div>
                <div className="row" style={{ width: '100%' }}>
                  <input className="mono" readOnly value={linkFor(lastCode)}
                    style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '.55rem .7rem', fontSize: '.78rem' }}
                    onClick={(e) => e.target.select()} />
                  <button className="btn secondary sm" onClick={() => copy(linkFor(lastCode), 'link')}>
                    {copied === 'link' ? <Check size={14} /> : 'Copier le lien'}
                  </button>
                </div>

                {/* Envoi par email (mailto) */}
                <div style={{ width: '100%', borderTop: '1px solid var(--line)', paddingTop: '.85rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '.5rem' }}>Envoyer par email</div>
                  {members.length > 0 && (
                    <div style={{ marginBottom: '.6rem' }}>
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '.4rem' }}>
                        <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Membres du planning</span>
                        <span className="row" style={{ gap: '.5rem' }}>
                          <button className="link-btn" onClick={() => toggleAll(true)}>Tout cocher</button>
                          <button className="link-btn" onClick={() => toggleAll(false)}>Aucun</button>
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', maxHeight: 140, overflowY: 'auto' }}>
                        {members.filter((m) => m.email !== user.email).map((m) => (
                          <label key={m.email} className="check-row">
                            <input type="checkbox" checked={!!checked[m.email]}
                              onChange={(e) => setChecked((c) => ({ ...c, [m.email]: e.target.checked }))} />
                            <span>{m.nom} <span style={{ color: 'var(--muted)', fontSize: '.78rem' }}>({m.email})</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="field" style={{ marginBottom: '.6rem' }}>
                    <label style={{ fontSize: '.78rem' }}>Autres emails (séparés par des virgules)</label>
                    <input type="text" value={extraEmails} placeholder="ex. jean@chu.fr, marie@chu.fr"
                      onChange={(e) => setExtraEmails(e.target.value)} />
                  </div>
                  <a className={`btn ${selectedEmails.length ? '' : 'disabled'}`} style={{ width: '100%', textAlign: 'center' }}
                    href={selectedEmails.length ? buildMailto(lastCode) : undefined}
                    onClick={(e) => { if (!selectedEmails.length) e.preventDefault(); }}>
                    <Mail size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                    Ouvrir l'email {selectedEmails.length > 0 && `(${selectedEmails.length})`}
                  </a>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: '.4rem', textAlign: 'center' }}>
                    Ça ouvre ta messagerie avec le message prérempli — tu n'as plus qu'à envoyer.
                  </div>
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
                        <button className="btn danger sm" onClick={() => { deleteInvitation(inv.code); logEvent('delete_invitation', user, `A supprimé l'invitation ${inv.code} (${inv.planningNom || ''})`); }}><Trash2 size={14} /></button>
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
