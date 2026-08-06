export interface Provider {
  id: number;
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string | null;
  contactPerson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
