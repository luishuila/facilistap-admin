export interface Permission {
  id: number;
  name: string;
  description: string;
  module: string;
  action: string;
  rolesCount: number;
  createdAt: string;
  updatedAt: string;
}
