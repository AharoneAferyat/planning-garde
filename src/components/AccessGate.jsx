import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { joinViaCode, logEvent } from '../lib/firebase';

// Écran affiché quand un email connecté n'est PAS encore autorisé (mode fermé).
// Il peut coller un code d'invitation ou un lien /join/CODE pour entrer.
export default function AccessGate({ onJoined }) {
  const { user, logout } = useAuth();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const extractCode = (raw) => {
    const s = raw.trim();
    // si c'est un lien .../join/CODE, on extrait le CODE
    const m = s.match(/join\/([A-Za-z0-9]+)/);
    if (m) return m[1].toUpperCase();
    return s.toUpperCase();
  };

  const submit = async () => {
    setError('');
    const code = extractCode(value);
    if (!code) { setError('Entre un code ou un lien d\'invitation.'); return; }
    setBusy(true);
    const res = await joinViaCode(code, user);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    logEvent('join', user, `A rejoint « ${res.planningNom || res.planningId} » avec le code ${code} (${res.role})`);
    onJoined(res.planningId);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="mark">✚</div>
        <h1>Il te faut une invitation</h1>
        <p>
          Ce service est sur invitation. Connecté en tant que <b>{user?.email}</b>,
          tu n'as pas encore accès. Colle ton <b>code d'invitation</b> ou le <b>lien</b> reçu
          pour rejoindre un planning.
        </p>
        <div className="field" style={{ textAlign: 'left', marginBottom: '1rem' }}>
          <input
            type="text" value={value} autoFocus
            placeholder="Code (ex. A3F9K2) ou lien d'invitation"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ textAlign: 'center', letterSpacing: '1px', fontWeight: 600 }}
          />
          {error && <div style={{ color: 'var(--red)', fontSize: '.82rem', marginTop: '.5rem' }}>{error}</div>}
        </div>
        <button className="btn" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Vérification…' : 'Rejoindre'}
        </button>
        <button className="btn ghost" style={{ width: '100%', marginTop: '.6rem' }} onClick={logout}>
          Se déconnecter
        </button>
        <p style={{ fontSize: '.78rem', marginTop: '1rem', marginBottom: 0 }}>
          Pas d'invitation ? Demande à la personne qui gère ton planning de t'en envoyer une.
        </p>
      </div>
    </div>
  );
}
