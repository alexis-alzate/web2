import { avatarTone } from '@/lib/avatar';
import { CheckIcon } from '../Icons';
import ShareStoreButton from './ShareStoreButton';

// Cabecera de la tienda de un productor. Recibe todo por props: no lee nada.

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

type ProducerStoreHeroProps = {
  slug: string;
  stageName: string;
  availableCount: number;
};

export default function ProducerStoreHero({ slug, stageName, availableCount }: ProducerStoreHeroProps) {
  const sub = availableCount === 0
    ? 'Tienda abierta'
    : `${availableCount} ${availableCount === 1 ? 'beat disponible' : 'beats disponibles'}`;

  return (
    <header className="pstore-hero">
      <div className="pstore-cover" aria-hidden="true" />
      <div className="pstore-head">
        <span className="pstore-avatar" data-tone={avatarTone(slug)} aria-hidden="true">{initialsOf(stageName)}</span>
        <div className="pstore-id">
          <h1 className="pstore-name">{stageName}</h1>
          <p className="pstore-sub">{sub}</p>
        </div>
        <ShareStoreButton name={stageName} />
      </div>
      <p className="pstore-badge">
        <CheckIcon className="pstore-badge-icon" />
        Aprobado por Lujo Urban
      </p>
    </header>
  );
}
