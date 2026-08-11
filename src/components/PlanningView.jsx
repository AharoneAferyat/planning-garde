import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  watchPlanning, updatePlanningGardes, updatePlanningInternes, updatePlanningPresences,
  watchMembres, watchHistorique, logAction, updateMembreRole, removeMembre,
} from '../lib/firebase';
import {
  semesterMonthsWithDays, semesterDays, MONTHS_FR, DAYS_FR,
  isVplusD, isDoublon, reposFor, semesterLabel,
  PRESENCE_STATUSES, PRESENCE_MAP, ABSENT_CODES,
  computePresences, gardeConflit, computeStatsProgress, autoDistribute, isoDate,
} from '../lib/semester';

const PALETTE = ['#bbf7d0', '#bfdbfe', '#fde68a', '#fecaca', '#e9d5ff', '#a5f3fc', '#fed7aa', '#f5d0fe', '#c7d2fe', '#d9f99d'];

export default function PlanningView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState(undefined);
  const [membres, setMembres] = useState([]);
  const [histo, setHisto] = useState([]);
  const [tab, setTab] = useState('planning');
  const [gardes, setGardes] = useState({});
  const [presences, setPresences] = useState({});

  useEffect(() => watchPlanning(id, setP), [id]);
  useEffect(() => watchMembres(id, setMembres), [id]);
  useEffect(() => watchHistorique(id, setHisto), [id]);
  useEffect(() => { if (p) { setGardes(p.gardes || {}); setPresences(p.presences || {}); } }, [p?.gardes, p?.presences]);

  const myMembre = membres.find((m) => m.email === user?.email);
  const myRole = myMembre?.role || (p?.ownerEmail === user?.email ? 'proprietaire' : null);
  const canEdit = myRole === 'proprietaire' || myRole === 'editeur';
  const isOwner = myRole === 'proprietaire';

  const internes = p?.internes || [];
  const interneColor = useMemo(() => {
    const m = {}; internes.forEach((i) => { m[i.nom] = i.couleur || '#e2e8f0'; }); return m;
  }, [internes]);

  const months = useMemo(() => p ? semesterMonthsWithDays(p.annee, p.type) : [], [p?.annee, p?.type]);
  const allDays = useMemo(() => p ? semesterDays(p.annee, p.type) : [], [p?.annee, p?.type]);

  if (p === undefined) return <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>;
  if (p === null) return (
    <div className="empty" style={{ paddingTop: '3rem' }}>
      <h2>Planning introuvable</h2>
      <button className="btn" style={{ marginTop: '1rem' }} onClick={() => nav('/plannings')}>Retour</button>
    </div>
  );

  const interneNames = internes.map((i) => i.nom);
  const todayIso = isoDate(new Date());

  const setGarde = async (iso, garde, dateLabel) => {
    const next = { ...gardes };
    if (garde) next[iso] = { ...(next[iso] || {}), garde };
    else { if (next[iso]) { const c = { ...next[iso] }; delete c.garde; next[iso] = c; if (!next[iso].garde) delete next[iso]; } }
    setGardes(next);
    try {
      await updatePlanningGardes(id, next);
      logAction(id, user, 'garde', `${dateLabel} → ${garde || '—'}`);
    } catch {}
  };

  const setPresence = async (iso, nom, code) => {
    const next = { ...presences };
    const row = { ...(next[iso] || {}) };
    if (code) row[nom] = code; else delete row[nom];
    if (Object.keys(row).length) next[iso] = row; else delete next[iso];
    setPresences(next);
    try { await updatePlanningPresences(id, next); } catch {}
  };

  // ---- Internes CRUD ----
  const addInterne = () => {
    const couleur = PALETTE[internes.length % PALETTE.length];
    updatePlanningInternes(id, [...internes, { nom: `Interne ${internes.length + 1}`, couleur, maxMois: 5, maxSem: 25 }]);
    logAction(id, user, 'interne', 'Ajout interne');
  };
  const patchInterne = (idx, field, value) =>
    updatePlanningInternes(id, internes.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const delInterne = (idx) => {
    const it = internes[idx];
    if (!confirm(`Supprimer ${it.nom} ?`)) return;
    updatePlanningInternes(id, internes.filter((_, i) => i !== idx));
    logAction(id, user, 'interne', `Suppression ${it.nom}`);
  };

  // ---- Répartition auto ----
  const runAuto = async () => {
    if (!canEdit) return;
    if (interneNames.length < 2) { alert('Ajoute au moins 2 internes.'); return; }
    const hasGardes = Object.values(gardes).some((c) => c.garde);
    if (hasGardes && !confirm('Remplacer le planning actuel par une répartition automatique équilibrée ?')) return;
    const dist = autoDistribute(allDays, internes, { presences, seed: Date.now() });
    const next = {};
    Object.entries(dist).forEach(([iso, nom]) => { next[iso] = { ...(gardes[iso] || {}), garde: nom }; });
    setGardes(next);
    try { await updatePlanningGardes(id, next); logAction(id, user, 'auto', 'Répartition automatique générée'); } catch {}
  };

  return (
    <>
      <div className="page-head row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{p.nom || semesterLabel(p.annee, p.type)}</h1>
          <p>{semesterLabel(p.annee, p.type)} · {internes.length} interne(s) ·{' '}
            <span className={`badge ${isOwner ? 'blue' : canEdit ? 'green' : 'gray'}`}>
              {isOwner ? 'Propriétaire' : canEdit ? 'Éditeur' : 'Invité'}</span></p>
        </div>
        <button className="btn secondary" onClick={() => nav('/plannings')}>← Retour</button>
      </div>

      <div className="tabs">
        {['planning', 'presences', 'internes', 'stats', ...(isOwner ? ['equipe'] : []), 'activite'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ planning: 'Planning', presences: 'Présences', internes: 'Internes', stats: 'Statistiques', equipe: 'Équipe', activite: 'Activité' }[t]}
          </div>
        ))}
      </div>

      {tab === 'planning' && (
        interneNames.length === 0 ? (
          <div className="card"><div className="empty">Ajoute d'abord des internes (onglet « Internes »).</div></div>
        ) : (
          <>
            <div className="planning-toolbar">
              <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                Du {fmtFull(allDays[0]?.iso)} au {fmtFull(allDays[allDays.length - 1]?.iso)}
              </span>
              <div className="spacer" />
              {canEdit && <button className="btn" onClick={runAuto}>⚡ Proposer une répartition</button>}
            </div>
            <div className="blocks">
              {chunk3(months).map((col, ci) => (
                <div key={ci}>
                  {col.map((m) => (
                    <PlanningMonth key={`${m.year}-${m.month}`} m={m}
                      gardes={gardes} presences={presences} internes={interneNames}
                      interneColor={interneColor} editable={canEdit} onSet={setGarde} todayIso={todayIso} />
                  ))}
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === 'presences' && (
        <PresencesTab months={months} internes={internes} gardes={gardes} presences={presences}
          editable={canEdit} onSet={setPresence} />
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

      {tab === 'stats' && <StatsProgress gardes={gardes} internes={internes} days={allDays} todayIso={todayIso} />}
      {tab === 'equipe' && isOwner && <TeamPanel planningId={id} membres={membres} ownerEmail={p.ownerEmail} />}
      {tab === 'activite' && <ActivityPanel histo={histo} />}
    </>
  );
}

// ---------- Planning mois en lignes ----------
function PlanningMonth({ m, gardes, presences, internes, interneColor, editable, onSet, todayIso }) {
  const days = m.days;
  const byIso = {}; days.forEach((d) => { byIso[d.iso] = d; });
  return (
    <div className="pmonth">
      <div className="pmonth-h">{MONTHS_FR[m.month]} {m.year}</div>
      <div className={`pmonth-b ${editable ? '' : 'readonly'}`}>
        {days.map((d, i) => {
          const prevIso = prevDayIso(d.iso);
          const cell = gardes[d.iso] || {};
          const garde = cell.garde || '';
          const repos = reposFor(gardes, prevIso);
          const doublon = isDoublon(gardes, d.iso, prevIso);
          const vd = isVplusD(gardes, d, byIso);
          const conflit = gardeConflit(gardes, presences, d.iso, garde);
          const rc = d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
          const bg = garde && !doublon && !conflit ? interneColor[garde] : undefined;
          const dl = `${DAYS_FR[d.weekday]} ${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`;
          return (
            <div key={d.iso} className={`lrow ${rc} ${conflit ? 'conflit' : ''}`}>
              <div className="ld">{DAYS_FR[d.weekday]} <span className="dnum">{String(d.day).padStart(2, '0')}/{String(d.month).padStart(2, '0')}</span></div>
              <div className="lg">
                {editable ? (
                  <select className="lsel" value={garde}
                    style={garde && !doublon && !conflit ? { background: bg, border: '1px solid rgba(0,0,0,.05)', color: '#0f172a', borderRadius: 999 } : undefined}
                    onChange={(e) => onSet(d.iso, e.target.value, dl)}>
                    <option value="">+ garde</option>
                    {internes.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                ) : (
                  garde && <span className={`lchip ${doublon || conflit ? 'doublon' : ''}`} style={{ background: bg }}>{garde}</span>
                )}
              </div>
              {conflit && <span className="conflit-warn">absent !</span>}
              <div className="lvd">{vd ? 'V+D' : ''}</div>
              <div className="lrepos">{repos && `repos : ${repos}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Présences ----------
function PresencesTab({ months, internes, gardes, presences, editable, onSet }) {
  const allDays = months.flatMap((m) => m.days);
  const names = internes.map((i) => i.nom);
  const eff = useMemo(() => computePresences(gardes, presences, allDays, names), [gardes, presences, allDays, names]);
  const [monthIdx, setMonthIdx] = useState(0);
  const m = months[monthIdx];
  if (!m) return <div className="card"><div className="empty">Aucun interne / mois.</div></div>;

  const cycle = (iso, nom) => {
    if (!editable) return;
    // cycle manuel : (vide) -> P -> CA -> FCP -> FCC -> AB -> (vide). G/RS sont auto (non éditables ici).
    const order = ['', 'P', 'CA', 'FCP', 'FCC', 'AB'];
    const cur = presences?.[iso]?.[nom] || '';
    const nextCode = order[(order.indexOf(cur) + 1) % order.length];
    onSet(iso, nom, nextCode);
  };

  return (
    <div className="card">
      <div className="card-h">Présences — {MONTHS_FR[m.month]} {m.year}
        <div className="spacer" />
        <div className="row">
          <button className="btn-icon" onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0}>‹</button>
          <button className="btn-icon" onClick={() => setMonthIdx(Math.min(months.length - 1, monthIdx + 1))} disabled={monthIdx === months.length - 1}>›</button>
        </div>
      </div>
      <div className="card-b">
        <div className="pres-wrap">
          <table className="pres-tbl">
            <thead>
              <tr>
                <th className="corner">Interne</th>
                {m.days.map((d) => (
                  <th key={d.iso} className={d.isSun ? 'sun' : d.isWeekend ? 'we' : ''}>
                    {DAYS_FR[d.weekday][0]}<br />{String(d.day).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((nom) => (
                <tr key={nom}>
                  <td className="rowhead">{nom}</td>
                  {m.days.map((d) => {
                    const code = eff[d.iso]?.[nom] || '';
                    const st = PRESENCE_MAP[code];
                    return (
                      <td key={d.iso} className={`pres-cell ${editable ? '' : 'readonly'}`}
                        style={{ background: st ? st.color : undefined, color: st ? st.text : 'var(--muted-2)' }}
                        title={st ? st.label : 'Cliquer pour définir'}
                        onClick={() => cycle(d.iso, nom)}>
                        {code}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {names.length === 0 && <tr><td className="rowhead">—</td><td colSpan={m.days.length}><div className="empty" style={{ padding: '1rem' }}>Aucun interne.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pres-legend">
          {PRESENCE_STATUSES.map((s) => (
            <span className="pl" key={s.code}>
              <span className="sw" style={{ background: s.color }} />
              <b>{s.code}</b> {s.label}{s.auto ? ' (auto)' : ''}
            </span>
          ))}
        </div>
        {editable && <div style={{ marginTop: '.6rem', fontSize: '.76rem', color: 'var(--muted)' }}>
          Clique une case pour changer le statut (P → CA → FCP → FCC → AB → vide). G et RS se posent automatiquement selon les gardes.
        </div>}
      </div>
    </div>
  );
}

// ---------- Stats "à ce jour" ----------
function StatsProgress({ gardes, internes, days, todayIso }) {
  const stats = useMemo(() => computeStatsProgress(gardes, internes.map((i) => i.nom), days, todayIso), [gardes, internes, days, todayIso]);
  const rows = internes.map((it) => {
    const s = stats[it.nom] || { faites: 0, prevues: 0, restantes: 0, samPrev: 0, dimPrev: 0, vdPrev: 0, repos: 0 };
    const max = it.maxSem ?? 25;
    const pctDone = s.prevues ? Math.round((s.faites / s.prevues) * 100) : 0;
    return { nom: it.nom, ...s, max, pctDone };
  });
  const maxPrev = Math.max(1, ...rows.map((r) => r.prevues));

  return (
    <>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-h">Avancement des gardes — à ce jour
          <div className="spacer" />
          <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Aujourd'hui : {fmtFull(todayIso)}</span>
        </div>
        <div className="card-b prog-card">
          {rows.length === 0 && <div className="empty">Aucun interne.</div>}
          {rows.map((r) => {
            const donePct = (r.faites / maxPrev) * 100;
            const todoPct = (r.restantes / maxPrev) * 100;
            return (
              <div className="prog-row" key={r.nom}>
                <div className="pname">{r.nom}</div>
                <div className="prog-bar">
                  <div className="done" style={{ width: `${donePct}%` }} />
                  <div className="todo" style={{ width: `${todoPct}%` }} />
                  <span className="lbl">{r.faites} faite(s) · {r.restantes} à venir</span>
                </div>
                <div className="prog-meta"><b>{r.prevues}</b>/{r.max} prévues</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h">Détail par interne</div>
        <div className="card-b" style={{ padding: 0 }}>
          <div className="stats-scroll">
            <table className="stats-tbl">
              <thead><tr>
                <th>Interne</th><th>Faites</th><th>À venir</th><th>Total prévu</th><th>Max</th>
                <th>Samedis</th><th>Dimanches</th><th>V+D</th><th>Repos</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nom}>
                    <td>{r.nom}</td>
                    <td><b>{r.faites}</b></td>
                    <td>{r.restantes}</td>
                    <td>{r.prevues}</td>
                    <td>{r.max}</td>
                    <td>{r.samPrev}</td>
                    <td>{r.dimPrev}</td>
                    <td>{r.vdPrev}</td>
                    <td>{r.repos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '.9rem 1.1rem', fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            <b>Faites</b> = gardes déjà passées · <b>À venir</b> = gardes prévues restantes ·{' '}
            <b>Total prévu</b> = faites + à venir. Chiffres actualisés selon la date du jour.
            <b> V+D</b> = gros week-end (vendredi + dimanche). Case garde en <b style={{ color: 'var(--red)' }}>rouge</b> = doublon ou interne absent.
          </div>
        </div>
      </div>
    </>
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
                <td>{m.email === ownerEmail ? <span className="badge blue">Propriétaire</span> : (
                  <select value={m.role} onChange={(e) => updateMembreRole(planningId, m.email, e.target.value)}
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '.35rem .5rem' }}>
                    <option value="editeur">Éditeur</option>
                    <option value="invite">Invité (lecture)</option>
                  </select>
                )}</td>
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

function ActivityPanel({ histo }) {
  return (
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
  );
}

// ---------- utils ----------
function chunk3(months) {
  // répartit N mois en 3 colonnes équilibrées, ordre chronologique par colonne
  const per = Math.ceil(months.length / 3);
  return [months.slice(0, per), months.slice(per, per * 2), months.slice(per * 2)];
}
function idxPrev(days, i) { return i > 0 ? days[i - 1] : null; }
function prevDayIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return isoDate(dt);
}
function fmtFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS_FR[Number(m)].toLowerCase()} ${y}`;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24); return `il y a ${j} j`;
}
