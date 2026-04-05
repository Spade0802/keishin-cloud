'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  BarChart3,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchRow {
  /** Row index in the original file (1-based) */
  rowIndex: number;
  companyName: string;
  fiscalYear: string;
  revenue: number;
  capitalStock: number;
  employees: number;
  yearsInBusiness: number;
  technicalStaff: number;
}

type SimStatus = 'pending' | 'success' | 'error';

interface BatchResult extends BatchRow {
  status: SimStatus;
  pScore: number | null;
  xScore: number | null;
  yScore: number | null;
  zScore: number | null;
  wScore: number | null;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// CSV template
// ---------------------------------------------------------------------------

const CSV_HEADER =
  '法人名,決算期,完成工事高(千円),資本金(千円),従業員数,営業年数,技術職員数';
const CSV_EXAMPLE_ROWS = [
  '株式会社サンプル建設,2025,1200000,50000,45,30,20',
  '有限会社テスト工務店,2025,350000,10000,12,15,5',
  '合同会社デモ設備,2025,800000,30000,28,22,14',
];
const CSV_TEMPLATE = [CSV_HEADER, ...CSV_EXAMPLE_ROWS].join('\n');

function downloadCsvTemplate() {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + CSV_TEMPLATE], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '一括シミュレーション_テンプレート.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function parseCsvText(text: string): { rows: BatchRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], errors: ['ヘッダー行とデータ行が必要です。'] };
  }

  const errors: string[] = [];
  const rows: BatchRow[] = [];

  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 7) {
      errors.push(`${i + 1}行目: 列数が不足しています（${cols.length}/7）`);
      continue;
    }

    const [
      companyName,
      fiscalYear,
      revenueStr,
      capitalStr,
      employeesStr,
      yearsStr,
      techStr,
    ] = cols;

    const revenue = Number(revenueStr);
    const capitalStock = Number(capitalStr);
    const employees = Number(employeesStr);
    const yearsInBusiness = Number(yearsStr);
    const technicalStaff = Number(techStr);

    if (!companyName) {
      errors.push(`${i + 1}行目: 法人名が空です`);
      continue;
    }
    if ([revenue, capitalStock, employees, yearsInBusiness, technicalStaff].some(isNaN)) {
      errors.push(`${i + 1}行目: 数値項目に不正な値があります`);
      continue;
    }

    rows.push({
      rowIndex: i + 1,
      companyName,
      fiscalYear,
      revenue,
      capitalStock,
      employees,
      yearsInBusiness,
      technicalStaff,
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Mock simulation (replace with real API call)
// ---------------------------------------------------------------------------

function simulateRow(row: BatchRow): Promise<BatchResult> {
  return new Promise((resolve) => {
    const delay = 300 + Math.random() * 700;
    setTimeout(() => {
      // Simplified P-score model for demonstration
      const x = Math.round(500 + (row.revenue / 10000) * 0.3 + row.employees * 2);
      const y = Math.round(
        400 +
          Math.min(row.yearsInBusiness, 40) * 3 +
          (row.capitalStock / 1000) * 0.5
      );
      const z = Math.round(600 + row.technicalStaff * 8);
      const w = Math.round(450 + row.employees * 3 + row.yearsInBusiness * 2);
      const p = Math.round(0.25 * x + 0.15 * y + 0.25 * z + 0.15 * w + 0.2 * 500);

      resolve({
        ...row,
        status: 'success',
        pScore: Math.min(p, 2000),
        xScore: Math.min(x, 2309),
        yScore: Math.min(y, 1750),
        zScore: Math.min(z, 2441),
        wScore: Math.min(w, 1966),
      });
    }, delay);
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SimStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          処理中
        </Badge>
      );
    case 'success':
      return (
        <Badge variant="default">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          完了
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          エラー
        </Badge>
      );
  }
}

function ResultsTable({ results }: { results: BatchResult[] }) {
  if (results.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2.5 text-left font-semibold">ステータス</th>
            <th className="px-3 py-2.5 text-left font-semibold">法人名</th>
            <th className="px-3 py-2.5 text-left font-semibold">決算期</th>
            <th className="px-3 py-2.5 text-right font-semibold">P点</th>
            <th className="px-3 py-2.5 text-right font-semibold">X1</th>
            <th className="px-3 py-2.5 text-right font-semibold">Y</th>
            <th className="px-3 py-2.5 text-right font-semibold">Z</th>
            <th className="px-3 py-2.5 text-right font-semibold">W</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.rowIndex}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-3 py-2.5">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2.5 font-medium">{r.companyName}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.fiscalYear}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                {r.status === 'pending' ? (
                  <Skeleton className="ml-auto h-4 w-12" />
                ) : r.pScore !== null ? (
                  r.pScore.toLocaleString()
                ) : (
                  '-'
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.status === 'pending' ? (
                  <Skeleton className="ml-auto h-4 w-10" />
                ) : r.xScore !== null ? (
                  r.xScore.toLocaleString()
                ) : (
                  '-'
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.status === 'pending' ? (
                  <Skeleton className="ml-auto h-4 w-10" />
                ) : r.yScore !== null ? (
                  r.yScore.toLocaleString()
                ) : (
                  '-'
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.status === 'pending' ? (
                  <Skeleton className="ml-auto h-4 w-10" />
                ) : r.zScore !== null ? (
                  r.zScore.toLocaleString()
                ) : (
                  '-'
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {r.status === 'pending' ? (
                  <Skeleton className="ml-auto h-4 w-10" />
                ) : r.wScore !== null ? (
                  r.wScore.toLocaleString()
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultsSummary({ results }: { results: BatchResult[] }) {
  const completed = results.filter((r) => r.status === 'success');
  const errors = results.filter((r) => r.status === 'error');
  const pending = results.filter((r) => r.status === 'pending');

  if (results.length === 0) return null;

  const avgP =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, r) => sum + (r.pScore ?? 0), 0) / completed.length
        )
      : null;
  const maxP =
    completed.length > 0
      ? Math.max(...completed.map((r) => r.pScore ?? 0))
      : null;
  const minP =
    completed.length > 0
      ? Math.min(...completed.map((r) => r.pScore ?? 0))
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card size="sm">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground mb-1">処理状況</p>
          <p className="text-lg font-bold tabular-nums">
            {completed.length}/{results.length}
            {pending.length > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({pending.length}件処理中)
              </span>
            )}
          </p>
          {errors.length > 0 && (
            <p className="text-xs text-destructive mt-0.5">{errors.length}件エラー</p>
          )}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground mb-1">平均P点</p>
          <p className="text-lg font-bold tabular-nums">
            {avgP !== null ? avgP.toLocaleString() : '-'}
          </p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground mb-1">最高P点</p>
          <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
            {maxP !== null ? maxP.toLocaleString() : '-'}
          </p>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs text-muted-foreground mb-1">最低P点</p>
          <p className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">
            {minP !== null ? minP.toLocaleString() : '-'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function BatchSimulationClient() {
  const [file, setFile] = useState<File | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setParseErrors([]);
    setResults([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFile = useCallback(async (selectedFile: File) => {
    setParseErrors([]);
    setResults([]);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'txt'].includes(ext)) {
      setParseErrors(['CSVファイル(.csv)をアップロードしてください。']);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setParseErrors(['ファイルサイズが大きすぎます（上限: 5MB）。']);
      return;
    }

    setFile(selectedFile);

    const text = await selectedFile.text();
    const { rows, errors } = parseCsvText(text);

    if (errors.length > 0) {
      setParseErrors(errors);
    }

    if (rows.length === 0) {
      if (errors.length === 0) {
        setParseErrors(['有効なデータ行が見つかりませんでした。']);
      }
      return;
    }

    if (rows.length > 100) {
      setParseErrors((prev) => [
        ...prev,
        `一度に処理できる法人数は100件までです。先頭100件を処理します。`,
      ]);
      rows.splice(100);
    }

    // Initialize pending results
    const pendingResults: BatchResult[] = rows.map((row) => ({
      ...row,
      status: 'pending' as SimStatus,
      pScore: null,
      xScore: null,
      yScore: null,
      zScore: null,
      wScore: null,
    }));
    setResults(pendingResults);
    setIsProcessing(true);

    // Process rows sequentially for visible progress
    for (let i = 0; i < rows.length; i++) {
      try {
        const result = await simulateRow(rows[i]);
        setResults((prev) =>
          prev.map((r) => (r.rowIndex === result.rowIndex ? result : r))
        );
      } catch {
        setResults((prev) =>
          prev.map((r) =>
            r.rowIndex === rows[i].rowIndex
              ? { ...r, status: 'error' as SimStatus, errorMessage: '処理に失敗しました' }
              : r
          )
        );
      }
    }

    setIsProcessing(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const exportResults = useCallback(() => {
    if (results.length === 0) return;

    const header = '法人名,決算期,P点,X1,Y,Z,W,ステータス';
    const rows = results.map((r) =>
      [
        r.companyName,
        r.fiscalYear,
        r.pScore ?? '',
        r.xScore ?? '',
        r.yScore ?? '',
        r.zScore ?? '',
        r.wScore ?? '',
        r.status === 'success' ? '完了' : r.status === 'error' ? 'エラー' : '処理中',
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `一括シミュレーション結果_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const hasResults = results.length > 0;
  const allDone = hasResults && results.every((r) => r.status !== 'pending');

  return (
    <>
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          ダッシュボードに戻る
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          一括シミュレーション
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          複数法人の経審P点をCSVファイルから一括試算します。
          行政書士事務所など、多数のクライアントを担当される方に最適です。
        </p>
      </div>

      {/* Step 1 - Template download & file upload */}
      <div className="space-y-6">
        {/* Template download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              CSVテンプレート
            </CardTitle>
            <CardDescription>
              はじめにテンプレートをダウンロードし、法人データを入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="outline" onClick={downloadCsvTemplate}>
                <Download className="mr-1.5 h-4 w-4" />
                テンプレートをダウンロード
              </Button>
              <span className="text-xs text-muted-foreground">
                CSV形式 / UTF-8 / サンプル3社分入り
              </span>
            </div>

            {/* Format reference */}
            <div className="mt-4 rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">CSV列の説明</p>
                  <p>
                    法人名, 決算期, 完成工事高(千円), 資本金(千円), 従業員数, 営業年数,
                    技術職員数
                  </p>
                  <p>1行目はヘッダー行として読み飛ばされます。最大100法人まで一括処理可能です。</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              ファイルアップロード
            </CardTitle>
            <CardDescription>
              入力済みのCSVファイルをドラッグ&ドロップ、またはクリックして選択してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
                ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                }
                ${isProcessing ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInput}
                className="hidden"
                disabled={isProcessing}
              />
              <Upload
                className={`mx-auto mb-3 h-10 w-10 ${
                  isDragOver ? 'text-primary' : 'text-muted-foreground/40'
                }`}
              />
              <p className="text-sm font-medium">
                {file && !isProcessing
                  ? file.name
                  : 'CSVファイルをドラッグ&ドロップ'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                または、クリックしてファイルを選択（.csv / 最大5MB）
              </p>
            </div>

            {/* File info & reset */}
            {file && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                {!isProcessing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetState();
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    クリア
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive mb-1">
                    データの読み込みに問題があります
                  </p>
                  <ul className="space-y-0.5">
                    {parseErrors.map((err, i) => (
                      <li key={i} className="text-xs text-destructive/80">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            シミュレーションを実行しています...
            ({results.filter((r) => r.status !== 'pending').length}/{results.length})
          </div>
        )}

        {/* Summary cards */}
        {hasResults && <ResultsSummary results={results} />}

        {/* Results table */}
        {hasResults && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  シミュレーション結果
                </CardTitle>
                {allDone && (
                  <Button variant="outline" size="sm" onClick={exportResults}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    結果をCSV出力
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResultsTable results={results} />
            </CardContent>
          </Card>
        )}

        {/* Empty state hint (no file uploaded yet) */}
        {!hasResults && !file && parseErrors.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm">
              CSVファイルをアップロードすると、ここにシミュレーション結果が表示されます。
            </p>
          </div>
        )}

        {/* Back to dashboard */}
        <div className="pt-4 text-center">
          <Link href="/dashboard">
            <Button variant="outline">ダッシュボードに戻る</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
