import Link from 'next/link';
import type { Artist } from '@/lib/artist-renderer';
import type { ArtistStats } from '@/lib/artist-stats';
import { formatNumber, plural } from '@/lib/portal-format';
import type { PortalTodo } from '@/lib/portal-todos';
import { PortalLink } from '../PortalLink';
import { DailyBars } from './DailyBars';

type HomeViewProps = {
  artist: Artist;
  stats: ArtistStats;
  todos: PortalTodo[];
  publicUrl: string;
  coverUrl: string;
  isTestAccount: boolean;
};

const comparison = (stats: ArtistStats) => {
  const diff = stats.visitors - stats.previous.visitors;
  if (stats.previous.visitors === 0) return 'En los 30 días anteriores no hubo visitas.';
  if (diff === 0) return 'Las mismas que en los 30 días anteriores.';
  return diff > 0
    ? `Son ${formatNumber(diff)} más que en los 30 días anteriores.`
    : `Son ${formatNumber(-diff)} menos que en los 30 días anteriores.`;
};

export function HomeView({ artist, stats, todos, publicUrl, coverUrl, isTestAccount }: HomeViewProps) {
  const firstName = (artist.cardName || artist.name).split(/\s+/)[0];
  const hasVisits = !stats.failed && stats.visitors > 0;

  return (
    <>
      <h1 className="pt-title">Hola, {firstName}</h1>

      <section className="pt-pulse">
        {stats.failed ? (
          <p className="pt-pulse-lead">No pudimos cargar tus visitas en este momento. Tu página sigue funcionando normal.</p>
        ) : hasVisits ? (
          <>
            <p className="pt-pulse-lead">
              <b>{formatNumber(stats.visitors)}</b>
              <span>{stats.visitors === 1 ? 'persona vio tu página' : 'personas vieron tu página'} en los últimos {stats.periodDays} días.</span>
            </p>
            <p className="pt-pulse-note">{comparison(stats)}</p>
            <DailyBars days={stats.daily} interactive={false} />
          </>
        ) : (
          <p className="pt-pulse-lead">
            {isTestAccount
              ? 'La cuenta de prueba no tiene página pública, así que no registra visitas.'
              : `Todavía no hay visitas en los últimos ${stats.periodDays} días. Pon tu enlace en la bio y aquí vas a ver cuánta gente entra.`}
          </p>
        )}
        {hasVisits ? (
          <div className="pt-pulse-foot">
            <span>{plural(stats.listens, 'escuchó', 'escucharon')} · {plural(stats.shares, 'compartió', 'compartieron')}</span>
            <Link href="/mi-perfil/estadisticas">Ver estadísticas</Link>
          </div>
        ) : null}
      </section>

      {isTestAccount ? null : <PortalLink url={publicUrl} isShort={Boolean(artist.shortLink)} />}

      {todos.length ? (
        <section className="pt-block">
          <h2 className="pt-h2">Por hacer</h2>
          <ul className="pt-todos">
            {todos.map(todo => (
              <li key={todo.key}>
                <span>{todo.text}</span>
                <Link href={todo.href}>{todo.action}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="pt-block">
        <h2 className="pt-h2">En tu página ahora</h2>
        {artist.release ? (
          <Link href="/mi-perfil/musica" className="pt-now">
            {coverUrl
              ? <img src={coverUrl} alt="" width="64" height="64" />
              : <span className="pt-cover-empty" aria-hidden="true">Sin portada</span>}
            <span className="pt-now-text">
              <strong>{artist.release.title}</strong>
              <small>Tu canción principal</small>
            </span>
            <span className="pt-now-go">Editar</span>
          </Link>
        ) : (
          <p className="pt-empty">
            Todavía no has publicado una canción. <Link href="/mi-perfil/musica">Publica la primera</Link>.
          </p>
        )}
      </section>
    </>
  );
}
