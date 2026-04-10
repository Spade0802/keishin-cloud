'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { ExtractionProgress } from '@/components/extraction-progress';

interface ParseMapping {
  source: string;
  target: string;
  value: number;
}

export interface ParsedFinancialFields {
  // Y input fields (千円)
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
  // BS-derived fields (千円)
  allowanceDoubtful?: number;
  notesAndReceivable?: number;
  constructionPayable?: number;
  inventoryAndMaterials?: number;
  advanceReceived?: number;
}

// BS/PLの構造化生データ（千円）
export interface ParsedRawBS {
  currentAssets: Record<string, number>;
  tangibleFixed: Record<string, number>;
  intangibleFixed: Record<string, number>;
  investments: Record<string, number>;
  currentLiabilities: Record<string, number>;
  fixedLiabilities: Record<string, number>;
  equity: Record<string, number>;
  totals: Record<string, number>;
}

export interface ParsedRawPL {
  completedConstruction: number;
  totalSales: number;
  costOfSales: number;
  grossProfit: number;
  sgaTotal: number;
  operatingProfit: number;
  interestIncome: number;
  dividendIncome: number;
  interestExpense: number;
  ordinaryProfit: number;
  specialGain: number;
  specialLoss: number;
  preTaxProfit: number;
  corporateTax: number;
  netIncome: number;
}

interface FileUploadProps {
  onDataParsed: (
    data: ParsedFinancialFields,
    rawBS?: ParsedRawBS,
    rawPL?: ParsedRawPL
  ) => void;
  onClear?: () => void;
  /** Custom label for the drop zone (default: "決算書ファイルをドロップ、またはクリックして選択") */
  dropLabel?: string;
  /** Custom sub-description below the label */
  dropDescription?: string;
}

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
];

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];

export function FileUpload({ onDataParsed, onClear, dropLabel, dropDescription }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    mappingCount: number;
    warnings: string[];
    mappings: ParseMapping[];
    ocrUsed?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
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
      setIsComplete(false);

      try {
        // Send to appropriate API based on file type
        const formData = new FormData();
        formData.append('file', file);

        const apiUrl = ext === '.pdf' ? '/api/parse-pdf' : '/api/parse-excel';
        const res = await fetch(apiUrl, {
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

        // BS個別科目から5項目を自動導出（千円）
        // Geminiの出力は科目名がフリーテキストなので、表記揺れに対応するヘルパー
        if (data.bs) {
          const findInSection = (section: Record<string, number> | undefined, ...keys: string[]): number => {
            if (!section) return 0;
            // 完全一致
            for (const key of keys) {
              if (section[key] !== undefined) return section[key];
            }
            // Geminiが空白やカッコを含むキーを返す場合の正規化マッチ
            const normalize = (s: string) => s.replace(/[\s　・（）()]/g, '');
            for (const key of keys) {
              const nKey = normalize(key);
              for (const [sectionKey, val] of Object.entries(section)) {
                if (normalize(sectionKey) === nKey) return val;
              }
            }
            return 0;
          };

          // keishinFields（Geminiが明示的に抽出した経審用フィールド）を優先使用
          const kf = (data.bs as Record<string, unknown>).keishinFields as {
            allowanceDoubtful?: number; notesReceivable?: number;
            accountsReceivableConstruction?: number; constructionPayable?: number;
            wipConstruction?: number; materialInventory?: number; advanceReceived?: number;
          } | undefined;

          if (kf && Object.values(kf).some(v => v !== 0 && v !== undefined)) {
            // keishinFieldsがある場合はそちらを使う（科目取り違えリスクが低い）
            if (kf.allowanceDoubtful) formValues.allowanceDoubtful = Math.abs(kf.allowanceDoubtful);
            const notes = kf.notesReceivable || 0;
            const acctRec = kf.accountsReceivableConstruction || 0;
            if (notes || acctRec) formValues.notesAndReceivable = notes + acctRec;
            if (kf.constructionPayable) formValues.constructionPayable = kf.constructionPayable;
            const wip = kf.wipConstruction || 0;
            const mat = kf.materialInventory || 0;
            if (wip || mat) formValues.inventoryAndMaterials = wip + mat;
            if (kf.advanceReceived) formValues.advanceReceived = kf.advanceReceived;
            console.log('[BS Field Mapping] Using keishinFields:', kf);
          } else {
            // keishinFieldsがない場合はcurrentAssets/currentLiabilitiesからフォールバック
            // 貸倒引当金（絶対値）
            const abd = findInSection(data.bs.currentAssets, '貸倒引当金');
            if (abd !== 0) formValues.allowanceDoubtful = Math.abs(abd);

            // 受取手形 + 完成工事未収入金（一般企業の「売掛金」も考慮）
            const notes = findInSection(data.bs.currentAssets, '受取手形');
            const acctRec = findInSection(data.bs.currentAssets, '完成工事未収入金', '売掛金');
            if (notes || acctRec) formValues.notesAndReceivable = notes + acctRec;

            // 工事未払金（一般企業の「買掛金」も考慮。未払経費は含めない）
            const cp = findInSection(data.bs.currentLiabilities, '工事未払金', '買掛金');
            if (cp) formValues.constructionPayable = cp;

            // 未成工事支出金（一般企業の「仕掛品」も考慮） + 材料貯蔵品
            const wip = findInSection(data.bs.currentAssets, '未成工事支出金', '仕掛品');
            const mat = findInSection(data.bs.currentAssets, '材料貯蔵品');
            if (wip || mat) formValues.inventoryAndMaterials = wip + mat;

            // 未成工事受入金（一般企業の「前受金」も考慮）
            const adv = findInSection(data.bs.currentLiabilities, '未成工事受入金', '前受金');
            if (adv) formValues.advanceReceived = adv;
          }

          // デバッグログ: 抽出された値を確認
          console.log('[BS Field Mapping] Raw currentAssets:', JSON.stringify(data.bs.currentAssets));
          console.log('[BS Field Mapping] Raw currentLiabilities:', JSON.stringify(data.bs.currentLiabilities));
          console.log('[BS Field Mapping] Mapped values:', {
            allowanceDoubtful: formValues.allowanceDoubtful,
            notesAndReceivable: formValues.notesAndReceivable,
            constructionPayable: formValues.constructionPayable,
            inventoryAndMaterials: formValues.inventoryAndMaterials,
            advanceReceived: formValues.advanceReceived,
          });
        }

        // 構造化BS/PLデータを構築
        const rawBS: ParsedRawBS | undefined = data.bs ? {
          currentAssets: data.bs.currentAssets || {},
          tangibleFixed: data.bs.tangibleFixed || {},
          intangibleFixed: data.bs.intangibleFixed || {},
          investments: data.bs.investments || {},
          currentLiabilities: data.bs.currentLiabilities || {},
          fixedLiabilities: data.bs.fixedLiabilities || {},
          equity: data.bs.equity || {},
          totals: data.bs.totals || {},
        } : undefined;

        const rawPL: ParsedRawPL | undefined = data.pl ? {
          completedConstruction: data.pl.completedConstruction || 0,
          totalSales: data.pl.totalSales || 0,
          costOfSales: data.pl.costOfSales || 0,
          grossProfit: data.pl.grossProfit || 0,
          sgaTotal: data.pl.sgaTotal || 0,
          operatingProfit: data.pl.operatingProfit || 0,
          interestIncome: data.pl.interestIncome || 0,
          dividendIncome: data.pl.dividendIncome || 0,
          interestExpense: data.pl.interestExpense || 0,
          ordinaryProfit: data.pl.ordinaryProfit || 0,
          specialGain: data.pl.specialGain || 0,
          specialLoss: data.pl.specialLoss || 0,
          preTaxProfit: data.pl.preTaxProfit || 0,
          corporateTax: data.pl.corporateTax || 0,
          netIncome: data.pl.netIncome || 0,
        } : undefined;

        setResult({
          success: mappings.length > 0,
          mappingCount: mappings.length,
          warnings,
          mappings,
          ocrUsed: parsed.ocrUsed || false,
        });

        if (mappings.length > 0) {
          onDataParsed(formValues, rawBS, rawPL);
        }
        // Signal completion so progress bar jumps to 100%
        setIsComplete(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ファイルの解析に失敗しました。');
      } finally {
        // Small delay so user sees 100% before hiding the progress bar
        setTimeout(() => setIsProcessing(false), 400);
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
    setIsComplete(false);
    onClear?.();
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
            <div className="space-y-2 px-2">
              <ExtractionProgress
                isActive={isProcessing}
                isComplete={isComplete}
                estimatedDuration={20000}
                label="決算書を解析中"
              />
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">
                {dropLabel || '決算書ファイルをドロップ、またはクリックして選択'}
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
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  PDF（OCR対応）
                </span>
              </div>
              {dropDescription && (
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">{dropDescription}</p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                ※ ファイルはサーバーで解析後、保存されません。スキャンPDFはOCR処理されます。50MB以下。
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
                  {result.ocrUsed && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      OCR使用
                    </span>
                  )}
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
