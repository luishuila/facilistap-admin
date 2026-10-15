// Mismos nombres y valores que el backend (entidad AppProperty, /api/app-properties).
export type AppPropertyCategory = 'APP' | 'URL' | 'API' | 'VERSION' | 'SECURITY' | 'ENV' | 'OTHER';
export type AppPropertyEnvironment = 'development' | 'staging' | 'production' | 'test';
export type AppPropertyDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface AppProperty {
  id: number;
  key: string;
  /** Ya convertido segun dataType; '***' cuando isSecret. */
  value: unknown;
  description?: string | null;
  category: AppPropertyCategory;
  environment: AppPropertyEnvironment;
  dataType: AppPropertyDataType;
  isPublic: boolean;
  isSecret: boolean;
  isActive: boolean;
  version?: string | null;
}

/** UpdateAppPropertyDto: `value` siempre viaja como string; el backend lo serializa segun dataType. */
export interface UpdateAppProperty {
  value?: string;
  description?: string;
  isActive?: boolean;
}
