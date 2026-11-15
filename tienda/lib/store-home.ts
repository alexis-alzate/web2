// A donde manda "Volver a la tienda" despues de una compra.
//
// Si TODO lo que se compro es de un solo productor con tienda, vuelve a la
// tienda de ese productor: el cliente lo trajo el, no debe terminar en el
// catalogo general con los beats de otros. Con un carrito mezclado, con beats sin
// productor o con un productor sin tienda (pausado), vuelve al catalogo general.
//
// Funcion pura: recibe los ids de productor de cada beat comprado y el mapa
// id -> slug de los productores activos (`getProducerSlugs`).

export const GENERAL_STORE_HREF = '/';

export function storeHomeHref(
  producerIds: (string | null)[],
  slugsById: ReadonlyMap<string, string>
): string {
  if (producerIds.length === 0) return GENERAL_STORE_HREF;

  const unique = new Set<string>();
  for (const id of producerIds) {
    if (!id) return GENERAL_STORE_HREF;
    unique.add(id);
  }
  if (unique.size !== 1) return GENERAL_STORE_HREF;

  const slug = slugsById.get([...unique][0]);
  return slug ? `/productor/${slug}` : GENERAL_STORE_HREF;
}
