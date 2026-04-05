'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Building2,
  Users,
  Calculator,
  ClipboardCheck,
  ChevronDown,
  Save,
} from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
import type { ParsedFinancialFields, ParsedRawBS, ParsedRawPL } from '@/components/file-upload';
import { FinancialPreview } from '@/components/financial-preview';
import { WItemsChecklist } from '@/components/w-items-checklist';
import { TechStaffPanel } from '@/components/tech-staff-panel';
import type { IndustryTechValue } from '@/components/tech-staff-panel';
import { ResultView } from '@/components/result-view';
import { ExtractionProgress } from '@/components/extraction-progress';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult, WDetail, SocialItems, KeishinBS, KeishinPL } from '@/lib/engine/types';
import type { KeishinPdfResult } from '@/lib/keishin-pdf-parser';
import { buildKeishinBSFromParsed, buildKeishinPLFromParsed } from '@/lib/engine/parsed-to-keishin';
import { useAutoSave, useRestoreSave } from '@/lib/hooks/use-auto-save';
import { useExtractedData } from '@/lib/hooks/use-extracted-data';
import type { ValidationIssue } from '@/lib/extraction-validator';

// ---- Types ----

interface IndustryInput {
  name: string;
  permitType: '特定' | '一般';
  prevCompletion: string;
  currCompletion: string;
  prevSubcontract: string;
  currSubcontract: string;
  techStaffValue: string;
}

interface BasicInfo {
  companyName: string;
  permitNumber: string;
  reviewBaseDate: string;
  periodNumber: string;
}

interface PrevPeriodData {
  totalCapital: string;
  operatingCF: string;
  allowanceDoubtful: string;
  notesAndReceivable: string;
  constructionPayable: string;
  inventoryAndMaterials: string;
  advanceReceived: string;
}

interface WizardSaveData {
  step: number;
  basicInfo: BasicInfo;
  industries: IndustryInput[];
  equity: string;
  ebitda: string;
  prevData: PrevPeriodData;
  sales: string;
  grossProfit: string;
  ordinaryProfit: string;
  interestExpense: string;
  interestDividendIncome: string;
  currentLiabilities: string;
  fixedLiabilities: string;
  totalCapital: string;
  fixedAssets: string;
  retainedEarnings: string;
  corporateTax: string;
  depreciation: string;
  allowanceDoubtful: string;
  notesAndReceivable: string;
  constructionPayable: string;
  inventoryAndMaterials: string;
  advanceReceived: string;
  wTotal: number;
  wScore: number;
  currentSocialItems?: SocialItems;
}

const WIZARD_SAVE_KEY = 'input-data';

function isWizardEmpty(d: WizardSaveData): boolean {
  return (
    !d.sales &&
    !d.grossProfit &&
    !d.ordinaryProfit &&
    !d.basicInfo.companyName &&
    !d.basicInfo.permitNumber &&
    d.industries.every((i) => !i.name && !i.currCompletion && !i.prevCompletion) &&
    !d.equity &&
    !d.ebitda &&
    d.wTotal === 0
  );
}

// ---- Industry Codes (建設業許可業種 29種) ----

const INDUSTRY_CODES = [
  { code: '01', name: '土木一式工事' },
  { code: '02', name: '建築一式工事' },
  { code: '03', name: '大工工事' },
  { code: '04', name: '左官工事' },
  { code: '05', name: 'とび・土工・コンクリート工事' },
  { code: '06', name: '石工事' },
  { code: '07', name: '屋根工事' },
  { code: '08', name: '電気工事' },
  { code: '09', name: '管工事' },
  { code: '10', name: 'タイル・れんが・ブロック工事' },
  { code: '11', name: '鋼構造物工事' },
  { code: '12', name: '鉄筋工事' },
  { code: '13', name: '舗装工事' },
  { code: '14', name: 'しゅんせつ工事' },
  { code: '15', name: '板金工事' },
  { code: '16', name: 'ガラス工事' },
  { code: '17', name: '塗装工事' },
  { code: '18', name: '防水工事' },
  { code: '19', name: '内装仕上工事' },
  { code: '20', name: '機械器具設置工事' },
  { code: '21', name: '熱絶縁工事' },
  { code: '22', name: '電気通信工事' },
  { code: '23', name: '造園工事' },
  { code: '24', name: 'さく井工事' },
  { code: '25', name: '建具工事' },
  { code: '26', name: '水道施設工事' },
  { code: '27', name: '消防施設工事' },
  { code: '28', name: '清掃施設工事' },
  { code: '29', name: '解体工事' },
] as const;

function IndustryCodeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return INDUSTRY_CODES;
    const q = search.toLowerCase();
    return INDUSTRY_CODES.filter(
      (item) => item.code.includes(q) || item.name.toLowerCase().includes(q)
    );
  }, [search]);

  // Display label for selected value
  const displayLabel = useMemo(() => {
    if (!value) return '';
    const match = INDUSTRY_CODES.find((item) => item.name === value);
    return match ? `${match.code} - ${match.name}` : value;
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center justify-between w-full h-8 text-sm border rounded px-2 bg-background hover:bg-muted/50 transition-colors text-left"
      >
        <span className={value ? '' : 'text-muted-foreground'}>{value ? displayLabel : '業種を選択'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg">
          <div className="p-1.5">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="コードまたは名前で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 text-xs border rounded px-2 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">該当する業種がありません</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => { onChange(item.name); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors ${
                    value === item.name ? 'bg-accent/50 font-medium' : ''
                  }`}
                >
                  <span className="font-mono text-muted-foreground mr-1.5">{item.code}</span>
                  {item.name}
                </button>
              ))
            )}
          </div>
          {value && (
            <div className="border-t p-1.5">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors rounded"
              >
                選択をクリア
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Step Indicator ----

const STEPS = [
  { num: 1, title: '決算書アップロード', icon: Upload },
  { num: 2, title: '提出書データ', icon: Building2 },
  { num: 3, title: '技術職員・社会性', icon: Users },
  { num: 4, title: '前期データ確認', icon: ClipboardCheck },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.num === current;
        const isDone = step.num < current;
        return (
          <div key={step.num} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm ${
              isActive ? 'bg-primary text-primary-foreground' :
              isDone ? 'bg-green-100 text-green-700' :
              'bg-muted/50 text-muted-foreground'
            }`}>
              {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Step{step.num}: {step.title}</span>
              <span className="sm:hidden">{step.num}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

function numField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  unit: string = '千円',
  help?: string,
  status?: 'auto-filled' | 'needs-input'
) {
  return (
    <div className={`space-y-1 rounded-md p-1.5 transition-colors ${
      status === 'auto-filled' ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-green-200 dark:ring-green-800' :
      status === 'needs-input' ? 'bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-800' : ''
    }`}>
      <Label className="text-xs font-medium flex items-center gap-1">
        {label}
        {status === 'auto-filled' && <span className="text-[9px] text-green-600 font-normal">自動</span>}
        {status === 'needs-input' && <span className="text-[9px] text-amber-600 font-normal">要入力</span>}
      </Label>
      <div className="flex items-center gap-1">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="text-right text-sm h-8" />
        <span className="text-xs text-muted-foreground whitespace-nowrap w-8">{unit}</span>
      </div>
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

// ---- Props ----

interface InputWizardProps {
  /** Pre-loaded input data from a saved simulation */
  initialInputData?: Record<string, unknown>;
  /** Pre-loaded result data from a saved simulation */
  initialResultData?: Record<string, unknown>;
  /** Existing simulation ID for update instead of create */
  simulationId?: string;
}

// ---- Main Component ----

export function InputWizard({ initialInputData, initialResultData, simulationId: initialSimulationId }: InputWizardProps = {}) {
  const [currentSimulationId, setCurrentSimulationId] = useState<string | undefined>(initialSimulationId);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(initialResultData ? 5 : 1);

  // Helper to extract string from initial data
  const init = (key: string, fallback = ''): string => {
    if (!initialInputData) return fallback;
    const v = initialInputData[key];
    return v !== undefined && v !== null ? String(v) : fallback;
  };

  // Step 1: Financial data from Excel
  const [sales, setSales] = useState(init('sales'));
  const [grossProfit, setGrossProfit] = useState(init('grossProfit'));
  const [ordinaryProfit, setOrdinaryProfit] = useState(init('ordinaryProfit'));
  const [interestExpense, setInterestExpense] = useState(init('interestExpense'));
  const [interestDividendIncome, setInterestDividendIncome] = useState(init('interestDividendIncome'));
  const [currentLiabilities, setCurrentLiabilities] = useState(init('currentLiabilities'));
  const [fixedLiabilities, setFixedLiabilities] = useState(init('fixedLiabilities'));
  const [totalCapital, setTotalCapital] = useState(init('totalCapital'));
  const [equity, setEquity] = useState(init('equity'));
  const [fixedAssets, setFixedAssets] = useState(init('fixedAssets'));
  const [retainedEarnings, setRetainedEarnings] = useState(init('retainedEarnings'));
  const [corporateTax, setCorporateTax] = useState(init('corporateTax'));
  const [depreciation, setDepreciation] = useState(init('depreciation'));
  const [allowanceDoubtful, setAllowanceDoubtful] = useState(init('allowanceDoubtful'));
  const [notesAndReceivable, setNotesAndReceivable] = useState(init('notesAndReceivable'));
  const [constructionPayable, setConstructionPayable] = useState(init('constructionPayable'));
  const [inventoryAndMaterials, setInventoryAndMaterials] = useState(init('inventoryAndMaterials'));
  const [advanceReceived, setAdvanceReceived] = useState(init('advanceReceived'));
  const [fileLoaded, setFileLoaded] = useState(!!initialInputData);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [previewBS, setPreviewBS] = useState<ParsedRawBS | null>(null);
  const [previewPL, setPreviewPL] = useState<ParsedRawPL | null>(null);

  // Step 2: Basic info + industries + X2 data
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(() => {
    if (!initialInputData) return { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' };
    const bi = initialInputData.basicInfo as BasicInfo | undefined;
    return bi ?? { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' };
  });
  const [ebitda, setEbitda] = useState(init('ebitda'));
  const [industries, setIndustries] = useState<IndustryInput[]>(() => {
    if (initialInputData?.industries && Array.isArray(initialInputData.industries)) {
      return initialInputData.industries as IndustryInput[];
    }
    return [{ name: '', permitType: '特定', prevCompletion: '', currCompletion: '', prevSubcontract: '', currSubcontract: '', techStaffValue: '' }];
  });

  // Step 3: W items
  const [wDetail, setWDetail] = useState<WDetail | null>(null);
  const [wTotal, setWTotal] = useState(0);
  const [wScore, setWScore] = useState(0);
  const [externalWItems, setExternalWItems] = useState<Partial<SocialItems> | undefined>(undefined);
  const [currentSocialItems, setCurrentSocialItems] = useState<SocialItems | undefined>(undefined);

  // Step 3: Tech staff auto-calculation
  const [autoTechValues, setAutoTechValues] = useState<Record<string, number>>({});
  const [techValueDetails, setTechValueDetails] = useState<IndustryTechValue[]>([]);
  // Step 3: Extracted staff list from PDF (for TechStaffPanel auto-populate)
  const [extractedStaff, setExtractedStaff] = useState<KeishinPdfResult['staffList']>(undefined);
  const [techValueOverrides, setTechValueOverrides] = useState<Record<number, boolean>>({});

  // 提出書PDF読込状態
  const [keishinPdfLoaded, setKeishinPdfLoaded] = useState(false);
  const [keishinPdfProcessing, setKeishinPdfProcessing] = useState(false);
  const [keishinPdfError, setKeishinPdfError] = useState<string | null>(null);
  const [keishinPdfMappings, setKeishinPdfMappings] = useState<{ source: string; target: string; value: string | number }[]>([]);
  const [keishinPdfComplete, setKeishinPdfComplete] = useState(false);
  // 抽出データ管理（バリデーション・データソース追跡）
  const extractedData = useExtractedData();
  const [extractionWarnings, setExtractionWarnings] = useState<ValidationIssue[]>([]);

  // Step 4: Previous period
  const [prevData, setPrevData] = useState<PrevPeriodData>(() => {
    if (initialInputData?.prevData) return initialInputData.prevData as PrevPeriodData;
    return { totalCapital: '', operatingCF: '', allowanceDoubtful: '', notesAndReceivable: '', constructionPayable: '', inventoryAndMaterials: '', advanceReceived: '' };
  });
  const [prevFileLoading, setPrevFileLoading] = useState(false);
  const [prevFileComplete, setPrevFileComplete] = useState(false);
  const [prevFileName, setPrevFileName] = useState<string | null>(null);
  const [prevFileError, setPrevFileError] = useState<string | null>(null);
  const prevFileRef = useRef<HTMLInputElement>(null);
  // Track which prevData fields were auto-filled from the prev period upload in Step 1
  const [prevAutoFilledFields, setPrevAutoFilledFields] = useState<Set<string>>(new Set());
  const [prevPeriodFileLoaded, setPrevPeriodFileLoaded] = useState(false);

  // Result
  type ResultType = {
    Y: number; X2: number; X21: number; X22: number; W: number; wTotal: number;
    yResult: YResult; wDetail: WDetail;
    industries: Array<{ name: string; X1: number; Z: number; Z1: number; Z2: number; P: number; x1TwoYearAvg: number; x1Current: number; x1Selected: '2年平均' | '当期' }>;
    bs?: KeishinBS; pl?: KeishinPL;
  };
  const [result, setResult] = useState<ResultType | null>(
    initialResultData ? initialResultData as ResultType : null
  );

  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // ---- Auto-save / Restore ----
  const [restoreBannerDismissed, setRestoreBannerDismissed] = useState(false);

  const wizardSnapshot: WizardSaveData = useMemo(() => ({
    step, basicInfo, industries, equity, ebitda, prevData,
    sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
    currentLiabilities, fixedLiabilities, totalCapital, fixedAssets,
    retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
    notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
    wTotal, wScore, currentSocialItems,
  }), [
    step, basicInfo, industries, equity, ebitda, prevData,
    sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
    currentLiabilities, fixedLiabilities, totalCapital, fixedAssets,
    retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
    notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
    wTotal, wScore, currentSocialItems,
  ]);

  // Don't auto-save when wizard is empty or showing results, or when loaded from props
  const shouldSave = !initialInputData && step <= 4 && !isWizardEmpty(wizardSnapshot);
  const { savedAt, clear: clearAutoSave } = useAutoSave<WizardSaveData>(
    WIZARD_SAVE_KEY,
    wizardSnapshot,
    shouldSave ? 500 : Infinity
  );

  const {
    data: savedData,
    hasSavedData,
    discard: discardSavedData,
  } = useRestoreSave<WizardSaveData>(WIZARD_SAVE_KEY);

  const showRestoreBanner = hasSavedData && !restoreBannerDismissed && !initialInputData && step <= 4;

  function handleRestore() {
    if (!savedData) return;
    setStep(savedData.step);
    setBasicInfo(savedData.basicInfo);
    setIndustries(savedData.industries);
    setEquity(savedData.equity);
    setEbitda(savedData.ebitda);
    setPrevData(savedData.prevData);
    setSales(savedData.sales);
    setGrossProfit(savedData.grossProfit);
    setOrdinaryProfit(savedData.ordinaryProfit);
    setInterestExpense(savedData.interestExpense);
    setInterestDividendIncome(savedData.interestDividendIncome);
    setCurrentLiabilities(savedData.currentLiabilities);
    setFixedLiabilities(savedData.fixedLiabilities);
    setTotalCapital(savedData.totalCapital);
    setFixedAssets(savedData.fixedAssets);
    setRetainedEarnings(savedData.retainedEarnings);
    setCorporateTax(savedData.corporateTax);
    setDepreciation(savedData.depreciation);
    setAllowanceDoubtful(savedData.allowanceDoubtful);
    setNotesAndReceivable(savedData.notesAndReceivable);
    setConstructionPayable(savedData.constructionPayable);
    setInventoryAndMaterials(savedData.inventoryAndMaterials);
    setAdvanceReceived(savedData.advanceReceived);
    setWTotal(savedData.wTotal);
    setWScore(savedData.wScore);
    if (savedData.currentSocialItems) setCurrentSocialItems(savedData.currentSocialItems);
    if (savedData.sales) setFileLoaded(true);
    setRestoreBannerDismissed(true);
  }

  function handleDiscard() {
    discardSavedData();
    setRestoreBannerDismissed(true);
  }

  // Clear step validation error when user types in the sales field
  function handleSalesChange(v: string) {
    setSales(v);
    if (stepError) setStepError(null);
  }

  function validateStep(current: number): boolean {
    if (current === 1) {
      const salesNum = parseFloat(sales);
      if (!sales || isNaN(salesNum) || salesNum <= 0) {
        setStepError('完成工事高（売上高）は必須です。0より大きい値を入力してください。');
        return false;
      }
      setStepError(null);
      return true;
    }
    return true;
  }

  function handleNextStep() {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  }

  function num(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // File parsed handler
  function handleFileParsed(
    data: ParsedFinancialFields,
    rawBS?: ParsedRawBS,
    rawPL?: ParsedRawPL
  ) {
    const filled = new Set<string>();
    const fieldSetters: Record<string, (v: string) => void> = {
      sales: setSales,
      grossProfit: setGrossProfit,
      ordinaryProfit: setOrdinaryProfit,
      interestExpense: setInterestExpense,
      interestDividendIncome: setInterestDividendIncome,
      currentLiabilities: setCurrentLiabilities,
      fixedLiabilities: setFixedLiabilities,
      totalCapital: setTotalCapital,
      equity: setEquity,
      fixedAssets: setFixedAssets,
      retainedEarnings: setRetainedEarnings,
      corporateTax: setCorporateTax,
      depreciation: setDepreciation,
      allowanceDoubtful: setAllowanceDoubtful,
      notesAndReceivable: setNotesAndReceivable,
      constructionPayable: setConstructionPayable,
      inventoryAndMaterials: setInventoryAndMaterials,
      advanceReceived: setAdvanceReceived,
    };

    for (const [key, setter] of Object.entries(fieldSetters)) {
      const val = data[key as keyof ParsedFinancialFields];
      if (val !== undefined) {
        setter(String(val));
        filled.add(key);
      }
    }

    setAutoFilledFields(filled);
    setFileLoaded(true);

    // BS/PLプレビュー用データを保存
    setPreviewBS(rawBS ?? null);
    setPreviewPL(rawPL ?? null);
  }

  // FileUploadクリア時のリセット
  function handleFileClear() {
    setAutoFilledFields(new Set());
    setPreviewBS(null);
    setPreviewPL(null);
    setFileLoaded(false);
  }

  // 前期決算書アップロード（Step 1）のハンドラ
  function handlePrevFileParsed(data: ParsedFinancialFields) {
    const filled = new Set<string>();
    const updated: PrevPeriodData = { ...prevData };

    // totalCapital = BS totalAssets
    if (data.totalCapital !== undefined) {
      updated.totalCapital = String(data.totalCapital);
      filled.add('totalCapital');
    }
    // allowanceDoubtful
    if (data.allowanceDoubtful !== undefined) {
      updated.allowanceDoubtful = String(data.allowanceDoubtful);
      filled.add('allowanceDoubtful');
    }
    // notesAndReceivable = notesReceivable + accountsReceivableConstruction
    if (data.notesAndReceivable !== undefined) {
      updated.notesAndReceivable = String(data.notesAndReceivable);
      filled.add('notesAndReceivable');
    }
    // constructionPayable
    if (data.constructionPayable !== undefined) {
      updated.constructionPayable = String(data.constructionPayable);
      filled.add('constructionPayable');
    }
    // inventoryAndMaterials = wipConstruction + materialInventory
    if (data.inventoryAndMaterials !== undefined) {
      updated.inventoryAndMaterials = String(data.inventoryAndMaterials);
      filled.add('inventoryAndMaterials');
    }
    // advanceReceived
    if (data.advanceReceived !== undefined) {
      updated.advanceReceived = String(data.advanceReceived);
      filled.add('advanceReceived');
    }
    // operatingCF: 前々期データが必要なため自動計算不可、0に設定
    // (前期のPLデータだけでは営業CFは算出できない)
    if (!updated.operatingCF) {
      updated.operatingCF = '0';
    }

    setPrevData(updated);
    setPrevAutoFilledFields(filled);
    setPrevPeriodFileLoaded(true);
  }

  function handlePrevFileClear() {
    setPrevAutoFilledFields(new Set());
    setPrevPeriodFileLoaded(false);
  }

  // Previous period file upload handler
  const handlePrevFile = useCallback(async (file: File) => {
    setPrevFileError(null);
    setPrevFileName(file.name);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!['.xlsx', '.xls', '.csv', '.pdf'].includes(ext)) {
      setPrevFileError('対応形式: Excel (.xlsx/.xls), CSV, PDF');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setPrevFileError('ファイルサイズが50MBを超えています。');
      return;
    }

    setPrevFileLoading(true);
    setPrevFileComplete(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const apiUrl = ext === '.pdf' ? '/api/parse-pdf' : '/api/parse-excel';
      const res = await fetch(apiUrl, { method: 'POST', body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `解析エラー (${res.status})`);
      }
      const parsed = await res.json();
      const { data } = parsed;

      // Map BS data to prevData fields
      // ※ parse-pdf API はすでに千円単位で返す（autoCorrectUnit適用済み）
      //   のでここで /1000 してはいけない
      const updated: PrevPeriodData = { ...prevData };
      if (data.bs?.totals?.totalAssets) updated.totalCapital = String(data.bs.totals.totalAssets);
      if (data.bs?.currentAssets?.['貸倒引当金'] !== undefined) updated.allowanceDoubtful = String(Math.abs(data.bs.currentAssets['貸倒引当金']));

      // 受取手形 + 完成工事未収入金
      const notes = data.bs?.currentAssets?.['受取手形'] || 0;
      const acctRec = data.bs?.currentAssets?.['完成工事未収入金'] || 0;
      if (notes || acctRec) updated.notesAndReceivable = String(notes + acctRec);

      // 工事未払金
      if (data.bs?.currentLiabilities?.['工事未払金']) updated.constructionPayable = String(data.bs.currentLiabilities['工事未払金']);

      // 未成工事支出金 + 材料貯蔵品
      const wip = data.bs?.currentAssets?.['未成工事支出金'] || 0;
      const mat = data.bs?.currentAssets?.['材料貯蔵品'] || 0;
      if (wip || mat) updated.inventoryAndMaterials = String(wip + mat);

      // 未成工事受入金
      if (data.bs?.currentLiabilities?.['未成工事受入金']) updated.advanceReceived = String(data.bs.currentLiabilities['未成工事受入金']);

      setPrevData(updated);
      setPrevFileComplete(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      setPrevFileError(e instanceof Error ? e.message : '解析に失敗しました。');
    } finally {
      setPrevFileLoading(false);
      setPrevFileComplete(false);
    }
  }, [prevData]);


  // 経審提出書PDFアップロード処理
  async function handleKeishinPdfUpload(file: File) {
    setKeishinPdfError(null);
    setKeishinPdfProcessing(true);
    setKeishinPdfComplete(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-keishin-pdf', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '解析に失敗しました');
      }
      const data: KeishinPdfResult = await res.json();

      // 抽出データをバリデーション＆処理
      const processed = extractedData.processExtraction(data);

      // バリデーション警告を保存
      setExtractionWarnings(processed.validationIssues);
      if (processed.validationIssues.length > 0) {
        console.log('[Keishin PDF] Validation issues:', processed.validationIssues.length,
          processed.validationIssues.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join(', '));
      }

      // Step 2: 基本情報（バリデーション済み）
      if (processed.basicInfo.companyName) setBasicInfo(prev => ({ ...prev, companyName: processed.basicInfo.companyName }));
      if (processed.basicInfo.permitNumber) setBasicInfo(prev => ({ ...prev, permitNumber: processed.basicInfo.permitNumber }));
      if (processed.basicInfo.reviewBaseDate) setBasicInfo(prev => ({ ...prev, reviewBaseDate: processed.basicInfo.reviewBaseDate }));
      if (processed.basicInfo.periodNumber) setBasicInfo(prev => ({ ...prev, periodNumber: processed.basicInfo.periodNumber }));

      // Step 2: X2データ
      if (processed.ebitda) setEbitda(String(processed.ebitda));
      // 自己資本額（= 純資産合計）→ Step1のequityにも反映
      if (processed.equity && !equity) setEquity(String(processed.equity));

      // Step 2: 業種別完成工事高（正規化済み業種名）
      if (processed.industries.length > 0) {
        setIndustries(processed.industries);
      }

      // Step 3: W項目（バリデーション済み、techStaffCount・businessYearsもマージ済み）
      if (Object.keys(processed.wItems).length > 0) {
        setExternalWItems(processed.wItems);
        console.log('[Keishin PDF] W items extracted:', Object.keys(processed.wItems).length, 'items',
          JSON.stringify(processed.wItems));
      }

      // Step 3: 技術職員リストをTechStaffPanelに渡す
      if (processed.staffList && processed.staffList.length > 0) {
        setExtractedStaff(processed.staffList);
        console.log('[Keishin PDF] Staff list extracted:', processed.staffList.length, 'entries');
      }

      setKeishinPdfMappings(data.mappings || []);
      setKeishinPdfLoaded(true);
      // Signal completion so progress bar jumps to 100%
      setKeishinPdfComplete(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      setKeishinPdfError(e instanceof Error ? e.message : '提出書PDFの解析に失敗しました');
    } finally {
      setKeishinPdfProcessing(false);
      setKeishinPdfComplete(false);
    }
  }

  function addIndustry() {
    setIndustries([...industries, { name: '', permitType: '一般', prevCompletion: '', currCompletion: '', prevSubcontract: '', currSubcontract: '', techStaffValue: '' }]);
  }

  function removeIndustry(i: number) {
    setIndustries(industries.filter((_, idx) => idx !== i));
  }

  function updateIndustry(i: number, field: keyof IndustryInput, value: string) {
    const u = [...industries];
    u[i] = { ...u[i], [field]: value };
    setIndustries(u);
  }

  // Calculate
  function handleCalculate() {
    setError(null);
    try {
      const yInput: YInput = {
        sales: num(sales), grossProfit: num(grossProfit), ordinaryProfit: num(ordinaryProfit),
        interestExpense: num(interestExpense), interestDividendIncome: num(interestDividendIncome),
        currentLiabilities: num(currentLiabilities), fixedLiabilities: num(fixedLiabilities),
        totalCapital: num(totalCapital), equity: num(equity), fixedAssets: num(fixedAssets),
        retainedEarnings: num(retainedEarnings), corporateTax: num(corporateTax),
        depreciation: num(depreciation), allowanceDoubtful: num(allowanceDoubtful),
        notesAndAccountsReceivable: num(notesAndReceivable),
        constructionPayable: num(constructionPayable),
        inventoryAndMaterials: num(inventoryAndMaterials), advanceReceived: num(advanceReceived),
        prev: {
          totalCapital: num(prevData.totalCapital),
          operatingCF: num(prevData.operatingCF),
          allowanceDoubtful: num(prevData.allowanceDoubtful),
          notesAndAccountsReceivable: num(prevData.notesAndReceivable),
          constructionPayable: num(prevData.constructionPayable),
          inventoryAndMaterials: num(prevData.inventoryAndMaterials),
          advanceReceived: num(prevData.advanceReceived),
        },
      };

      if (yInput.sales <= 0) { setError('完成工事高（売上高）を入力してください。'); return; }

      const yResult = calculateY(yInput);
      const x21 = lookupScore(X21_TABLE, num(equity));
      const x22 = lookupScore(X22_TABLE, num(ebitda));
      const x2 = calculateX2(x21, x22);
      const W = wScore || Math.floor((wTotal * 1750) / 200);
      const wDet = wDetail || { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, w8: 0, total: wTotal };

      const industryResults = industries
        .filter((ind) => ind.name)
        .map((ind) => {
          const avgComp = Math.floor((num(ind.prevCompletion) + num(ind.currCompletion)) / 2);
          const currComp = num(ind.currCompletion);
          const adoptedComp = Math.max(avgComp, currComp);
          const x1Selected: '2年平均' | '当期' = avgComp >= currComp ? '2年平均' : '当期';
          const avgSub = Math.floor((num(ind.prevSubcontract) + num(ind.currSubcontract)) / 2);
          const techVal = num(ind.techStaffValue);
          const X1 = lookupScore(X1_TABLE, adoptedComp);
          const z1 = lookupScore(Z1_TABLE, techVal);
          const z2 = lookupScore(Z2_TABLE, avgSub);
          const Z = calculateZ(z1, z2);
          const P = calculateP(X1, x2, yResult.Y, Z, W);
          return { name: ind.name, X1, Z, Z1: z1, Z2: z2, P, x1TwoYearAvg: avgComp, x1Current: currComp, x1Selected };
        });

      const bs = previewBS ? buildKeishinBSFromParsed(previewBS) : undefined;
      const pl = previewPL ? buildKeishinPLFromParsed(previewPL) : undefined;
      const resultObj: ResultType = { Y: yResult.Y, X2: x2, X21: x21, X22: x22, W, wTotal, yResult, wDetail: wDet, industries: industryResults, bs, pl };
      setResult(resultObj);
      setStep(5); // Go to result

      // Clear localStorage auto-save on successful calculation
      clearAutoSave();

      // Auto-save to database
      const inputDataPayload = {
        sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
        currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets,
        retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
        notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
        ebitda, basicInfo, industries, prevData,
      };

      saveSimulation(inputDataPayload, resultObj);
    } catch (e) {
      setError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    }
  }

  async function saveSimulation(inputData: Record<string, unknown>, resultData: ResultType) {
    setSaving(true);
    try {
      const payload = {
        ...(currentSimulationId ? { id: currentSimulationId } : {}),
        name: (inputData.basicInfo as BasicInfo)?.companyName || '無題のシミュレーション',
        period: (inputData.basicInfo as BasicInfo)?.periodNumber || null,
        inputData,
        resultData,
      };

      const method = currentSimulationId ? 'PUT' : 'POST';
      const res = await fetch('/api/simulations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        if (!currentSimulationId && saved.id) {
          setCurrentSimulationId(saved.id);
          // Update URL without full navigation so the user can share/bookmark
          window.history.replaceState(null, '', `/trial/${saved.id}`);
        }
      }
    } catch {
      // Save failure is non-blocking - user still sees the result
      console.error('シミュレーション保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const handleWCalculated = useCallback((detail: WDetail, total: number, w: number, items?: SocialItems) => {
    setWDetail(detail);
    setWTotal(total);
    setWScore(w);
    if (items) setCurrentSocialItems(items);
  }, []);

  // Callback from TechStaffPanel: auto-fill techStaffValue per industry
  const handleTechValuesCalculated = useCallback(
    (values: Record<string, number>, details: IndustryTechValue[]) => {
      setAutoTechValues(values);
      setTechValueDetails(details);

      // Auto-fill industry techStaffValue fields (unless user has manually overridden)
      setIndustries((prev) =>
        prev.map((ind, i) => {
          if (techValueOverrides[i]) return ind; // User override -- don't touch
          const autoVal = values[ind.name];
          if (autoVal !== undefined && autoVal > 0) {
            return { ...ind, techStaffValue: String(autoVal) };
          }
          return ind;
        })
      );
    },
    [techValueOverrides]
  );

  // Mark an industry's techStaffValue as manually overridden
  function handleTechStaffManualEdit(index: number, value: string) {
    setTechValueOverrides((prev) => ({ ...prev, [index]: true }));
    updateIndustry(index, 'techStaffValue', value);
  }

  // Reset override for an industry (re-use auto-calculated value)
  function resetTechStaffOverride(index: number) {
    const autoVal = autoTechValues[industries[index]?.name];
    setTechValueOverrides((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    if (autoVal !== undefined) {
      updateIndustry(index, 'techStaffValue', String(autoVal));
    }
  }

  return (
    <div className="space-y-6">
      {/* Restore banner */}
      {showRestoreBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            前回の入力データがあります
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleDiscard}>
              破棄する
            </Button>
            <Button size="sm" onClick={handleRestore}>
              復元する
            </Button>
          </div>
        </div>
      )}

      {step <= 4 && <StepIndicator current={step} />}

      {/* Step 1: Upload + Financial */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 1: 決算書Excelアップロード</h2>
          <p className="text-sm text-muted-foreground">
            決算書Excelをアップロードすると、BS/PLの数値を自動読取します。手入力も可能です。
          </p>

          {/* 当期 / 前期 アップロードエリア */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 当期決算書 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">当期決算書</h3>
                {basicInfo.periodNumber && <Badge variant="secondary" className="text-xs">{basicInfo.periodNumber}</Badge>}
                {fileLoaded && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="mr-1 h-3 w-3" />読取済み
                  </Badge>
                )}
              </div>
              <FileUpload onDataParsed={handleFileParsed} onClear={handleFileClear} />
            </div>

            {/* 前期決算書 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">前期決算書（任意）</h3>
                {prevPeriodFileLoaded && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="mr-1 h-3 w-3" />読取済み
                  </Badge>
                )}
              </div>
              <FileUpload
                onDataParsed={handlePrevFileParsed}
                onClear={handlePrevFileClear}
                dropLabel="前期の決算書ファイルをドロップ、またはクリックして選択"
                dropDescription="Step 4の前期データを自動入力します"
              />
              {prevPeriodFileLoaded && prevAutoFilledFields.size > 0 && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  前期BS {prevAutoFilledFields.size}項目を自動読取 → Step 4に反映済み
                </div>
              )}
              {prevPeriodFileLoaded && (
                <p className="text-[10px] text-amber-600">
                  ※ 前期の営業CFは前々期データが必要なため自動計算できません。Step 4で手入力してください。
                </p>
              )}
            </div>
          </div>

          {/* BS/PLプレビュー */}
          {(previewBS || previewPL) && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-primary hover:underline flex items-center gap-1.5">
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                自動生成された貸借対照表・損益計算書を確認
              </summary>
              <div className="mt-3">
                <FinancialPreview bs={previewBS ?? undefined} pl={previewPL ?? undefined} />
              </div>
            </details>
          )}

          {fileLoaded && autoFilledFields.size > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                自動入力済み（{autoFilledFields.size}項目）
              </span>
              {autoFilledFields.size < 18 && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                  要手入力（{18 - autoFilledFields.size}項目）
                </span>
              )}
            </div>
          )}

          <div className="space-y-4">
            {/* Group 1: P&L */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">当期財務データ（千円）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">損益計算書（P&L）</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {numField('完成工事高（売上高）', sales, handleSalesChange, '千円', undefined, fileLoaded ? (autoFilledFields.has('sales') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('売上総利益', grossProfit, setGrossProfit, '千円', undefined, fileLoaded ? (autoFilledFields.has('grossProfit') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('経常利益', ordinaryProfit, setOrdinaryProfit, '千円', undefined, fileLoaded ? (autoFilledFields.has('ordinaryProfit') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('支払利息', interestExpense, setInterestExpense, '千円', undefined, fileLoaded ? (autoFilledFields.has('interestExpense') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('受取利息配当金', interestDividendIncome, setInterestDividendIncome, '千円', undefined, fileLoaded ? (autoFilledFields.has('interestDividendIncome') ? 'auto-filled' : 'needs-input') : undefined)}
                  </div>
                </div>

                {/* Group 2: B/S */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">貸借対照表（B/S）</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {numField('流動負債合計', currentLiabilities, setCurrentLiabilities, '千円', undefined, fileLoaded ? (autoFilledFields.has('currentLiabilities') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('固定負債合計', fixedLiabilities, setFixedLiabilities, '千円', undefined, fileLoaded ? (autoFilledFields.has('fixedLiabilities') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('総資本（総資産）', totalCapital, setTotalCapital, '千円', undefined, fileLoaded ? (autoFilledFields.has('totalCapital') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('純資産合計', equity, setEquity, '千円', undefined, fileLoaded ? (autoFilledFields.has('equity') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('固定資産合計', fixedAssets, setFixedAssets, '千円', undefined, fileLoaded ? (autoFilledFields.has('fixedAssets') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('利益剰余金合計', retainedEarnings, setRetainedEarnings, '千円', undefined, fileLoaded ? (autoFilledFields.has('retainedEarnings') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('貸倒引当金（絶対値）', allowanceDoubtful, setAllowanceDoubtful, '千円', undefined, fileLoaded ? (autoFilledFields.has('allowanceDoubtful') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('受取手形+完成工事未収入金', notesAndReceivable, setNotesAndReceivable, '千円', undefined, fileLoaded ? (autoFilledFields.has('notesAndReceivable') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('未成工事受入金', advanceReceived, setAdvanceReceived, '千円', undefined, fileLoaded ? (autoFilledFields.has('advanceReceived') ? 'auto-filled' : 'needs-input') : undefined)}
                  </div>
                </div>

                {/* Group 3: Other */}
                <div className="rounded-lg border border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">その他（原価報告書等）</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {numField('法人税等', corporateTax, setCorporateTax, '千円', undefined, fileLoaded ? (autoFilledFields.has('corporateTax') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('減価償却実施額', depreciation, setDepreciation, '千円', undefined, fileLoaded ? (autoFilledFields.has('depreciation') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('工事未払金', constructionPayable, setConstructionPayable, '千円', '未払経費を含めない', fileLoaded ? (autoFilledFields.has('constructionPayable') ? 'auto-filled' : 'needs-input') : undefined)}
                    {numField('未成工事支出金+材料貯蔵品', inventoryAndMaterials, setInventoryAndMaterials, '千円', undefined, fileLoaded ? (autoFilledFields.has('inventoryAndMaterials') ? 'auto-filled' : 'needs-input') : undefined)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Submission Data */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 2: 経審提出書データ</h2>
          <p className="text-sm text-muted-foreground">
            経審提出書PDFをアップロードすると、基本情報・業種別完工高・W項目を自動読取します。手入力も可能です。
          </p>

          {/* 提出書PDFアップロード */}
          <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
            <CardContent className="py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">経審提出書PDFアップロード</span>
                  {keishinPdfLoaded && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" />読取済み
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  経営規模等評価申請書・別紙一（業種別完工高）・別紙三（W項目）を自動で読み取ります
                </p>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleKeishinPdfUpload(f);
                      }}
                      disabled={keishinPdfProcessing}
                    />
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                      keishinPdfProcessing
                        ? 'bg-muted text-muted-foreground cursor-wait'
                        : 'bg-background hover:bg-accent text-foreground cursor-pointer'
                    }`}>
                      <Upload className="h-4 w-4" />
                      {keishinPdfProcessing ? '解析中...' : 'PDFを選択'}
                    </span>
                  </label>
                </div>
                {keishinPdfProcessing && (
                  <div className="w-full px-2">
                    <ExtractionProgress
                      isActive={keishinPdfProcessing}
                      isComplete={keishinPdfComplete}
                      estimatedDuration={25000}
                    />
                  </div>
                )}
                {keishinPdfError && (
                  <p className="text-xs text-destructive">{keishinPdfError}</p>
                )}
                {keishinPdfLoaded && keishinPdfMappings.length > 0 && (
                  <details className="w-full">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      読み取り項目の詳細（{keishinPdfMappings.length}件）
                    </summary>
                    <div className="mt-2 text-xs bg-muted/50 rounded p-2 max-h-40 overflow-auto">
                      {keishinPdfMappings.map((m, i) => (
                        <div key={i} className="py-0.5">
                          <span className="text-muted-foreground">{m.source}</span>
                          {' → '}
                          <span className="font-medium">{m.target}</span>
                          {' = '}
                          <span className="text-primary">{typeof m.value === 'number' ? m.value.toLocaleString() : m.value}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2 バリデーション警告（基本情報・業種・財務） */}
          {extractionWarnings.filter(w => w.severity === 'warning' || w.severity === 'error').filter(
            w => w.field.startsWith('basicInfo') || w.field.startsWith('industry') || w.field === 'equity' || w.field === 'ebitda' || w.field === 'industries'
          ).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-medium text-amber-800">抽出データの確認事項</p>
              {extractionWarnings.filter(w => w.severity === 'warning' || w.severity === 'error').filter(
                w => w.field.startsWith('basicInfo') || w.field.startsWith('industry') || w.field === 'equity' || w.field === 'ebitda' || w.field === 'industries'
              ).map((issue, i) => (
                <div key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 bg-amber-500" />
                  <span><strong>{issue.label}</strong>: {issue.message}</span>
                </div>
              ))}
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">会社名</Label>
                <Input value={basicInfo.companyName} onChange={(e) => setBasicInfo({ ...basicInfo, companyName: e.target.value })} className="text-sm h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">許可番号</Label>
                <Input value={basicInfo.permitNumber} onChange={(e) => setBasicInfo({ ...basicInfo, permitNumber: e.target.value })} className="text-sm h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">審査基準日</Label>
                <Input value={basicInfo.reviewBaseDate} onChange={(e) => setBasicInfo({ ...basicInfo, reviewBaseDate: e.target.value })} className="text-sm h-8" placeholder="R7.6.30" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">期</Label>
                <Input value={basicInfo.periodNumber} onChange={(e) => setBasicInfo({ ...basicInfo, periodNumber: e.target.value })} className="text-sm h-8" placeholder="第58期" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">続紙：X2用データ（千円）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {numField('利払後事業利益額（X22用 2期平均）', ebitda, setEbitda, '千円', '提出書の続紙に記載')}
              <div className="text-xs text-muted-foreground self-end pb-2">
                ※ X21は「純資産合計」（Step1で入力済み）から自動算出
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">別紙一：業種別完成工事高（千円）</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {industries.map((ind, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="space-y-1 w-48">
                      <Label className="text-xs">業種名</Label>
                      <IndustryCodeSelect value={ind.name} onChange={(v) => updateIndustry(i, 'name', v)} />
                    </div>
                    <div className="space-y-1 w-20">
                      <Label className="text-xs">許可</Label>
                      <select value={ind.permitType} onChange={(e) => updateIndustry(i, 'permitType', e.target.value)} className="w-full h-8 text-xs border rounded px-2 bg-background">
                        <option value="特定">特定</option>
                        <option value="一般">一般</option>
                      </select>
                    </div>
                    {industries.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-destructive h-8 ml-auto" onClick={() => removeIndustry(i)}>削除</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {numField('前年度完工高', ind.prevCompletion, (v) => updateIndustry(i, 'prevCompletion', v))}
                    {numField('当年度完工高', ind.currCompletion, (v) => updateIndustry(i, 'currCompletion', v))}
                    {numField('前年度下請完工高', ind.prevSubcontract, (v) => updateIndustry(i, 'prevSubcontract', v))}
                    {numField('当年度下請完工高', ind.currSubcontract, (v) => updateIndustry(i, 'currSubcontract', v))}
                  </div>
                  {/* 元請完工高（自動計算）: 完成工事高 - 下請完工高 */}
                  {(num(ind.prevCompletion) > 0 || num(ind.currCompletion) > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">前期 元請完工高（自動計算）</Label>
                        <div className="h-8 flex items-center px-2 text-sm font-mono bg-muted/40 rounded border border-dashed">
                          {num(ind.prevCompletion) > 0 ? `¥${(num(ind.prevCompletion) - num(ind.prevSubcontract)).toLocaleString()}千円` : '—'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">当期 元請完工高（自動計算）</Label>
                        <div className="h-8 flex items-center px-2 text-sm font-mono bg-muted/40 rounded border border-dashed">
                          {num(ind.currCompletion) > 0 ? `¥${(num(ind.currCompletion) - num(ind.currSubcontract)).toLocaleString()}千円` : '—'}
                        </div>
                      </div>
                      <div className="col-span-2 self-end text-[10px] text-muted-foreground pb-2">
                        元請完工高 = 完成工事高 − 下請完工高
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      {numField(
                        '技術職員数値',
                        ind.techStaffValue,
                        (v) => handleTechStaffManualEdit(i, v),
                        '点',
                        undefined,
                        autoTechValues[ind.name] !== undefined && !techValueOverrides[i] ? 'auto-filled' : undefined
                      )}
                      {/* Show breakdown when auto-calculated */}
                      {(() => {
                        const detail = techValueDetails.find((d) => d.name === ind.name);
                        if (detail && detail.breakdown.length > 0) {
                          return (
                            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1 mt-0.5">
                              <span className="font-medium">内訳: </span>
                              {detail.breakdown.map((b) => `${b.staffName}(x${b.multiplier})`).join(' + ')}
                              {' = '}
                              {detail.breakdown.map((b) => b.multiplier).join('+')}
                              {'='}
                              {detail.value}点
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {techValueOverrides[i] && autoTechValues[ind.name] !== undefined && (
                        <button
                          type="button"
                          onClick={() => resetTechStaffOverride(i)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          自動計算値({autoTechValues[ind.name]}点)に戻す
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground self-end pb-2 space-y-0.5">
                      {(() => {
                        const avg = Math.floor((num(ind.prevCompletion) + num(ind.currCompletion)) / 2);
                        const curr = num(ind.currCompletion);
                        const isAvgSelected = avg >= curr;
                        return (
                          <>
                            <div className={isAvgSelected ? 'text-green-600 font-medium' : ''}>
                              2年平均: {avg.toLocaleString()}千円{isAvgSelected && ' (採用)'}
                            </div>
                            <div className={!isAvgSelected ? 'text-green-600 font-medium' : ''}>
                              当期: {curr.toLocaleString()}千円{!isAvgSelected && ' (採用)'}
                            </div>
                            <div className="text-[10px]">
                              {isAvgSelected ? '※ 2年平均が大きいため採用' : '※ 当期が大きいため採用'}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIndustry}>+ 業種を追加</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Technical Staff + W */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 3: 技術職員・社会性等</h2>
          <p className="text-sm text-muted-foreground">
            別紙二（技術職員名簿）と別紙三（社会性等W項目）を入力します。
          </p>

          {/* 別紙二: 技術職員名簿 → 業種別技術職員数値の自動計算 */}
          <TechStaffPanel
            industryNames={industries.filter((ind) => ind.name).map((ind) => ind.name)}
            onValuesCalculated={handleTechValuesCalculated}
            externalStaff={extractedStaff}
          />

          {/* 経審提出書PDF: 未読込ならアップロード欄、読込済みなら反映状況を表示 */}
          {!keishinPdfLoaded ? (
            <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
              <CardContent className="py-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">経審提出書PDFからW項目を自動入力</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Step 2 でアップロード済みなら自動反映されます。ここからもアップロードできます。
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleKeishinPdfUpload(f);
                        }}
                        disabled={keishinPdfProcessing}
                      />
                      <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                        keishinPdfProcessing
                          ? 'bg-muted text-muted-foreground cursor-wait'
                          : 'bg-background hover:bg-accent text-foreground cursor-pointer'
                      }`}>
                        <Upload className="h-4 w-4" />
                        {keishinPdfProcessing ? '解析中...' : '提出書PDFを選択'}
                      </span>
                    </label>
                  </div>
                  {keishinPdfProcessing && (
                    <div className="w-full px-2">
                      <ExtractionProgress
                        isActive={keishinPdfProcessing}
                        isComplete={keishinPdfComplete}
                        estimatedDuration={25000}
                      />
                    </div>
                  )}
                  {keishinPdfError && (
                    <p className="text-xs text-destructive">{keishinPdfError}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">提出書PDFから別紙三（W項目）を自動反映済み</span>
                </div>
                {keishinPdfMappings.filter(m => m.source === '別紙三' || m.source.includes('別紙三') || m.target.startsWith('W/')).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {keishinPdfMappings.filter(m => m.source === '別紙三' || m.source.includes('別紙三') || m.target.startsWith('W/')).map((m, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-green-50 border-green-200 text-green-700">
                        {m.target.replace('W/', '')} = {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  読み取れなかった項目は手入力で補完してください
                </p>
              </CardContent>
            </Card>
          )}

          {externalWItems && Object.keys(externalWItems).length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                提出書PDFからW項目を
                {Object.entries(externalWItems).filter(([, v]) => v !== undefined && v !== null && v !== 0 && v !== false).length}
                件自動反映しました。値を確認・修正してください。
              </span>
            </div>
          )}

          {/* バリデーション警告表示 */}
          {extractionWarnings.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-amber-700 hover:underline flex items-center gap-1.5">
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                抽出データの確認事項（{extractionWarnings.length}件）
              </summary>
              <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
                {extractionWarnings.map((issue, i) => (
                  <div key={i} className={`text-xs flex items-start gap-1.5 ${
                    issue.severity === 'error' ? 'text-red-700' :
                    issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
                  }`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${
                      issue.severity === 'error' ? 'bg-red-500' :
                      issue.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <span><strong>{issue.label}</strong>: {issue.message}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <WItemsChecklist onWCalculated={handleWCalculated} externalItems={externalWItems} />

          {wDetail && (
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">W点（社会性等）</div>
              <div className="text-3xl font-bold">{wScore}</div>
              <div className="text-xs text-muted-foreground">素点合計 = {wTotal}</div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Previous Period */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 4: 前期データ確認</h2>
          <p className="text-sm text-muted-foreground">
            Y点の営業CF計算に前期の経審用BS千円値が必要です。
            {prevPeriodFileLoaded
              ? 'Step 1で前期決算書をアップロード済みのため、自動入力されています。内容を確認・修正してください。'
              : 'ファイルアップロードまたは手入力してください。Step 1でも前期決算書をアップロードできます。'}
          </p>

          {/* Previous period file upload */}
          <Card>
            <CardHeader><CardTitle className="text-base">前期決算書をアップロード（任意）</CardTitle></CardHeader>
            <CardContent>
              <div
                onClick={() => prevFileRef.current?.click()}
                className="cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <input
                  ref={prevFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePrevFile(file);
                    e.target.value = '';
                  }}
                />
                {prevFileLoading ? (
                  <div className="w-full px-4 py-2">
                    <ExtractionProgress
                      isActive={prevFileLoading}
                      isComplete={prevFileComplete}
                      estimatedDuration={15000}
                      label="決算書を解析中"
                    />
                  </div>
                ) : prevFileName && !prevFileError ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>{prevFileName} から前期データを読み込みました</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">前期の決算書（Excel/PDF）をクリックまたはドロップ</p>
                    <p className="text-xs text-muted-foreground">BS科目から自動マッピングします</p>
                  </div>
                )}
              </div>
              {prevFileError && (
                <p className="mt-2 text-xs text-destructive">{prevFileError}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                前期（経審用BS千円値）
                {prevPeriodFileLoaded && prevAutoFilledFields.size > 0 && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                    <CheckCircle className="mr-1 h-3 w-3" />Step 1で{prevAutoFilledFields.size}項目を自動入力済み
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {numField('前期 資産合計（総資本）', prevData.totalCapital, (v) => setPrevData({ ...prevData, totalCapital: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('totalCapital') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 営業CF', prevData.operatingCF, (v) => setPrevData({ ...prevData, operatingCF: v }), '千円', '前期③があれば。なければ前期BSから再計算', prevPeriodFileLoaded ? 'needs-input' : undefined)}
              {numField('前期 貸倒引当金', prevData.allowanceDoubtful, (v) => setPrevData({ ...prevData, allowanceDoubtful: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('allowanceDoubtful') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 受取手形+完成工事未収入金', prevData.notesAndReceivable, (v) => setPrevData({ ...prevData, notesAndReceivable: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('notesAndReceivable') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 工事未払金', prevData.constructionPayable, (v) => setPrevData({ ...prevData, constructionPayable: v }), '千円', '未払経費を含めない', prevPeriodFileLoaded ? (prevAutoFilledFields.has('constructionPayable') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 未成工事支出金+材料貯蔵品', prevData.inventoryAndMaterials, (v) => setPrevData({ ...prevData, inventoryAndMaterials: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('inventoryAndMaterials') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 未成工事受入金', prevData.advanceReceived, (v) => setPrevData({ ...prevData, advanceReceived: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('advanceReceived') ? 'auto-filled' : 'needs-input') : undefined)}
            </CardContent>
          </Card>

          <Card className="bg-blue-50/50 border-blue-200">
            <CardContent className="py-4 text-sm text-blue-800">
              <p className="font-medium">2回目以降は自動引継ぎ</p>
              <p className="mt-1 text-xs">前回の試算データがDB内にある場合、前期データは自動で引き継がれます。ここでは確認・修正のみ行ってください。</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Result */}
      {step === 5 && result && (
        <ResultView
          companyName={basicInfo.companyName}
          period={basicInfo.periodNumber}
          reviewBaseDate={basicInfo.reviewBaseDate}
          industries={result.industries}
          Y={result.Y}
          X2={result.X2}
          X21={result.X21}
          X22={result.X22}
          W={result.W}
          wTotal={result.wTotal}
          yResult={result.yResult}
          wDetail={result.wDetail}
          bs={result.bs}
          pl={result.pl}
          yInput={{
            sales: num(sales), grossProfit: num(grossProfit), ordinaryProfit: num(ordinaryProfit),
            interestExpense: num(interestExpense), interestDividendIncome: num(interestDividendIncome),
            currentLiabilities: num(currentLiabilities), fixedLiabilities: num(fixedLiabilities),
            totalCapital: num(totalCapital), equity: num(equity), fixedAssets: num(fixedAssets),
            retainedEarnings: num(retainedEarnings), corporateTax: num(corporateTax),
            depreciation: num(depreciation), allowanceDoubtful: num(allowanceDoubtful),
            notesAndAccountsReceivable: num(notesAndReceivable),
            constructionPayable: num(constructionPayable),
            inventoryAndMaterials: num(inventoryAndMaterials), advanceReceived: num(advanceReceived),
            prev: {
              totalCapital: num(prevData.totalCapital), operatingCF: num(prevData.operatingCF),
              allowanceDoubtful: num(prevData.allowanceDoubtful),
              notesAndAccountsReceivable: num(prevData.notesAndReceivable),
              constructionPayable: num(prevData.constructionPayable),
              inventoryAndMaterials: num(prevData.inventoryAndMaterials),
              advanceReceived: num(prevData.advanceReceived),
            },
          }}
          ebitda={num(ebitda)}
          industryCalcData={industries.filter(ind => ind.name).map((ind, i) => ({
            name: ind.name,
            code: String(i + 1).padStart(2, '0'),
            avgCompletion: Math.floor((num(ind.prevCompletion) + num(ind.currCompletion)) / 2),
            avgSubcontract: Math.floor((num(ind.prevSubcontract) + num(ind.currSubcontract)) / 2),
            techStaffValue: num(ind.techStaffValue),
          }))}
          socialItems={currentSocialItems}
        />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step Validation Error */}
      {stepError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {stepError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        {step > 1 && step <= 4 && (
          <Button variant="outline" onClick={() => { setStepError(null); setStep(step - 1); }}>
            <ArrowLeft className="mr-2 h-4 w-4" />戻る
          </Button>
        )}
        {step === 5 && (
          <Button variant="outline" onClick={() => setStep(4)}>
            <ArrowLeft className="mr-2 h-4 w-4" />入力に戻る
          </Button>
        )}
        <div className="ml-auto">
          {step < 4 && (
            <Button onClick={handleNextStep}>
              次へ<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step === 4 && (
            <Button size="lg" onClick={handleCalculate} className="px-12">
              <Calculator className="mr-2 h-5 w-5" />
              試算実行
            </Button>
          )}
        </div>
      </div>

      {saving && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          保存中...
        </p>
      )}

      {/* Auto-save indicator */}
      {step <= 4 && savedAt && !isWizardEmpty(wizardSnapshot) && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Save className="h-3 w-3" />
          自動保存済み {savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <p className="text-xs text-center text-muted-foreground">
        ※ 本試算は参考値であり、公式の経営事項審査結果通知書ではありません。
      </p>
    </div>
  );
}
