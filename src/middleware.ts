import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * 認証必須ページのミドルウェア
 *
 * - /dashboard, /verification, /comparison, /reclassification, /trial は認証必須
 * - /onboarding はログイン済みだが法人未設定のユーザー用
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const protectedPaths = [
    '/dashboard',
    '/trial',
    '/verification',
    '/comparison',
    '/reclassification',
  ];

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ログイン済みで法人未設定の場合、保護ページからonboardingへリダイレクト
  if (isProtected && req.auth?.user && !req.auth.user.organizationId) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/trial/:path*',
    '/verification/:path*',
    '/comparison/:path*',
    '/reclassification/:path*',
    '/onboarding/:path*',
  ],
};
