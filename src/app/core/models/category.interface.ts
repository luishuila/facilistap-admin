/** Texto por idioma, igual al jsonb del backend: { es: 'Belleza', en: 'Beauty' }. */
export type LocalizedText = Partial<Record<CategoryLang, string>>;

export type CategoryLang = 'es' | 'en';

export const CATEGORY_LANGS: { code: CategoryLang; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

export interface Category {
  id: number;
  name: LocalizedText;
  description: LocalizedText;
  img: string | null;
  isActive: boolean;
  subcategoriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryPayload {
  name: LocalizedText;
  description: LocalizedText;
  img: string | null;
  isAsset?: boolean;
}

/** Texto en el idioma pedido, cayendo a español y luego a cualquiera disponible. */
export function localizedText(text: LocalizedText | string | null | undefined, lang: CategoryLang = 'es'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.es || Object.values(text).find((v) => !!v) || '';
}
