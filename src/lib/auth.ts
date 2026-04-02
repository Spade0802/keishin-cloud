import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import { db } from './db';
import { users } from './db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  adapter: DrizzleAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    Google,
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
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }

      // ユーザーの法人情報をセッションに付与
      const dbUser = await db
        .select({
          organizationId: users.organizationId,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, session.user.id))
        .then((rows) => rows[0]);

      if (dbUser) {
        session.user.organizationId = dbUser.organizationId;
        session.user.role = dbUser.role;
      }

      return session;
    },
  },
});
