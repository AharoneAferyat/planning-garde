// Génère un fichier .ics (calendrier) à partir des gardes d'un interne (ou toutes).
// Compatible Google Agenda / Apple Calendar / Outlook.

function pad(n) { return String(n).padStart(2, '0'); }

// date ISO (yyyy-mm-dd) -> format ICS date (yyyymmdd)
function icsDate(iso) {
  return iso.replace(/-/g, '');
}

function escapeText(s = '') {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// gardes: { iso: { garde: nom } } ; filtreNom optionnel (ne garder que ses gardes)
export function buildICS(gardes, planningNom, filtreNom = null) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planning Garde//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText('Gardes — ' + (planningNom || ''))}`,
  ];

  Object.entries(gardes || {}).forEach(([iso, g]) => {
    const nom = g?.garde;
    if (!nom) return;
    if (filtreNom && nom !== filtreNom) return;
    // événement "journée entière" : DTEND = lendemain
    const [y, m, d] = iso.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const endIso = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${iso}-${escapeText(nom)}@planning-garde`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(iso)}`,
      `DTEND;VALUE=DATE:${icsDate(endIso)}`,
      `SUMMARY:${escapeText('Garde' + (filtreNom ? '' : ' — ' + nom))}`,
      `DESCRIPTION:${escapeText('Planning : ' + (planningNom || ''))}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// Déclenche le téléchargement d'un .ics
export function downloadICS(content, filename = 'gardes.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
