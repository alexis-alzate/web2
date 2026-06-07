import type { ReleaseAnalyticsSummary, ReleaseEventType } from '@/lib/analytics';

type Release = {
  title: string;
  slug: string;
};

type AnalyticsDashboardProps = {
  summary: ReleaseAnalyticsSummary;
  releases: Release[];
};

const labels: Record<ReleaseEventType, string> = {
  view: 'Visitas',
  chat_click: 'Chat',
  status_click: 'Estado'
};

const eventClasses: Record<ReleaseEventType, string> = {
  view: 'views',
  chat_click: 'chat',
  status_click: 'status'
};

const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value);

const releaseName = (slug: string, releases: Release[]) =>
  releases.find(release => release.slug === slug)?.title || slug;

const MetricCard = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <article className={`analytics-metric ${tone}`}>
    <span>{label}</span>
    <strong>{formatNumber(value)}</strong>
  </article>
);

const BarList = ({
  title,
  items,
  releases
}: {
  title: string;
  items: Array<{ slug: string; count: number }>;
  releases: Release[];
}) => {
  const max = Math.max(1, ...items.map(item => item.count));

  return (
    <article className="analytics-panel">
      <h3>{title}</h3>
      {items.length ? (
        <div className="analytics-bars">
          {items.map(item => (
            <div className="analytics-bar-row" key={item.slug}>
              <div className="analytics-bar-meta">
                <span>{releaseName(item.slug, releases)}</span>
                <strong>{formatNumber(item.count)}</strong>
              </div>
              <div className="analytics-bar-track" aria-hidden="true">
                <span style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="analytics-empty-text">Aun no hay datos para esta grafica.</p>
      )}
    </article>
  );
};

const InteractionDonut = ({ summary }: { summary: ReleaseAnalyticsSummary }) => {
  const total = Math.max(0, summary.interactionsTotal);
  let offset = 0;

  const gradient = total
    ? summary.distribution
      .filter(item => item.count > 0)
      .map(item => {
        const start = offset;
        const end = offset + (item.count / total) * 100;
        offset = end;
        const color = item.type === 'view'
          ? '#39ff63'
          : item.type === 'chat_click'
            ? '#9dffb1'
            : '#ffd46b';
        return `${color} ${start}% ${end}%`;
      })
      .join(', ')
    : 'rgba(255,255,255,.08) 0 100%';

  return (
    <article className="analytics-panel">
      <h3>Distribucion de interacciones</h3>
      <div className="analytics-donut-wrap">
        <div className="analytics-donut" style={{ background: `conic-gradient(${gradient})` }}>
          <span>{formatNumber(total)}</span>
        </div>
        <div className="analytics-legend">
          {summary.distribution.map(item => (
            <div className="analytics-legend-item" key={item.type}>
              <span className={`analytics-dot ${eventClasses[item.type]}`} />
              <span>{labels[item.type]}</span>
              <strong>{formatNumber(item.count)}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
};

export function AnalyticsDashboard({ summary, releases }: AnalyticsDashboardProps) {
  return (
    <div className="analytics-dashboard">
      {summary.error ? (
        <div className="analytics-empty">
          <strong>Analiticas pendientes</strong>
          <p>{summary.error}</p>
        </div>
      ) : null}

      <div className="analytics-metrics">
        <MetricCard label="Visitas totales" value={summary.totals.view} tone="views" />
        <MetricCard label="Clics en chat" value={summary.totals.chat_click} tone="chat" />
        <MetricCard label="Clics en estado" value={summary.totals.status_click} tone="status" />
        <MetricCard label="Interacciones" value={summary.interactionsTotal} tone="total" />
      </div>

      {!summary.hasData && !summary.error ? (
        <div className="analytics-empty">
          <strong>Aun no hay eventos registrados</strong>
          <p>Cuando la landing empiece a recibir visitas y clics, este panel mostrara los datos reales.</p>
        </div>
      ) : null}

      <div className="analytics-grid">
        <BarList title="Lanzamientos mas vistos" items={summary.topViews} releases={releases} />
        <BarList title="Mas clics en chat" items={summary.topChatClicks} releases={releases} />
        <InteractionDonut summary={summary} />
      </div>
    </div>
  );
}

