/** 管理画面で使用する型定義 */

export interface AdminOrganization {
  id: string;
  name: string;
  permitNumber: string;
  registeredAt: string;
  userCount: number;
  simulationCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  organizationName: string;
  role: 'admin' | 'member';
  lastLoginAt: string | null;
  disabledAt: string | null;
}

export interface AdminSimulation {
  id: string;
  createdAt: string;
  organizationName: string;
  fiscalYear: string;
  mainIndustry: string;
  pScore: number;
}

export interface AdminStats {
  totalOrganizations: number;
  totalUsers: number;
  monthlySimulations: number;
  recentActiveUsers: number;
}
