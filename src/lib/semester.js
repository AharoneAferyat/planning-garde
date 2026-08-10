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
