import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  watchSemestres, watchInternes, createSemestre, deleteSemestre,
} from '../lib/firebase';
import { semesterLabel } from '../lib/semester';
import NewSemesterModal from './NewSemesterModal';

export default function Home() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [semestres, setSemestres] = useState([]);
  const [internes, setInternes] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => watchSemestres(setSemestres), []);
  useEffect(() => watchInternes(setInternes), []);

  const handleCreate = async ({ annee, type, internesRepris }) => {
    const ref = await createSemestre({
      annee, type,
      label: semesterLabel(annee, type),
      internes: internesRepris,
      gardes: {},
    });
    setShowModal(false);
    nav(`/semestre/${ref.id}`);
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`Supprimer le semestre « ${label} » ?`)) return;
    await deleteSemestre(id);
  };

  return (
    <div className="container">
      <div className="hero">
        <h1>Gardes des Internes</h1>
        <p>Organisation semestrielle — gardes 24 h, repos, congés, formations.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h">Semestres</div>
          <div className="card-b">
            {semestres.length === 0 ? (
              <div className="empty">Aucun semestre pour l'instant.</div>
            ) : (
              <div className="sem-list">
                {semestres.map((s) => (
                  <div className="sem-row" key={s.id}>
                    <div>
                      <div className="sem-label">{s.label || semesterLabel(s.annee, s.type)}</div>
                      <div className="sem-sub">
                        {(s.internes?.length || 0)} interne(s)
                      </div>
                    </div>
                    <div className="spacer" />
                    <button className="btn sm" onClick={() => nav(`/semestre/${s.id}`)}>
                      Ouvrir
                    </button>
                    {isAdmin && (
                      <button
                        className="btn danger sm"
                        onClick={() => handleDelete(s.id, s.label)}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Actions</div>
          <div className="card-b">
            {isAdmin ? (
              <div className="sem-list">
                <button className="btn" onClick={() => setShowModal(true)}>
                  + Nouveau semestre
                </button>
                <button className="btn secondary" onClick={() => nav('/internes')}>
                  Gérer les internes
                </button>
              </div>
            ) : (
              <div className="empty">
                Connecte-toi avec Google (bouton en haut à droite) pour créer
                des semestres et éditer les plannings.
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <NewSemesterModal
          internes={internes}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
