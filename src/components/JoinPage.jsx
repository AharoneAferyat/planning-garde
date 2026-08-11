import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { joinViaCode } from '../lib/firebase';

export default function JoinPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState('loading'); // loading|error|ok
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let done = false;
    (async () => {
      if (!user) return;
      const res = await joinViaCode(code, user);
      if (done) return;
      if (res.error) { setStatus('error'); setMsg(res.error); }
      else { setStatus('ok'); setTimeout(() => nav(`/planning/${res.planningId}`), 1200); }
    })();
    return () => { done = true; };
  }, [code, user]);

  return (
    <div className="empty" style={{ paddingTop: '4rem' }}>
      {status === 'loading' && <>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        Ajout à ce planning…
      </>}
      {status === 'error' && <>
        <h2 style={{ marginBottom: '.5rem' }}>Invitation invalide</h2>
        <p>{msg}</p>
        <button className="btn" style={{ marginTop: '1rem' }} onClick={() => nav('/')}>Retour</button>
      </>}
      {status === 'ok' && <>
        <h2 style={{ marginBottom: '.5rem' }}>✓ Bienvenue !</h2>
        <p>Tu as rejoint le planning. Redirection…</p>
      </>}
    </div>
  );
}
