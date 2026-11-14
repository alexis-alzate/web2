import Link from 'next/link';

// Nombre del productor de un beat ("Prod. by X"). Si el productor tiene tienda
// (slug) enlaza a ella; si el beat es de texto libre o el productor esta
// pausado, se muestra como texto plano. Sin estado: sirve en server y client.
export default function ProducerName({ name, slug }: { name: string; slug?: string | null }) {
  if (!slug) return <>{name}</>;
  return (
    <Link href={`/productor/${slug}`} className="producer-link">
      {name}
    </Link>
  );
}
