import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { watchSemestre, watchInternes, updateSemestreGardes } from '../lib/firebase';
import {
  monthBlocks, monthDays, MONTHS_FR, DAYS_FR, CODES,
  isVplusD, isDoublon, reposFor, semesterLabel,
} from '../lib/semester';
import StatsPanel from './StatsPanel';

export default function PlanningView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin } = useAuth();
  const [sem, setSem] = useState(undefined); // undefined=loading, null=not found
  const [internes, setInternes] = useState([]);

  useEffect(() => watchSemestre(id, setSem), [id]);
  useEffect(() => watchInternes(setInternes), []);

  // gardes local (optimistic) synchronisé avec Firestore
  const [gardes, setGardes] = useState({});
  useEffect(() => { if (sem?.gardes) setGardes(sem.gardes); }, [sem?.gardes]);

  const interneColor = useMemo(() => {
    const m = {};
    internes.forEach((i) => { m[i.nom] = i.couleur || '#e2e8f0'; });
    return m;
  }, [internes]);

  if (sem === undefined) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }
  if (sem === null) {
    return (
      <div className="container">
        <div className="empty">Semestre introuvable.</div>
        <button className="btn" onClick={() => nav('/')}>Retour</button>
      </div>
    );
  }

  const semInternes = sem.internes && sem.internes.length
    ? sem.internes
    : internes.filter((i) => i.actif !== false).map((i) => i.nom);

  const blocks = monthBlocks(sem.annee, sem.type);
  const allMonths = blocks.flat();

  const setCell = async (iso, patch) => {
    const next = {
      ...gardes,
      [iso]: { ...(gardes[iso] || {}), ...patch },
    };
    // nettoyer les cellules vides
    if (!next[iso].garde && !next[iso].code) delete next[iso];
    setGardes(next);
    try { await updateSemestreGardes(id, next); } catch (e) { /* offline tolerated */ }
  };

  return (
    <div className="container">
      <div className="plan-head">
        <div>
          <h2>{sem.label || semesterLabel(sem.annee, sem.type)}</h2>
          <div className="sub">
            {isAdmin
              ? 'Clique une case Garde pour attribuer. Repos auto le lendemain. Doublon en rouge.'
              : 'Lecture seule — connecte-toi pour éditer.'}
          </div>
        </div>
        <div className="spacer" />
        <button className="btn secondary" onClick={() => nav('/')}>← Semestres</button>
      </div>

      <div className={`blocks ${isAdmin ? '' : 'readonly'}`}>
        {blocks.map((block, bi) => (
          <div key={bi}>
            {block.map((m) => (
              <MonthTable
                key={`${m.year}-${m.month}`}
                year={m.year}
                month={m.month}
                gardes={gardes}
                internes={semInternes}
                interneColor={interneColor}
                editable={isAdmin}
                onSet={setCell}
              />
            ))}
          </div>
        ))}
      </div>

      <StatsPanel
        gardes={gardes}
        internes={semInternes}
        months={allMonths}
        internesMeta={internes}
      />
    </div>
  );
}

function MonthTable({ year, month, gardes, internes, interneColor, editable, onSet }) {
  const days = monthDays(year, month);
  const byIso = {};
  days.forEach((d) => { byIso[d.iso] = d; });

  return (
    <div className="month">
      <div className="month-h">{MONTHS_FR[month]} {year}</div>
      <table className="month-grid">
        <thead>
          <tr>
            <th>J</th><th>Date</th><th>Garde</th><th>Repos</th><th>Code</th><th></th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => {
            const prevIso = i > 0 ? days[i - 1].iso : null;
            const cell = gardes[d.iso] || {};
            const garde = cell.garde || '';
            const code = cell.code || '';
            const repos = prevIso ? reposFor(gardes, prevIso) : '';
            const doublon = prevIso ? isDoublon(gardes, d.iso, prevIso) : false;
            const vd = isVplusD(gardes, d, byIso);
            const rowClass = d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
            const gardeBg = garde && !doublon ? interneColor[garde] : undefined;
            return (
              <tr key={d.iso} className={rowClass}>
                <td className="cell-day">{DAYS_FR[d.weekday]}</td>
                <td className="cell-date">
                  {String(d.day).padStart(2, '0')}/{String(month).padStart(2, '0')}
                </td>
                <td
                  className={`cell-garde ${doublon ? 'doublon' : ''}`}
                  style={{ background: doublon ? undefined : gardeBg }}
                >
                  {editable ? (
                    <select
                      className="garde-select"
                      value={garde}
                      onChange={(e) => onSet(d.iso, { garde: e.target.value })}
                    >
                      <option value="">—</option>
                      {internes.map((nom) => (
                        <option key={nom} value={nom}>{nom}</option>
                      ))}
                    </select>
                  ) : (garde || '')}
                </td>
                <td className="cell-repos">{repos}</td>
                <td className="cell-code">
                  {editable ? (
                    <select
                      className="code-select"
                      value={code}
                      onChange={(e) => onSet(d.iso, { code: e.target.value })}
                    >
                      <option value="">—</option>
                      {CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  ) : (code || '')}
                </td>
                <td className="cell-vd">{vd ? 'V+D' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
