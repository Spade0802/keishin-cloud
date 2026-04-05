/**
 * Admin seed script
 *
 * Seeds or updates the initial admin user for KeishinCloud.
 * Uses upsert logic: if the email already exists, updates role to admin.
 */
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';

const ADMIN_NAME = 'KeishinCloud Admin';

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set for admin seeding.'
    );
  }

  const hashedPassword = await hash(adminPassword, 12);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ role: 'admin', password: hashedPassword, name: ADMIN_NAME })
      .where(eq(users.email, adminEmail));
    return { action: 'updated', email: adminEmail };
  }

  await db.insert(users).values({
    email: adminEmail,
    password: hashedPassword,
    name: ADMIN_NAME,
    role: 'admin',
  });
  return { action: 'created', email: adminEmail };
}
