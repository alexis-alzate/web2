'use client';

import { useEffect } from 'react';
import { ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/admin-session';

export function AutoLogoutTimer() {
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      await fetch('/api/logout', { method: 'POST' }).catch(() => null);
      window.location.assign('/login?error=expired');
    }, ADMIN_SESSION_MAX_AGE_SECONDS * 1000);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
