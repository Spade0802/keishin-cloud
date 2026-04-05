import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge Runtime 対応の軽量 Auth 設定
 *
 * middleware で使用するため、Node.js 専用モジュール
 * (pg, bcryptjs, drizzle-orm) を一切インポートしない。
 * Credentials プロバイダーは authorize() で DB アクセスが必要なため、
 * auth.ts 側でのみ追加する。
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;

      const protectedPaths = [
        '/dashboard',
        '/trial',
        '/verification',
        '/comparison',
        '/reclassification',
        '/admin',
        '/account',
      ];

      const isProtected = protectedPaths.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );

      const isOnboarding =
        pathname === '/onboarding' || pathname.startsWith('/onboarding/');

      const isLoggedIn = !!auth?.user;

      // 保護ページ: 未認証 → ログインへ
      if (isProtected && !isLoggedIn) {
        return false; // Auth.js が自動的に signIn ページへリダイレクト
      }

      // onboarding: 未認証 → ログインへ
      if (isOnboarding && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
};
