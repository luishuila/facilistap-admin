export interface Activity {
  id: number;
  description: string;
  userId: number;
  userName: string;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalProviders: number;
  totalEmployees: number;
  totalCategories: number;
  totalPqrs: number;
  pqrsByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  recentActivity: Activity[];
}
