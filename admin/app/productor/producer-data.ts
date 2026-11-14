import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAccess, type LujoAccessStatus } from '@/lib/auth';
import { producerRepository } from '@/lib/producers';
import { summarizeEarnings, type EarningsSummary } from '@/lib/producers/earnings-summary';
import type { EarningRow, ProducerBeat, ProducerProfile } from '@/lib/producers/types';

// Lo que necesita cualquier pantalla del portal del productor. El layout y cada
// pagina llaman a `loadProducer()`; `cache` hace que en una misma peticion se
// lea una sola vez. La comprobacion de acceso va AQUI (no solo en el layout)
// para que ninguna pagina pueda mostrarse sin pasar por ella.

export type ProducerPortal = {
  status: LujoAccessStatus;
  // null = la cuenta existe pero el productor ya no esta registrado.
  profile: ProducerProfile | null;
  beats: ProducerBeat[];
  earnings: EarningRow[];
  summary: EarningsSummary;
};

export const loadProducer = cache(async (): Promise<ProducerPortal> => {
  const access = await getCurrentAccess();
  if (!access) redirect('/login');
  if (access.role === 'admin') redirect('/');
  if (access.role === 'artist') redirect('/mi-perfil');
  if (access.role !== 'producer' || !access.producerId) redirect('/login?error=access');

  const profile = await producerRepository.findById(access.producerId);
  const usable = profile?.status === 'active' && access.status === 'active';
  if (!usable) {
    return { status: access.status, profile, beats: [], earnings: [], summary: summarizeEarnings([]) };
  }

  // Solo se leen los datos del productor de la SESION, nunca de la peticion.
  const [beats, earnings] = await Promise.all([
    producerRepository.listBeats(access.producerId),
    producerRepository.listEarnings(access.producerId)
  ]);

  return { status: access.status, profile, beats, earnings, summary: summarizeEarnings(earnings) };
});

// Para las paginas: solo devuelve cuando hay un productor activo. En cualquier
// otro caso el layout ya esta mostrando el aviso y la pagina no pinta nada.
export const loadActiveProducer = async () => {
  const portal = await loadProducer();
  if (!portal.profile || portal.status !== 'active' || portal.profile.status !== 'active') return null;
  return { ...portal, profile: portal.profile };
};
