# Stripe 課金設定ガイド

KeishinCloud の課金機能を有効にするための手順書です。

---

## 概要

```
現在の状態: BYPASS_BILLING=true （全機能無料で動作中）
本番課金時: BYPASS_BILLING=false + 下記の設定を完了
```

### 必要な作業

| # | 作業 | 所要時間 | 場所 |
|---|------|---------|------|
| 1 | Stripe アカウント作成 | 5分 | stripe.com |
| 2 | 商品・価格を作成 | 10分 | Stripe Dashboard |
| 3 | Webhook エンドポイント設定 | 5分 | Stripe Dashboard |
| 4 | カスタマーポータル設定 | 5分 | Stripe Dashboard |
| 5 | 環境変数を設定 | 5分 | .env.local / Cloud Run |
| 6 | Admin画面で有効化 | 1分 | /admin/settings |
| 7 | テスト決済で動作確認 | 5分 | ブラウザ |

---

## Step 1: Stripe アカウント作成

1. https://dashboard.stripe.com/register にアクセス
2. メールアドレス・パスワードで登録
3. ビジネス情報を入力（後からでも変更可能）
4. **最初はテストモード**で操作する（Dashboard右上のトグル）

> **重要**: テストモードでは実際のお金は動きません。テスト用カード番号で決済テストできます。

---

## Step 2: 商品・価格を作成

### 2-1: スタンダードプラン

1. Stripe Dashboard → **Products** → **+ Add product**
2. 商品情報:
   - Name: `KeishinCloud スタンダード`
   - Description: `行政書士・中小建設業向け 経審シミュレーション`
3. **Price（価格）を2つ作成**:

**年額:**
- Pricing model: `Standard pricing`
- Price: `¥100,000`
- Billing period: `Yearly`
- → 作成後に表示される **Price ID** (`price_xxx...`) をメモ

**月額:**
- Price: `¥9,800`
- Billing period: `Monthly`
- → **Price ID** をメモ

### 2-2: プレミアムプラン

1. **+ Add product**
2. 商品情報:
   - Name: `KeishinCloud プレミアム`
   - Description: `大規模事務所・コンサルタント向け`
3. **Price を2つ作成**:

**年額:** `¥300,000` / Yearly → Price ID メモ
**月額:** `¥29,800` / Monthly → Price ID メモ

### テスト用 ¥0 価格（任意）

テストで¥0で通したい場合:
1. 既存の商品に **新しいPrice** を追加
2. Price: `¥0` / Yearly
3. この Price ID を設定すれば ¥0 でチェックアウトが完了

---

## Step 3: Webhook エンドポイント設定

1. Stripe Dashboard → **Developers** → **Webhooks**
2. **+ Add endpoint**
3. 設定:
   - Endpoint URL: `https://あなたのドメイン/api/webhooks/stripe`
     - テスト時: Stripe CLI を使う（後述）
     - Cloud Run: `https://keishin-cloud-xxxxx-an.a.run.app/api/webhooks/stripe`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
4. 作成後に表示される **Signing secret** (`whsec_xxx...`) をメモ

### ローカル開発でWebhookをテストする場合

```bash
# Stripe CLI をインストール
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# ローカルにWebhookを転送
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 表示される whsec_xxx... を .env.local に設定
```

---

## Step 4: カスタマーポータル設定

1. Stripe Dashboard → **Settings** → **Billing** → **Customer portal**
2. 有効化して、以下を設定:
   - **Subscriptions**: 「Cancel subscriptions」を有効化
   - **Payment methods**: カード更新を有効化
   - **Invoices**: 請求書表示を有効化
3. **Save** をクリック

> これにより `/account/billing` の「サブスクリプション管理」ボタンが機能します。

---

## Step 5: 環境変数を設定

### 5-1: ローカル開発 (.env.local)

```bash
# Stripe テストキー（Dashboard → Developers → API keys）
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<YOUR_STRIPE_PUBLISHABLE_KEY>

# Webhook シークレット（Step 3 で取得）
STRIPE_WEBHOOK_SECRET=<YOUR_WEBHOOK_SECRET>

# Price ID（Step 2 で作成）
STRIPE_PRICE_STANDARD_YEARLY=<YOUR_PRICE_ID>
STRIPE_PRICE_STANDARD_MONTHLY=<YOUR_PRICE_ID>
STRIPE_PRICE_PREMIUM_YEARLY=<YOUR_PRICE_ID>
STRIPE_PRICE_PREMIUM_MONTHLY=<YOUR_PRICE_ID>

# テスト中はtrue、本番課金時はfalseに変更
BYPASS_BILLING=false
```

### 5-2: Cloud Run デプロイ時

```bash
gcloud run services update keishin-cloud \
  --update-env-vars="STRIPE_SECRET_KEY=<YOUR_KEY>,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<YOUR_KEY>,STRIPE_WEBHOOK_SECRET=<YOUR_SECRET>,STRIPE_PRICE_STANDARD_YEARLY=<PRICE_ID>,STRIPE_PRICE_STANDARD_MONTHLY=<PRICE_ID>,STRIPE_PRICE_PREMIUM_YEARLY=<PRICE_ID>,STRIPE_PRICE_PREMIUM_MONTHLY=<PRICE_ID>,BYPASS_BILLING=false"
```

> **注意**: `--update-env-vars` は既存の環境変数を上書きしません（追加のみ）

---

## Step 6: Admin画面で有効化

1. `/admin/settings` にアクセス
2. **「課金 (Stripe)」タブ** を開く
3. 課金バイパスを **OFF** に切替
4. APIキー・Price ID を入力（環境変数で設定済みなら不要）
5. **設定を保存**

> Admin画面の設定は環境変数より優先されます。
> どちらか一方で設定すれば動作します。

---

## Step 7: テスト決済

### テスト用カード番号

| カード番号 | 結果 |
|-----------|------|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 3220` | 3Dセキュア認証 |
| `4000 0000 0000 9995` | 残高不足で失敗 |
| `4000 0000 0000 0341` | カード拒否 |

- 有効期限: 未来の日付ならなんでもOK（例: `12/30`）
- CVC: 3桁ならなんでもOK（例: `123`）
- 郵便番号: なんでもOK

### テスト手順

1. ログイン → `/pricing` にアクセス
2. 「スタンダード」の「申し込む」をクリック
3. Stripe Checkout 画面でテストカードを入力
4. 完了 → `/account/billing` にリダイレクト
5. プランが「スタンダード」、ステータスが「有効」になっていることを確認
6. `/admin/billing` で法人のサブスクリプションが表示されることを確認

---

## 本番移行チェックリスト

本番でお金を実際に受け取る前に:

- [ ] Stripe Dashboard でテストモード → **本番モード** に切替
- [ ] 本番用 APIキー (`sk_live_xxx`, `pk_live_xxx`) を取得
- [ ] 本番用 Webhook エンドポイントを作成し、シークレットを取得
- [ ] 本番用 Product/Price を作成し、Price ID を取得
- [ ] Cloud Run の環境変数を本番キーに更新
- [ ] `BYPASS_BILLING=false` を確認
- [ ] Stripe の本人確認（KYC）を完了
- [ ] 銀行口座を登録（売上の振込先）
- [ ] 特定商取引法に基づく表記ページを作成/更新
- [ ] プライバシーポリシーに決済情報の取り扱いを追記
- [ ] 利用規約にサブスクリプション条件を追記
- [ ] テスト決済を実施して全フロー動作確認

---

## トラブルシューティング

### 「決済システムが設定されていません」エラー
→ `STRIPE_SECRET_KEY` が設定されていないか、`BYPASS_BILLING=true` になっている

### Webhook が届かない
→ Stripe Dashboard → Developers → Webhooks → イベントログを確認
→ エンドポイントURLが正しいか確認
→ `STRIPE_WEBHOOK_SECRET` が正しいか確認

### チェックアウト後にプランが更新されない
→ Webhook が正常に届いているか確認
→ `checkout.session.completed` イベントの metadata に `organizationId` があるか確認

### 「Price IDが設定されていません」エラー
→ `STRIPE_PRICE_STANDARD_YEARLY` 等の環境変数を確認
→ Admin設定 → 課金タブで Price ID が入力されているか確認

---

## 料金体系

| プラン | 月額 | 年額 | 対象 |
|-------|------|------|------|
| 無料 | ¥0 | ¥0 | お試し（機能制限あり） |
| スタンダード | ¥9,800 | ¥100,000 | 行政書士・中小建設業 |
| プレミアム | ¥29,800 | ¥300,000 | 大規模事務所・コンサル |

---

## アーキテクチャ図

```
ユーザー
  ↓ /pricing で「申し込む」
  ↓
[POST /api/stripe/create-checkout-session]
  ↓ Stripe Customer 作成/取得
  ↓ Checkout Session 作成
  ↓
Stripe Checkout (stripe.com)
  ↓ カード入力・決済
  ↓
[POST /api/webhooks/stripe]  ← Stripe から自動通知
  ↓ checkout.session.completed
  ↓ organizations テーブル更新
  ↓   plan = 'standard'
  ↓   subscriptionStatus = 'active'
  ↓
ユーザー → /account/billing にリダイレクト
  ↓ プラン有効化を確認
```

```
管理者
  ↓ /admin/billing
  ↓ 法人一覧・プラン変更・統計確認
  ↓
  ↓ /admin/settings → 課金タブ
  ↓ Stripe APIキー・Price ID 設定
  ↓ バイパスON/OFF
```
