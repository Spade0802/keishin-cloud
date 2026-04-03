import { SettingsForm } from './settings-form';

export const metadata = {
  title: 'システム設定 | 管理画面',
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">システム設定</h2>
        <p className="text-sm text-muted-foreground mt-1">
          AI 分析・OCR・ファイルアップロードなどのシステム全体の設定を管理します。
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
