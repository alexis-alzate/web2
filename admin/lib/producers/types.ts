// Tipos y puertos de los productores. Aqui no hay Supabase ni Next: solo la
// forma de los datos y lo que las implementaciones deben cumplir.

export type ProducerStatus = 'active' | 'inactive';
export type BeatStatus = 'available' | 'sold_exclusive';
export type EarningStatus = 'pending' | 'paid' | 'cancelled';
export type LicenseKind = 'basic' | 'premium' | 'exclusive';
export type PayoutMethod = 'nequi' | 'daviplata' | 'bancolombia' | 'otro';

// Donde recibe su plata el productor. Lo escribe el, desde su portal.
export interface PayoutDetails {
  method: PayoutMethod;
  // Celular (Nequi/Daviplata), numero de cuenta (Bancolombia) o texto libre (otro).
  account: string;
  // Nombre del titular: sirve para comprobar que se paga a la persona correcta.
  holder: string;
}

export interface ProducerProfile {
  id: string;
  stageName: string;
  email: string;
  // Direccion de su tienda: tienda.lujourban.com/productor/<slug>.
  slug: string | null;
  // Lo que se queda Lujo Urban. El productor recibe el resto.
  commissionPercent: number;
  status: ProducerStatus;
  // Descripcion corta (maximo 160 caracteres) y ruta de su foto en el
  // almacenamiento. Los dos se muestran en su tienda publica.
  bio: string | null;
  photoPath: string | null;
  // null = todavia no dijo como quiere recibir su pago.
  payout: PayoutDetails | null;
}

export interface ProducerBeat {
  id: string;
  slug: string;
  title: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  status: BeatStatus;
  // Ruta de la portada dentro del almacenamiento (no la direccion completa).
  coverPath: string | null;
  createdAt: string;
}

export interface EarningRow {
  id: string;
  beatTitle: string | null;
  license: LicenseKind;
  grossAmount: number;
  platformFeeAmount: number;
  producerAmount: number;
  status: EarningStatus;
  createdAt: string;
  // Dia desde el cual esta venta se puede pagar (la compra + los dias de espera).
  availableAt: string;
}

// Un pago real que Lujo Urban le hizo a un productor.
export interface PayoutRow {
  id: string;
  producerId: string;
  // Solo la usa el panel (el portal ya sabe quien es el productor).
  producerName: string | null;
  amount: number;
  earningsCount: number;
  // Copia de la cuenta a la que se envio, tal como estaba ese dia.
  method: PayoutMethod;
  account: string;
  holder: string | null;
  reference: string;
  paidBy: string;
  paidAt: string;
}

// Lo que el panel muestra de cada productor para decidir si pagarle.
export interface PendingTotal {
  // Todo lo pendiente (liberado + en espera).
  amount: number;
  count: number;
  // Lo que ya se puede pagar hoy.
  availableAmount: number;
  availableCount: number;
  // Lo que todavia esta en los dias de espera y cuando se libera lo primero.
  holdingAmount: number;
  nextReleaseAt: string | null;
}

export interface PayoutResult {
  payoutId: string;
  amount: number;
  earningsCount: number;
}

// Aviso al productor de que se le pago.
export interface PayoutNotice {
  email: string;
  stageName: string;
  amount: number;
  earningsCount: number;
  method: PayoutMethod;
  // Cuenta completa: el correo solo muestra una pista (ultimos 4 digitos).
  account: string;
  reference: string;
}

export interface PayoutMailer {
  send(notice: PayoutNotice): Promise<void>;
}

export interface ProducerRepository {
  findById(id: string): Promise<ProducerProfile | null>;
  listBeats(producerId: string): Promise<ProducerBeat[]>;
  listEarnings(producerId: string): Promise<EarningRow[]>;
  updateProfile(producerId: string, changes: { bio: string | null; photoPath: string | null }): Promise<void>;
  updatePayoutDetails(producerId: string, details: PayoutDetails): Promise<void>;
  listPayouts(producerId: string): Promise<PayoutRow[]>;
  listRecentPayouts(limit: number): Promise<PayoutRow[]>;
  // Lo pendiente de pago por productor (clave = id del productor).
  pendingTotals(): Promise<Map<string, PendingTotal>>;
  // Paga TODO lo liberado del productor en una sola operacion atomica. Si lo
  // liberado no llega a `minAmount`, no paga nada.
  registerPayout(input: {
    producerId: string;
    reference: string;
    paidBy: string;
    expectedAccount: string;
    minAmount: number;
  }): Promise<PayoutResult>;
}

// Puerto sobre el almacenamiento de las fotos de los productores.
export interface ProducerPhotoStore {
  // Guarda la foto y devuelve su ruta (`productores/<id>/foto-<huella>.<ext>`).
  save(producerId: string, image: { extension: 'jpg' | 'png' | 'webp'; contentBase64: string }): Promise<string>;
  // Borra una foto. Quien llama decide si un fallo aqui importa.
  remove(path: string): Promise<void>;
}

// ---- Accesos (cuentas de login) ----

export type AccessStatus = 'active' | 'suspended' | 'inactive';

export interface AccessUser {
  id: string;
  email: string | null;
  confirmed: boolean;
  metadata: Record<string, unknown>;
}

// Puerto sobre el sistema de cuentas (Supabase Auth en produccion).
export interface AccessDirectory {
  list(): Promise<AccessUser[]>;
  // Crea la cuenta pendiente y devuelve el token del enlace de invitacion.
  createInvite(email: string): Promise<{ user: AccessUser; tokenHash: string }>;
  setMetadata(userId: string, metadata: Record<string, unknown>): Promise<void>;
  remove(userId: string): Promise<void>;
}

export interface InviteMailer {
  // Falla pronto (antes de crear nada) si el correo no esta configurado.
  assertReady(): void;
  send(input: { email: string; stageName: string; link: string; storeUrl: string | null }): Promise<void>;
}

// Lo que el panel muestra del acceso de un productor.
export interface ProducerAccessInfo {
  userId: string;
  email: string | null;
  status: AccessStatus;
  // false = invitacion enviada y todavia sin crear la clave.
  confirmed: boolean;
}
