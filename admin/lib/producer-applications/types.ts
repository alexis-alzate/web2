// Tipos y puertos de las solicitudes de productor. Aqui no hay Supabase ni Next.

import type { ApplicationInput, ApplicationStatus } from './rules';

export interface ProducerApplication {
  id: string;
  stageName: string;
  email: string;
  musicUrl: string;
  status: ApplicationStatus;
  producerId: string | null;
  createdAt: string;
}

export interface ApplicationRepository {
  // 'duplicate' = ya habia una solicitud con ese correo (no se guarda otra).
  insert(input: ApplicationInput, sourceUrl: string | null): Promise<'created' | 'duplicate'>;
  countSince(sinceIso: string): Promise<number>;
  findById(id: string): Promise<ProducerApplication | null>;
  list(): Promise<ProducerApplication[]>;
  // Cambios de estado atomicos: devuelven false si la solicitud ya no estaba
  // en el estado esperado (alguien la reviso al mismo tiempo).
  claim(id: string): Promise<boolean>;
  release(id: string): Promise<void>;
  attachProducer(id: string, producerId: string): Promise<void>;
  reject(id: string): Promise<boolean>;
}

// Crea (y deshace) la ficha del productor al aprobar.
export interface ProducerRegistry {
  create(input: { stageName: string; email: string; commissionPercent: number }): Promise<string>;
  remove(id: string): Promise<void>;
}

// Lo unico que se necesita del acceso de productores: invitar a un correo.
export interface ProducerInviter {
  invite(producerId: string, email: string): Promise<unknown>;
}
