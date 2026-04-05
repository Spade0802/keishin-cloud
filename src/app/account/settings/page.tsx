'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Building2,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellOff,
  LogOut,
  Trash2,
  AlertTriangle,
  Save,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/components/ui/toast';
import { logger } from '@/lib/logger';
import { useSession } from '@/lib/session-context';

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: string;
  createdAt: string;
}

type ThemePreference = 'light' | 'dark' | 'system';

function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme-preference') as ThemePreference) || 'system';
}

function applyTheme(theme: ThemePreference) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
  localStorage.setItem('theme-preference', theme);
}

interface NotificationPrefs {
  emailNotifications: boolean;
  trialExpiryReminders: boolean;
}

function getStoredNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return { emailNotifications: true, trialExpiryReminders: true };
  const stored = localStorage.getItem('notification-preferences');
  if (stored) {
    try { return JSON.parse(stored); } catch (e) { logger.warn('通知設定のパースに失敗', e); }
  }
  return { emailNotifications: true, trialExpiryReminders: true };
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-3 text-left"
    >
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const session = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailNotifications: true,
    trialExpiryReminders: true,
  });

  useEffect(() => {
    setTheme(getStoredTheme());
    setNotifPrefs(getStoredNotificationPrefs());
  }, []);

  useEffect(() => {
    fetch('/api/user/profile')
      .then((r) => {
        if (!r.ok) throw new Error(`プロフィール取得失敗: ${r.status}`);
        return r.json();
      })
      .then((data: UserProfile) => {
        setProfile(data);
        setDisplayName(data.name || '');
      })
      .catch((err) => {
        logger.error('プロフィール取得エラー', err);
        setFetchError('プロフィールの読み込みに失敗しました');
      })
      .finally(() => setLoading(false));
  }, []);

  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) return '表示名を入力してください';
    if (value.trim().length < 2) return '表示名は2文字以上で入力してください';
    if (value.trim().length > 100) return '表示名は100文字以内で入力してください';
    return null;
  }, []);

  const handleSaveName = useCallback(async () => {
    const error = validateName(displayName);
    if (error) {
      setNameError(error);
      showToast(error, 'error');
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error || '保存に失敗しました';
        logger.error('プロフィール保存失敗', { status: res.status, error: data.error });
        showToast(msg, 'error');
        return;
      }
      setProfile((prev) => prev ? { ...prev, name: displayName.trim() } : prev);
      showToast('表示名を更新しました', 'success');
    } catch (err) {
      logger.error('プロフィール保存エラー', err);
      showToast('ネットワークエラーが発生しました', 'error');
    } finally {
      setSaving(false);
    }
  }, [displayName, validateName]);

  function handleThemeChange(newTheme: ThemePreference) {
    setTheme(newTheme);
    applyTheme(newTheme);
  }

  function handleNotifChange(key: keyof NotificationPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    localStorage.setItem('notification-preferences', JSON.stringify(updated));
    showToast('通知設定を保存しました', 'success');
  }

  async function handleSignOutAll() {
    try {
      // Server action for sign out — redirects to /
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/auth/signout';
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrfToken';
      // Fetch CSRF token
      const csrfRes = await fetch('/api/auth/csrf');
      const csrfData = await csrfRes.json();
      csrfInput.value = csrfData.csrfToken;
      form.appendChild(csrfInput);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      logger.error('ログアウト処理エラー', err);
      showToast('ログアウトに失敗しました', 'error');
    }
  }

  if (!session?.user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        <p>ログインが必要です</p>
        <Button onClick={() => router.push('/login')} variant="outline" className="mt-4">
          ログインページへ
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-48" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-56 mt-1" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <p className="text-muted-foreground mb-4">{fetchError}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          再読み込み
        </Button>
      </div>
    );
  }

  const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'ライト', icon: Sun },
    { value: 'dark', label: 'ダーク', icon: Moon },
    { value: 'system', label: 'システム', icon: Monitor },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard')}
          className="p-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">アカウント設定</h1>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            プロフィール
          </CardTitle>
          <CardDescription>表示名やメールアドレスを管理します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">表示名</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="表示名を入力"
                maxLength={100}
                aria-invalid={!!nameError}
                className={nameError ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              <Button
                onClick={handleSaveName}
                disabled={saving || displayName.trim() === (profile?.name || '')}
                size="sm"
                className="shrink-0"
              >
                <Save className="h-3 w-3 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
            {nameError && (
              <p className="text-xs text-red-500 mt-1">{nameError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              <Mail className="h-3 w-3" />
              メールアドレス
            </Label>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {profile?.email || '未設定'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              <Building2 className="h-3 w-3" />
              所属法人
            </Label>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {profile?.organizationName || '未所属'}
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>パスワード変更</Label>
            <p className="text-xs text-muted-foreground">
              パスワードの変更は認証プロバイダーの設定画面から行えます。
            </p>
            <Button variant="outline" size="sm" disabled>
              パスワード変更（準備中）
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            テーマ設定
          </CardTitle>
          <CardDescription>アプリケーションの外観を選択します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-transparent hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知設定
          </CardTitle>
          <CardDescription>メール通知の受信設定を管理します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <ToggleSwitch
            checked={notifPrefs.emailNotifications}
            onChange={(val) => handleNotifChange('emailNotifications', val)}
            label="メール通知"
            description="シミュレーション結果やお知らせをメールで受け取ります"
          />
          <Separator />
          <ToggleSwitch
            checked={notifPrefs.trialExpiryReminders}
            onChange={(val) => handleNotifChange('trialExpiryReminders', val)}
            label="トライアル期限リマインダー"
            description="トライアル期間の終了が近づくとメールで通知します"
          />
          <div className="pt-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BellOff className="h-3 w-3" />
              メール送信機能は現在準備中です。設定は保存されます。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            セッション管理
          </CardTitle>
          <CardDescription>ログインセッションを管理します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.createdAt && (
            <div className="space-y-1">
              <p className="text-sm font-medium">アカウント作成日</p>
              <p className="text-sm text-muted-foreground">
                {new Date(profile.createdAt).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">現在のセッション</p>
            <p className="text-xs text-muted-foreground">このブラウザでログイン中です</p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOutAll}
            className="w-full text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            全セッションからログアウト
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="mb-6 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-4 w-4" />
            アカウント削除
          </CardTitle>
          <CardDescription>アカウントの削除をリクエストします</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 space-y-1">
                <p className="font-medium">アカウントを削除すると以下のデータが全て失われます:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  <li>全てのシミュレーションデータ</li>
                  <li>企業情報と決算期データ</li>
                  <li>サブスクリプション情報</li>
                  <li>アカウントに紐づく全ての設定</li>
                </ul>
                <p className="mt-2">この操作は取り消すことができません。</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            disabled
            className="w-full border-red-200 text-red-500 cursor-not-allowed"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            削除リクエスト送信（準備中）
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            この機能は今後のアップデートで実装予定です
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
