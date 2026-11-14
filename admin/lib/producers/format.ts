// Formato de plata y fechas del portal del productor (es-CO).

export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value);

// "14 nov" con la fecha de Colombia.
export const formatSaleDate = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Bogota'
  }).format(new Date(iso)).replace('.', '');
