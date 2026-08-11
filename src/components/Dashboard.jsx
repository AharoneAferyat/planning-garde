import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlannings } from '../lib/usePlannings';
import { isoDate, semesterMonths, monthDays, MONTHS_FR } from '../lib/semester';
import NewPlanningModal from './NewPlanningModal';
import Hero from './Hero';

export default function Dashboard() {
  const { user } = useAuth();
  const { mine, shared } = usePlannings();
  const nav = useNavigate();
  const [showNew, setShowNew] = useState(false);

  const all = [...mine, ...shared];

  // Prochaines gardes (toutes plannings confondues), à partir d'aujourd'hui
  const upcoming = useMemo(() => {
    const today = isoDate(new Date());
    const rows = [];
    all.forEach((p) => {
      Object.entries(p.gardes || {}).forEach(([iso, cell]) => {
        if (cell.garde && iso >= today) {
          rows.push({ iso, garde: cell.garde, planning: p.nom, planningId: p.id });
        }
      });
    });
    rows.sort((a, b) => a.iso.localeCompare(b.iso));
    return rows.slice(0, 4);
  }, [all]);

  // Stats globales
  const totalGardes = all.reduce(
    (n, p) => n + Object.values(p.gardes || {}).filter((c) => c.garde).length, 0);
  const totalInternes = new Set(all.flatMap((p) => (p.internes || []).map((i) => i.nom))).size;

  const prenom = (user?.nom || '').split(' ')[0] || '';

  return (
    <>
      <Hero
        badge={`${all.length} planning${all.length > 1 ? 's' : ''} accessible${all.length > 1 ? 's' : ''}`}
        title={`Bonjour ${prenom} 👋`}
        subtitle="Voici un aperçu de tes gardes et plannings."
      />

      <div className="grid dash">
        {/* Prochaines gardes */}
        <div className="card">
          <div className="card-h">Prochaines gardes</div>
          <div className="card-b">
            {upcoming.length === 0 ? (
              <div className="empty" style={{ padding: '1.5rem 0' }}>Aucune garde à venir.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
                {upcoming.map((g, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{fmtDate(g.iso)}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{g.planning}</div>
                    </div>
                    <span className="badge blue">{g.garde}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn secondary sm" style={{ marginTop: '1rem' }}
              onClick={() => nav('/plannings')}>
              Voir mes plannings →
            </button>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="card">
          <div className="card-h">Actions rapides</div>
          <div className="card-b">
            <div className="qa-grid">
              <div className="qa" onClick={() => setShowNew(true)}>
                <span className="ic">＋</span><span className="t">Nouveau planning</span>
              </div>
              <div className="qa" onClick={() => nav('/plannings')}>
                <span className="ic">▤</span><span className="t">Mes plannings</span>
              </div>
              <div className="qa" onClick={() => nav('/invitations')}>
                <span className="ic">✉</span><span className="t">Inviter</span>
              </div>
              <div className="qa" onClick={() => nav('/plannings')}>
                <span className="ic">▦</span><span className="t">Gérer</span>
              </div>
            </div>
          </div>
        </div>

        {/* Aperçu chiffres */}
        <div className="card">
          <div className="card-h">En bref</div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div className="stat" style={{ border: 'none', padding: 0 }}>
              <div className="ic blue">▤</div>
              <div><div className="v">{all.length}</div><div className="l">Plannings accessibles</div></div>
            </div>
            <div className="stat" style={{ border: 'none', padding: 0 }}>
              <div className="ic green">☰</div>
              <div><div className="v">{totalGardes}</div><div className="l">Gardes planifiées</div></div>
            </div>
            <div className="stat" style={{ border: 'none', padding: 0 }}>
              <div className="ic purple">◎</div>
              <div><div className="v">{totalInternes}</div><div className="l">Internes au total</div></div>
            </div>
          </div>
        </div>
      </div>

      {showNew && (
        <NewPlanningModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); nav(`/planning/${id}`); }}
        />
      )}
    </>
  );
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "Aujourd'hui";
  return `${d}/${m}/${y}`;
}
