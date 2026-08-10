import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { watchInternes, addInterne, updateInterne, deleteInterne } from '../lib/firebase';

const PALETTE = ['#d9e8d5', '#d6e4f0', '#f7e9c8', '#f3d9cc', '#e7d6ee', '#d0e3e8', '#e9e2d0', '#f0dce4'];

export default function InternesManager() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [internes, setInternes] = useState([]);

  useEffect(() => watchInternes(setInternes), []);

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="empty">Réservé aux admins. Connecte-toi avec Google.</div>
        <button className="btn" onClick={() => nav('/')}>Retour</button>
      </div>
    );
  }

  const add = () => {
    const couleur = PALETTE[internes.length % PALETTE.length];
    addInterne({ nom: 'Nouvel interne', initiales: '', couleur, maxMois: 5, maxSem: 25, actif: true });
  };

  const patch = (id, field, value) => updateInterne(id, { [field]: value });

  return (
    <div className="container">
      <div className="plan-head">
        <div>
          <h2>Internes</h2>
          <div className="sub">Liste maîtresse. Un nouveau semestre proposera de reprendre ces internes.</div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={add}>+ Ajouter</button>
        <button className="btn secondary" onClick={() => nav('/')}>← Retour</button>
      </div>

      <div className="card">
        <div className="card-b" style={{ padding: 0 }}>
          <table className="int-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Nom</th>
                <th>Initiales</th>
                <th>Couleur</th>
                <th>Max /mois</th>
                <th>Max /sem.</th>
                <th>Actif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {internes.length === 0 && (
                <tr><td colSpan={7}><div className="empty">Aucun interne. Clique « Ajouter ».</div></td></tr>
              )}
              {internes.map((i) => (
                <tr key={i.id}>
                  <td>
                    <input
                      type="text"
                      value={i.nom}
                      onChange={(e) => patch(i.id, 'nom', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={i.initiales || ''}
                      onChange={(e) => patch(i.id, 'initiales', e.target.value)}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td>
                    <input
                      type="color"
                      className="swatch"
                      value={i.couleur || '#e2e8f0'}
                      onChange={(e) => patch(i.id, 'couleur', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={i.maxMois ?? 5}
                      onChange={(e) => patch(i.id, 'maxMois', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={i.maxSem ?? 25}
                      onChange={(e) => patch(i.id, 'maxSem', Number(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={i.actif !== false}
                      onChange={(e) => patch(i.id, 'actif', e.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn danger sm"
                      onClick={() => confirm(`Supprimer ${i.nom} ?`) && deleteInterne(i.id)}
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
