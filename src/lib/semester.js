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

// Fin du semestre = dimanche précédant le 1er lundi du mois de départ du
// semestre SUIVANT. (Mai-Oct finit le dimanche avant le 1er lundi de novembre.)
export function semesterEnd(annee, type) {
  // mois de départ du semestre suivant
  const nextStartMonth = type === 'nov' ? 5 : 11;
  const nextYear = type === 'nov' ? annee + 1 : annee;
  const firstMonday = new Date(nextYear, nextStartMonth - 1, 1);
  while (firstMonday.getDay() !== 1) firstMonday.setDate(firstMonday.getDate() + 1);
  // dimanche juste avant
  const end = new Date(firstMonday);
  end.setDate(end.getDate() - 1);
  return end;
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
  { code: 'P', label: 'Présent', color: '#cffafe', text: '#0e7490' },
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

// ============================================================
//  JOURS FÉRIÉS (France métropole) — calcul dynamique
// ============================================================
// Dimanche de Pâques (algorithme de Meeus/Butcher).
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }

// Renvoie un Set d'ISO des 11 fériés nationaux pour une année.
export function frenchHolidays(year) {
  const easter = easterSunday(year);
  const list = [
    new Date(year, 0, 1),    // Jour de l'an
    addDays(easter, 1),      // Lundi de Pâques
    new Date(year, 4, 1),    // Fête du travail
    new Date(year, 4, 8),    // Victoire 1945
    addDays(easter, 39),     // Ascension
    addDays(easter, 50),     // Lundi de Pentecôte
    new Date(year, 6, 14),   // Fête nationale
    new Date(year, 7, 15),   // Assomption
    new Date(year, 10, 1),   // Toussaint
    new Date(year, 10, 11),  // Armistice 1918
    new Date(year, 11, 25),  // Noël
  ];
  return new Set(list.map((d) => isoDate(d)));
}
// Noms des fériés (pour tooltip).
export function holidayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const year = y;
  const easter = easterSunday(year);
  const map = {
    [isoDate(new Date(year, 0, 1))]: "Jour de l'an",
    [isoDate(addDays(easter, 1))]: 'Lundi de Pâques',
    [isoDate(new Date(year, 4, 1))]: 'Fête du travail',
    [isoDate(new Date(year, 4, 8))]: 'Victoire 1945',
    [isoDate(addDays(easter, 39))]: 'Ascension',
    [isoDate(addDays(easter, 50))]: 'Lundi de Pentecôte',
    [isoDate(new Date(year, 6, 14))]: 'Fête nationale',
    [isoDate(new Date(year, 7, 15))]: 'Assomption',
    [isoDate(new Date(year, 10, 1))]: 'Toussaint',
    [isoDate(new Date(year, 10, 11))]: 'Armistice 1918',
    [isoDate(new Date(year, 11, 25))]: 'Noël',
  };
  return map[iso] || '';
}

// ============================================================
//  VALORISATION : semaine 1× · samedi 1,5× · dim/férié 2×
// ============================================================
export function gardeValue(day, holidaysSet) {
  const ferie = holidaysSet ? holidaysSet.has(day.iso) : false;
  if (day.isSun || ferie) return 2;
  if (day.isSat) return 1.5;
  return 1;
}

// Ajoute isHoliday + value à chaque jour du semestre.
export function semesterDaysValued(annee, type) {
  const days = semesterDays(annee, type);
  const years = [...new Set(days.map((d) => d.year))];
  const holi = new Set();
  years.forEach((y) => frenchHolidays(y).forEach((iso) => holi.add(iso)));
  days.forEach((d) => {
    d.isHoliday = holi.has(d.iso);
    d.value = gardeValue(d, holi);
  });
  return { days, holidays: holi };
}

// ============================================================
//  RÉPARTITION AUTO MULTI-CRITÈRES
//  Équilibre simultanément : nb de gardes, total de points (valorisation),
//  et nb de week-ends/fériés "lourds". Jamais 2 de suite. Respecte plafonds
//  et absences (manuel). On modifie ensuite à la main si besoin.
// ============================================================
export function autoDistributeV2(days, internes, opts = {}) {
  const { presences = {}, holidays = new Set(), maxMoisDefault = 5, maxSemDefault = 25, seed = Date.now() } = opts;
  let s = seed >>> 0;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const names = internes.map((i) => i.nom);
  const maxMois = Object.fromEntries(internes.map((i) => [i.nom, i.maxMois ?? maxMoisDefault]));
  const maxSem = Object.fromEntries(internes.map((i) => [i.nom, i.maxSem ?? maxSemDefault]));

  // compteurs par personne
  const cntSem = Object.fromEntries(names.map((n) => [n, 0]));   // total gardes
  const pts = Object.fromEntries(names.map((n) => [n, 0]));      // points
  const cat = Object.fromEntries(names.map((n) => [n, { ferie: 0, dim: 0, sam: 0 }])); // par catégorie
  const cntMois = {};
  const result = {};
  const assignedBy = {}; // iso -> nom (pour recalcul V+D)
  const monthKey = (d, n) => `${n}-${d.year}-${d.month}`;

  // classe chaque jour par "préciosité" : férié > dimanche > samedi > semaine.
  // On attribue les jours les plus précieux EN PREMIER pour garantir leur équité,
  // et à l'intérieur d'une catégorie on répartit également.
  const rank = (d) => {
    if (holidays.has(d.iso)) return 0; // férié = le plus précieux
    if (d.isSun) return 1;
    if (d.isSat) return 2;
    return 3; // semaine
  };
  const catKey = (d) => {
    if (holidays.has(d.iso)) return 'ferie';
    if (d.isSun) return 'dim';
    if (d.isSat) return 'sam';
    return null;
  };

  // on garde l'ordre chronologique dans chaque groupe (pour la règle "pas 2 de suite")
  const groups = [[], [], [], []];
  days.forEach((d) => groups[rank(d)].push(d));

  const isAdjacent = (iso, nom) => {
    // interdit d'être de garde 2 jours consécutifs
    const prev = shiftIso(iso, -1);
    const next = shiftIso(iso, 1);
    return assignedBy[prev] === nom || assignedBy[next] === nom;
  };

  const assignGroup = (group) => {
    group.forEach((d) => {
      const val = holidays.has(d.iso) || d.isSun ? 2 : d.isSat ? 1.5 : 1;
      const ck = catKey(d);

      let cands = names.filter((n) => {
        if (isAdjacent(d.iso, n)) return false;
        if (cntSem[n] >= maxSem[n]) return false;
        if ((cntMois[monthKey(d, n)] || 0) >= maxMois[n]) return false;
        if (ABSENT_CODES.includes(presences?.[d.iso]?.[n])) return false;
        return true;
      });
      if (cands.length === 0) cands = names.filter((n) => !isAdjacent(d.iso, n) && cntSem[n] < maxSem[n]);
      if (cands.length === 0) cands = names.filter((n) => !isAdjacent(d.iso, n));
      if (cands.length === 0) return;

      // Priorité : équilibrer d'abord la CATÉGORIE du jour (fériés entre eux,
      // dimanches entre eux, etc.), puis les points, puis le nb total de gardes.
      cands.sort((a, b) => {
        if (ck) { const dc = cat[a][ck] - cat[b][ck]; if (dc !== 0) return dc; }
        const dp = pts[a] - pts[b]; if (Math.abs(dp) > 0.01) return dp;
        const dg = cntSem[a] - cntSem[b]; if (dg !== 0) return dg;
        return rnd() - 0.5;
      });
      // un peu d'aléatoire parmi les ex-æquo du meilleur score
      const best = cands[0];
      const bestScore = ck ? cat[best][ck] : cntSem[best];
      const tied = cands.filter((n) => (ck ? cat[n][ck] : cntSem[n]) === bestScore);
      const pick = tied[Math.floor(rnd() * tied.length)];

      result[d.iso] = pick;
      assignedBy[d.iso] = pick;
      cntSem[pick] += 1;
      pts[pick] += val;
      if (ck) cat[pick][ck] += 1;
      cntMois[monthKey(d, pick)] = (cntMois[monthKey(d, pick)] || 0) + 1;
    });
  };

  // Ordre : fériés, dimanches, samedis, puis semaine.
  groups.forEach(assignGroup);

  return result;
}

// décale un ISO de n jours
function shiftIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoDate(dt);
}

// Stats de points par interne (pour affichage).
export function computePoints(gardes, internes, days, holidaysSet) {
  const pts = Object.fromEntries(internes.map((n) => [n, { total: 0, sem: 0, sam: 0, dim: 0, ferie: 0 }]));
  days.forEach((d) => {
    const g = gardes?.[d.iso]?.garde;
    if (!g || !pts[g]) return;
    const ferie = holidaysSet.has(d.iso);
    if (ferie) { pts[g].total += 2; pts[g].ferie += 1; }
    else if (d.isSun) { pts[g].total += 2; pts[g].dim += 1; }
    else if (d.isSat) { pts[g].total += 1.5; pts[g].sam += 1; }
    else { pts[g].total += 1; pts[g].sem += 1; }
  });
  return pts;
}
