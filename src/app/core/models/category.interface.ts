export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  isActive: boolean;
  subcategoriesCount: number;
  createdAt: string;
  updatedAt: string;
}
