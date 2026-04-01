'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface ParseMapping {
  source: string;
  target: string;
  value: number;
}

interface FileUploadProps {
  onDataParsed: (data: {
    // Y input fields
    sales?: number;
    grossProfit?: number;
    ordinaryProfit?: number;
    interestExpense?: number;
    interestDividendIncome?: number;
    currentLiabilities?: number;
    fixedLiabilities?: number;
    totalCapital?: number;
    equity?: number;
    fixedAssets?: number;
    retainedEarnings?: number;
    corporateTax?: number;
    depreciation?: number;
  }) => void;
}

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
];

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];

export function FileUpload({ onDataParsed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    mappingCount: number;
    warnings: string[];
    mappings: ParseMapping[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setFileName(file.name);

      // Validate extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError(`対応していないファイル形式です。Excel (.xlsx/.xls), CSV, PDF に対応しています。`);
        return;
      }

      // Size check (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('ファイルサイズが50MBを超えています。');
        return;
      }

      setIsProcessing(true);

      try {
        if (ext === '.pdf') {
          setError('PDF読み取りは近日対応予定です。現在はExcel (.xlsx/.xls) をご利用ください。');
          setIsProcessing(false);
          return;
        }

        // Send to API for parsing
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/parse-excel', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || `解析エラー (${res.status})`);
        }

        const parsed = await res.json();
        const { data, warnings, mappings } = parsed;

        // Map parsed RawFinancialData to form fields
        const formValues: Record<string, number> = {};

        if (data.pl) {
          if (data.pl.completedConstruction) {
            formValues.sales = data.pl.completedConstruction + (data.pl.progressConstruction || 0);
          } else if (data.pl.totalSales) {
            formValues.sales = data.pl.totalSales;
          }
          if (data.pl.grossProfit) formValues.grossProfit = data.pl.grossProfit;
          if (data.pl.ordinaryProfit) formValues.ordinaryProfit = data.pl.ordinaryProfit;
          if (data.pl.interestExpense) formValues.interestExpense = data.pl.interestExpense;
          const intDiv = (data.pl.interestIncome || 0) + (data.pl.dividendIncome || 0);
          if (intDiv) formValues.interestDividendIncome = intDiv;
          if (data.pl.corporateTax) formValues.corporateTax = data.pl.corporateTax;
        }

        if (data.bs) {
          if (data.bs.totals?.currentLiabilities) formValues.currentLiabilities = data.bs.totals.currentLiabilities;
          if (data.bs.totals?.fixedLiabilities) formValues.fixedLiabilities = data.bs.totals.fixedLiabilities;
          if (data.bs.totals?.totalAssets) formValues.totalCapital = data.bs.totals.totalAssets;
          if (data.bs.totals?.totalEquity) formValues.equity = data.bs.totals.totalEquity;
          if (data.bs.totals?.fixedAssets) formValues.fixedAssets = data.bs.totals.fixedAssets;

          // 利益剰余金 = 利益準備金 + 別途積立金 + 繰越利益剰余金
          const re =
            (data.bs.equity?.['利益準備金'] || 0) +
            (data.bs.equity?.['別途積立金'] || 0) +
            (data.bs.equity?.['繰越利益剰余金'] || 0);
          if (re) formValues.retainedEarnings = re;
        }

        if (data.manufacturing) {
          const dep = (data.manufacturing.mfgDepreciation || 0) + (data.sga?.sgaDepreciation || 0);
          if (dep) formValues.depreciation = dep;
        }

        setResult({
          success: mappings.length > 0,
          mappingCount: mappings.length,
          warnings,
          mappings,
        });

        if (mappings.length > 0) {
          onDataParsed(formValues);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ファイルの解析に失敗しました。');
      } finally {
        setIsProcessing(false);
      }
    },
    [onDataParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [handleFile]
  );

  function reset() {
    setFileName(null);
    setResult(null);
    setError(null);
  }

  return (
    <Card>
      <CardContent className="pt-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}
            ${isProcessing ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleInputChange}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-2">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">解析中...</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">
                決算書ファイルをドロップ、またはクリックして選択
              </p>
              <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel (.xlsx/.xls)
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  CSV
                </span>
                <span className="flex items-center gap-1 opacity-50">
                  <FileText className="h-3.5 w-3.5" />
                  PDF（準備中）
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                ※ ファイルはサーバーで解析後、保存されません。50MB以下。
              </p>
            </>
          )}
        </div>

        {/* Result feedback */}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {fileName && (
                <Button variant="ghost" size="sm" onClick={reset} className="mt-1 h-6 px-2 text-xs">
                  やり直す
                </Button>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-3 space-y-2">
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                result.success
                  ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300'
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {result.success
                    ? `${fileName} から ${result.mappingCount}項目を読み取りました`
                    : `${fileName} からデータを認識できませんでした`}
                </p>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs mt-1 opacity-80">
                    ⚠ {w}
                  </p>
                ))}
                <Button variant="ghost" size="sm" onClick={reset} className="mt-1 h-6 px-2 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  クリア
                </Button>
              </div>
            </div>

            {/* Show what was mapped */}
            {result.mappings.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  読み取り項目の詳細（{result.mappings.length}件）
                </summary>
                <div className="mt-1 max-h-40 overflow-y-auto rounded border p-2">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-[10px] text-muted-foreground">
                        <th className="py-0.5 text-left">決算書の科目</th>
                        <th className="py-0.5 text-left">→ 割当先</th>
                        <th className="py-0.5 text-right">金額（千円）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.mappings.map((m, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-0.5">{m.source}</td>
                          <td className="py-0.5 text-muted-foreground">{m.target}</td>
                          <td className="py-0.5 text-right font-mono">
                            {m.value.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
