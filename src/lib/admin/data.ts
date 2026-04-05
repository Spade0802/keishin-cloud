/**
 * 管理画面データ取得関数
 *
 * DBから実データを取得する。
 */

import { db } from '@/lib/db';
import { organizations, users, simulations } from '@/lib/db/schema';
import { count, gte, and, eq, sql, desc, isNotNull } from 'drizzle-orm';
import type {
  AdminOrganization,
  AdminUser,
  AdminSimulation,
  AdminStats,
} from './types';

// ---------------------------------------------------------------------------
// データ取得関数（DB実データ）
// ---------------------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [orgCount, userCount, monthlySimCount, activeUserCount, totalSimCount, activeSubCount, recentSignupCount] = await Promise.all([
    db.select({ value: count() }).from(organizations).then((r) => r[0]?.value ?? 0),
    db.select({ value: count() }).from(users).then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(simulations)
      .where(gte(simulations.createdAt, monthStart))
      .then((r) => r[0]?.value ?? 0),
    // Active users: users who have at least one simulation in the last 30 days
    db
      .select({ value: sql<number>`count(distinct ${users.id})` })
      .from(users)
      .innerJoin(simulations, eq(users.id, simulations.userId))
      .where(gte(simulations.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
      .then((r) => Number(r[0]?.value ?? 0)),
    // Total simulation count
    db.select({ value: count() }).from(simulations).then((r) => r[0]?.value ?? 0),
    // Active subscriptions (active or trialing)
    db
      .select({ value: count() })
      .from(organizations)
      .where(
        sql`${organizations.subscriptionStatus} in ('active', 'trialing')`
      )
      .then((r) => r[0]?.value ?? 0),
    // Recent signups (last 7 days)
    db
      .select({ value: count() })
      .from(users)
      .where(gte(users.createdAt, sevenDaysAgo))
      .then((r) => r[0]?.value ?? 0),
  ]);

  return {
    totalOrganizations: orgCount,
    totalUsers: userCount,
    monthlySimulations: monthlySimCount,
    recentActiveUsers: activeUserCount,
    totalSimulations: totalSimCount,
    activeSubscriptions: activeSubCount,
    recentSignups: recentSignupCount,
  };
}

export async function getOrganizations(): Promise<AdminOrganization[]> {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      permitNumber: organizations.permitNumber,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  // Enrich with user/simulation counts
  const result: AdminOrganization[] = [];
  for (const row of rows) {
    const [uc, sc] = await Promise.all([
      db.select({ value: count() }).from(users).where(eq(users.organizationId, row.id)).then((r) => r[0]?.value ?? 0),
      db.select({ value: count() }).from(simulations).where(eq(simulations.organizationId, row.id)).then((r) => r[0]?.value ?? 0),
    ]);
    result.push({
      id: row.id,
      name: row.name,
      permitNumber: row.permitNumber ?? '',
      registeredAt: row.createdAt.toISOString().slice(0, 10),
      userCount: uc,
      simulationCount: sc,
    });
  }
  return result;
}

export async function getOrganization(
  id: string,
): Promise<AdminOrganization | undefined> {
  const orgs = await getOrganizations();
  return orgs.find((o) => o.id === id);
}

export async function getUsers(): Promise<AdminUser[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      organizationId: users.organizationId,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const result: AdminUser[] = [];
  for (const row of rows) {
    let organizationName = '-';
    if (row.organizationId) {
      const org = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, row.organizationId))
        .then((r) => r[0]);
      if (org) organizationName = org.name;
    }
    result.push({
      id: row.id,
      email: row.email ?? '',
      name: row.name ?? '',
      organizationName,
      role: row.role,
      lastLoginAt: null, // Sessions table doesn't track last login timestamp directly
      disabledAt: row.disabledAt?.toISOString() ?? null,
    });
  }
  return result;
}

export async function getUsersByOrganization(
  orgName: string,
): Promise<AdminUser[]> {
  const allUsers = await getUsers();
  return allUsers.filter((u) => u.organizationName === orgName);
}

export async function getSimulations(): Promise<AdminSimulation[]> {
  const rows = await db
    .select({
      id: simulations.id,
      createdAt: simulations.createdAt,
      organizationId: simulations.organizationId,
      name: simulations.name,
      inputData: simulations.inputData,
      resultData: simulations.resultData,
    })
    .from(simulations)
    .orderBy(desc(simulations.createdAt))
    .limit(50);

  const result: AdminSimulation[] = [];
  for (const row of rows) {
    let organizationName = '-';
    if (row.organizationId) {
      const org = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, row.organizationId))
        .then((r) => r[0]);
      if (org) organizationName = org.name;
    }

    // Extract info from inputData/resultData if available
    const input = row.inputData as Record<string, unknown> | null;
    const resultObj = row.resultData as Record<string, unknown> | null;
    const fiscalYear = (input?.period as string) || row.name || '-';
    const mainIndustry = (input?.mainIndustry as string) || '-';
    const pScore = (resultObj?.totalP as number) || 0;

    result.push({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      organizationName,
      fiscalYear,
      mainIndustry,
      pScore,
    });
  }
  return result;
}

export async function getSimulationsByOrganization(
  orgName: string,
): Promise<AdminSimulation[]> {
  const allSims = await getSimulations();
  return allSims.filter((s) => s.organizationName === orgName);
}
