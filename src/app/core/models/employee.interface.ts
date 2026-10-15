export interface Employee {
  id: number;
  userId: number;
  usersId?: string;
  providersId?: number;
  providerName?: string | null;
  userFullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position?: string | null;
  employeeCode?: string | null;
  roleId: number;
  roleName: string;
  isActive: boolean;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}
