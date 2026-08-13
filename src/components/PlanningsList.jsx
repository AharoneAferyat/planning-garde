import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlannings } from '../lib/usePlannings';
import { Copy } from 'lucide-react';
import { deletePlanning, logEvent, duplicatePlanning } from '../lib/firebase';
import { semesterLabel } from '../lib/semester';
import NewPlanningModal from './NewPlanningModal';

export default function PlanningsList() {
  const { mine, shared, loading } = usePlannings();
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('mine');
  const [showNew, setShowNew] = useState(false);

  const list = tab === 'mine' ? mine : shared;

  return (
    <>
      <div className="page-head row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Mes plannings</h1>
          <p>Gère tes plannings de gardes et ceux partagés avec toi.</p>
        </div>
        <button className="btn" onClick={() => setShowNew(true)}>＋ Nouveau planning</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          Mes plannings ({mine.length})
        </div>
        <div className={`tab ${tab === 'shared' ? 'active' : ''}`} onClick={() => setTab('shared')}>
          Partagés avec moi ({shared.length})
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="card"><div className="empty">
          {tab === 'mine'
            ? "Tu n'as pas encore de planning. Crée-en un pour commencer."
            : "Aucun planning partagé avec toi pour l'instant."}
        </div></div>
      ) : (
        <div className="card">
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nom</th><th>Période</th><th>Internes</th><th>Rôle</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/planning/${p.id}`)}>
                    <td style={{ fontWeight: 600 }}>{p.nom || semesterLabel(p.annee, p.type)}</td>
                    <td style={{ color: 'var(--muted)' }}>{semesterLabel(p.annee, p.type)}</td>
                    <td>{(p.internes?.length || 0)}</td>
                    <td>
                      <span className={`badge ${roleColor(p.myRole || 'proprietaire')}`}>
                        {roleLabel(p.myRole || 'proprietaire')}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row">
                        <button className="btn secondary sm" onClick={() => nav(`/planning/${p.id}`)}>Ouvrir</button>
                        {tab === 'mine' && (
                          <>
                          <button className="btn secondary sm" title="Dupliquer (nouveau semestre)"
                            onClick={async () => {
                              const nom = prompt('Nom du nouveau planning :', `${p.nom} (copie)`);
                              if (nom === null) return;
                              const newId = await duplicatePlanning(p.id, { nom: nom.trim() || `${p.nom} (copie)` }, user);
                              logEvent('create_planning', user, `A dupliqué « ${p.nom} » → « ${nom}»`);
                              if (newId) nav(`/planning/${newId}`);
                            }}>
                            <Copy size={13} />
                          </button>
                          <button className="btn danger sm"
                            onClick={() => { if (confirm(`Supprimer « ${p.nom} » ?`)) { deletePlanning(p.id); logEvent('delete_planning', user, `A supprimé le planning « ${p.nom || p.id} »`); } }}>
                            Suppr.
                          </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewPlanningModal onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); nav(`/planning/${id}`); }} />
      )}
    </>
  );
}

function roleLabel(r) {
  return r === 'proprietaire' ? 'Propriétaire' : r === 'editeur' ? 'Éditeur' : 'Invité';
}
function roleColor(r) {
  return r === 'proprietaire' ? 'blue' : r === 'editeur' ? 'green' : 'gray';
}
