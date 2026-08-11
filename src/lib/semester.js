// Logique métier des semestres (dates, blocs, détections).

export const MONTHS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
export const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// Codes de présence/absence
export const CODES = [
  { code: 'CA', label: 'Congé' },
  { code: 'F', label: 'Formation' },
  { code: 'A', label: 'Absence' },
  { code: 'AR', label: 'Arrêt' },
];

// ISO date locale (YYYY-MM-DD) sans décalage de fuseau.
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Les 6 mois d'un semestre. type 'nov' => Nov..Avril ; 'mai' => Mai..Octobre.
export function semesterMonths(annee, type) {
  const startMonth = type === 'nov' ? 11 : 5;
  const months = [];
  let m = startMonth;
  let y = annee;
  for (let i = 0; i < 6; i++) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// Label lisible d'un semestre.
export function semesterLabel(annee, type) {
  if (type === 'nov') return `${annee} · Nov → Avril ${annee + 1}`;
  return `${annee} · Mai → Octobre`;
}

// Jours d'un mois donné, avec métadonnées.
export function monthDays(year, month) {
  const nb = new Date(year, month, 0).getDate(); // month 1-based -> day 0 of next
  const days = [];
  for (let d = 1; d <= nb; d++) {
    const date = new Date(year, month - 1, d);
    const wd = date.getDay(); // 0=dim..6=sam
    days.push({
      day: d,
      date,
      iso: isoDate(date),
      weekday: wd,
      isSat: wd === 6,
      isSun: wd === 0,
      isWeekend: wd === 0 || wd === 6,
    });
  }
  return days;
}

// Répartition des 6 mois en 3 blocs de 2 mois.
export function monthBlocks(annee, type) {
  const months = semesterMonths(annee, type);
  return [
    [months[0], months[1]],
    [months[2], months[3]],
    [months[4], months[5]],
  ];
}

// Détecte un doublon : garde identique la veille (impossible, repos le lendemain).
export function isDoublon(gardes, iso, prevIso) {
  const g = gardes?.[iso]?.garde;
  const p = gardes?.[prevIso]?.garde;
  return !!g && !!p && g === p;
}

// Le repos du jour = garde de la veille (si présente).
export function reposFor(gardes, prevIso) {
  return gardes?.[prevIso]?.garde || '';
}

// V+D : un vendredi où la même personne est aussi de garde le dimanche suivant.
export function isVplusD(gardes, day, allDaysByIso) {
  if (day.weekday !== 5) return false; // vendredi
  const g = gardes?.[day.iso]?.garde;
  if (!g) return false;
  const sun = new Date(day.date);
  sun.setDate(sun.getDate() + 2);
  const sunIso = isoDate(sun);
  return gardes?.[sunIso]?.garde === g;
}

// ---- Statistiques par interne ----
export function computeStats(gardes, internes, months) {
  // Index de tous les jours du semestre.
  const allDays = [];
  months.forEach((m) => allDays.push(...monthDays(m.year, m.month)));
  const byIso = {};
  allDays.forEach((d) => { byIso[d.iso] = d; });

  const stat = {};
  internes.forEach((nom) => {
    stat[nom] = {
      nom, gardes: 0, samedis: 0, dimanches: 0, vd: 0,
      repos: 0, ca: 0, form: 0, abs: 0,
    };
  });

  allDays.forEach((d) => {
    const cell = gardes?.[d.iso];
    if (!cell) return;
    const g = cell.garde;
    if (g && stat[g]) {
      stat[g].gardes++;
      if (d.isSat) stat[g].samedis++;
      if (d.isSun) stat[g].dimanches++;
      if (isVplusD(gardes, d, byIso)) stat[g].vd++;
    }
  });

  // Repos : pour chaque jour, la personne de garde la veille est en repos.
  for (let i = 1; i < allDays.length; i++) {
    const rep = gardes?.[allDays[i - 1].iso]?.garde;
    if (rep && stat[rep]) stat[rep].repos++;
  }

  return stat;
}

// ============================================================
//  BORNES DU SEMESTRE : du 1er lundi au dernier dimanche
// ============================================================

// Premier lundi à partir du 1er du mois de départ.
export function semesterStart(annee, type) {
  const startMonth = type === 'nov' ? 11 : 5;
  const d = new Date(annee, startMonth - 1, 1);
  // avancer jusqu'au lundi (getDay: 1 = lundi)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
}

// Dernier dimanche du 6e mois du semestre.
export function semesterEnd(annee, type) {
  const months = semesterMonths(annee, type);
  const last = months[5];
  const d = new Date(last.year, last.month, 0); // dernier jour du mois
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1); // reculer jusqu'à dimanche
  return d;
}

// Tous les jours du semestre (1er lundi → dernier dimanche), avec métadonnées.
export function semesterDays(annee, type) {
  const start = semesterStart(annee, type);
  const end = semesterEnd(annee, type);
  const days = [];
  const d = new Date(start);
  while (d <= end) {
    const wd = d.getDay();
    days.push({
      date: new Date(d),
      iso: isoDate(d),
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      weekday: wd,
      isSat: wd === 6,
      isSun: wd === 0,
      isWeekend: wd === 0 || wd === 6,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Regroupe les jours du semestre par mois (pour affichage en 3 blocs de 2 mois).
// Un jour appartient au mois de sa date. On garde l'ordre chronologique.
export function semesterMonthsWithDays(annee, type) {
  const all = semesterDays(annee, type);
  const map = new Map();
  all.forEach((d) => {
    const key = `${d.year}-${d.month}`;
    if (!map.has(key)) map.set(key, { year: d.year, month: d.month, days: [] });
    map.get(key).days.push(d);
  });
  return [...map.values()];
}

// ============================================================
//  PRÉSENCES
// ============================================================
export const PRESENCE_STATUSES = [
  { code: 'P', label: 'Présent', color: '#e2e8f0', text: '#334155' },
  { code: 'G', label: 'Garde', color: '#bfdbfe', text: '#1e40af', auto: true },
  { code: 'RS', label: 'Repos de sécurité', color: '#ddd6fe', text: '#5b21b6', auto: true },
  { code: 'CA', label: 'Congé', color: '#bbf7d0', text: '#166534' },
  { code: 'FCP', label: 'Formation perso', color: '#fde68a', text: '#92400e' },
  { code: 'FCC', label: 'Formation coordonateur', color: '#fed7aa', text: '#9a3412' },
  { code: 'AB', label: 'Absence', color: '#fecaca', text: '#991b1b' },
];
export const PRESENCE_MAP = Object.fromEntries(PRESENCE_STATUSES.map((s) => [s.code, s]));

// Statuts considérés comme "absent" (ne devrait pas être de garde).
export const ABSENT_CODES = ['CA', 'FCP', 'FCC', 'AB'];

// Construit la table de présence effective en fusionnant :
//  - la saisie manuelle (presences[iso][interne] = code)
//  - l'auto G (jour de garde) et RS (lendemain de garde)
// Retour : { [iso]: { [interne]: code } }
export function computePresences(gardes, presences, days, internes) {
  const eff = {};
  days.forEach((d) => { eff[d.iso] = {}; });

  // 1) saisie manuelle
  days.forEach((d) => {
    const row = presences?.[d.iso] || {};
    internes.forEach((nom) => {
      if (row[nom]) eff[d.iso][nom] = row[nom];
    });
  });

  // 2) auto G le jour de garde, RS le lendemain
  days.forEach((d, i) => {
    const g = gardes?.[d.iso]?.garde;
    if (g) {
      eff[d.iso][g] = 'G'; // la garde prime sur une saisie P
      const next = days[i + 1];
      if (next && !eff[next.iso][g]) eff[next.iso][g] = 'RS';
      else if (next && eff[next.iso][g] === 'P') eff[next.iso][g] = 'RS';
    }
  });

  return eff;
}

// Un interne est-il "en conflit" un jour donné : de garde ALORS qu'il est marqué absent ?
export function gardeConflit(gardes, presences, iso, interneGarde) {
  if (!interneGarde) return false;
  const manual = presences?.[iso]?.[interneGarde];
  return ABSENT_CODES.includes(manual);
}

// ============================================================
//  STATS "À CE JOUR" (fait vs prévu)
// ============================================================
export function computeStatsProgress(gardes, internes, days, todayIso) {
  const stat = {};
  internes.forEach((nom) => {
    stat[nom] = {
      nom,
      faites: 0, prevues: 0, restantes: 0,       // gardes
      samFait: 0, dimFait: 0, vdFait: 0,
      samPrev: 0, dimPrev: 0, vdPrev: 0,
      repos: 0,
    };
  });
  const byIso = {}; days.forEach((d) => { byIso[d.iso] = d; });

  days.forEach((d, i) => {
    const g = gardes?.[d.iso]?.garde;
    if (g && stat[g]) {
      const passe = d.iso < todayIso; // strictement avant aujourd'hui = fait
      stat[g].prevues++;
      if (passe) stat[g].faites++; else stat[g].restantes++;
      if (d.isSat) { stat[g].samPrev++; if (passe) stat[g].samFait++; }
      if (d.isSun) { stat[g].dimPrev++; if (passe) stat[g].dimFait++; }
      if (isVplusD(gardes, d, byIso)) { stat[g].vdPrev++; if (passe) stat[g].vdFait++; }
    }
  });
  // repos = lendemains de garde (total prévu)
  for (let i = 1; i < days.length; i++) {
    const rep = gardes?.[days[i - 1].iso]?.garde;
    if (rep && stat[rep]) stat[rep].repos++;
  }
  return stat;
}

// ============================================================
//  RÉPARTITION AUTOMATIQUE (avec règles)
//  Règles : pas 2 gardes de suite, max/mois, max/semestre,
//           équilibrage global + équilibrage des week-ends,
//           éviter les jours où l'interne est absent (manuel).
// ============================================================
export function autoDistribute(days, internes, opts = {}) {
  const { presences = {}, maxMoisDefault = 5, maxSemDefault = 25, seed = Date.now() } = opts;
  // PRNG déterministe (mulberry32)
  let s = seed >>> 0;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const names = internes.map((i) => i.nom);
  const maxMois = Object.fromEntries(internes.map((i) => [i.nom, i.maxMois ?? maxMoisDefault]));
  const maxSem = Object.fromEntries(internes.map((i) => [i.nom, i.maxSem ?? maxSemDefault]));

  const cntSem = Object.fromEntries(names.map((n) => [n, 0]));
  const cntMois = {}; // `${nom}-${year}-${month}`
  const cntWe = Object.fromEntries(names.map((n) => [n, 0]));
  const result = {}; // iso -> garde
  let prev = null;   // interne de la veille (pour éviter 2 de suite)

  const monthKey = (d, n) => `${n}-${d.year}-${d.month}`;

  days.forEach((d) => {
    // candidats valides
    let cands = names.filter((n) => {
      if (n === prev) return false;                          // pas 2 de suite
      if (cntSem[n] >= maxSem[n]) return false;              // plafond semestre
      if ((cntMois[monthKey(d, n)] || 0) >= maxMois[n]) return false; // plafond mois
      const pcode = presences?.[d.iso]?.[n];
      if (ABSENT_CODES.includes(pcode)) return false;        // absent ce jour
      return true;
    });
    // si personne (contraintes trop serrées), relâcher l'absence puis les plafonds,
    // MAIS jamais le "pas 2 de suite" (doublon physiquement impossible).
    if (cands.length === 0) cands = names.filter((n) => n !== prev && cntSem[n] < maxSem[n]);
    if (cands.length === 0) cands = names.filter((n) => n !== prev); // dernier recours : ignore plafonds
    if (cands.length === 0) { prev = null; return; } // vraiment personne -> jour vide

    // score : moins de gardes = prioritaire ; en WE, moins de WE = prioritaire
    const we = d.isWeekend;
    cands.sort((a, b) => {
      const base = cntSem[a] - cntSem[b];
      if (we && base === 0) return cntWe[a] - cntWe[b];
      if (base !== 0) return base;
      return rnd() - 0.5;
    });
    // prendre parmi les 2 meilleurs (un peu d'aléatoire pour varier)
    const pool = cands.slice(0, Math.min(2, cands.length));
    const pick = pool[Math.floor(rnd() * pool.length)];

    result[d.iso] = pick;
    cntSem[pick]++;
    cntMois[monthKey(d, pick)] = (cntMois[monthKey(d, pick)] || 0) + 1;
    if (we) cntWe[pick]++;
    prev = pick;
  });

  return result; // { iso: nom }
}
