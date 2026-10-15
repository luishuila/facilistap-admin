export interface City {
  id: number;
  cityName: string;
  stateCode: string;
  /** Del departamento (los trae GET /api/cities). */
  stateName?: string | null;
  countryCode?: string | null;
  stateCountryId: number;
  /** Nombre en cada idioma (columna localized_name): { es, en, ... } */
  localizedName?: Record<string, string> | null;
  code: string;
  status: boolean;
  language: string;
  createdAt: string;
  updatedAt: string;
}
