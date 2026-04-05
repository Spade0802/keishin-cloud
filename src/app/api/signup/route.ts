import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { RateLimiter } from '@/lib/rate-limiter';
import { isValidEmail, sanitizeString } from '@/lib/security';

/** サインアップ: 1 IPあたり 1 分間 3 リクエスト */
const signupLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 3,
});

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateResult = signupLimiter.consume(ip);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらくしてから再度お試しください。' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateResult.resetAt.toISOString(),
          'Retry-After': String(Math.ceil((rateResult.resetAt.getTime() - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const body = await req.json();

    // 入力サニタイズ: トリム＆長さ制限
    const name = sanitizeString(body.name, 100);
    const email = sanitizeString(body.email, 254);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '名前、メールアドレス、パスワードは必須です' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上128文字以内で入力してください' },
        { status: 400 }
      );
    }

    // 既存ユーザーチェック
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .then((rows) => rows[0]);

    if (existing) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    });

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateResult.remaining),
          'X-RateLimit-Reset': rateResult.resetAt.toISOString(),
        },
      },
    );
  } catch (error) {
    console.error('[signup] Account creation failed:', error);
    return NextResponse.json(
      { error: 'アカウント作成に失敗しました' },
      { status: 500 }
    );
  }
}
