// Tipos y puertos de los productores. Aqui no hay Supabase ni Next: solo la
// forma de los datos y lo que las implementaciones deben cumplir.

export type ProducerStatus = 'active' | 'inactive';
export type BeatStatus = 'available' | 'sold_exclusive';
export type EarningStatus = 'pending' | 'paid' | 'cancelled';
export type LicenseKind = 'basic' | 'premium' | 'exclusive';

export interface ProducerProfile {
  id: string;
  stageName: string;
  email: string;
  // Lo que se queda Lujo Urban. El productor recibe el resto.
  commissionPercent: number;
  status: ProducerStatus;
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
}

export interface ProducerRepository {
  findById(id: string): Promise<ProducerProfile | null>;
  listBeats(producerId: string): Promise<ProducerBeat[]>;
  listEarnings(producerId: string): Promise<EarningRow[]>;
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
  send(input: { email: string; stageName: string; link: string }): Promise<void>;
}

// Lo que el panel muestra del acceso de un productor.
export interface ProducerAccessInfo {
  userId: string;
  email: string | null;
  status: AccessStatus;
  // false = invitacion enviada y todavia sin crear la clave.
  confirmed: boolean;
}
