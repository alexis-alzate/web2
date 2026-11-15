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
  // URL completa de la foto (vacio = sin foto: se muestra la inicial) y
  // descripcion corta (null = no puso).
  photoUrl?: string;
  bio?: string | null;
};

export default function ProducerStoreHero({ slug, stageName, availableCount, photoUrl = '', bio = null }: ProducerStoreHeroProps) {
  const sub = availableCount === 0
    ? 'Tienda abierta'
    : `${availableCount} ${availableCount === 1 ? 'beat disponible' : 'beats disponibles'}`;

  return (
    <header className="pstore-hero">
      <div className="pstore-cover" aria-hidden="true" />
      <div className="pstore-head">
        <span className="pstore-avatar" data-tone={avatarTone(slug)} aria-hidden="true">
          {/* La foto llena el mismo circulo de 72 px: no cambia el tamano. */}
          {photoUrl ? <img className="pstore-photo" src={photoUrl} alt="" width="72" height="72" /> : initialsOf(stageName)}
        </span>
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
      {bio ? <p className="pstore-bio">{bio}</p> : null}
    </header>
  );
}
