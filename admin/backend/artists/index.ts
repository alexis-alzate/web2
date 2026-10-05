// Raiz de composicion de los artistas: el UNICO lugar que decide que
// implementaciones reales usa el servicio (el equivalente a la configuracion
// de Spring que arma los beans).
//
//   ArtistService
//     ├─ SupabaseArtistRepository  (cliente service_role)
//     ├─ GithubSitePublisher       (API de GitHub)
//     └─ fetchSmartLinkCover       (descarga de portadas)
//
// Quien necesite artistas importa `artistService` desde '@/backend/artists'.

import { commitFiles, readFile, readJson } from '@/backend/integrations/github';
import { createSupabaseAdminClient } from '@/backend/supabase/admin-client';
import { fetchSmartLinkCover } from '@/backend/artists/images';
import { SupabaseArtistRepository } from '@/backend/artists/repository';
import { ArtistService } from '@/backend/artists/service';
import { GithubSitePublisher } from '@/backend/artists/site-publisher';

export const artistService = new ArtistService(
  new SupabaseArtistRepository(createSupabaseAdminClient),
  new GithubSitePublisher({ readFile, readJson, commitFiles }),
  fetchSmartLinkCover
);

export { applyPortalInput } from '@/backend/artists/service';
export type { PortalInput, SaveArtistInput, AddReleaseInput } from '@/backend/artists/service';
export type { ArtistRecord, Roster } from '@/backend/artists/types';
