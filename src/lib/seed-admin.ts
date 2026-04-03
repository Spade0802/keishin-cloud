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

const ADMIN_EMAIL = 'admin@keishin.cloud';
const ADMIN_PASSWORD = 'KeishinAdmin2026!';
const ADMIN_NAME = 'KeishinCloud Admin';

export async function seedAdmin() {
  const hashedPassword = await hash(ADMIN_PASSWORD, 12);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ role: 'admin', password: hashedPassword, name: ADMIN_NAME })
      .where(eq(users.email, ADMIN_EMAIL));
    return { action: 'updated', email: ADMIN_EMAIL };
  }

  await db.insert(users).values({
    email: ADMIN_EMAIL,
    password: hashedPassword,
    name: ADMIN_NAME,
    role: 'admin',
  });
  return { action: 'created', email: ADMIN_EMAIL };
}
