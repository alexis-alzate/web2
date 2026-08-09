import { headers } from 'next/headers';

export const getAppOrigin = async () => {
  const configuredUrl = process.env.ADMIN_SITE_URL || process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') || 'https';
  if (!host) throw new Error('No pude determinar la URL del panel.');
  return `${protocol}://${host}`;
};
