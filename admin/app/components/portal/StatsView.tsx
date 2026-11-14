import type { ArtistStats } from '@/lib/artist-stats';
import { formatNumber } from '@/lib/portal-format';
import { DailyBars } from './DailyBars';
import { SourceVinyl } from './SourceVinyl';

export type StatsSong = {
  slug: string;
  title: string;
  coverUrl: string;
  listens: number;
};

type StatsViewProps = {
  stats: ArtistStats;
  songs: StatsSong[];
  isTestAccount: boolean;
};

const Figure = ({ label, value, previous }: { label: string; value: number; previous: number }) => (
  <div className="pt-figure">
    <strong>{formatNumber(value)}</strong>
    <span>{label}</span>
    <small>Antes: {formatNumber(previous)}</small>
  </div>
);

export function StatsView({ stats, songs, isTestAccount }: StatsViewProps) {
  if (stats.failed || !stats.hasData) {
    return (
      <>
        <h1 className="pt-title">Estadísticas</h1>
        <p className="pt-empty">
          {stats.failed
            ? 'No pudimos cargar tus estadísticas en este momento. Tu página sigue funcionando normal; vuelve a intentarlo más tarde.'
            : isTestAccount
              ? 'La cuenta de prueba no tiene página pública, así que no registra visitas.'
              : `Todavía no hay visitas en los últimos ${stats.periodDays} días. Pon tu enlace en la bio y aquí vas a ver cuánta gente entra, qué escucha y de dónde llega.`}
        </p>
      </>
    );
  }

  const maxLink = Math.max(1, ...stats.links.map(link => link.clicks));
  const maxSong = Math.max(1, ...songs.map(song => song.listens));

  return (
    <>
      <h1 className="pt-title">Estadísticas</h1>
      <p className="pt-period">Últimos {stats.periodDays} días</p>

      <div className="pt-figures">
        <Figure label="Visitas" value={stats.visitors} previous={stats.previous.visitors} />
        <Figure label="Escucharon" value={stats.listens} previous={stats.previous.listens} />
        <Figure label="Compartieron" value={stats.shares} previous={stats.previous.shares} />
      </div>

      <section className="pt-chart">
        <h2 className="pt-h2">Visitas por día</h2>
        <DailyBars days={stats.daily} />
      </section>

      {stats.sources.length ? (
        <section className="pt-chart">
          <h2 className="pt-h2">De dónde llegan</h2>
          <SourceVinyl sources={stats.sources} />
          <p className="pt-chart-note">Quien llega desde WhatsApp suele aparecer como enlace directo.</p>
        </section>
      ) : null}

      <section className="pt-chart">
        <h2 className="pt-h2">Qué enlaces tocan</h2>
        {stats.links.length ? (
          <ul className="pt-rank">
            {stats.links.map(link => (
              <li key={link.key}>
                <span className="pt-rank-name">{link.label}</span>
                <span className="pt-rank-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(3, (link.clicks / maxLink) * 100)}%` }} />
                </span>
                <b>{formatNumber(link.clicks)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-empty">Todavía nadie ha tocado tus redes en estos {stats.periodDays} días.</p>
        )}
      </section>

      {songs.length ? (
        <section className="pt-chart">
          <h2 className="pt-h2">Tus canciones</h2>
          <ul className="pt-rank pt-rank-songs">
            {songs.map(song => (
              <li key={song.slug}>
                {song.coverUrl
                  ? <img src={song.coverUrl} alt="" width="40" height="40" loading="lazy" />
                  : <span className="pt-cover-empty pt-rank-cover" aria-hidden="true" />}
                <span className="pt-rank-name">{song.title}</span>
                <span className="pt-rank-track" aria-hidden="true">
                  <span className={song.listens === 0 ? 'is-zero' : ''} style={{ width: song.listens === 0 ? undefined : `${Math.max(3, (song.listens / maxSong) * 100)}%` }} />
                </span>
                <b>{formatNumber(song.listens)}</b>
              </li>
            ))}
          </ul>
          <p className="pt-chart-note">Personas que tocaron «Escuchar» en cada canción.</p>
        </section>
      ) : null}

      <p className="pt-foot">
        Contamos una visita por persona y por día, y un toque por persona, enlace y día. «Antes» son los {stats.periodDays} días anteriores.
      </p>
    </>
  );
}
