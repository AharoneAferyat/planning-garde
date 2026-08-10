import { useState } from 'react';

export default function NewSemesterModal({ internes, onClose, onCreate }) {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [type, setType] = useState('nov');
  const activeInternes = internes.filter((i) => i.actif !== false);
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(activeInternes.map((i) => [i.nom, true]))
  );

  const toggle = (nom) => setChecked((c) => ({ ...c, [nom]: !c[nom] }));
  const allOn = () => setChecked(Object.fromEntries(activeInternes.map((i) => [i.nom, true])));
  const allOff = () => setChecked({});

  const submit = () => {
    const internesRepris = activeInternes
      .filter((i) => checked[i.nom])
      .map((i) => i.nom);
    onCreate({ annee: Number(annee), type, internesRepris });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Nouveau semestre</div>
        <div className="modal-b">
          <div className="field">
            <label>Année de début</label>
            <input
              type="number"
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Type de semestre</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="nov">Novembre → Avril</option>
              <option value="mai">Mai → Octobre</option>
            </select>
          </div>
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Internes à reprendre</span>
              <span>
                <button className="btn secondary sm" onClick={allOn} type="button">Tous</button>{' '}
                <button className="btn secondary sm" onClick={allOff} type="button">Aucun</button>
              </span>
            </label>
            {activeInternes.length === 0 ? (
              <div className="empty" style={{ padding: '.6rem' }}>
                Aucun interne. Ajoute-les d'abord dans « Gérer les internes ».
              </div>
            ) : (
              <div className="check-list">
                {activeInternes.map((i) => (
                  <label className="check-item" key={i.id}>
                    <input
                      type="checkbox"
                      checked={!!checked[i.nom]}
                      onChange={() => toggle(i.nom)}
                    />
                    <span
                      className="swatch"
                      style={{ background: i.couleur || '#e2e8f0', width: 16, height: 16 }}
                    />
                    {i.nom}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-f">
          <button className="btn secondary" onClick={onClose}>Annuler</button>
          <button className="btn" onClick={submit}>Créer</button>
        </div>
      </div>
    </div>
  );
}
