/**
 * インメモリ スライディングウィンドウ レートリミッター
 *
 * 単一インスタンス環境向け。Redis 不要。
 * 将来スケールアウトする場合は Redis/Upstash ベースに差し替える。
 */

interface RateLimiterOptions {
  /** ウィンドウ幅（ミリ秒） */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
}

interface CheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  /** key → タイムスタンプ配列 */
  private readonly hits: Map<string, number[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;

    // 5 分ごとに期限切れエントリを掃除
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Node.js がタイマーのせいで終了しないようにする
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * レート制限の状態を確認する（消費しない）
   */
  check(key: string): CheckResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.getValidHits(key, windowStart);
    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    const resetAt = timestamps.length > 0
      ? new Date(timestamps[0] + this.windowMs)
      : new Date(now + this.windowMs);

    return {
      allowed: timestamps.length < this.maxRequests,
      remaining,
      resetAt,
    };
  }

  /**
   * 1 リクエスト分を消費する。制限超過なら false を返す。
   */
  consume(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.getValidHits(key, windowStart);

    if (timestamps.length >= this.maxRequests) {
      // 古いエントリだけ残して保存
      this.hits.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }

  /** ウィンドウ内の有効なヒットだけ返す */
  private getValidHits(key: string, windowStart: number): number[] {
    const existing = this.hits.get(key);
    if (!existing) return [];
    return existing.filter((t) => t > windowStart);
  }

  /** 期限切れエントリを一括削除 */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.hits) {
      const valid = timestamps.filter((t) => t > windowStart);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  /** テスト用: タイマーを停止 */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ─── プリセットインスタンス ───────────────────────────────

/** AI 分析 API: 1 ユーザーあたり 1 時間 10 リクエスト */
export const aiAnalysisLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 時間
  maxRequests: 10,
});

/** 汎用 API: 1 IP あたり 1 分 100 リクエスト（将来用） */
let _apiGeneralLimiter: RateLimiter | null = null;
export function getApiGeneralLimiter(): RateLimiter {
  if (!_apiGeneralLimiter) {
    _apiGeneralLimiter = new RateLimiter({
      windowMs: 60 * 1000, // 1 分
      maxRequests: 100,
    });
  }
  return _apiGeneralLimiter;
}
