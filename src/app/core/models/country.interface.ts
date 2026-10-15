export interface Country {
  id: number;
  countryCode: string;
  countryName: string;
  language: string;
  countryContinent: string;
  status: boolean;
  stateCode: string;
  dialCode?: string;
  /** Nombre en cada idioma (columna localized_name): { es, en, ... } */
  localizedName?: Record<string, string> | null;
  img: string;
  createdAt: string;
  updatedAt: string;
}
