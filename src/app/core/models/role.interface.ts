import { Permission } from './permission.interface';

export interface Role {
  id: number;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}
