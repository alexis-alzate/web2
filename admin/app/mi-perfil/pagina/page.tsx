import { PageView } from '../../components/portal/PageView';
import { loadActivePortal, siteImage } from '../portal-data';

export default async function PortalPagePage() {
  const portal = await loadActivePortal();
  if (!portal) return null;

  return <PageView artist={portal.artist} photoUrl={siteImage(portal.artist.photo)} isTestAccount={portal.isTestAccount} />;
}
