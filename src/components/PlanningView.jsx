import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  watchPlanning, updatePlanningGardes, updatePlanningInternes,
  watchMembres, watchHistorique, logAction, updateMembreRole, removeMembre,
} from '../lib/firebase';
import {
  monthBlocks, monthDays, MONTHS_FR, DAYS_FR, CODES,
  isVplusD, isDoublon, reposFor, semesterLabel, computeStats,
} from '../lib/semester';

const PALETTE = ['#d9e8d5', '#d6e4f0', '#f7e9c8', '#f3d9cc', '#e7d6ee', '#d0e3e8', '#e9e2d0', '#f0dce4', '#dbeafe', '#fae8ff'];

export default function PlanningView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState(undefined);
  const [membres, setMembres] = useState([]);
  const [histo, setHisto] = useState([]);
  const [tab, setTab] = useState('planning');
  const [gardes, setGardes] = useState({});

  useEffect(() => watchPlanning(id, setP), [id]);
  useEffect(() => watchMembres(id, setMembres), [id]);
  useEffect(() => watchHistorique(id, setHisto), [id]);
  useEffect(() => { if (p?.gardes) setGardes(p.gardes); }, [p?.gardes]);

  const myMembre = membres.find((m) => m.email === user?.email);
  const myRole = myMembre?.role || (p?.ownerEmail === user?.email ? 'proprietaire' : null);
  const canEdit = myRole === 'proprietaire' || myRole === 'editeur';
  const isOwner = myRole === 'proprietaire';

  const internes = p?.internes || [];
  const interneColor = useMemo(() => {
    const m = {}; internes.forEach((i) => { m[i.nom] = i.couleur || '#e2e8f0'; }); return m;
  }, [internes]);

  if (p === undefined) return <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>;
  if (p === null) return (
    <div className="empty" style={{ paddingTop: '3rem' }}>
      <h2>Planning introuvable</h2>
      <button className="btn" style={{ marginTop: '1rem' }} onClick={() => nav('/plannings')}>Retour</button>
    </div>
  );

  const blocks = monthBlocks(p.annee, p.type);
  const allMonths = blocks.flat();
  const interneNames = internes.map((i) => i.nom);

  const setCell = async (iso, patch, dateLabel) => {
    const next = { ...gardes, [iso]: { ...(gardes[iso] || {}), ...patch } };
    if (!next[iso].garde && !next[iso].code) delete next[iso];
    setGardes(next);
    try {
      await updatePlanningGardes(id, next);
      if (patch.garde !== undefined) logAction(id, user, 'garde', `${dateLabel} -> ${patch.garde || '—'}`);
    } catch {}
  };

  const addInterne = () => {
    const couleur = PALETTE[internes.length % PALETTE.length];
    const next = [...internes, { nom: `Interne ${internes.length + 1}`, couleur, maxMois: 5, maxSem: 25 }];
    updatePlanningInternes(id, next);
    logAction(id, user, 'interne', 'Ajout interne');
  };
  const patchInterne = (idx, field, value) => {
    updatePlanningInternes(id, internes.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const delInterne = (idx) => {
    const it = internes[idx];
    if (!confirm(`Supprimer ${it.nom} ?`)) return;
    updatePlanningInternes(id, internes.filter((_, i) => i !== idx));
    logAction(id, user, 'interne', `Suppression ${it.nom}`);
  };

  return (
    <>
      <div className="page-head row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{p.nom || semesterLabel(p.annee, p.type)}</h1>
          <p>{semesterLabel(p.annee, p.type)} · {internes.length} interne(s){' '}·{' '}
            <span className={`badge ${isOwner ? 'blue' : canEdit ? 'green' : 'gray'}`}>
              {isOwner ? 'Propriétaire' : canEdit ? 'Éditeur' : 'Invité'}</span></p>
        </div>
        <button className="btn secondary" onClick={() => nav('/plannings')}>← Retour</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'planning' ? 'active' : ''}`} onClick={() => setTab('planning')}>Planning</div>
        <div className={`tab ${tab === 'internes' ? 'active' : ''}`} onClick={() => setTab('internes')}>Internes</div>
        <div className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>Statistiques</div>
        {isOwner && <div className={`tab ${tab === 'equipe' ? 'active' : ''}`} onClick={() => setTab('equipe')}>Équipe</div>}
        <div className={`tab ${tab === 'activite' ? 'active' : ''}`} onClick={() => setTab('activite')}>Activité</div>
      </div>

      {tab === 'planning' && (
        interneNames.length === 0 ? (
          <div className="card"><div className="empty">Ajoute d'abord des internes (onglet « Internes ») pour remplir le planning.</div></div>
        ) : (
          <div className={`blocks ${canEdit ? '' : 'readonly'}`}>
            {blocks.map((block, bi) => (
              <div key={bi}>
                {block.map((m) => (
                  <MonthTable key={`${m.year}-${m.month}`} year={m.year} month={m.month}
                    gardes={gardes} internes={interneNames} interneColor={interneColor}
                    editable={canEdit} onSet={setCell} />
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'internes' && (
        <div className="card">
          <div className="card-h">Internes du planning<div className="spacer" />
            {canEdit && <button className="btn sm" onClick={addInterne}>＋ Ajouter</button>}
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Couleur</th><th>Max/mois</th><th>Max/sem.</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {internes.length === 0 && <tr><td colSpan={5}><div className="empty">Aucun interne.</div></td></tr>}
                  {internes.map((it, idx) => (
                    <tr key={idx}>
                      <td><input type="text" value={it.nom} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'nom', e.target.value)} /></td>
                      <td><input type="color" className="swatch" value={it.couleur || '#e2e8f0'} disabled={!canEdit} style={{ width: 32, height: 28, padding: 0 }} onChange={(e) => patchInterne(idx, 'couleur', e.target.value)} /></td>
                      <td><input type="number" value={it.maxMois ?? 5} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'maxMois', Number(e.target.value))} /></td>
                      <td><input type="number" value={it.maxSem ?? 25} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'maxSem', Number(e.target.value))} /></td>
                      {canEdit && <td><button className="btn danger sm" onClick={() => delInterne(idx)}>Suppr.</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && <StatsPanel gardes={gardes} internes={internes} months={allMonths} />}
      {tab === 'equipe' && isOwner && <TeamPanel planningId={id} membres={membres} ownerEmail={p.ownerEmail} />}

      {tab === 'activite' && (
        <div className="card">
          <div className="card-h">Activité récente</div>
          <div className="card-b" style={{ padding: 0 }}>
            {histo.length === 0 ? <div className="empty">Aucune activité.</div> : (
              <table className="tbl">
                <thead><tr><th>Qui</th><th>Action</th><th>Détail</th><th>Quand</th></tr></thead>
                <tbody>
                  {histo.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.nom}</td>
                      <td><span className="badge gray">{h.action}</span></td>
                      <td style={{ color: 'var(--muted)' }}>{h.detail}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{timeAgo(h.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MonthTable({ year, month, gardes, internes, interneColor, editable, onSet }) {
  const days = monthDays(year, month);
  const byIso = {}; days.forEach((d) => { byIso[d.iso] = d; });
  return (
    <div className="month">
      <div className="month-h">{MONTHS_FR[month]} {year}</div>
      <table className="mgrid">
        <thead><tr><th>J</th><th>Date</th><th>Garde</th><th>Repos</th><th>Code</th><th></th></tr></thead>
        <tbody>
          {days.map((d, i) => {
            const prevIso = i > 0 ? days[i - 1].iso : null;
            const cell = gardes[d.iso] || {};
            const garde = cell.garde || '';
            const code = cell.code || '';
            const repos = prevIso ? reposFor(gardes, prevIso) : '';
            const doublon = prevIso ? isDoublon(gardes, d.iso, prevIso) : false;
            const vd = isVplusD(gardes, d, byIso);
            const rc = d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
            const bg = garde && !doublon ? interneColor[garde] : undefined;
            const dl = `${String(d.day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
            return (
              <tr key={d.iso} className={rc}>
                <td className="c-day">{DAYS_FR[d.weekday]}</td>
                <td className="c-date">{dl}</td>
                <td className={`c-garde ${doublon ? 'doublon' : ''}`} style={{ background: doublon ? undefined : bg }}>
                  {editable ? (
                    <select className="gsel" value={garde} onChange={(e) => onSet(d.iso, { garde: e.target.value }, dl)}>
                      <option value="">—</option>
                      {internes.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : garde}
                </td>
                <td className="c-repos">{repos}</td>
                <td className="c-code">
                  {editable ? (
                    <select className="csel" value={code} onChange={(e) => onSet(d.iso, { code: e.target.value }, dl)}>
                      <option value="">—</option>
                      {CODES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  ) : code}
                </td>
                <td className="c-vd">{vd ? 'V+D' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatsPanel({ gardes, internes, months }) {
  const stats = useMemo(() => computeStats(gardes, internes.map((i) => i.nom), months), [gardes, internes, months]);
  const maxOf = (nom) => internes.find((i) => i.nom === nom)?.maxSem ?? 25;
  const rows = internes.map((it) => {
    const s = stats[it.nom] || { gardes: 0, samedis: 0, dimanches: 0, vd: 0, repos: 0 };
    const max = maxOf(it.nom); const reste = max - s.gardes;
    let st = 'green', l = 'OK';
    if (s.gardes > max) { st = 'red'; l = 'Dépassé'; } else if (s.gardes === max) { st = 'amber'; l = 'Plein'; }
    return { nom: it.nom, ...s, max, reste, st, l };
  });
  const counts = rows.map((r) => r.gardes);
  const ecart = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;
  return (
    <div className="card">
      <div className="card-h">Statistiques du semestre<div className="spacer" />
        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '.82rem' }}>Écart max/min : <b>{ecart}</b></span>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        <div className="stats-scroll">
          <table className="stats-tbl">
            <thead><tr><th>Interne</th><th>Gardes</th><th>Samedis</th><th>Dimanches</th><th>V+D</th><th>Repos</th><th>Max</th><th>Reste</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9}><div className="empty">Aucun interne.</div></td></tr>}
              {rows.map((r) => (
                <tr key={r.nom}>
                  <td>{r.nom}</td><td>{r.gardes}</td><td>{r.samedis}</td><td>{r.dimanches}</td>
                  <td>{r.vd}</td><td>{r.repos}</td><td>{r.max}</td><td>{r.reste}</td>
                  <td><span className={`badge ${r.st}`}>{r.l}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '.9rem 1.1rem', fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
          <b>V+D</b> = gros week-end (garde vendredi ET dimanche) · <b>Repos</b> = lendemains de garde ·{' '}
          <b>Reste</b> = Max − Gardes · Case garde en <b style={{ color: 'var(--red)' }}>rouge</b> = doublon
          (2 gardes de suite). Codes : CA congé, F formation, A absence, AR arrêt.
        </div>
      </div>
    </div>
  );
}

function TeamPanel({ planningId, membres, ownerEmail }) {
  return (
    <div className="card">
      <div className="card-h">Équipe & permissions</div>
      <div className="card-b" style={{ padding: 0 }}>
        <table className="tbl">
          <thead><tr><th>Membre</th><th>Rôle</th><th></th></tr></thead>
          <tbody>
            {membres.map((m) => (
              <tr key={m.email}>
                <td><div style={{ fontWeight: 600 }}>{m.nom}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>{m.email}</div></td>
                <td>
                  {m.email === ownerEmail ? <span className="badge blue">Propriétaire</span> : (
                    <select value={m.role} onChange={(e) => updateMembreRole(planningId, m.email, e.target.value)}
                      style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '.35rem .5rem' }}>
                      <option value="editeur">Éditeur</option>
                      <option value="invite">Invité (lecture)</option>
                    </select>
                  )}
                </td>
                <td>{m.email !== ownerEmail && (
                  <button className="btn danger sm" onClick={() => confirm(`Retirer ${m.nom} ?`) && removeMembre(planningId, m.email)}>Retirer</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24); return `il y a ${j} j`;
}
