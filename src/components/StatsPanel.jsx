import { useMemo } from 'react';
import { computeStats } from '../lib/semester';

export default function StatsPanel({ gardes, internes, months, internesMeta }) {
  const stats = useMemo(
    () => computeStats(gardes, internes, months),
    [gardes, internes, months]
  );

  const maxSemOf = (nom) => {
    const meta = internesMeta.find((i) => i.nom === nom);
    return meta?.maxSem ?? 25;
  };

  const rows = internes.map((nom) => {
    const s = stats[nom] || { gardes: 0, samedis: 0, dimanches: 0, vd: 0, repos: 0 };
    const max = maxSemOf(nom);
    const reste = max - s.gardes;
    let statut = 'ok', label = 'OK';
    if (s.gardes > max) { statut = 'over'; label = 'Dépassé'; }
    else if (s.gardes === max) { statut = 'full'; label = 'Plein'; }
    return { nom, ...s, max, reste, statut, label };
  });

  const totals = rows.reduce((acc, r) => {
    ['gardes', 'samedis', 'dimanches', 'vd', 'repos'].forEach((k) => {
      acc[k] = (acc[k] || 0) + r[k];
    });
    return acc;
  }, {});

  const gardeCounts = rows.map((r) => r.gardes);
  const ecart = gardeCounts.length
    ? Math.max(...gardeCounts) - Math.min(...gardeCounts)
    : 0;

  return (
    <div className="stats-wrap card">
      <div className="card-h">
        Statistiques du semestre
        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--muted)', fontSize: '.82rem' }}>
          Écart max/min de gardes : <b>{ecart}</b>
        </span>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Interne</th>
              <th>Gardes</th>
              <th>Samedis</th>
              <th>Dimanches</th>
              <th>V+D</th>
              <th>Repos</th>
              <th>Max/sem</th>
              <th>Reste</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nom}>
                <td>{r.nom}</td>
                <td>{r.gardes}</td>
                <td>{r.samedis}</td>
                <td>{r.dimanches}</td>
                <td>{r.vd}</td>
                <td>{r.repos}</td>
                <td>{r.max}</td>
                <td>{r.reste}</td>
                <td><span className={`pill ${r.statut}`}>{r.label}</span></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td>{totals.gardes || 0}</td>
                <td>{totals.samedis || 0}</td>
                <td>{totals.dimanches || 0}</td>
                <td>{totals.vd || 0}</td>
                <td>{totals.repos || 0}</td>
                <td colSpan={3}></td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="legend" style={{ padding: '.8rem 1.1rem' }}>
          <b>Gardes</b> = total gardes 24 h &nbsp;·&nbsp;
          <b>Samedis / Dimanches</b> = gardes tombant ce jour &nbsp;·&nbsp;
          <b>V+D</b> = gros week-end (garde vendredi ET dimanche) &nbsp;·&nbsp;
          <b>Repos</b> = lendemains de garde &nbsp;·&nbsp;
          <b>Reste</b> = Max − Gardes.<br />
          Une case garde en <b style={{ color: 'var(--red)' }}>rouge</b> = doublon
          (deux gardes de suite, impossible car repos le lendemain). Codes :
          <b> CA</b> congé, <b>F</b> formation, <b>A</b> absence, <b>AR</b> arrêt.
        </div>
      </div>
    </div>
  );
}
