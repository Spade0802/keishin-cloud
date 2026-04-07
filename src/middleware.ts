import { NextResponse, type NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * 認証ミドルウェア（Edge Runtime 対応）
 *
 * 1. 正規URL へのリダイレクト（Cookie不一致によるOAuth障害を防止）
 * 2. 認可ロジック（保護ページへの未認証アクセスをブロック）
 *
 * ★ Cloud Run は複数のURL形式でアクセス可能（旧形式/新形式）。
 * OAuth callback URL や Cookie はドメインに紐づくため、
 * 異なるドメインからアクセスすると CSRF 不一致やセッション消失が起きる。
 * 全トラフィックを正規URLに統一することで恒久的に防止する。
 */

// Cloud Run の正規URL（NEXTAUTH_URL と一致させる）
const CANONICAL_HOST = process.env.NEXTAUTH_URL
  ? new URL(process.env.NEXTAUTH_URL).host
  : null;

const { auth: authMiddleware } = NextAuth(authConfig);

// NextAuth の auth middleware をラップして正規URL リダイレクトを追加
export default authMiddleware(function handler(req) {
  // 正規URLリダイレクト（静的ファイルはNext.jsが処理するので対象外）
  if (CANONICAL_HOST && req.nextUrl.host !== CANONICAL_HOST) {
    const canonicalUrl = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // authorized callback で認証チェック済み → そのまま通過
  return NextResponse.next();
});

export const config = {
  matcher: [
    // 正規URLリダイレクト + 認証チェック対象
    // 静的ファイル（画像、CSS、JS）は除外
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
