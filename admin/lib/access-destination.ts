// A donde manda el login a cada tipo de cuenta. Es una regla pura (sin
// cookies ni red) para poder probarla: cada rol entra SOLO a su propia zona.
//
//   admin     -> /            (panel completo)
//   artista   -> /mi-perfil   (su portal)
//   productor -> /productor   (su portal)
//
// `null` significa "esta cuenta no tiene un acceso valido": el login la saca.
// Un artista o productor con el acceso pausado SI entra, para ver el aviso de
// que esta pausado en vez de un error confuso.

import type { LujoAccess } from '@/lib/auth';

type Destinable = Pick<LujoAccess, 'role' | 'status' | 'artistSlug' | 'producerId'>;

export const destinationFor = (access: Destinable | null | undefined): string | null => {
  if (!access) return null;
  if (access.role === 'admin') return access.status === 'active' ? '/' : null;
  if (access.role === 'artist') return access.artistSlug ? '/mi-perfil' : null;
  if (access.role === 'producer') return access.producerId ? '/productor' : null;
  return null;
};
