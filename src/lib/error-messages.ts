/**
 * ユーザー向けエラーメッセージ一覧
 *
 * 全てのユーザーに表示されるエラーメッセージをここに集約する。
 * console.error 等のサーバーサイドログは対象外。
 */

// ── 認証・認可 ──────────────────────────────────────
export const ERR_AUTH_REQUIRED = '認証が必要です。ログインしてください。';
export const ERR_UNAUTHORIZED = '認証に失敗しました。';
export const ERR_FORBIDDEN = '権限がありません。';

// ── ファイルアップロード / 解析 ─────────────────────
export const ERR_FILE_NOT_SELECTED = 'ファイルが指定されていません。';
export const ERR_FILE_TOO_LARGE = 'ファイルサイズが50MBを超えています。';
export const ERR_UNSUPPORTED_FILE_FORMAT =
  '対応していないファイル形式です。PDF/Excelファイルを選択してください。';
export const ERR_PDF_ONLY = 'PDFファイル（.pdf）のみ対応しています。';
export const ERR_EXCEL_ONLY = 'Excelファイル（.xlsx/.xls）のみ対応しています。';
export const ERR_PDF_PARSE_FAILED =
  'PDFの解析に失敗しました。ファイル形式を確認してください。';
export const ERR_EXCEL_PARSE_FAILED = 'ファイルの解析に失敗しました。';
export const ERR_KEISHIN_PDF_PARSE_FAILED = '提出書PDFの解析に失敗しました。';
export const ERR_PDF_TEXT_EXTRACTION_FAILED =
  'PDFからテキストを抽出できませんでした。スキャン品質を確認してください。';
export const ERR_RESULT_PDF_PARSE_FAILED = '結果通知書の解析に失敗しました。';

// ── AI 分析 ─────────────────────────────────────────
export const ERR_AI_EMPTY_RESPONSE =
  'AI解析の応答が空でした。もう一度お試しください。';
export const ERR_AI_ANALYSIS_FAILED =
  'AI分析の生成中にエラーが発生しました。しばらくしてから再度お試しください。';
export const ERR_AI_ANALYSIS_RUNTIME =
  'AI分析の実行中にエラーが発生しました。';

// ── 計算エンジン ────────────────────────────────────
export const ERR_SCORE_BRACKET_NOT_FOUND =
  '評点テーブルの該当区間が見つかりません。入力値を確認してください。';
export const ERR_SALES_REQUIRED =
  '完成工事高（売上高）を入力してください。';
export const ERR_CALCULATION_FAILED = '計算中にエラーが発生しました。';

// ── Excel エクスポート ──────────────────────────────
export const ERR_EXCEL_EXPORT_FAILED = 'Excel生成に失敗しました。';
export const ERR_EXCEL_DOWNLOAD_FAILED =
  'Excelファイルのダウンロードに失敗しました。';

// ── Stripe / 決済 ───────────────────────────────────
export const ERR_STRIPE_NOT_CONFIGURED =
  '決済システムが設定されていません。管理者にお問い合わせください。';
export const ERR_STRIPE_INVALID_SIGNATURE =
  '決済リクエストの検証に失敗しました。';
export const ERR_STRIPE_MISSING_SIGNATURE =
  '決済リクエストの署名が不足しています。';
export const ERR_STRIPE_WEBHOOK_HANDLER =
  '決済Webhookの処理中にエラーが発生しました。';
export const ERR_STRIPE_CHECKOUT_FAILED =
  'チェックアウトセッションの作成に失敗しました。';
export const ERR_STRIPE_PORTAL_FAILED =
  'ポータルセッションの作成に失敗しました。';
export const ERR_STRIPE_SUBSCRIPTION_FAILED =
  'サブスクリプション情報の取得に失敗しました。';
export const ERR_STRIPE_INVALID_PLAN = '無効なプランです。';

// ── 組織・法人 ──────────────────────────────────────
export const ERR_ORG_REQUIRED = '法人登録が必要です。';
export const ERR_ORG_NOT_FOUND = '法人が登録されていません。';
export const ERR_ORG_ALREADY_EXISTS = '既に法人が登録されています。';
export const ERR_ORG_NAME_REQUIRED = '法人名は必須です。';

// ── 企業管理 ────────────────────────────────────────
export const ERR_COMPANY_NOT_FOUND = '企業が見つかりません。';
export const ERR_COMPANY_NAME_REQUIRED = '企業名は必須です。';

// ── シミュレーション ────────────────────────────────
export const ERR_SIMULATION_NOT_FOUND = 'シミュレーションが見つかりません。';
export const ERR_SIMULATION_ID_REQUIRED = 'IDが必要です。';
export const ERR_SIMULATION_INPUT_REQUIRED = '入力データが必要です。';

// ── ユーザー登録 ────────────────────────────────────
export const ERR_SIGNUP_FIELDS_REQUIRED =
  '名前、メールアドレス、パスワードは必須です。';
export const ERR_PASSWORD_MIN_LENGTH =
  'パスワードは8文字以上で入力してください。';
export const ERR_EMAIL_ALREADY_EXISTS =
  'このメールアドレスは既に登録されています。';
export const ERR_SIGNUP_FAILED = 'アカウント作成に失敗しました。';

// ── 管理者 ──────────────────────────────────────────
export const ERR_ADMIN_INTERNAL = 'サーバー内部エラーが発生しました。';

// ── リクエスト ──────────────────────────────────────
export const ERR_INVALID_REQUEST = '不正なリクエストです。';
export const ERR_JSON_PARSE = '不正なリクエスト: JSON パースエラー';

// ── 汎用 ────────────────────────────────────────────
export const ERR_GENERIC = 'エラーが発生しました。';
export const ERR_PARSE_FAILED = '解析に失敗しました。';
