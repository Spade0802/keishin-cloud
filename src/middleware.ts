import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * 認証必須ページのミドルウェア
 *
 * Edge Runtime 対応のため auth() ではなく getToken() を使用。
 * auth() は DrizzleAdapter / bcryptjs など Node.js 専用モジュールを
 * バンドルしてしまい Edge Runtime でエラーになるため。
 */
export default async function middleware(req: NextRequest) {
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

  const isOnboarding =
    pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  // JWT トークンを検証（Edge Runtime で動作する）
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  // 保護ページ: 未認証 → ログインへ
  if (isProtected && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 保護ページ: 認証済みだが法人未設定 → onboarding へ
  if (isProtected && token && !token.organizationId) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // onboarding: 未認証 → ログインへ
  if (isOnboarding && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

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
