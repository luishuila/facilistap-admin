export interface UserRole {
  id?: number;
  idRol: number;
  name: string;
  role: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  lastname: string;
  uiid: string;
  img: string;
  email?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  birth?: string;
  roles: UserRole[];
  fullName?: string;
  firstName?: string;
  lastName?: string;
  roleName?: string;
  roleId?: number;
  isActive?: boolean;
  isBlocked?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}
