export interface Provider {
  id: number;
  name: string;
  username?: string;
  description: string;
  email: string;
  phone: string;
  logoUrl?: string | null;
  status?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerUsername?: string | null;
  ownerEmail?: string | null;
  categories?: number[];
  address: string | null;
  contactPerson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Sede de un negocio, como la devuelve /admin/providers/:id/branches. */
export interface ProviderBranch {
  id: number;
  name: string;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: string | null;
  employeesCount: number;
  address: { fullAddress: string | null; cityName: string | null } | null;
}
