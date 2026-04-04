@AGENTS.md

# KeishinCloud プロジェクト固有ルール

## デプロイ
- Cloud Build: `gcloud builds submit --config=cloudbuild.yaml`
- 本番URL: https://keishin-cloud-axguwuc4qq-an.a.run.app
- デプロイ後は必ずGoogle認証ログインの動作確認を行う

## 認証（NextAuth v5）
- auth.config.ts: Googleプロバイダーは明示的にclientId/clientSecretを渡すこと
- Cloud Run環境変数: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST=true
- `--update-env-vars`で既存env varsを保持（`--set-env-vars`は使わない）

## テスト
- `pnpm build` でビルドエラーがないか確認
- `npx tsc --noEmit` で型チェック
