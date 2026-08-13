'use client';

import { useEffect } from 'react';

const HEARTBEAT_INTERVAL_MS = 60_000;

export function PortalActivityTracker() {
  useEffect(() => {
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/activity/heartbeat', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        keepalive: true
      }).catch(() => null);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
