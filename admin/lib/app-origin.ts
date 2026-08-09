import { headers } from 'next/headers';

const CANONICAL_ADMIN_ORIGIN = 'https://admin.lujourban.com';

export const getAppOrigin = async () => {
  const configuredUrl = process.env.ADMIN_SITE_URL || process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl);
      if (configured.hostname === 'admin.lujourban.com' || process.env.NODE_ENV !== 'production') {
        return configured.origin;
      }
    } catch {
      // Fall through to the canonical production domain.
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const headerStore = await headers();
    const host = headerStore.get('host');
    const protocol = headerStore.get('x-forwarded-proto') || 'http';
    if (host) return `${protocol}://${host}`;
  }

  return CANONICAL_ADMIN_ORIGIN;
};
