'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Refresca la pagina cada pocos segundos mientras la orden sigue pendiente,
// para que el comprador vea sus descargas sin recargar a mano.
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return null;
}
