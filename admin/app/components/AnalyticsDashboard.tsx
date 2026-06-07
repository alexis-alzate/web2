'use client';

import type { ReleaseAnalyticsSummary, ReleaseEventType, DailyStat } from '@/lib/analytics';

type Release = {
  title: string;
  slug: string;
  cover?: string;
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

const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value);

const findRelease = (slug: string, releases: Release[]) =>
  releases.find(release => release.slug === slug);

const KPICard = ({ 
  label, 
  value, 
  suffix = '', 
  tone = 'default' 
}: { 
  label: string; 
  value: string | number; 
  suffix?: string;
  tone?: 'default' | 'green' | 'gold' | 'cyan'
}) => (
  <article className={`analytics-kpi-card ${tone}`}>
    <div className="analytics-kpi-content">
      <span className="analytics-kpi-label">{label}</span>
      <strong className="analytics-kpi-value">
        {typeof value === 'number' ? formatNumber(value) : value}{suffix}
      </strong>
    </div>
    <div className="analytics-kpi-glow" />
  </article>
);

const TrendLine = ({ data }: { data: DailyStat[] }) => {
  const points = data.slice(-14);
  const max = Math.max(1, ...points.map(d => Math.max(d.view, d.interaction)));
  const width = 1000;
  const height = 120; // Reduced height for density
  const padding = 10;
  
  const getX = (i: number) => (i / (points.length - 1)) * width;
  const getY = (val: number) => height - ((val / max) * (height - padding * 2) + padding);

  const viewPath = points.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.view)}`).join(' ');
  const interactionPath = points.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.interaction)}`).join(' ');

  const areaPath = `${viewPath} L ${getX(points.length - 1)} ${height} L 0 ${height} Z`;

  return (
    <article className="analytics-panel trend-panel compact">
      <div className="panel-header">
        <h3>Tendencia Diaria</h3>
        <div className="panel-legend">
          <span className="legend-item views">Visitas</span>
          <span className="legend-item interactions">Interacciones</span>
        </div>
      </div>
      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(57, 255, 99, 0.12)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGradient)" />
          <path d={viewPath} fill="none" stroke="#39ff63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={interactionPath} fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      </div>
    </article>
  );
};

const HeroBarList = ({
  title,
  items,
  releases,
  color = '#39ff63',
  icon
}: {
  title: string;
  items: Array<{ slug: string; count: number }>;
  releases: Release[];
  color?: string;
  icon?: string;
}) => {
  const max = Math.max(1, ...items.map(item => item.count));
  const mainSiteUrl = 'https://www.lujourban.com/';

  return (
    <article className="analytics-panel hero-bars compact">
      <div className="panel-header-simple">
        <div className="title-with-icon">
          {icon && <span className="title-icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        <span className="panel-badge">{items.length}</span>
      </div>
      <div className="hero-bar-stack">
        {items.map((item, i) => {
          const rel = findRelease(item.slug, releases);
          let coverUrl = rel?.cover;
          if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/')) {
            coverUrl = mainSiteUrl + coverUrl;
          }

          return (
            <div className="hero-bar-row" key={item.slug} style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="hero-bar-meta">
                <div className="hero-bar-info">
                  <span className="hero-bar-index">{String(i + 1).padStart(2, '0')}</span>
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="hero-bar-thumb" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  ) : (
                    <div className="hero-bar-thumb-empty">♪</div>
                  )}
                  <span className="hero-bar-name">{rel?.title || item.slug}</span>
                </div>
                <strong className="hero-bar-value">{formatNumber(item.count)}</strong>
              </div>
              <div className="hero-bar-track">
                <div 
                  className="hero-bar-fill" 
                  style={{ 
                    width: `${(item.count / max) * 100}%`,
                    backgroundColor: color
                  }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
};

const ModernDonut = ({ summary }: { summary: ReleaseAnalyticsSummary }) => {
  const total = summary.totals.view + summary.interactionsTotal;
  const radius = 82; // Slightly bigger
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = summary.distribution.filter(d => d.count > 0).map(d => {
    const percent = (d.count / total) * 100;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -offset;
    offset += (percent / 100) * circumference;

    const colors: Record<ReleaseEventType, string> = {
      view: '#39ff63',
      chat_click: '#d4af37',
      status_click: '#00e5ff'
    };

    return { ...d, strokeDasharray, strokeDashoffset, color: colors[d.type as ReleaseEventType] };
  });

  return (
    <article className="analytics-panel donut-panel compact">
      <h3>Distribución de Tráfico</h3>
      <div className="donut-content">
        <div className="donut-svg-wrap">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="16" />
            {segments.map(seg => (
              <circle
                key={seg.type}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                style={{ transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
            ))}
            <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle" className="donut-total">
              {formatNumber(summary.totals.view)}
            </text>
            <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle" className="donut-sub">
              VISITAS TOTALES
            </text>
          </svg>
        </div>
        <div className="donut-legend">
          {summary.distribution.map(d => (
            <div className="donut-legend-item" key={d.type}>
              <span className={`dot ${d.type}`} />
              <div className="legend-label-group">
                <span className="label">{labels[d.type as ReleaseEventType]}</span>
                <strong className="value">{formatNumber(d.count)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
};

const FutureMetrics = () => (
  <article className="analytics-panel future-panel compact">
    <h3>Insights del Roster</h3>
    <div className="future-grid">
      <div className="future-card">
        <div className="future-icon-wrap">🌍</div>
        <div className="future-text">
          <strong>Geografía Global</strong>
          <p>Países y Ciudades</p>
        </div>
      </div>
      <div className="future-card">
        <div className="future-icon-wrap">📱</div>
        <div className="future-text">
          <strong>Tecnología</strong>
          <p>Dispositivos y OS</p>
        </div>
      </div>
    </div>
  </article>
);

export function AnalyticsDashboard({ summary, releases }: AnalyticsDashboardProps) {
  const topReleaseSlug = summary.topViews[0]?.slug;
  const topReleaseTitle = releases.find(r => r.slug === topReleaseSlug)?.title || 'Ninguno';

  return (
    <div className="analytics-container compact fade-in">
      {summary.error && (
        <div className="analytics-error-toast">
          <p>⚠️ {summary.error}</p>
        </div>
      )}

      <section className="analytics-hero-metrics compact">
        <KPICard label="Visitas" value={summary.totals.view} tone="green" />
        <KPICard label="Interacciones" value={summary.interactionsTotal} tone="cyan" />
        <KPICard label="Conversión" value={summary.conversionRate.toFixed(1)} suffix="%" tone="gold" />
        <KPICard label="Top Release" value={topReleaseTitle} tone="gold" />
      </section>

      {!summary.hasData && !summary.error ? (
        <div className="analytics-empty-state">
          <h2>Dashboard en espera de datos</h2>
          <p>La magia musical aparecerá pronto.</p>
        </div>
      ) : (
        <>
          <TrendLine data={summary.dailyStats} />
          
          <div className="analytics-main-grid compact">
            <HeroBarList 
              title="Top Lanzamientos" 
              items={summary.topViews} 
              releases={releases} 
              icon="🔥"
            />
            <div className="analytics-side-stack compact">
              <ModernDonut summary={summary} />
              <FutureMetrics />
            </div>
          </div>
          
          <div className="analytics-secondary-grid compact">
            <HeroBarList 
              title="Engagement: Chat" 
              items={summary.topChatClicks} 
              releases={releases}
              color="#d4af37"
              icon="💬"
            />
            <HeroBarList 
              title="Engagement: Estado" 
              items={summary.topStatusClicks} 
              releases={releases}
              color="#00e5ff"
              icon="📱"
            />
          </div>
        </>
      )}
    </div>
  );
}

