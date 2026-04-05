'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Building2, CheckCircle2, Phone, Clock, ChevronDown, ChevronUp, HelpCircle, MapPin } from 'lucide-react';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const MESSAGE_MIN_LENGTH = 10;
  const MESSAGE_MAX_LENGTH = 2000;

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'お名前を入力してください';
    if (!email.trim()) {
      errs.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = '正しいメールアドレスを入力してください';
    }
    if (!message.trim()) {
      errs.message = 'お問い合わせ内容を入力してください';
    } else if (message.trim().length < MESSAGE_MIN_LENGTH) {
      errs.message = `${MESSAGE_MIN_LENGTH}文字以上でご記入ください`;
    } else if (message.length > MESSAGE_MAX_LENGTH) {
      errs.message = `${MESSAGE_MAX_LENGTH}文字以内でご記入ください`;
    }
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    // TODO: 実際のメール送信またはAPI呼び出しを実装する
    // POST /api/contact に { name, email, company, message } を送信
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 500);
  }

  function handleBlur(field: keyof FormErrors) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate();
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  const faqItems = [
    {
      question: 'KeishinCloudはどのような企業向けですか？',
      answer:
        '建設業を中心とした中小企業から大企業まで幅広くご利用いただけます。経審（経営事項審査）のシミュレーションや分析機能を活用して、効率的な経営管理を実現できます。',
    },
    {
      question: '無料で利用できますか？',
      answer:
        '基本機能は無料でご利用いただけます。より高度な分析機能やチーム向け機能については、有料プランをご用意しています。詳しくは料金ページをご覧ください。',
    },
    {
      question: 'データのセキュリティは大丈夫ですか？',
      answer:
        'お客様のデータは暗号化された安全な環境で管理しています。定期的なセキュリティ監査を実施し、業界標準のセキュリティ基準を満たしています。',
    },
    {
      question: '導入までどのくらいかかりますか？',
      answer:
        'アカウント登録後すぐにご利用いただけます。初期設定も数分で完了し、直感的なUIで操作を覚える必要はほとんどありません。',
    },
    {
      question: 'サポート体制について教えてください',
      answer:
        'メールでのサポートは平日9:00〜18:00に対応しています。通常2営業日以内にご回答いたします。有料プランでは優先サポートもご利用いただけます。',
    },
  ];

  if (submitted) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl mb-4">
              お問い合わせありがとうございます
            </h1>
            <p className="text-muted-foreground mb-8">
              内容を確認のうえ、ご入力いただいたメールアドレス宛にご連絡いたします。
              通常2営業日以内に回答いたします。
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline">
              別のお問い合わせをする
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold sm:text-3xl mb-2">お問い合わせ</h1>
          <p className="text-muted-foreground mb-8">
            KeishinCloudに関するご質問・ご要望をお気軽にお寄せください。
          </p>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">お問い合わせフォーム</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-name">
                        お名前 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => handleBlur('name')}
                        placeholder="山田 太郎"
                        required
                        aria-required="true"
                        aria-invalid={touched.name && !!errors.name}
                        aria-describedby={errors.name ? 'contact-name-error' : undefined}
                      />
                      {touched.name && errors.name && (
                        <p id="contact-name-error" className="text-sm text-destructive" role="alert">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-email">
                        メールアドレス <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => handleBlur('email')}
                        placeholder="taro@example.com"
                        required
                        aria-required="true"
                        aria-invalid={touched.email && !!errors.email}
                        aria-describedby={errors.email ? 'contact-email-error' : undefined}
                      />
                      {touched.email && errors.email && (
                        <p id="contact-email-error" className="text-sm text-destructive" role="alert">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-company">会社名</Label>
                      <Input
                        id="contact-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="株式会社○○"
                        aria-label="会社名（任意）"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contact-message">
                        お問い合わせ内容 <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        id="contact-message"
                        value={message}
                        onChange={(e) => {
                          if (e.target.value.length <= MESSAGE_MAX_LENGTH) {
                            setMessage(e.target.value);
                          }
                        }}
                        onBlur={() => handleBlur('message')}
                        placeholder="ご質問やご要望をご記入ください..."
                        rows={6}
                        required
                        aria-required="true"
                        aria-invalid={touched.message && !!errors.message}
                        aria-describedby="contact-message-hint contact-message-counter contact-message-error"
                        className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 resize-y"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <p id="contact-message-hint" className="text-xs text-muted-foreground">
                          {MESSAGE_MIN_LENGTH}文字以上でご記入ください
                        </p>
                        <p
                          id="contact-message-counter"
                          className={`text-xs tabular-nums ${
                            message.length > MESSAGE_MAX_LENGTH * 0.9
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }`}
                          aria-live="polite"
                        >
                          {message.length} / {MESSAGE_MAX_LENGTH}
                        </p>
                      </div>
                      {touched.message && errors.message && (
                        <p id="contact-message-error" className="text-sm text-destructive" role="alert">
                          {errors.message}
                        </p>
                      )}
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                      {submitting ? '送信中...' : '送信する'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm mb-1">メール</h3>
                      <p className="text-sm text-muted-foreground">
                        {/* TODO: 実際のメールアドレスに置き換える */}
                        support@keishincloud.jp
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm mb-1">電話</h3>
                      <p className="text-sm text-muted-foreground">
                        {/* TODO: 実際の電話番号に置き換える */}
                        03-XXXX-XXXX
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm mb-1">対応時間</h3>
                      <p className="text-sm text-muted-foreground">
                        平日 9:00〜18:00
                        <br />
                        （土日祝休み）
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FAQ セクション */}
          <section className="mt-16" aria-labelledby="faq-heading">
            <div className="flex items-center gap-2 mb-6">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <h2 id="faq-heading" className="text-xl font-bold">
                よくあるご質問
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <Card key={index}>
                  <button
                    type="button"
                    className="w-full text-left px-6 py-4 flex items-center justify-between gap-4"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    aria-expanded={openFaq === index}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="font-medium text-sm">{item.question}</span>
                    {openFaq === index ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {openFaq === index && (
                    <div
                      id={`faq-answer-${index}`}
                      role="region"
                      className="px-6 pb-4"
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* 会社情報セクション */}
          <section className="mt-16 mb-8" aria-labelledby="company-heading">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h2 id="company-heading" className="text-xl font-bold">
                運営会社
              </h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                  <dt className="text-muted-foreground font-medium">会社名</dt>
                  <dd>
                    {/* TODO: 実際の会社名に置き換える */}
                    KeishinCloud 運営事務局
                  </dd>
                  <dt className="text-muted-foreground font-medium">所在地</dt>
                  <dd className="flex items-start gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>
                      {/* TODO: 実際の住所に置き換える */}
                      〒000-0000 東京都○○区○○ 0-0-0
                    </span>
                  </dd>
                  <dt className="text-muted-foreground font-medium">設立</dt>
                  <dd>
                    {/* TODO: 実際の設立日に置き換える */}
                    20XX年X月
                  </dd>
                  <dt className="text-muted-foreground font-medium">事業内容</dt>
                  <dd>建設業向けクラウドサービスの開発・運営</dd>
                  <dt className="text-muted-foreground font-medium">メール</dt>
                  <dd>
                    {/* TODO: 実際のメールアドレスに置き換える */}
                    support@keishincloud.jp
                  </dd>
                </dl>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
