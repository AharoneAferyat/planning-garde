import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createPlanning, addMembre } from '../lib/firebase';
import { semesterLabel } from '../lib/semester';

export default function NewPlanningModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const now = new Date();
  const [nom, setNom] = useState('');
  const [annee, setAnnee] = useState(now.getFullYear());
  const [type, setType] = useState(now.getMonth() + 1 >= 5 && now.getMonth() + 1 <= 10 ? 'mai' : 'nov');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const label = nom.trim() || semesterLabel(Number(annee), type);
    const ref = await createPlanning({
      nom: label,
      annee: Number(annee), type,
      internes: [],
      gardes: {},
    }, user);
    // Le créateur devient propriétaire (membre)
    await addMembre(ref.id, user.email, user.nom, 'proprietaire');
    setBusy(false);
    onCreated(ref.id);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Nouveau planning</div>
        <div className="modal-b">
          <div className="field">
            <label>Nom du planning</label>
            <input
              type="text" value={nom} autoFocus
              placeholder="Ex. Rotation Cardiologie 2026"
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <div className="row" style={{ gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Année de début</label>
              <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Période</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="nov">Novembre → Avril</option>
                <option value="mai">Mai → Octobre</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
            Tu ajouteras les internes directement dans le planning ensuite.
          </div>
        </div>
        <div className="modal-f">
          <button className="btn secondary" onClick={onClose}>Annuler</button>
          <button className="btn" onClick={submit} disabled={busy}>
            {busy ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
