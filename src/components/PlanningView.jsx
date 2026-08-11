import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  watchPlanning, updatePlanningGardes, updatePlanningInternes, updatePlanningPresences,
  watchMembres, watchHistorique, logAction, updateMembreRole, removeMembre,
} from '../lib/firebase';
import {
  semesterMonthsWithDays, semesterDays, semesterDaysValued, MONTHS_FR, DAYS_FR,
  isVplusD, isDoublon, reposFor, semesterLabel,
  PRESENCE_STATUSES, PRESENCE_MAP, ABSENT_CODES,
  computePresences, gardeConflit, computeStatsProgress, autoDistributeV2, isoDate,
  frenchHolidays, holidayName, computePoints,
} from '../lib/semester';

const PALETTE = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#ca8a04', '#0d9488'];

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
  const holidays = useMemo(() => {
    if (!p) return new Set();
    const years = [...new Set(allDays.map((d) => d.year))];
    const h = new Set();
    years.forEach((y) => frenchHolidays(y).forEach((iso) => h.add(iso)));
    return h;
  }, [allDays, p]);

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
    const dist = autoDistributeV2(allDays, internes, { presences, holidays, seed: Date.now() });
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
              {months.map((m) => (
                <PlanningMonth key={`${m.year}-${m.month}`} m={m}
                  gardes={gardes} presences={presences} internes={interneNames}
                  interneColor={interneColor} editable={canEdit} onSet={setGarde}
                  todayIso={todayIso} holidays={holidays} />
              ))}
            </div>
          </>
        )
      )}

      {tab === 'presences' && (
        <PresencesTab months={months} internes={internes} gardes={gardes} presences={presences}
          editable={canEdit} onSetPresence={setPresence} onSetGarde={setGarde} holidays={holidays} />
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

      {tab === 'stats' && <StatsProgress gardes={gardes} internes={internes} days={allDays} todayIso={todayIso} holidays={holidays} />}
      {tab === 'equipe' && isOwner && <TeamPanel planningId={id} membres={membres} ownerEmail={p.ownerEmail} />}
      {tab === 'activite' && <ActivityPanel histo={histo} />}
    </>
  );
}

// ---------- Planning mois V1 : tableau dense ----------
function PlanningMonth({ m, gardes, presences, internes, interneColor, editable, onSet, todayIso, holidays }) {
  const days = m.days;
  const byIso = {}; days.forEach((d) => { byIso[d.iso] = d; });
  return (
    <div className="pm">
      <div className="pm-h">{MONTHS_FR[m.month]} {m.year}</div>
      <table className={`pt ${editable ? '' : 'readonly'}`}>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>Jour</th><th>Garde</th><th>Repos</th><th>V+D</th><th>Val.</th></tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const prevIso = prevDayIso(d.iso);
            const garde = gardes[d.iso]?.garde || '';
            const repos = reposFor(gardes, prevIso);
            const doublon = isDoublon(gardes, d.iso, prevIso);
            const vd = isVplusD(gardes, d, byIso);
            const conflit = gardeConflit(gardes, presences, d.iso, garde);
            const ferie = holidays.has(d.iso);
            const val = ferie || d.isSun ? '2×' : d.isSat ? '1,5×' : '1×';
            const rc = conflit ? 'conflit' : ferie ? 'fer' : d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
            const bad = doublon || conflit;
            const col = interneColor[garde];
            const dl = `${DAYS_FR[d.weekday]} ${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`;
            return (
              <tr key={d.iso} className={rc}>
                <td className="pdd">
                  {DAYS_FR[d.weekday]} <b>{String(d.day).padStart(2, '0')}/{String(d.month).padStart(2, '0')}</b>
                  {ferie && <span className="ferbadge" title={holidayName(d.iso)}>FÉRIÉ</span>}
                </td>
                <td>
                  {editable ? (
                    <select className={`psel ${garde && !bad ? 'filled' : ''}`}
                      value={garde}
                      style={garde && !bad ? { background: col } : undefined}
                      onChange={(e) => onSet(d.iso, e.target.value, dl)}>
                      <option value="" style={{ color: '#334155' }}>+ garde</option>
                      {internes.map((n) => <option key={n} value={n} style={{ color: '#334155' }}>{n}</option>)}
                    </select>
                  ) : (
                    garde && <span className={`pchip ${bad ? 'bad' : ''}`} style={{ background: bad ? undefined : col }}>{garde}</span>
                  )}
                </td>
                <td className="prep">{repos}</td>
                <td className="pvd">{vd ? 'V+D' : ''}</td>
                <td className="pval">{val}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Présences ----------
function PresencesTab({ months, internes, gardes, presences, editable, onSetPresence, onSetGarde, holidays }) {
  const allDays = months.flatMap((m) => m.days);
  const names = internes.map((i) => i.nom);
  const eff = useMemo(() => computePresences(gardes, presences, allDays, names), [gardes, presences, allDays, names]);
  const [monthIdx, setMonthIdx] = useState(0);
  const [menu, setMenu] = useState(null); // { iso, nom, x, y }
  const m = months[monthIdx];
  if (!m) return <div className="card"><div className="empty">Aucun interne / mois.</div></div>;

  const openMenu = (e, iso, nom) => {
    if (!editable) return;
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ iso, nom, x: r.left, y: r.bottom + window.scrollY });
  };

  const applyStatus = (iso, nom, code) => {
    // G : pose/retire la garde du jour (un seul interne de garde par jour)
    if (code === 'G') {
      onSetGarde(iso, nom, dateLabelOf(iso));
      onSetPresence(iso, nom, ''); // on efface une éventuelle saisie manuelle, G devient auto
    } else if (code === '') {
      // vide : si l'interne était de garde ce jour, on retire la garde ; sinon efface le statut manuel
      if (gardes?.[iso]?.garde === nom) onSetGarde(iso, '', dateLabelOf(iso));
      onSetPresence(iso, nom, '');
    } else {
      // statut manuel (CA/FCP/FCC/AB/RS/P). Si l'interne était de garde, on l'enlève d'abord.
      if (gardes?.[iso]?.garde === nom) onSetGarde(iso, '', dateLabelOf(iso));
      onSetPresence(iso, nom, code);
    }
    setMenu(null);
  };

  // Totaux de la période (tout le semestre)
  const totals = useMemo(() => {
    const t = { G: 0, RS: 0, CA: 0, FCP: 0, FCC: 0, AB: 0 };
    allDays.forEach((d) => {
      names.forEach((nom) => {
        const c = eff[d.iso]?.[nom];
        if (c && t[c] !== undefined) t[c] += 1;
      });
    });
    return t;
  }, [eff, allDays, names]);

  const initials = (nom) => nom.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <div className="card">
        <div className="card-h">Présences
          <div className="spacer" />
          <div className="row">
            <button className="btn secondary sm" onClick={() => setMonthIdx(0)}>Aujourd'hui</button>
            <button className="btn-icon" onClick={() => setMonthIdx(Math.max(0, monthIdx - 1))} disabled={monthIdx === 0}>‹</button>
            <span style={{ fontWeight: 700, minWidth: 130, textAlign: 'center' }}>{MONTHS_FR[m.month]} {m.year}</span>
            <button className="btn-icon" onClick={() => setMonthIdx(Math.min(months.length - 1, monthIdx + 1))} disabled={monthIdx === months.length - 1}>›</button>
          </div>
        </div>
        <div className="card-b">
          <div className="pres-legend" style={{ marginBottom: '.9rem', marginTop: 0 }}>
            {PRESENCE_STATUSES.map((s) => (
              <span className="pl" key={s.code}>
                <span className="sw" style={{ background: s.color, color: s.text }}>{s.code}</span>
                {s.label}
              </span>
            ))}
            <span className="pl"><span className="sw" style={{ background: '#f1f5f9', color: '#94a3b8' }}>–</span>Vide</span>
          </div>

          <div className="pres-wrap">
            <table className="pres-tbl">
              <thead>
                <tr>
                  <th className="corner">Internes</th>
                  {m.days.map((d) => {
                    const ferie = holidays.has(d.iso);
                    return (
                      <th key={d.iso} className={ferie ? 'fer' : d.isSun ? 'sun' : d.isWeekend ? 'we' : ''} title={ferie ? holidayName(d.iso) : ''}>
                        {DAYS_FR[d.weekday].toUpperCase()}<br />{String(d.day).padStart(2, '0')}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {internes.map((it) => (
                  <tr key={it.nom}>
                    <td className="rowhead">
                      <div className="row" style={{ gap: '.5rem' }}>
                        <span className="ini" style={{ background: it.couleur || '#e2e8f0' }}>{initials(it.nom)}</span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{it.nom}</div>
                          {it.role && <div style={{ fontSize: '.68rem', color: 'var(--muted)' }}>{it.role}</div>}
                        </div>
                      </div>
                    </td>
                    {m.days.map((d) => {
                      const code = eff[d.iso]?.[it.nom] || '';
                      const st = PRESENCE_MAP[code];
                      const ferie = holidays.has(d.iso);
                      const wecls = ferie ? 'fer' : d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
                      return (
                        <td key={d.iso}
                          className={`pres-cell ${editable ? '' : 'readonly'} ${!code ? wecls : ''}`}
                          style={code ? { background: st?.color, color: st?.text } : undefined}
                          title={st ? st.label : ''}
                          onClick={(e) => openMenu(e, d.iso, it.nom)}>
                          {code || (editable ? '' : '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {internes.length === 0 && <tr><td className="rowhead">—</td><td colSpan={m.days.length}><div className="empty" style={{ padding: '1rem' }}>Aucun interne.</div></td></tr>}
              </tbody>
            </table>
          </div>
          {editable && <div style={{ marginTop: '.6rem', fontSize: '.76rem', color: 'var(--muted)' }}>
            Clique une case pour définir le statut. « Garde » pose la garde du jour (G) et le repos de sécurité (RS) se met automatiquement le lendemain.
          </div>}
        </div>
      </div>

      {/* Résumé de la période */}
      <div className="grid cols-3" style={{ marginTop: '1.25rem' }}>
        <SummaryCard ic="☰" cls="blue" v={totals.G} l="Gardes planifiées" />
        <SummaryCard ic="☾" cls="purple" v={totals.RS} l="Repos de sécurité" />
        <SummaryCard ic="✈" cls="green" v={totals.CA} l="Congés" />
        <SummaryCard ic="◈" cls="amber" v={totals.FCP} l="Formations perso" />
        <SummaryCard ic="◆" cls="amber" v={totals.FCC} l="Formations coordo" />
        <SummaryCard ic="✚" cls="red" v={totals.AB} l="Absences" />
      </div>

      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenu(null)} />
          <div className="pres-menu" style={{ left: menu.x, top: menu.y }}>
            {[
              { code: 'G', label: 'Garde' },
              { code: 'RS', label: 'Repos sécurité' },
              { code: 'CA', label: 'Congé' },
              { code: 'FCP', label: 'Formation perso' },
              { code: 'FCC', label: 'Formation coordo' },
              { code: 'AB', label: 'Absence' },
              { code: '', label: 'Vide' },
            ].map((o) => {
              const st = PRESENCE_MAP[o.code];
              return (
                <button key={o.code || 'vide'} className="pres-menu-item"
                  onClick={() => applyStatus(menu.iso, menu.nom, o.code)}>
                  <span className="sw" style={{ background: st ? st.color : '#f1f5f9', color: st ? st.text : '#94a3b8' }}>
                    {o.code || '–'}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({ ic, cls, v, l }) {
  return (
    <div className="stat">
      <div className={`ic ${cls}`}>{ic}</div>
      <div><div className="v">{v}</div><div className="l">{l}</div></div>
    </div>
  );
}

function dateLabelOf(iso) {
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}`;
}

// ---------- Stats "à ce jour" ----------
function StatsProgress({ gardes, internes, days, todayIso, holidays }) {
  const stats = useMemo(() => computeStatsProgress(gardes, internes.map((i) => i.nom), days, todayIso), [gardes, internes, days, todayIso]);
  const points = useMemo(() => computePoints(gardes, internes.map((i) => i.nom), days, holidays), [gardes, internes, days, holidays]);
  const rows = internes.map((it) => {
    const s = stats[it.nom] || { faites: 0, prevues: 0, restantes: 0, samPrev: 0, dimPrev: 0, vdPrev: 0, repos: 0 };
    const pt = points[it.nom] || { total: 0, ferie: 0 };
    const max = it.maxSem ?? 25;
    return { nom: it.nom, ...s, max, pts: pt.total, ferie: pt.ferie };
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
                <th>Samedis</th><th>Dimanches</th><th>Fériés</th><th>V+D</th><th>Points</th><th>Repos</th>
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
                    <td>{r.ferie}</td>
                    <td>{r.vdPrev}</td>
                    <td><b>{String(r.pts).replace('.', ',')}</b></td>
                    <td>{r.repos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '.9rem 1.1rem', fontSize: '.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            <b>Faites</b> = gardes déjà passées · <b>À venir</b> = restantes · <b>Points</b> = valorisation
            (semaine 1× · samedi 1,5× · dimanche &amp; fériés 2×). Chiffres actualisés selon la date du jour.
            Case garde en <b style={{ color: 'var(--red)' }}>rouge</b> = doublon ou interne absent ce jour.
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
