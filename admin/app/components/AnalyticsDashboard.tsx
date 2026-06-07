'use client';

import type { ReleaseAnalyticsSummary, DailyStat } from '@/lib/analytics';

type Release = {
  title: string;
  slug: string;
  cover?: string;
};

type AnalyticsDashboardProps = {
  summary: ReleaseAnalyticsSummary;
  releases: Release[];
};

const mainSiteUrl = 'https://www.lujourban.com/';

const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value);

const findRelease = (slug: string, releases: Release[]) =>
  releases.find(release => release.slug === slug);

const resolveCoverUrl = (release?: Release) => {
  let coverUrl = release?.cover;
  if (coverUrl && !coverUrl.startsWith('http') && !coverUrl.startsWith('/')) {
    coverUrl = mainSiteUrl + coverUrl;
  }
  return coverUrl;
};

type PeriodTotals = {
  views: number;
  interactions: number;
  conversionRate: number;
};

const sumPeriod = (rows: DailyStat[]): PeriodTotals => {
  const views = rows.reduce((acc, row) => acc + row.view, 0);
  const interactions = rows.reduce((acc, row) => acc + row.interaction, 0);
  return {
    views,
    interactions,
    conversionRate: views > 0 ? (interactions / views) * 100 : 0
  };
};

const percentChange = (current: number, previous: number) => {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
};

const TrendBadge = ({ delta, unit }: { delta: number; unit: '%' | 'pts' }) => {
  const rounded = Math.round(delta * 10) / 10;
  const tone = rounded > 0.05 ? 'up' : rounded < -0.05 ? 'down' : 'flat';
  const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '·';
  return (
    <span className={`analytics-trend-badge ${tone}`}>
      {arrow} {Math.abs(rounded).toFixed(1)} {unit}
    </span>
  );
};

const Sparkline = ({ data }: { data: DailyStat[] }) => {
  if (data.length < 2) return null;

  const width = 160;
  const height = 28;
  const values = data.map(d => d.view);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const getX = (i: number) => (i / (data.length - 1)) * width;
  const getY = (value: number) => height - ((value - min) / range) * height;

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.view).toFixed(1)}`)
    .join(' ');

  return (
    <svg className="analytics-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const InteractionBreakdown = ({ chatClicks, statusClicks }: { chatClicks: number; statusClicks: number }) => {
  const total = chatClicks + statusClicks;
  if (total <= 0) return null;

  const chatPct = (chatClicks / total) * 100;
  const statusPct = (statusClicks / total) * 100;

  return (
    <div className="analytics-interaction-breakdown">
      <span className="analytics-interaction-bar">
        <span className="analytics-interaction-segment chat" style={{ width: `${chatPct}%` }} />
        <span className="analytics-interaction-segment status" style={{ width: `${statusPct}%` }} />
      </span>
      <div className="analytics-interaction-legend">
        <span><i className="dot chat" />Chat / escuchar · {chatPct.toFixed(0)}%</span>
        <span><i className="dot status" />Estado · {statusPct.toFixed(0)}%</span>
      </div>
    </div>
  );
};

const ReleaseList = ({ stats, releases }: { stats: ReleaseAnalyticsSummary['releases']; releases: Release[] }) => {
  const maxViews = Math.max(1, ...stats.map(item => item.views));

  return (
    <article className="analytics-panel">
      <h3>Lanzamientos</h3>
      <ol className="analytics-release-list">
        {stats.map((item, index) => {
          const release = findRelease(item.slug, releases);
          const coverUrl = resolveCoverUrl(release);
          const isTop = index === 0;
          const barWidth = (item.views / maxViews) * 100;

          return (
            <li className="analytics-release-row" key={item.slug}>
              <span className={`analytics-release-rank${isTop ? ' is-top' : ''}`}>
                {isTop ? '★' : index + 1}
              </span>
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="analytics-release-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="analytics-release-cover analytics-release-cover-empty">♪</span>
              )}
              <div className="analytics-release-info">
                <span className="analytics-release-title">{release?.title || item.slug}</span>
                <span className="analytics-release-stats">
                  {formatNumber(item.views)} visitas · {item.conversionRate.toFixed(1)}% conversión
                </span>
                <span className="analytics-release-bar-track">
                  <span
                    className={`analytics-release-bar-fill${isTop ? ' is-top' : ''}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
};

export function AnalyticsDashboard({ summary, releases }: AnalyticsDashboardProps) {
  const days = summary.dailyStats;
  const half = Math.floor(days.length / 2);
  const previousPeriod = sumPeriod(days.slice(0, half));
  const currentPeriod = sumPeriod(days.slice(half));
  const periodDays = days.length - half;
  const viewsDelta = percentChange(currentPeriod.views, previousPeriod.views);
  const conversionDelta = currentPeriod.conversionRate - previousPeriod.conversionRate;

  return (
    <div className="analytics-container fade-in">
      {summary.error && (
        <div className="analytics-error-toast">
          <p>⚠️ {summary.error}</p>
        </div>
      )}

      {!summary.hasData && !summary.error ? (
        <div className="analytics-empty-state">
          <h2>Todavía no hay datos</h2>
          <p>Las visitas e interacciones aparecerán aquí en cuanto empiecen a registrarse.</p>
        </div>
      ) : (
        <div className="analytics-grid">
          <article className="analytics-kpi-card">
            <span className="analytics-kpi-label">Visitas · últimos {periodDays} días</span>
            <div className="analytics-kpi-row">
              <strong className="analytics-kpi-value">{formatNumber(currentPeriod.views)}</strong>
              <TrendBadge delta={viewsDelta} unit="%" />
            </div>
            <Sparkline data={days.slice(half)} />
            <span className="analytics-kpi-context">
              {formatNumber(previousPeriod.views)} en los {periodDays} días anteriores
            </span>
          </article>

          <article className="analytics-kpi-card">
            <span className="analytics-kpi-label">Conversión · últimos {periodDays} días</span>
            <div className="analytics-kpi-row">
              <strong className="analytics-kpi-value">{currentPeriod.conversionRate.toFixed(1)}%</strong>
              <TrendBadge delta={conversionDelta} unit="pts" />
            </div>
            <InteractionBreakdown
              chatClicks={summary.totals.chat_click}
              statusClicks={summary.totals.status_click}
            />
            <span className="analytics-kpi-context">
              {formatNumber(currentPeriod.interactions)} interacciones de {formatNumber(currentPeriod.views)} visitas
            </span>
          </article>

          <ReleaseList stats={summary.releases} releases={releases} />
        </div>
      )}
    </div>
  );
}
