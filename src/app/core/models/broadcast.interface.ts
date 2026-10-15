// Mismos valores que el backend (NotificationBroadcast, /api/admin/notifications).
export type BroadcastAudience = 'ALL' | 'ROLE' | 'USERS';

export interface Broadcast {
  id: number;
  title: string;
  message: string;
  imageUrl: string | null;
  audience: BroadcastAudience;
  role: string | null;
  recipientsCount: number;
  createdByName: string | null;
  createdAt: string;
}

/** SendBroadcastDto */
export interface SendBroadcast {
  title: string;
  message: string;
  imageUrl?: string;
  audience: BroadcastAudience;
  role?: string;
  userIds?: string[];
}

export const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  ALL: 'Todos los usuarios',
  ROLE: 'Por rol',
  USERS: 'Usuarios específicos',
};
