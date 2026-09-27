import { LocalizedText } from './category.interface';

export interface Subcategory {
  id: number;
  name: LocalizedText;
  description: LocalizedText;
  img: string | null;
  isActive: boolean;
  categoryId: number | null;
  categoryName: LocalizedText;
  createdAt: string;
  updatedAt: string;
}

export interface SubcategoryPayload {
  name: LocalizedText;
  description: LocalizedText;
  img: string | null;
  categoryId: number;
  isAssete?: boolean;
}
