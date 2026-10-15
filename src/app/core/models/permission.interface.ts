export interface Permission {
  id: number;
  name: string;
  description: string;
  module: string;
  /** 'panel.<modulo>' en los permisos de acceso a los modulos del panel. */
  slug?: string | null;
  action: string;
  rolesCount: number;
  createdAt: string;
  updatedAt: string;
}
