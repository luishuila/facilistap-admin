export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalProviders: number;
  totalEmployees: number;
  totalCategories: number;
  totalPqrs: number;
  totalComplaints: number;
  pqrsByStatus: Record<string, number>;
  complaintsByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
}

export interface KpiData {
  totalUsers: number;
  activeUsers: number;
  totalProviders: number;
  totalEmployees: number;
  totalCategories: number;
  totalComplaints: number;
  complaintsByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
}

export interface Activity {
  id: number;
  description: string;
  userName: string;
  type: string;
  createdAt: string;
}
