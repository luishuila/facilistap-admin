export enum RoleEnum {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  ADMINISTRATOR = 'ADMINISTRATOR',
  SUPER_ADMIN = 'SUPER_ADMIN',
  CLIENT = 'CLIENT',
  USER = 'USER',
  INDEPENDENT = 'INDEPENDENT',
}

export interface Role {
  idRol: number;
  id: number;
  name: string;
  role: RoleEnum;
  description?: string;
  isSystem?: boolean;
  permissions?: string[];
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
