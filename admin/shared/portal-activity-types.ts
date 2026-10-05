export const PORTAL_ONLINE_WINDOW_SECONDS = 150;

export type PortalActivityEvent = {
  id: string;
  type: string;
  label: string;
  createdAt: string;
};

export type PortalUserActivity = {
  loginCount: number;
  lastLoginAt: string;
  totalActiveSeconds: number;
  lastSession: {
    id: string;
    startedAt: string;
    lastSeenAt: string;
    endedAt: string | null;
    durationSeconds: number;
    loginMethod: string;
    deviceType: string;
  };
  events: PortalActivityEvent[];
};

export type PortalUserActivityResult = {
  available: boolean;
  byUserId: Record<string, PortalUserActivity>;
};
