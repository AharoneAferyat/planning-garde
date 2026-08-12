import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { joinViaCode, watchPlanning, claimInterne, logEvent } from '../lib/firebase';

export default function JoinPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState('loading'); // loading|error|claim|done
  const [msg, setMsg] = useState('');
  const [planningId, setPlanningId] = useState('');
  const [planning, setPlanning] = useState(null);
  const [role, setRole] = useState('');
  const [choice, setChoice] = useState('');   // index d'interne, ou 'none'
  const [prenom, setPrenom] = useState('');

  useEffect(() => {
    let done = false;
    (async () => {
      if (!user) return;
      const res = await joinViaCode(code, user);
      if (done) return;
      if (res.error) { setStatus('error'); setMsg(res.error); return; }
      logEvent('join', user, `A rejoint « ${res.planningNom || res.planningId} » avec le code ${code} (${res.role})`);
      setPlanningId(res.planningId); setRole(res.role);
      setPrenom((user.nom || '').split(' ')[0] || '');
      setStatus('claim');
    })();
    return () => { done = true; };
  }, [code, user]);

  useEffect(() => {
    if (!planningId) return;
    return watchPlanning(planningId, setPlanning);
  }, [planningId]);

  const finish = () => { setStatus('done'); setTimeout(() => nav(`/planning/${planningId}`), 900); };

  const confirmClaim = async () => {
    if (choice !== '' && choice !== 'none') {
      await claimInterne(planningId, Number(choice), prenom.trim() || 'Interne', user.email);
    }
    finish();
  };

  if (status === 'loading') return (
    <div className="empty" style={{ paddingTop: '4rem' }}>
      <div className="spinner" style={{ margin: '0 auto 1rem' }} />Ajout à ce planning…
    </div>
  );
  if (status === 'error') return (
    <div className="empty" style={{ paddingTop: '4rem' }}>
      <h2>Invitation invalide</h2><p>{msg}</p>
      <button className="btn" style={{ marginTop: '1rem' }} onClick={() => nav('/')}>Retour</button>
    </div>
  );
  if (status === 'done') return (
    <div className="empty" style={{ paddingTop: '4rem' }}>
      <h2>✓ C'est bon !</h2><p>Redirection vers le planning…</p>
    </div>
  );

  // status === 'claim'
  const internes = planning?.internes || [];
  const libres = internes.map((it, i) => ({ ...it, idx: i })).filter((it) => !it.email);

  return (
    <div style={{ maxWidth: 460, margin: '3rem auto 0' }}>
      <div className="card">
        <div className="card-h">Bienvenue dans « {planning?.nom || '…'} »</div>
        <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--muted)' }}>
            Tu as rejoint ce planning en tant que <b>{role === 'invite' ? 'invité (lecture)' : 'éditeur'}</b>.
            {role !== 'invite' && ' Indique quel interne tu es pour retrouver tes gardes.'}
          </p>

          {role !== 'invite' && (
            <>
              <div className="field">
                <label>Je suis…</label>
                <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                  <option value="">— choisir —</option>
                  {libres.map((it) => (
                    <option key={it.idx} value={it.idx}>{it.nom}</option>
                  ))}
                  <option value="none">Je ne suis pas dans la liste / plus tard</option>
                </select>
              </div>
              {choice !== '' && choice !== 'none' && (
                <div className="field">
                  <label>Ton prénom (remplacera « {internes[Number(choice)]?.nom} »)</label>
                  <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Ton prénom" autoFocus />
                </div>
              )}
            </>
          )}

          <button className="btn" onClick={confirmClaim}>Continuer</button>
        </div>
      </div>
    </div>
  );
}
