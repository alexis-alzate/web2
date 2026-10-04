// Raiz de composicion de los artistas: el UNICO lugar que decide que
// implementaciones reales usa el servicio (el equivalente a la configuracion
// de Spring que arma los beans).
//
//   ArtistService
//     ├─ SupabaseArtistRepository  (cliente service_role)
//     ├─ GithubSitePublisher       (API de GitHub)
//     └─ fetchSmartLinkCover       (descarga de portadas)
//
// Quien necesite artistas importa `artistService` desde '@/lib/artists'.

import { commitFiles, readFile, readJson } from '@/lib/github';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { fetchSmartLinkCover } from './images';
import { SupabaseArtistRepository } from './repository';
import { ArtistService } from './service';
import { GithubSitePublisher } from './site-publisher';

export const artistService = new ArtistService(
  new SupabaseArtistRepository(createSupabaseAdminClient),
  new GithubSitePublisher({ readFile, readJson, commitFiles }),
  fetchSmartLinkCover
);

export { applyPortalInput } from './service';
export type { PortalInput, SaveArtistInput, AddReleaseInput } from './service';
export type { ArtistRecord, Roster } from './types';
