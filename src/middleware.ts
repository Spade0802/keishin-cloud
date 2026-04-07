import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * 認証ミドルウェア（Edge Runtime 対応）
 *
 * 1. 正規URL へのリダイレクト（Cookie不一致によるOAuth障害を防止）
 * 2. 認可ロジック（保護ページへの未認証アクセスをブロック）
 *
 * ★ Cloud Run は複数のURL形式でアクセス可能:
 *   - 旧形式: xxx-axguwuc4qq-an.a.run.app
 *   - 新形式: xxx-687458058500.asia-northeast1.run.app
 * OAuth callback URL や Cookie はドメインに紐づくため、
 * 異なるドメインからアクセスすると CSRF 不一致やセッション消失が起きる。
 * 全トラフィックを正規URLに統一することで恒久的に防止する。
 */

const CANONICAL_HOST = process.env.NEXTAUTH_URL
  ? new URL(process.env.NEXTAUTH_URL).host
  : null;

const { auth: authMiddleware } = NextAuth(authConfig);

export default authMiddleware(function handler(req) {
  // ── 正規URLリダイレクト ──
  // req.nextUrl.host は trustHost により書き換わる場合があるため、
  // 実際のリクエストヘッダーから判定する
  const requestHost =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    '';

  if (
    CANONICAL_HOST &&
    requestHost &&
    requestHost !== CANONICAL_HOST &&
    !requestHost.startsWith('localhost')
  ) {
    const canonicalUrl = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // 全ページ対象（静的ファイルは除外）
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
