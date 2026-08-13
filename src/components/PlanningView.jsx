import { useEffect, useMemo, useState } from 'react';
import { Zap, Star, Moon, Plane, BookOpen, GraduationCap, Ban, CalendarCheck, Printer, CalendarPlus, Check } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  watchPlanning, updatePlanning, updatePlanningGardes, updatePlanningInternes, updatePlanningPresences, claimInterne,
  watchMembres, watchHistorique, logAction, logEvent, updateMembreRole, removeMembre,
  createEchange, watchEchanges, updateEchange, deleteEchange, pushNotifMany, pushNotif,
} from '../lib/firebase';
import {
  semesterMonthsWithDays, semesterDays, semesterDaysValued, MONTHS_FR, DAYS_FR,
  isVplusD, isDoublon, reposFor, semesterLabel,
  PRESENCE_STATUSES, PRESENCE_MAP, ABSENT_CODES,
  computePresences, gardeConflit, computeStatsProgress, autoDistributeV2, isoDate,
  frenchHolidays, holidayName, computePoints,
} from '../lib/semester';
import { useIsMobile } from '../lib/useIsMobile';
import { buildICS, downloadICS } from '../lib/icsExport';

const PALETTE = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#ca8a04', '#0d9488'];

export default function PlanningView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [p, setP] = useState(undefined);
  const [membres, setMembres] = useState([]);
  const [histo, setHisto] = useState([]);
  const [tab, setTab] = useState('planning');
  const [gardes, setGardes] = useState({});
  const [presences, setPresences] = useState({});
  const [planMonthIdx, setPlanMonthIdx] = useState(0);
  const [mineOnly, setMineOnly] = useState(false);
  const [changed, setChanged] = useState({});      // { iso: true } cases "modifiées" (jaune)
  const [comments, setComments] = useState({});    // { iso: texte } commentaires par jour
  const [wasRandom, setWasRandom] = useState(false);
  const [editsSinceRandom, setEditsSinceRandom] = useState(0);

  useEffect(() => watchPlanning(id, setP), [id]);
  useEffect(() => watchMembres(id, setMembres), [id]);
  useEffect(() => watchHistorique(id, setHisto), [id]);
  useEffect(() => { if (p) { setGardes(p.gardes || {}); setPresences(p.presences || {}); } }, [p?.gardes, p?.presences]);
  useEffect(() => { if (p) { setChanged(p.changed || {}); setWasRandom(!!p.wasRandom); setEditsSinceRandom(p.editsSinceRandom || 0); } }, [p?.changed, p?.wasRandom, p?.editsSinceRandom]);
  useEffect(() => { if (p) setComments(p.comments || {}); }, [p?.comments]);

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

  // Marque une case comme "modifiée" (jaune) selon la règle :
  // - planning random : 1re modif ne marque pas, 2e+ marque. (editsSinceRandom)
  // - planning manuel (jamais de random) : 1re modif marque déjà.
  const applyChangeMark = (iso, nextGardes, extra = {}) => {
    let nextChanged = { ...changed };
    let nextEdits = editsSinceRandom;
    if (wasRandom) {
      nextEdits = editsSinceRandom + 1;
      if (nextEdits >= 2) nextChanged[iso] = true; // à partir de la 2e modif
    } else {
      nextChanged[iso] = true; // planning manuel : dès la 1re
    }
    setChanged(nextChanged);
    setEditsSinceRandom(nextEdits);
    updatePlanning(id, { gardes: nextGardes, changed: nextChanged, editsSinceRandom: nextEdits, ...extra });
  };

  const setComment = async (iso, texte) => {
    const next = { ...comments };
    if (texte && texte.trim()) next[iso] = texte.trim(); else delete next[iso];
    setComments(next);
    try { updatePlanning(id, { comments: next }); } catch {}
  };

  const setGarde = async (iso, garde, dateLabel) => {
    const next = { ...gardes };
    if (garde) next[iso] = { ...(next[iso] || {}), garde };
    else { if (next[iso]) { const c = { ...next[iso] }; delete c.garde; next[iso] = c; if (!next[iso].garde) delete next[iso]; } }
    setGardes(next);
    try {
      applyChangeMark(iso, next);
      logAction(id, user, 'garde', `${dateLabel} → ${garde || '—'}`);
    } catch {}
  };

  const setPresence = async (iso, nom, code) => {
    const next = { ...presences };
    const row = { ...(next[iso] || {}) };
    if (code) row[nom] = code; else delete row[nom];
    if (Object.keys(row).length) next[iso] = row; else delete next[iso];
    setPresences(next);
    try {
      let nextChanged = { ...changed };
      let nextEdits = editsSinceRandom;
      if (wasRandom) { nextEdits = editsSinceRandom + 1; if (nextEdits >= 2) nextChanged[iso] = true; }
      else { nextChanged[iso] = true; }
      setChanged(nextChanged); setEditsSinceRandom(nextEdits);
      updatePlanning(id, { presences: next, changed: nextChanged, editsSinceRandom: nextEdits });
    } catch {}
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

  // "C'est moi" : le membre courant se relie à cet interne (+ option renommer avec prénom)
  const claimMe = async (idx) => {
    const it = internes[idx];
    const prenom = prompt(`Ton prénom (remplacera « ${it.nom} ») :`, (user?.nom || '').split(' ')[0] || it.nom);
    if (prenom === null) return; // annulé
    await claimInterne(id, idx, prenom.trim() || it.nom, user.email);
    logAction(id, user, 'interne', `${user.nom} s'est identifié comme ${prenom.trim() || it.nom}`);
  };
  const unclaimMe = async (idx) => {
    const next = internes.map((x, i) => i === idx ? { ...x, email: '' } : x);
    updatePlanningInternes(id, next);
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
    setChanged({}); setWasRandom(true); setEditsSinceRandom(0);
    try {
      updatePlanning(id, { gardes: next, changed: {}, wasRandom: true, editsSinceRandom: 0 });
      logAction(id, user, 'auto', 'Répartition automatique générée');
    } catch {}
  };

  return (
    <>
      <div className="page-head row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{p.nom || semesterLabel(p.annee, p.type)}
            {p.valide && <span className="badge green" style={{ marginLeft: '.6rem', verticalAlign: 'middle' }}><Check size={12} style={{ verticalAlign: -1, marginRight: 3 }} />Validé</span>}
          </h1>
          <p>{semesterLabel(p.annee, p.type)} · {internes.length} interne(s) ·{' '}
            <span className={`badge ${isOwner ? 'blue' : canEdit ? 'green' : 'gray'}`}>
              {isOwner ? 'Propriétaire' : canEdit ? 'Éditeur' : 'Invité'}</span></p>
        </div>
        <div className="row" style={{ gap: '.5rem' }}>
          {isOwner && (
            <button className={`btn ${p.valide ? 'secondary' : ''}`}
              onClick={() => {
                const v = !p.valide;
                updatePlanning(id, { valide: v });
                logAction(id, user, 'statut', v ? 'Planning validé' : 'Validation retirée');
                if (v) pushNotifMany(membres.map((m) => m.email), { type: 'valide', text: `Le planning « ${p.nom} » a été validé.`, planningId: id });
              }}>
              {p.valide ? 'Retirer la validation' : 'Valider le planning'}
            </button>
          )}
          <button className="btn secondary" onClick={() => nav('/plannings')}>← Retour</button>
        </div>
      </div>

      <div className="tabs">
        {['planning', 'presences', 'internes', 'stats', 'echanges', ...(isOwner ? ['equipe'] : []), 'activite'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {{ planning: 'Planning', presences: 'Présences', internes: 'Internes', stats: 'Statistiques', echanges: 'Échanges', equipe: 'Équipe', activite: 'Activité' }[t]}
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
              {internes.some((it) => it.email === user?.email) && (
                <label className="check-row" style={{ marginRight: '.4rem' }}>
                  <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                  <span style={{ fontSize: '.82rem' }}>Mes gardes</span>
                </label>
              )}
              <button className="btn secondary" onClick={() => window.print()} title="Imprimer ou enregistrer en PDF">
                <Printer size={15} style={{ marginRight: 6, verticalAlign: -2 }} />PDF
              </button>
              <button className="btn secondary" onClick={() => {
                const me = internes.find((it) => it.email === user?.email);
                downloadICS(buildICS(gardes, p.nom, me?.nom || null), `gardes-${(me?.nom || 'toutes').replace(/\s/g, '-')}.ics`);
              }} title="Ajouter mes gardes à mon agenda">
                <CalendarPlus size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Calendrier
              </button>
              {canEdit && <button className="btn" onClick={runAuto}><Zap size={16} style={{marginRight:6,verticalAlign:-2}} />Proposer une répartition</button>}
            </div>
            <LiveEquity gardes={gardes} internes={internes} interneColor={interneColor} />
            {isMobile ? (
              <>
                <div className="month-nav">
                  <button className="btn-icon" onClick={() => setPlanMonthIdx(Math.max(0, planMonthIdx - 1))} disabled={planMonthIdx === 0}>‹</button>
                  <span>{months[planMonthIdx] && `${MONTHS_FR[months[planMonthIdx].month]} ${months[planMonthIdx].year}`}</span>
                  <button className="btn-icon" onClick={() => setPlanMonthIdx(Math.min(months.length - 1, planMonthIdx + 1))} disabled={planMonthIdx === months.length - 1}>›</button>
                </div>
                {months[planMonthIdx] && (
                  <PlanningMonth m={months[planMonthIdx]}
                    gardes={gardes} presences={presences} internes={interneNames}
                    interneColor={interneColor} editable={canEdit} onSet={setGarde}
                    todayIso={todayIso} holidays={holidays} changed={changed} mineOnly={mineOnly} myName={interneNames.find((n) => internes.find((it) => it.nom === n && it.email === user?.email))} comments={comments} onComment={setComment} />
                )}
              </>
            ) : (
              <div className="blocks">
                {months.map((m) => (
                  <PlanningMonth key={`${m.year}-${m.month}`} m={m}
                    gardes={gardes} presences={presences} internes={interneNames}
                    interneColor={interneColor} editable={canEdit} onSet={setGarde}
                    todayIso={todayIso} holidays={holidays} changed={changed} mineOnly={mineOnly} myName={interneNames.find((n) => internes.find((it) => it.nom === n && it.email === user?.email))} comments={comments} onComment={setComment} />
                ))}
              </div>
            )}
          </>
        )
      )}

      {tab === 'presences' && (
        <PresencesTab months={months} internes={internes} gardes={gardes} presences={presences}
          editable={canEdit} onSetPresence={setPresence} onSetGarde={setGarde} holidays={holidays} isMobile={isMobile} changed={changed} />
      )}

      {tab === 'internes' && (
        <div className="card">
          <div className="card-h">Internes du planning<div className="spacer" />
            {canEdit && <button className="btn sm" onClick={addInterne}>＋ Ajouter</button>}
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead><tr><th>Nom</th><th>Couleur</th><th>Max/mois</th><th>Max/sem.</th><th>Identité</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {internes.length === 0 && <tr><td colSpan={6}><div className="empty">Aucun interne.</div></td></tr>}
                  {internes.map((it, idx) => {
                    const isMe = it.email === user?.email;
                    return (
                    <tr key={idx}>
                      <td><input type="text" value={it.nom} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'nom', e.target.value)} /></td>
                      <td><input type="color" className="swatch" value={it.couleur || '#e2e8f0'} disabled={!canEdit} style={{ width: 32, height: 28, padding: 0 }} onChange={(e) => patchInterne(idx, 'couleur', e.target.value)} /></td>
                      <td><input type="number" value={it.maxMois ?? 5} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'maxMois', Number(e.target.value))} /></td>
                      <td><input type="number" value={it.maxSem ?? 25} disabled={!canEdit} onChange={(e) => patchInterne(idx, 'maxSem', Number(e.target.value))} /></td>
                      <td>
                        {isMe ? (
                          <span className="row" style={{ gap: '.4rem' }}>
                            <span className="badge green"><Star size={12} style={{marginRight:4,verticalAlign:-1}} />C'est moi</span>
                            <button className="btn ghost sm" onClick={() => unclaimMe(idx)}>Retirer</button>
                          </span>
                        ) : it.email ? (
                          <span className="badge gray" title={it.email}>Pris</span>
                        ) : (
                          <button className="btn secondary sm" onClick={() => claimMe(idx)}>C'est moi</button>
                        )}
                      </td>
                      {canEdit && <td><button className="btn danger sm" onClick={() => delInterne(idx)}>Suppr.</button></td>}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && <StatsProgress gardes={gardes} internes={internes} days={allDays} todayIso={todayIso} holidays={holidays} />}
      {tab === 'echanges' && (
        <EchangesPanel planningId={id} planningNom={p.nom} gardes={gardes} internes={internes}
          membres={membres} user={user} canEdit={canEdit} onApplied={setGarde} months={months} />
      )}
      {tab === 'equipe' && isOwner && <TeamPanel planningId={id} planningNom={p.nom} membres={membres} ownerEmail={p.ownerEmail} user={user} />}
      {tab === 'activite' && <ActivityPanel histo={histo} />}
    </>
  );
}

// ---------- Planning mois V1 : tableau dense ----------
// Barre d'équité en temps réel : nb de gardes par interne, mise à jour à chaque modif.
function LiveEquity({ gardes, internes, interneColor }) {
  const counts = useMemo(() => {
    const c = Object.fromEntries(internes.map((it) => [it.nom, 0]));
    Object.values(gardes || {}).forEach((g) => { if (g?.garde && c[g.garde] !== undefined) c[g.garde] += 1; });
    return c;
  }, [gardes, internes]);
  const vals = Object.values(counts);
  if (internes.length === 0 || vals.every((v) => v === 0)) return null;
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const spread = max - min; // écart max-min : indicateur d'équité

  return (
    <div className="equity">
      <div className="equity-h">
        <span>Équilibre en temps réel</span>
        <span className={`equity-badge ${spread <= 1 ? 'ok' : spread <= 3 ? 'warn' : 'bad'}`}>
          écart {spread}
        </span>
      </div>
      <div className="equity-bars">
        {internes.map((it) => (
          <div className="equity-row" key={it.nom}>
            <span className="equity-name">{it.nom}</span>
            <div className="equity-track">
              <div className="equity-fill" style={{ width: `${(counts[it.nom] / max) * 100}%`, background: it.couleur || 'var(--blue)' }} />
            </div>
            <span className="equity-val">{counts[it.nom]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanningMonth({ m, gardes, presences, internes, interneColor, editable, onSet, todayIso, holidays, changed = {}, mineOnly = false, myName = null, comments = {}, onComment }) {
  const days = m.days;
  const byIso = {}; days.forEach((d) => { byIso[d.iso] = d; });
  return (
    <div className="pm">
      <div className="pm-h">{MONTHS_FR[m.month]} {m.year}</div>
      <table className={`pt ${editable ? '' : 'readonly'}`}>
        <thead>
          <tr><th style={{ textAlign: 'left' }}>Jour</th><th>Garde</th><th>Repos</th><th>V+D</th><th>Val.</th><th>Note</th></tr>
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
            const isChanged = !!changed[d.iso];
            const isMineGarde = myName && garde === myName;
            const dimmed = mineOnly && !isMineGarde;
            const bad = doublon || conflit;
            const col = interneColor[garde];
            const dl = `${DAYS_FR[d.weekday]} ${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`;
            return (
              <tr key={d.iso} className={`${rc} ${isChanged ? 'changed' : ''} ${dimmed ? 'dimmed' : ''} ${isMineGarde && mineOnly ? 'mine-hl' : ''}`}>
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
                <td className="pnote">
                  {editable ? (
                    <input type="text" className="note-input" value={comments[d.iso] || ''}
                      placeholder="+ note"
                      onChange={(e) => onComment(d.iso, e.target.value)} />
                  ) : (
                    comments[d.iso] ? <span className="note-txt" title={comments[d.iso]}>{comments[d.iso]}</span> : ''
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Présences ----------
function PresencesTab({ months, internes, gardes, presences, editable, onSetPresence, onSetGarde, holidays, isMobile, changed = {} }) {
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
            <span className="pl"><span className="sw" style={{ background: '#f1f5f9', color: '#94a3b8' }}>–</span>Vide (jour normal)</span>
          </div>

          {isMobile ? (
            <PresWeekly m={m} internes={internes} eff={eff} holidays={holidays}
              editable={editable} openMenu={openMenu} initials={initials} />
          ) : (
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
                          className={`pres-cell ${editable ? '' : 'readonly'} ${!code ? wecls : ''} ${changed[d.iso] ? 'cell-changed' : ''}`}
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
          )}
          {editable && <div style={{ marginTop: '.6rem', fontSize: '.76rem', color: 'var(--muted)' }}>
            Clique une case pour définir le statut. « Garde » pose la garde du jour (G) et le repos de sécurité (RS) se met automatiquement le lendemain.
          </div>}
        </div>
      </div>

      {/* Résumé de la période */}
      <div className="grid cols-3" style={{ marginTop: '1.25rem' }}>
        <SummaryCard Icon={CalendarCheck} cls="blue" v={totals.G} l="Gardes planifiées" />
        <SummaryCard Icon={Moon} cls="purple" v={totals.RS} l="Repos de sécurité" />
        <SummaryCard Icon={Plane} cls="green" v={totals.CA} l="Congés" />
        <SummaryCard Icon={BookOpen} cls="amber" v={totals.FCP} l="Formations perso" />
        <SummaryCard Icon={GraduationCap} cls="amber" v={totals.FCC} l="Formations coordo" />
        <SummaryCard Icon={Ban} cls="red" v={totals.AB} l="Absences" />
      </div>

      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenu(null)} />
          <div className="pres-menu" style={{ left: menu.x, top: menu.y }}>
            {[
              { code: 'G', label: 'Garde' },
              { code: 'P', label: 'Présent' },
              { code: 'RS', label: 'Repos sécurité' },
              { code: 'CA', label: 'Congé' },
              { code: 'FCP', label: 'Formation perso' },
              { code: 'FCC', label: 'Formation coordo' },
              { code: 'AB', label: 'Absence' },
              { code: 'INDISPO', label: 'Indisponible (souhait)' },
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

function SummaryCard({ Icon, cls, v, l }) {
  return (
    <div className="stat">
      <div className={`ic ${cls}`}>{Icon && <Icon size={18} />}</div>
      <div><div className="v">{v}</div><div className="l">{l}</div></div>
    </div>
  );
}

// Vue mobile des présences : par semaine, empilée. Aucun scroll horizontal.
function PresWeekly({ m, internes, eff, holidays, editable, openMenu, initials }) {
  // découpe les jours du mois en semaines (lundi -> dimanche)
  const weeks = [];
  let cur = [];
  m.days.forEach((d) => {
    cur.push(d);
    if (d.weekday === 0) { weeks.push(cur); cur = []; } // dimanche clôt la semaine
  });
  if (cur.length) weeks.push(cur);

  return (
    <div className="pres-weeks">
      {weeks.map((week, wi) => (
        <div className="pweek" key={wi}>
          <div className="pweek-h">
            Semaine du {String(week[0].day).padStart(2, '0')} au {String(week[week.length - 1].day).padStart(2, '0')} {MONTHS_FR[m.month].slice(0, 4)}.
          </div>
          {week.map((d) => {
            const ferie = holidays.has(d.iso);
            const dayCls = ferie ? 'fer' : d.isSun ? 'sun' : d.isWeekend ? 'we' : '';
            // internes ayant un statut ce jour
            const withStatus = internes
              .map((it) => ({ it, code: eff[d.iso]?.[it.nom] || '' }))
              .filter((x) => x.code);
            return (
              <div className={`pday ${dayCls}`} key={d.iso}>
                <div className="pday-h">
                  <span className="pday-date">{DAYS_FR[d.weekday]} {String(d.day).padStart(2, '0')}</span>
                  {ferie && <span className="ferbadge">FÉRIÉ</span>}
                </div>
                <div className="pday-chips">
                  {internes.map((it) => {
                    const code = eff[d.iso]?.[it.nom] || '';
                    const st = PRESENCE_MAP[code];
                    return (
                      <button key={it.nom}
                        className={`pchip-m ${editable ? '' : 'ro'}`}
                        style={code ? { background: st?.color, color: st?.text, borderColor: 'transparent' } : undefined}
                        onClick={(e) => openMenu(e, d.iso, it.nom)}>
                        <span className="pchip-ini" style={{ background: code ? 'rgba(255,255,255,.5)' : (it.couleur || '#e2e8f0') }}>
                          {initials(it.nom)}
                        </span>
                        {code || '–'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
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

function TeamPanel({ planningId, planningNom, membres, ownerEmail, user }) {
  const changeRole = (email, nom, role) => {
    updateMembreRole(planningId, email, role);
    logEvent('change_role', user, `A changé le rôle de ${nom} en ${role === 'editeur' ? 'Éditeur' : 'Invité'} (${planningNom || planningId})`);
  };
  const remove = (email, nom) => {
    if (!confirm(`Retirer ${nom} ?`)) return;
    removeMembre(planningId, email);
    logEvent('remove_member', user, `A retiré ${nom} du planning « ${planningNom || planningId} »`);
  };
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
                  <select value={m.role} onChange={(e) => changeRole(m.email, m.nom, e.target.value)}
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '.35rem .5rem' }}>
                    <option value="editeur">Éditeur</option>
                    <option value="invite">Invité (lecture)</option>
                  </select>
                )}</td>
                <td>{m.email !== ownerEmail && (
                  <button className="btn danger sm" onClick={() => remove(m.email, m.nom)}>Retirer</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Panneau des échanges de gardes : proposer une de ses gardes, accepter celle d'un autre.
function EchangesPanel({ planningId, planningNom, gardes, internes, membres, user, canEdit, onApplied, months }) {
  const [echanges, setEchanges] = useState([]);
  const [selectedIso, setSelectedIso] = useState('');

  useEffect(() => watchEchanges(planningId, setEchanges), [planningId]);

  // Quel interne suis-je dans ce planning ? (via email)
  const me = internes.find((it) => it.email === user?.email);
  const myName = me?.nom;

  // Mes gardes à venir (celles dont je suis le garde), pour proposer un échange.
  const allDays = months.flatMap((m) => m.days);
  const todayIso = isoDate(new Date());
  const myGardes = allDays.filter((d) => d.iso >= todayIso && gardes?.[d.iso]?.garde === myName);

  const emailsOfOthers = membres.filter((m) => m.email !== user?.email).map((m) => m.email);

  const propose = async () => {
    if (!selectedIso || !myName) return;
    const d = allDays.find((x) => x.iso === selectedIso);
    const dateLabel = d ? `${DAYS_FR[d.weekday]} ${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}` : selectedIso;
    await createEchange(planningId, {
      iso: selectedIso, dateLabel, fromNom: myName, fromEmail: user.email,
    });
    logAction(planningId, user, 'echange', `Propose d'échanger sa garde du ${dateLabel}`);
    pushNotifMany(emailsOfOthers, {
      type: 'echange', text: `${myName} propose d'échanger sa garde du ${dateLabel} (${planningNom}).`, planningId,
    });
    setSelectedIso('');
  };

  const accept = async (e) => {
    if (!myName) { alert("Tu dois d'abord t'identifier comme interne (onglet Internes) pour accepter."); return; }
    if (e.fromNom === myName) { alert("Tu ne peux pas accepter ta propre garde."); return; }
    if (!confirm(`Reprendre la garde du ${e.dateLabel} (actuellement à ${e.fromNom}) ?`)) return;
    // applique le changement de garde
    await onApplied(e.iso, myName, e.dateLabel);
    await updateEchange(planningId, e.id, { status: 'accepte', takenByNom: myName, takenByEmail: user.email });
    logAction(planningId, user, 'echange', `${myName} reprend la garde du ${e.dateLabel} (de ${e.fromNom})`);
    // notifie le proposeur
    pushNotif(e.fromEmail, {
      type: 'echange', text: `${myName} a repris ta garde du ${e.dateLabel} (${planningNom}).`, planningId,
    });
  };

  const cancel = async (e) => {
    if (!confirm('Annuler cette proposition ?')) return;
    await deleteEchange(planningId, e.id);
  };

  const ouverts = echanges.filter((e) => e.status === 'ouvert');
  const passes = echanges.filter((e) => e.status !== 'ouvert');

  return (
    <>
      {!myName && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-b">
            <div style={{ color: 'var(--muted)' }}>
              Pour proposer ou accepter un échange, identifie-toi comme interne dans l'onglet <b>Internes</b> (bouton « C'est moi »).
            </div>
          </div>
        </div>
      )}

      {myName && canEdit && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-h">Proposer un échange</div>
          <div className="card-b">
            {myGardes.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>Tu n'as pas de garde à venir à proposer.</div>
            ) : (
              <div className="row" style={{ gap: '.6rem', flexWrap: 'wrap' }}>
                <select value={selectedIso} onChange={(e) => setSelectedIso(e.target.value)}
                  style={{ minWidth: 220 }}>
                  <option value="">Choisis une de tes gardes…</option>
                  {myGardes.map((d) => (
                    <option key={d.iso} value={d.iso}>
                      {DAYS_FR[d.weekday]} {String(d.day).padStart(2, '0')}/{String(d.month).padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={propose} disabled={!selectedIso}>Proposer l'échange</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-h">Échanges ouverts</div>
        <div className="card-b" style={{ padding: 0 }}>
          {ouverts.length === 0 ? (
            <div className="empty">Aucun échange proposé pour l'instant.</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Garde</th><th>Proposée par</th><th></th></tr></thead>
              <tbody>
                {ouverts.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.dateLabel}</td>
                    <td>{e.fromNom}</td>
                    <td style={{ textAlign: 'right' }}>
                      {e.fromEmail === user?.email ? (
                        <button className="btn danger sm" onClick={() => cancel(e)}>Annuler</button>
                      ) : (
                        <button className="btn sm" onClick={() => accept(e)} disabled={!canEdit}>Reprendre</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {passes.length > 0 && (
        <div className="card">
          <div className="card-h">Historique des échanges</div>
          <div className="card-b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>Garde</th><th>De</th><th>Repris par</th><th>Statut</th></tr></thead>
              <tbody>
                {passes.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.dateLabel}</td>
                    <td>{e.fromNom}</td>
                    <td>{e.takenByNom || '—'}</td>
                    <td><span className={`badge ${e.status === 'accepte' ? 'green' : 'gray'}`}>{e.status === 'accepte' ? 'Échangée' : 'Annulée'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
