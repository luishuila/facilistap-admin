export interface Employee {
  id: number;
  userId: number;
  userFullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: number;
  roleName: string;
  isActive: boolean;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}
