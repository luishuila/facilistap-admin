export interface StateCountry {
  id: number;
  stateCode: string;
  stateName: string;
  regionState: string;
  /** Nombre en cada idioma (columna localized_name): { es, en, ... } */
  localizedName?: Record<string, string> | null;
  countryCode: string;
  code: string;
  status: boolean;
  img: string;
  createdAt: string;
  updatedAt: string;
}
