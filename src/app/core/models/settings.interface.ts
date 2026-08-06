export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  type: SettingType;
  group: string;
  isEditable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationConfig {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
}

export interface SecurityConfig {
  maxLoginAttempts: number;
  sessionTimeout: number;
  passwordMinLength: number;
  requireMfa: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
}
