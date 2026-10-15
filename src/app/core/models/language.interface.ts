/** Fila de la tabla `languages` del backend (api/language). */
export interface Language {
  id: number;
  /** Codigo ISO 639-1: 'es', 'en'... Es la clave usada en los localized_name. */
  code: string;
  /** Nombre en su propio idioma: "Español", "English". */
  name: string;
  /** Nombre en el idioma de la peticion (lo calcula el backend). */
  label?: string;
  localizedName: Record<string, string> | null;
  flag: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

/** CreateLanguageDto / UpdateLanguageDto (en la edicion `code` no se envia). */
export interface SaveLanguage {
  code?: string;
  name: string;
  localizedName?: Record<string, string> | null;
  flag?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

/** Nombre traducido guardado como jsonb: { "es": "Alemania", "en": "Germany" }. */
export type LocalizedName = Record<string, string>;
