import { LICENSE_LABELS } from '@/lib/types';
import type { LicenseType } from '@/lib/types';

// Tienda de un productor que todavia no publica beats. No manda al visitante
// al catalogo de otro: la tienda es del productor. Muestra lo que si es real
// de la tienda: que licencias se venden y que trae cada una.

const LICENSES: LicenseType[] = ['basic', 'premium', 'exclusive'];
const WAVE = [34, 58, 44, 78, 52, 92, 64, 40, 70, 48, 30];

export default function ProducerStoreEmpty({ stageName }: { stageName: string }) {
  return (
    <>
      <section className="pstore-soon" aria-label="Tienda sin beats todavía">
        <svg className="pstore-wave" viewBox="0 0 110 100" aria-hidden="true">
          {WAVE.map((height, index) => (
            <rect
              key={index}
              x={index * 10 + 2}
              y={50 - height / 2}
              width="6"
              height={height}
              rx="3"
            />
          ))}
        </svg>
        <h2 className="pstore-soon-title">Los primeros beats llegan pronto</h2>
        <p className="pstore-soon-copy">
          {stageName} ya tiene su tienda abierta en Lujo Urban. Cuando publique, podrás escuchar el preview
          de cada beat y llevártelo al instante.
        </p>
      </section>

      <section className="pstore-licenses" aria-labelledby="pstore-licenses-title">
        <h2 id="pstore-licenses-title" className="pstore-section-title">Licencias</h2>
        <ul className="pstore-license-list">
          {LICENSES.map((license) => (
            <li key={license} className="pstore-license">
              <strong>{LICENSE_LABELS[license].name}</strong>
              <span>{LICENSE_LABELS[license].desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
