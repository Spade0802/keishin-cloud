'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Building2, Zap, ArrowRight, X } from 'lucide-react';
import { PLANS } from '@/lib/stripe';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

type Interval = 'month' | 'year';

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled') === 'true';
  const [interval, setInterval] = useState<Interval>('year');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (planId === 'free') {
      router.push('/signup');
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, interval }),
      });

      const data = await res.json();

      if (data.bypassed) {
        // テストモード: 即座にダッシュボードへ
        router.push('/dashboard?plan_activated=true');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'エラーが発生しました');
      }
    } catch {
      alert('エラーが発生しました');
    } finally {
      setLoadingPlan(null);
    }
  }

  const planList = [
    { ...PLANS.free, icon: Building2, color: 'border-gray-200', badge: null },
    { ...PLANS.standard, icon: Sparkles, color: 'border-blue-500 ring-2 ring-blue-100', badge: '人気' },
    { ...PLANS.premium, icon: Zap, color: 'border-purple-500', badge: null },
  ];

  return (
    <>
    <Header />
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            経審クラウドの料金プラン
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            建設業の経営事項審査をAIで効率化。
            まずは無料プランでお試しください。
          </p>
        </div>

        {canceled && (
          <div className="max-w-md mx-auto mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
            チェックアウトがキャンセルされました。お好きなタイミングで再度お申し込みください。
          </div>
        )}

        {/* Interval Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setInterval('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              interval === 'month'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            月払い
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              interval === 'year'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            年払い
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 text-[10px]">
              2ヶ月お得
            </Badge>
          </button>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {planList.map((plan) => {
            const Icon = plan.icon;
            const price = interval === 'year' ? plan.priceYearly : plan.priceMonthly;
            const isPopular = plan.badge === '人気';

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition hover:shadow-lg ${plan.color}`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    人気
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{plan.nameJa}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div>
                    {price === 0 ? (
                      <div className="text-3xl font-bold">
                        無料
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold">
                          {(interval === 'year' ? Math.floor(price / 12) : price).toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-sm">円/月</span>
                        {interval === 'year' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            年額 {price.toLocaleString()}円（税抜）
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingPlan !== null}
                    className={`w-full ${
                      isPopular
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : plan.id === 'premium'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : ''
                    }`}
                    variant={plan.id === 'free' ? 'outline' : 'default'}
                  >
                    {loadingPlan === plan.id ? (
                      '処理中...'
                    ) : plan.id === 'free' ? (
                      <>無料で始める</>
                    ) : (
                      <>
                        申し込む
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Limits detail for free */}
                  {plan.id === 'free' && (
                    <div className="rounded-lg bg-gray-50 p-3 text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1">
                        <X className="h-3 w-3 text-gray-400" /> AI分析
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="h-3 w-3 text-gray-400" /> Excelエクスポート
                      </div>
                      <div className="flex items-center gap-1">
                        <X className="h-3 w-3 text-gray-400" /> 期間比較
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">よくある質問</h2>
          <div className="space-y-4">
            {[
              {
                q: '無料プランから有料プランへの切り替えはいつでもできますか？',
                a: 'はい、いつでもアップグレード可能です。日割り計算で差額のみお支払いいただきます。',
              },
              {
                q: '解約はいつでもできますか？',
                a: 'はい、いつでも解約できます。解約後は現在の請求期間の終了まで引き続きご利用いただけます。',
              },
              {
                q: 'お支払い方法は何が使えますか？',
                a: 'クレジットカード（Visa, Mastercard, JCB, AMEX）をご利用いただけます。Stripeによる安全な決済処理を行っています。',
              },
              {
                q: '法人での契約は可能ですか？',
                a: 'はい。法人契約の場合は請求書払い（NET30）にも対応可能です。お問い合わせください。',
              },
            ].map((faq, i) => (
              <details key={i} className="group rounded-lg border p-4">
                <summary className="cursor-pointer font-medium text-sm list-none flex items-center justify-between">
                  {faq.q}
                  <span className="text-muted-foreground group-open:rotate-180 transition">
                    &#9660;
                  </span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
