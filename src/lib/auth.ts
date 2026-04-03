import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from './db/schema';
import { authConfig } from './auth.config';

/**
 * フル Auth 設定（Node.js Runtime 専用）
 *
 * DrizzleAdapter, Credentials, bcryptjs など Node.js 依存を含む。
 * middleware からは使わないこと（auth.config.ts を使う）。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Credentials({
      name: 'メールアドレス',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .then((rows) => rows[0]);

        if (!user || !user.password) return null;

        const { compare } = await import('bcryptjs');
        const isValid = await compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // 初回サインインまたはトークン更新時に法人情報を付与
      if (user || trigger === 'update' || !token.organizationId) {
        const dbUser = await db
          .select({ organizationId: users.organizationId, role: users.role })
          .from(users)
          .where(eq(users.id, token.id as string))
          .then((rows) => rows[0]);
        if (dbUser) {
          token.organizationId = dbUser.organizationId;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.organizationId) {
        session.user.organizationId = token.organizationId as string;
      }
      if (token.role) {
        session.user.role = token.role as 'admin' | 'member';
      }
      return session;
    },
  },
});
