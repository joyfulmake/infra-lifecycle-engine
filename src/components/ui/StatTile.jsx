// Shared stat-tile primitive — replaces three near-identical implementations
// that had drifted apart (ExecOverview's KpiTile, DependencyGraphTab's
// StatTile, CostTab's StatCard). One component, one set of tokens (see
// .ui-stat-tile in index.css), so new tabs/domains don't invent a fourth.
//
// `tone` maps to a design token color; pass `hex` directly for cases that
// need an exact color (e.g. a domain's own accent, or a role's color).

const TONE_VAR = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  neutral: 'var(--color-neutral)',
  accent: 'var(--app-accent)',
};

export default function StatTile({ label, value, sub, tone = 'neutral', hex, className = '' }) {
  const accent = hex || TONE_VAR[tone] || TONE_VAR.neutral;
  return (
    <div className={`ui-stat-tile flex-1 min-w-24 ${className}`} style={{ '--tile-accent': accent }}>
      <div className="ui-stat-tile-label">{label}</div>
      <div className="ui-stat-tile-value">{value}</div>
      {sub && <div className="ui-stat-tile-sub">{sub}</div>}
    </div>
  );
}
