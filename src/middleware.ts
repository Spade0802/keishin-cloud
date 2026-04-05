import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * 認証ミドルウェア（Edge Runtime 対応）
 *
 * auth.config.ts の軽量設定を使用。
 * Node.js 専用モジュールを含まないため Edge Runtime で動作する。
 * 認可ロジックは authConfig.callbacks.authorized で定義。
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/trial/:path*',
    '/verification/:path*',
    '/comparison/:path*',
    '/reclassification/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
    '/account/:path*',
  ],
};
