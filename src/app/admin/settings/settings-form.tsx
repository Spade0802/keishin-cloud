'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface SettingsData {
  ai_provider: string;
  gemini_api_key: string;
  openai_api_key: string;
  gemini_model: string;
  openai_model: string;
  ocr_provider: string;
  max_file_size_mb: string;
  ai_analysis_enabled: string;
  // Stripe
  stripe_secret_key: string;
  stripe_publishable_key: string;
  stripe_webhook_secret: string;
  stripe_price_standard_yearly: string;
  stripe_price_standard_monthly: string;
  stripe_price_premium_yearly: string;
  stripe_price_premium_monthly: string;
  bypass_billing: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  ai_provider: 'gemini',
  gemini_api_key: '',
  openai_api_key: '',
  gemini_model: 'gemini-2.5-flash',
  openai_model: 'gpt-4o',
  ocr_provider: 'gemini',
  max_file_size_mb: '50',
  ai_analysis_enabled: 'true',
  // Stripe
  stripe_secret_key: '',
  stripe_publishable_key: '',
  stripe_webhook_secret: '',
  stripe_price_standard_yearly: '',
  stripe_price_standard_monthly: '',
  stripe_price_premium_yearly: '',
  stripe_price_premium_monthly: '',
  bypass_billing: 'true',
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // トースト自動消去
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 設定読み込み
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('設定の読み込みに失敗しました');
      const data = await res.json();
      const s = data.settings as Record<string, { value: string }>;
      setSettings({
        ai_provider: s.ai_provider?.value ?? DEFAULT_SETTINGS.ai_provider,
        gemini_api_key: s.gemini_api_key?.value ?? '',
        openai_api_key: s.openai_api_key?.value ?? '',
        gemini_model: s.gemini_model?.value ?? DEFAULT_SETTINGS.gemini_model,
        openai_model: s.openai_model?.value ?? DEFAULT_SETTINGS.openai_model,
        ocr_provider: s.ocr_provider?.value ?? DEFAULT_SETTINGS.ocr_provider,
        max_file_size_mb: s.max_file_size_mb?.value ?? DEFAULT_SETTINGS.max_file_size_mb,
        ai_analysis_enabled: s.ai_analysis_enabled?.value ?? DEFAULT_SETTINGS.ai_analysis_enabled,
        // Stripe
        stripe_secret_key: s.stripe_secret_key?.value ?? '',
        stripe_publishable_key: s.stripe_publishable_key?.value ?? '',
        stripe_webhook_secret: s.stripe_webhook_secret?.value ?? '',
        stripe_price_standard_yearly: s.stripe_price_standard_yearly?.value ?? '',
        stripe_price_standard_monthly: s.stripe_price_standard_monthly?.value ?? '',
        stripe_price_premium_yearly: s.stripe_price_premium_yearly?.value ?? '',
        stripe_price_premium_monthly: s.stripe_price_premium_monthly?.value ?? '',
        bypass_billing: s.bypass_billing?.value ?? DEFAULT_SETTINGS.bypass_billing,
      });
    } catch {
      setToast({ type: 'error', message: '設定の読み込みに失敗しました' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 保存
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存に失敗しました');
      }
      setToast({ type: 'success', message: '設定を保存しました' });
      // 再読み込みしてマスク値を更新
      await fetchSettings();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof SettingsData, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* トースト */}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">AI設定</TabsTrigger>
          <TabsTrigger value="ocr">OCR設定</TabsTrigger>
          <TabsTrigger value="stripe">課金 (Stripe)</TabsTrigger>
          <TabsTrigger value="other">その他</TabsTrigger>
        </TabsList>

        {/* ─── AI設定 ─── */}
        <TabsContent value="ai">
          <div className="space-y-6 pt-2">
            {/* AI プロバイダー */}
            <Card>
              <CardHeader>
                <CardTitle>AI プロバイダー</CardTitle>
                <CardDescription>
                  書類分析に使用する AI エンジンを選択します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {([
                    ['gemini', 'Gemini (無料枠 / Vertex AI)', 'Google の Gemini API を使用します。Vertex AI 経由の場合は環境変数で認証します。'],
                    ['gemini-paid', 'Gemini (有料・API キー)', 'Google AI Studio の有料 API キーを使用します。'],
                    ['openai', 'OpenAI', 'OpenAI の API を使用します。API キーが必要です。'],
                  ] as const).map(([value, label, desc]) => (
                    <label
                      key={value}
                      className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                        settings.ai_provider === value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ai_provider"
                        value={value}
                        checked={settings.ai_provider === value}
                        onChange={(e) => update('ai_provider', e.target.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gemini 設定 */}
            <Card>
              <CardHeader>
                <CardTitle>Gemini 設定</CardTitle>
                <CardDescription>
                  Gemini モデルと API キー（有料プラン選択時）を設定します。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gemini_model">モデル名</Label>
                  <Input
                    id="gemini_model"
                    list="gemini-models"
                    value={settings.gemini_model}
                    onChange={(e) => update('gemini_model', e.target.value)}
                    placeholder="gemini-2.5-flash"
                    className="h-8"
                  />
                  <datalist id="gemini-models">
                    <option value="gemini-2.5-flash" />
                    <option value="gemini-2.5-pro" />
                    <option value="gemini-2.5-flash-preview-04-17" />
                    <option value="gemini-2.0-flash" />
                    <option value="gemini-2.0-flash-lite" />
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    候補から選択するか、任意のモデル名を直接入力できます
                  </p>
                </div>

                {settings.ai_provider === 'gemini-paid' && (
                  <div className="space-y-2">
                    <Label htmlFor="gemini_api_key">API キー</Label>
                    <div className="relative">
                      <Input
                        id="gemini_api_key"
                        type={showGeminiKey ? 'text' : 'password'}
                        value={settings.gemini_api_key}
                        onChange={(e) => update('gemini_api_key', e.target.value)}
                        placeholder="AIza..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Google AI Studio で発行した API キーを入力してください。
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* OpenAI 設定 */}
            <Card>
              <CardHeader>
                <CardTitle>OpenAI 設定</CardTitle>
                <CardDescription>
                  OpenAI モデルと API キーを設定します。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai_model">モデル名</Label>
                  <Input
                    id="openai_model"
                    list="openai-models"
                    value={settings.openai_model}
                    onChange={(e) => update('openai_model', e.target.value)}
                    placeholder="gpt-4o"
                    className="h-8"
                  />
                  <datalist id="openai-models">
                    <option value="gpt-4.1" />
                    <option value="gpt-4.1-mini" />
                    <option value="gpt-4.1-nano" />
                    <option value="gpt-4o" />
                    <option value="gpt-4o-mini" />
                    <option value="o3" />
                    <option value="o3-mini" />
                    <option value="o4-mini" />
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    候補から選択するか、任意のモデル名を直接入力できます
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai_api_key">API キー</Label>
                  <div className="relative">
                    <Input
                      id="openai_api_key"
                      type={showOpenAIKey ? 'text' : 'password'}
                      value={settings.openai_api_key}
                      onChange={(e) => update('openai_api_key', e.target.value)}
                      placeholder="sk-..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    OpenAI のダッシュボードで発行した API キーを入力してください。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── OCR設定 ─── */}
        <TabsContent value="ocr">
          <div className="space-y-6 pt-2">
            <Card>
              <CardHeader>
                <CardTitle>OCR プロバイダー</CardTitle>
                <CardDescription>
                  書類画像からテキストを抽出する OCR エンジンを選択します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {([
                    ['gemini', 'Gemini (マルチモーダル)', '画像を直接 Gemini に渡して OCR を実行します。追加料金なし。'],
                    ['document-ai', 'Google Document AI', 'Google Cloud Document AI を使用します。高精度ですが別途料金が発生します。'],
                    ['vision-api', 'Google Cloud Vision API', 'Google Cloud Vision API を使用します。テキスト抽出に特化しています。'],
                  ] as const).map(([value, label, desc]) => (
                    <label
                      key={value}
                      className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                        settings.ocr_provider === value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ocr_provider"
                        value={value}
                        checked={settings.ocr_provider === value}
                        onChange={(e) => update('ocr_provider', e.target.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── 課金(Stripe)設定 ─── */}
        <TabsContent value="stripe">
          <div className="space-y-6 pt-2">
            {/* 課金バイパス */}
            <Card>
              <CardHeader>
                <CardTitle>課金モード</CardTitle>
                <CardDescription>
                  テスト中は「バイパス」をONにすると、Stripeなしで全機能が利用可能になります。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.bypass_billing === 'true'}
                    onClick={() =>
                      update(
                        'bypass_billing',
                        settings.bypass_billing === 'true' ? 'false' : 'true'
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      settings.bypass_billing === 'true'
                        ? 'bg-amber-500'
                        : 'bg-input'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                        settings.bypass_billing === 'true'
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <Label>
                    {settings.bypass_billing === 'true' ? (
                      <span className="text-amber-600 font-medium">バイパスON（全機能無料）</span>
                    ) : (
                      <span>Stripe課金を有効化</span>
                    )}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  本番運用時はOFFにし、下記のStripeキーを設定してください。
                </p>
              </CardContent>
            </Card>

            {/* Stripe APIキー */}
            <Card>
              <CardHeader>
                <CardTitle>Stripe APIキー</CardTitle>
                <CardDescription>
                  Stripe Dashboardから取得したAPIキーを設定します。テスト用キー（sk_test_）と本番用キー（sk_live_）があります。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stripe_secret_key">シークレットキー</Label>
                  <div className="relative">
                    <Input
                      id="stripe_secret_key"
                      type={showStripeKey ? 'text' : 'password'}
                      value={settings.stripe_secret_key}
                      onChange={(e) => update('stripe_secret_key', e.target.value)}
                      placeholder="sk_test_..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeKey(!showStripeKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showStripeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe_publishable_key">公開キー</Label>
                  <Input
                    id="stripe_publishable_key"
                    value={settings.stripe_publishable_key}
                    onChange={(e) => update('stripe_publishable_key', e.target.value)}
                    placeholder="pk_test_..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe_webhook_secret">Webhook シークレット</Label>
                  <div className="relative">
                    <Input
                      id="stripe_webhook_secret"
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={settings.stripe_webhook_secret}
                      onChange={(e) => update('stripe_webhook_secret', e.target.value)}
                      placeholder="whsec_..."
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Webhook URL: <code className="bg-muted px-1 rounded">https://your-domain.com/api/webhooks/stripe</code>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Price ID 設定 */}
            <Card>
              <CardHeader>
                <CardTitle>プラン Price ID</CardTitle>
                <CardDescription>
                  Stripe Dashboardの「Products」で作成したPrice IDを設定します。
                  テスト時は¥0のPriceを作成してください。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_standard_yearly">
                      スタンダード（年額¥100,000）
                    </Label>
                    <Input
                      id="stripe_price_standard_yearly"
                      value={settings.stripe_price_standard_yearly}
                      onChange={(e) => update('stripe_price_standard_yearly', e.target.value)}
                      placeholder="price_xxx"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_standard_monthly">
                      スタンダード（月額¥9,800）
                    </Label>
                    <Input
                      id="stripe_price_standard_monthly"
                      value={settings.stripe_price_standard_monthly}
                      onChange={(e) => update('stripe_price_standard_monthly', e.target.value)}
                      placeholder="price_xxx"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_premium_yearly">
                      プレミアム（年額¥300,000）
                    </Label>
                    <Input
                      id="stripe_price_premium_yearly"
                      value={settings.stripe_price_premium_yearly}
                      onChange={(e) => update('stripe_price_premium_yearly', e.target.value)}
                      placeholder="price_xxx"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_premium_monthly">
                      プレミアム（月額¥29,800）
                    </Label>
                    <Input
                      id="stripe_price_premium_monthly"
                      value={settings.stripe_price_premium_monthly}
                      onChange={(e) => update('stripe_price_premium_monthly', e.target.value)}
                      placeholder="price_xxx"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── その他 ─── */}
        <TabsContent value="other">
          <div className="space-y-6 pt-2">
            <Card>
              <CardHeader>
                <CardTitle>ファイルアップロード</CardTitle>
                <CardDescription>
                  アップロード可能なファイルサイズの上限を設定します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="max_file_size_mb">最大ファイルサイズ (MB)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="max_file_size_mb"
                      type="number"
                      min={1}
                      max={500}
                      value={settings.max_file_size_mb}
                      onChange={(e) => update('max_file_size_mb', e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">MB</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1〜500 MB の範囲で設定できます。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI 分析機能</CardTitle>
                <CardDescription>
                  AI による書類分析機能の有効/無効を切り替えます。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.ai_analysis_enabled === 'true'}
                    onClick={() =>
                      update(
                        'ai_analysis_enabled',
                        settings.ai_analysis_enabled === 'true' ? 'false' : 'true'
                      )
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      settings.ai_analysis_enabled === 'true'
                        ? 'bg-primary'
                        : 'bg-input'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                        settings.ai_analysis_enabled === 'true'
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <Label>
                    {settings.ai_analysis_enabled === 'true' ? '有効' : '無効'}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  無効にすると、AI による書類分析機能が全ユーザーで利用できなくなります。
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {saving ? '保存中...' : '設定を保存'}
        </Button>
      </div>
    </div>
  );
}
