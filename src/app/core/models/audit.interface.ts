export interface Audit {
  id: number;
  userId: string;
  userName: string;
  action: string;
  module: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}
