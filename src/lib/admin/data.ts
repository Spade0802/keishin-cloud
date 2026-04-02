/**
 * 管理画面データ取得関数
 *
 * 現在はモックデータを返す。
 * DB接続時はこのファイルの実装を切り替えるだけで対応可能。
 */

import type {
  AdminOrganization,
  AdminUser,
  AdminSimulation,
  AdminStats,
} from './types';

// ---------------------------------------------------------------------------
// モックデータ
// ---------------------------------------------------------------------------

const mockOrganizations: AdminOrganization[] = [
  {
    id: 'org-1',
    name: '株式会社山田建設',
    permitNumber: '国土交通大臣許可（般-4）第12345号',
    registeredAt: '2026-01-15',
    userCount: 5,
    simulationCount: 23,
  },
  {
    id: 'org-2',
    name: '佐藤電気工業株式会社',
    permitNumber: '東京都知事許可（特-3）第67890号',
    registeredAt: '2026-02-03',
    userCount: 3,
    simulationCount: 12,
  },
  {
    id: 'org-3',
    name: '有限会社中村設備',
    permitNumber: '大阪府知事許可（般-5）第11223号',
    registeredAt: '2026-02-20',
    userCount: 2,
    simulationCount: 8,
  },
  {
    id: 'org-4',
    name: '田中建設工業株式会社',
    permitNumber: '国土交通大臣許可（特-2）第44556号',
    registeredAt: '2026-03-01',
    userCount: 8,
    simulationCount: 45,
  },
  {
    id: 'org-5',
    name: '鈴木土木株式会社',
    permitNumber: '埼玉県知事許可（般-4）第78901号',
    registeredAt: '2026-03-10',
    userCount: 4,
    simulationCount: 18,
  },
];

const mockUsers: AdminUser[] = [
  {
    id: 'user-1',
    email: 'yamada@yamada-kensetsu.co.jp',
    name: '山田太郎',
    organizationName: '株式会社山田建設',
    role: 'admin',
    lastLoginAt: '2026-04-01T10:30:00Z',
  },
  {
    id: 'user-2',
    email: 'tanaka@yamada-kensetsu.co.jp',
    name: '田中花子',
    organizationName: '株式会社山田建設',
    role: 'member',
    lastLoginAt: '2026-03-30T14:20:00Z',
  },
  {
    id: 'user-3',
    email: 'sato@sato-denki.co.jp',
    name: '佐藤次郎',
    organizationName: '佐藤電気工業株式会社',
    role: 'admin',
    lastLoginAt: '2026-04-02T09:00:00Z',
  },
  {
    id: 'user-4',
    email: 'nakamura@nakamura-setsubi.co.jp',
    name: '中村三郎',
    organizationName: '有限会社中村設備',
    role: 'admin',
    lastLoginAt: '2026-03-28T16:45:00Z',
  },
  {
    id: 'user-5',
    email: 'suzuki@suzuki-doboku.co.jp',
    name: '鈴木四郎',
    organizationName: '鈴木土木株式会社',
    role: 'admin',
    lastLoginAt: null,
  },
  {
    id: 'user-6',
    email: 'takahashi@tanaka-kensetsu.co.jp',
    name: '高橋五郎',
    organizationName: '田中建設工業株式会社',
    role: 'admin',
    lastLoginAt: '2026-04-01T08:15:00Z',
  },
  {
    id: 'user-7',
    email: 'ito@tanaka-kensetsu.co.jp',
    name: '伊藤六子',
    organizationName: '田中建設工業株式会社',
    role: 'member',
    lastLoginAt: '2026-03-31T11:00:00Z',
  },
];

const mockSimulations: AdminSimulation[] = [
  {
    id: 'sim-1',
    createdAt: '2026-04-02T09:15:00Z',
    organizationName: '佐藤電気工業株式会社',
    fiscalYear: '第36期',
    mainIndustry: '電気',
    pScore: 987,
  },
  {
    id: 'sim-2',
    createdAt: '2026-04-01T14:30:00Z',
    organizationName: '株式会社山田建設',
    fiscalYear: '第52期',
    mainIndustry: '土木一式',
    pScore: 812,
  },
  {
    id: 'sim-3',
    createdAt: '2026-04-01T10:00:00Z',
    organizationName: '田中建設工業株式会社',
    fiscalYear: '第28期',
    mainIndustry: '建築一式',
    pScore: 1054,
  },
  {
    id: 'sim-4',
    createdAt: '2026-03-31T16:20:00Z',
    organizationName: '有限会社中村設備',
    fiscalYear: '第15期',
    mainIndustry: '管',
    pScore: 732,
  },
  {
    id: 'sim-5',
    createdAt: '2026-03-30T11:45:00Z',
    organizationName: '鈴木土木株式会社',
    fiscalYear: '第41期',
    mainIndustry: '舗装',
    pScore: 665,
  },
  {
    id: 'sim-6',
    createdAt: '2026-03-29T09:30:00Z',
    organizationName: '株式会社山田建設',
    fiscalYear: '第52期',
    mainIndustry: '電気',
    pScore: 845,
  },
  {
    id: 'sim-7',
    createdAt: '2026-03-28T15:00:00Z',
    organizationName: '田中建設工業株式会社',
    fiscalYear: '第28期',
    mainIndustry: '鋼構造物',
    pScore: 921,
  },
  {
    id: 'sim-8',
    createdAt: '2026-03-27T10:20:00Z',
    organizationName: '佐藤電気工業株式会社',
    fiscalYear: '第36期',
    mainIndustry: '電気通信',
    pScore: 733,
  },
];

// ---------------------------------------------------------------------------
// データ取得関数（将来 DB に切り替え可能）
// ---------------------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  return {
    totalOrganizations: mockOrganizations.length,
    totalUsers: mockUsers.length,
    monthlySimulations: mockSimulations.filter((s) => {
      const d = new Date(s.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    recentActiveUsers: mockUsers.filter((u) => u.lastLoginAt !== null).length,
  };
}

export async function getOrganizations(): Promise<AdminOrganization[]> {
  return mockOrganizations;
}

export async function getOrganization(
  id: string,
): Promise<AdminOrganization | undefined> {
  return mockOrganizations.find((o) => o.id === id);
}

export async function getUsers(): Promise<AdminUser[]> {
  return mockUsers;
}

export async function getUsersByOrganization(
  orgName: string,
): Promise<AdminUser[]> {
  return mockUsers.filter((u) => u.organizationName === orgName);
}

export async function getSimulations(): Promise<AdminSimulation[]> {
  return mockSimulations;
}

export async function getSimulationsByOrganization(
  orgName: string,
): Promise<AdminSimulation[]> {
  return mockSimulations.filter((s) => s.organizationName === orgName);
}
