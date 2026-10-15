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
