// TODO: PERF-7 - Extract step components to reduce 30+ useState in this file
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileSpreadsheet,
  Building2,
  Users,
  Calculator,
  ChevronDown,
  Save,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { FileUpload } from '@/components/file-upload';
import type { ParsedFinancialFields, ParsedRawBS, ParsedRawPL } from '@/components/file-upload';
import { FinancialPreview } from '@/components/financial-preview';
import { WItemsChecklist } from '@/components/w-items-checklist';
import { TechStaffPanel } from '@/components/tech-staff-panel';
import type { IndustryTechValue } from '@/components/tech-staff-panel';
import dynamic from 'next/dynamic';
const ResultView = dynamic(() => import('@/components/result-view').then(mod => ({ default: mod.ResultView })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>,
});
import { ExtractionProgress } from '@/components/extraction-progress';
import { OnboardingCallout } from '@/components/onboarding-guide';
import { HelpPanel } from '@/components/help-panel';
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW, calculateX1WithAverage } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult, WDetail, SocialItems, KeishinBS, KeishinPL } from '@/lib/engine/types';
import type { KeishinPdfResult } from '@/lib/keishin-pdf-parser';
import { buildKeishinBSFromParsed, buildKeishinPLFromParsed } from '@/lib/engine/parsed-to-keishin';
import { useAutoSave, useRestoreSave } from '@/lib/hooks/use-auto-save';
import { useExtractedData } from '@/lib/hooks/use-extracted-data';
import type { ValidationIssue } from '@/lib/extraction-validator';
import { showToast } from '@/components/ui/toast';
import {
  getFinancialFieldWarning,
  detectIndustryDuplicate,
  getIndustryWDefaults,
  INDUSTRY_W_DEFAULTS,
  type FieldWarning,
} from '@/lib/input-wizard-validation';

// ---- Types ----

interface IndustryInput {
  name: string;
  permitType: '特定' | '一般';
  prevCompletion: string;
  currCompletion: string;
  /** 前々期完成工事高（激変緩和措置の3年平均用、任意） */
  prevPrevCompletion: string;
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
  notes?: string;
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

// Industry code groups for categorised display
const INDUSTRY_GROUPS = [
  { label: '一式工事（2種）', codes: ['01', '02'] },
  { label: '専門工事（27種）', codes: ['03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29'] },
] as const;

/**
 * Format a value in 千円 (thousands of yen) to a human-readable Japanese string.
 * e.g. 100000 (= 1億円) → "= 1億円", 12000 → "= 1,200万円", 123456 → "= 1億2,345万6千円"
 */
function formatSenYenHint(value: string): string | null {
  const n = parseFloat(value);
  if (isNaN(n) || n === 0) return null;
  // value is in 千円, so actual yen = n * 1000
  const absN = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  // absN is in 千円 units
  const oku = Math.floor(absN / 100000); // 1億 = 100,000千円
  const remainder = absN - oku * 100000;
  const man = Math.floor(remainder / 10); // 1万 = 10千円
  const sen = Math.floor(remainder - man * 10); // remaining 千円

  if (absN < 10) return null; // too small to format
  const parts: string[] = [];
  if (oku > 0) parts.push(`${oku.toLocaleString()}億`);
  if (man > 0) parts.push(`${man.toLocaleString()}万`);
  if (sen > 0) parts.push(`${sen}千`);
  if (parts.length === 0) return null;
  return `= ${sign}${parts.join('')}円`;
}

/**
 * Cross-step data consistency checks.
 * Returns an array of warning strings for display in the validation summary.
 */
function checkCrossStepConsistency(
  totalCapital: string,
  equity: string,
  sales: string,
  industries: IndustryInput[],
  wDetail: WDetail | null,
  currentSocialItems: SocialItems | undefined,
  techValueDetails: IndustryTechValue[],
  numFn: (s: string) => number,
): string[] {
  const warnings: string[] = [];
  const tc = numFn(totalCapital);
  const eq = numFn(equity);
  const sl = numFn(sales);

  // 1. totalCapital should be >= equity
  if (tc > 0 && eq > tc) {
    warnings.push(`純資産合計(${eq.toLocaleString()}千円)が総資本(${tc.toLocaleString()}千円)を超えています。Step 1の値を確認してください。`);
  }

  // 2. sales should be >= each industry's completion amount
  const validIndustries = industries.filter((ind) => ind.name);
  for (const ind of validIndustries) {
    const curr = numFn(ind.currCompletion);
    if (sl > 0 && curr > sl) {
      warnings.push(`${ind.name}の当期完成工事高(${curr.toLocaleString()}千円)がStep 1の売上高(${sl.toLocaleString()}千円)を超えています。`);
    }
  }

  // 3. Tech staff count: Step 3 の業種別配置人数が W 項目の総数を超えていないか
  // W項目 techStaffCount = 技術職員の総数（W点用）
  // techValueDetails = 業種別に配置した技術職員（Z点用、総数より少ないのが通常）
  if (currentSocialItems && typeof currentSocialItems.techStaffCount === 'number' && currentSocialItems.techStaffCount > 0) {
    const uniqueStaffNames = new Set<string>();
    for (const detail of techValueDetails) {
      for (const b of detail.breakdown) {
        uniqueStaffNames.add(b.staffName);
      }
    }
    const actualStaffCount = uniqueStaffNames.size;
    if (actualStaffCount > 0 && actualStaffCount > currentSocialItems.techStaffCount) {
      warnings.push(`Step 3で入力した技術職員数(${actualStaffCount}名)がW項目の技術職員数(${currentSocialItems.techStaffCount}名)を超えています。`);
    }
  }

  return warnings;
}

// INDUSTRY_W_DEFAULTS, getIndustryWDefaults, getFinancialFieldWarning
// are imported from @/lib/input-wizard-validation

function IndustryCodeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = 'industry-code-listbox';

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

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [filtered]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  // Display label for selected value
  const displayLabel = useMemo(() => {
    if (!value) return '';
    const match = INDUSTRY_CODES.find((item) => item.name === value);
    return match ? `${match.code} - ${match.name}` : value;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setSearch('');
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          onChange(filtered[highlightIndex].name);
          setOpen(false);
          setSearch('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        className="flex items-center justify-between w-full h-8 text-sm border rounded px-2 bg-background hover:bg-muted/50 transition-colors text-left"
      >
        <span className={value ? '' : 'text-muted-foreground'}>{value ? displayLabel : '業種を選択'}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full sm:w-64 rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          <div className="p-1.5">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="コードまたは名前で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 text-xs border rounded px-2 bg-background outline-none focus:ring-1 focus:ring-ring"
              aria-controls={listId}
              aria-activedescendant={highlightIndex >= 0 ? `industry-option-${filtered[highlightIndex]?.code}` : undefined}
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label="業種一覧" className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">該当する業種がありません</div>
            ) : search ? (
              // When searching, show flat list (no groups)
              filtered.map((item, idx) => (
                <button
                  key={item.code}
                  id={`industry-option-${item.code}`}
                  type="button"
                  role="option"
                  aria-selected={value === item.name}
                  onClick={() => { onChange(item.name); setOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors ${
                    value === item.name ? 'bg-accent/50 font-medium' : ''
                  } ${idx === highlightIndex ? 'bg-accent text-accent-foreground' : ''}`}
                >
                  <span className="font-mono text-muted-foreground mr-1.5">{item.code}</span>
                  {item.name}
                </button>
              ))
            ) : (
              // When not searching, show grouped by category
              (() => {
                let globalIdx = 0;
                return INDUSTRY_GROUPS.map((group) => {
                  const groupItems = filtered.filter((item) => (group.codes as readonly string[]).includes(item.code));
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {group.label}
                      </div>
                      {groupItems.map((item) => {
                        const idx = globalIdx++;
                        return (
                          <button
                            key={item.code}
                            id={`industry-option-${item.code}`}
                            type="button"
                            role="option"
                            aria-selected={value === item.name}
                            onClick={() => { onChange(item.name); setOpen(false); setSearch(''); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground transition-colors ${
                              value === item.name ? 'bg-accent/50 font-medium' : ''
                            } ${idx === highlightIndex ? 'bg-accent text-accent-foreground' : ''}`}
                          >
                            <span className="font-mono text-muted-foreground mr-1.5">{item.code}</span>
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                });
              })()
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
  { num: 4, title: '結果', icon: Calculator },
];

function StepIndicator({ current, maxReached, onNavigate }: { current: number; maxReached: number; onNavigate: (step: number) => void }) {
  const stepsToShow = current >= 4 ? STEPS : STEPS.slice(0, 3);
  return (
    <nav aria-label="ステップ進行" className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {stepsToShow.map((step, i) => {
        const Icon = step.icon;
        const isActive = step.num === current;
        const isVisited = step.num <= maxReached && step.num !== current;
        // Allow clicking any previously visited step, but not the result step (4) via indicator
        const canClick = isVisited && step.num < 4;
        return (
          <div key={step.num} className="flex items-center">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onNavigate(step.num)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' :
                canClick ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer' :
                'bg-muted/50 text-muted-foreground cursor-default'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isVisited && step.num < current ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Step{step.num}: {step.title}</span>
              <span className="sm:hidden">{step.num}</span>
            </button>
            {i < stepsToShow.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
          </div>
        );
      })}
    </nav>
  );
}

function numField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  unit: string = '千円',
  help?: string,
  status?: 'auto-filled' | 'needs-input' | 'pending',
  warning?: FieldWarning | null
) {
  const fieldId = `numfield-${label.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '-')}`;
  return (
    <div className={`space-y-1 rounded-md p-1.5 transition-colors ${
      status === 'auto-filled' ? 'bg-green-50 dark:bg-green-950/20 ring-1 ring-green-200 dark:ring-green-800' :
      status === 'needs-input' ? 'bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-200 dark:ring-amber-800' :
      status === 'pending' ? 'bg-blue-50 dark:bg-blue-950/20 ring-1 ring-blue-200 dark:ring-blue-800' : ''
    }`}>
      <Label htmlFor={fieldId} className="text-xs font-medium flex items-center gap-1">
        {label}
        {status === 'auto-filled' && <span className="text-[9px] text-green-600 font-normal">自動</span>}
        {status === 'needs-input' && <span className="text-[9px] text-amber-600 font-normal">要入力</span>}
        {status === 'pending' && <span className="text-[9px] text-blue-600 font-normal">計算待ち</span>}
      </Label>
      <div className="flex items-center gap-1">
        <Input id={fieldId} type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`text-right text-sm h-10 sm:h-8 ${warning ? 'border-amber-400 focus-visible:ring-amber-400' : ''}`} />
        <span className="text-xs text-muted-foreground whitespace-nowrap w-8">{unit}</span>
      </div>
      {unit === '千円' && (() => {
        const hint = formatSenYenHint(value);
        return hint ? <p className="text-[10px] text-muted-foreground font-mono">{hint}</p> : null;
      })()}
      {warning && (
        <p className={`text-[10px] ${warning.level === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}>
          {warning.message}
        </p>
      )}
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
  const [step, setStep] = useState(initialResultData ? 4 : 1);
  const [maxStepReached, setMaxStepReached] = useState(initialResultData ? 4 : 1);

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
    return [{ name: '', permitType: '特定', prevCompletion: '', currCompletion: '', prevPrevCompletion: '', prevSubcontract: '', currSubcontract: '', techStaffValue: '' }];
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
  const [keishinPdfDragging, setKeishinPdfDragging] = useState(false);
  const keishinPdfInputRef = useRef<HTMLInputElement>(null);
  // 抽出データ管理（バリデーション・データソース追跡）
  const extractedData = useExtractedData();
  const [extractionWarnings, setExtractionWarnings] = useState<ValidationIssue[]>([]);

  // Step 4: Previous period
  const [prevData, setPrevData] = useState<PrevPeriodData>(() => {
    if (initialInputData?.prevData) return initialInputData.prevData as PrevPeriodData;
    return { totalCapital: '', operatingCF: '', allowanceDoubtful: '', notesAndReceivable: '', constructionPayable: '', inventoryAndMaterials: '', advanceReceived: '' };
  });
  // Track which prevData fields were auto-filled from the prev period upload in Step 1
  const [prevAutoFilledFields, setPrevAutoFilledFields] = useState<Set<string>>(new Set());
  const [prevPeriodFileLoaded, setPrevPeriodFileLoaded] = useState(false);

  // 前々期決算書アップロード状態（Step 1）
  const [prevPrevPeriodFileLoaded, setPrevPrevPeriodFileLoaded] = useState(false);
  // 前期PLデータ（営業CF自動計算用）
  const [prevPeriodPLData, setPrevPeriodPLData] = useState<{ ordinaryProfit: number; depreciation: number; corporateTax: number } | null>(null);
  // 前々期BSデータ（営業CF自動計算用）
  const [prevPrevPeriodBSData, setPrevPrevPeriodBSData] = useState<ParsedFinancialFields | null>(null);
  // 前期営業CFが自動計算されたかどうか
  const [prevCFAutoCalculated, setPrevCFAutoCalculated] = useState(false);

  // Result
  type ResultType = {
    Y: number; X2: number; X21: number; X22: number; W: number; wTotal: number;
    yResult: YResult; wDetail: WDetail;
    industries: Array<{ name: string; X1: number; Z: number; Z1: number; Z2: number; P: number; x1TwoYearAvg: number; x1Current: number; x1Selected: '2年平均' | '当期' | '3年平均' }>;
    bs?: KeishinBS; pl?: KeishinPL;
  };
  const [result, setResult] = useState<ResultType | null>(
    initialResultData ? initialResultData as ResultType : null
  );

  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepErrorField, setStepErrorField] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [notes, setNotes] = useState(init('notes'));

  // Ref for scrolling to top on step change
  const wizardTopRef = useRef<HTMLDivElement>(null);

  // ---- Auto-save / Restore ----
  const [restoreBannerDismissed, setRestoreBannerDismissed] = useState(false);

  const wizardSnapshot: WizardSaveData = useMemo(() => ({
    step, basicInfo, industries, equity, ebitda, prevData,
    sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
    currentLiabilities, fixedLiabilities, totalCapital, fixedAssets,
    retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
    notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
    wTotal, wScore, currentSocialItems, notes,
  }), [
    step, basicInfo, industries, equity, ebitda, prevData,
    sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
    currentLiabilities, fixedLiabilities, totalCapital, fixedAssets,
    retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
    notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
    wTotal, wScore, currentSocialItems, notes,
  ]);

  // Don't auto-save when wizard is empty or showing results, or when loaded from props
  const shouldSave = !initialInputData && step <= 3 && !isWizardEmpty(wizardSnapshot);
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

  const showRestoreBanner = hasSavedData && !restoreBannerDismissed && !initialInputData && step <= 3;

  function handleRestore() {
    if (!savedData) return;
    setStep(savedData.step);
    setMaxStepReached(prev => Math.max(prev, savedData.step));
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
    if (savedData.notes) setNotes(savedData.notes);
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
    if (stepError) { setStepError(null); setStepErrorField(null); }
  }

  /** Returns the error field name if validation fails, or null if valid. */
  function validateStep(current: number): string | null {
    if (current === 1) {
      const salesNum = parseFloat(sales);
      if (!sales || isNaN(salesNum) || salesNum <= 0) {
        setStepError('完成工事高（売上高）は必須です。0より大きい値を入力してください。');
        setStepErrorField('sales');
        return 'sales';
      }
      const tc = num(totalCapital);
      if (tc <= 0) {
        setStepError('総資本（総資産）は必須です。0より大きい値を入力してください。Y点の計算に必要です。');
        setStepErrorField('totalCapital');
        return 'totalCapital';
      }
      setStepError(null);
      setStepErrorField(null);
      return null;
    }
    if (current === 2) {
      const validIndustries = industries.filter((ind) => ind.name && num(ind.currCompletion) > 0);
      if (validIndustries.length === 0) {
        setStepError('業種を1つ以上入力してください。業種名と当年度完工高（0より大きい値）が必要です。');
        setStepErrorField('industries');
        return 'industries';
      }
      setStepError(null);
      setStepErrorField(null);
      return null;
    }
    return null;
  }

  function scrollToFirstError(fieldId?: string | null) {
    requestAnimationFrame(() => {
      // Try to find the specific error field first
      if (fieldId) {
        const fieldLabel = `numfield-${fieldId.replace(/[^a-zA-Z0-9\u3040-\u9FFF]/g, '-')}`;
        const el = document.getElementById(fieldLabel);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus({ preventScroll: true });
          return;
        }
      }
      // Fallback: find the first .text-destructive element
      const errorEl = wizardTopRef.current?.querySelector('.text-destructive');
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function handleNextStep() {
    const errorField = validateStep(step);
    if (errorField === null) {
      const nextStep = step + 1;
      setStep(nextStep);
      setMaxStepReached(prev => Math.max(prev, nextStep));
      // Scroll to top of the wizard when navigating between steps
      requestAnimationFrame(() => {
        wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } else {
      // Auto-scroll to the first error field
      scrollToFirstError(errorField);
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

  /**
   * 前期営業CF自動計算
   * 前期PL（前期決算書から）＋ 前期BS（前期決算書から）＋ 前々期BS（前々期決算書から）が揃った場合のみ計算。
   * 当期+前期の2つだけでは前々期BSがないため計算不可 → ユーザー手入力。
   */
  function tryCalculatePrevOperatingCF(
    currentPrevData: PrevPeriodData,
    prevPrevBS: ParsedFinancialFields | null,
  ): number | null {
    // 前期PL（前期決算書から）と前々期BS（前々期決算書から）の両方が必要
    if (!prevPeriodPLData || !prevPrevBS) return null;

    // 前期BS values（前期決算書 → prevData に格納済み）
    const prevAllowance = parseFloat(currentPrevData.allowanceDoubtful) || 0;
    const prevReceivable = parseFloat(currentPrevData.notesAndReceivable) || 0;
    const prevPayable = parseFloat(currentPrevData.constructionPayable) || 0;
    const prevInventory = parseFloat(currentPrevData.inventoryAndMaterials) || 0;
    const prevAdvance = parseFloat(currentPrevData.advanceReceived) || 0;

    // 前々期BS values（前々期決算書から）
    const prevPrevAllowance = prevPrevBS.allowanceDoubtful ?? 0;
    const prevPrevReceivable = prevPrevBS.notesAndReceivable ?? 0;
    const prevPrevPayable = prevPrevBS.constructionPayable ?? 0;
    const prevPrevInventory = prevPrevBS.inventoryAndMaterials ?? 0;
    const prevPrevAdvance = prevPrevBS.advanceReceived ?? 0;

    // 営業CF = 経常利益 + 減価償却実施額 - 法人税等
    //        + 貸倒引当金増減 - 売掛債権増減 + 仕入債務増減 - 棚卸資産増減 + 受入金増減
    return (
      prevPeriodPLData.ordinaryProfit +
      prevPeriodPLData.depreciation -
      prevPeriodPLData.corporateTax +
      (prevAllowance - prevPrevAllowance) -
      (prevReceivable - prevPrevReceivable) +
      (prevPayable - prevPrevPayable) -
      (prevInventory - prevPrevInventory) +
      (prevAdvance - prevPrevAdvance)
    );
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
    // 前期PLデータを保存（営業CF自動計算用）
    const plData = (data.ordinaryProfit !== undefined && data.depreciation !== undefined && data.corporateTax !== undefined)
      ? { ordinaryProfit: data.ordinaryProfit, depreciation: data.depreciation, corporateTax: data.corporateTax }
      : null;
    setPrevPeriodPLData(plData);

    // 前々期BSデータがあれば営業CFを自動計算
    const autoCalcCF = tryCalculatePrevOperatingCF(updated, prevPrevPeriodBSData);
    if (autoCalcCF !== null) {
      updated.operatingCF = String(autoCalcCF);
      filled.add('operatingCF');
      setPrevCFAutoCalculated(true);
    }
    // 前々期がまだ未アップロードの場合は空のままにする（'0'にしない）
    // ユーザーには「計算待ち」状態として表示される

    setPrevData(updated);
    setPrevAutoFilledFields(filled);
    setPrevPeriodFileLoaded(true);
  }

  function handlePrevFileClear() {
    setPrevAutoFilledFields(new Set());
    setPrevPeriodFileLoaded(false);
    setPrevPeriodPLData(null);
    // 前期営業CFの自動計算結果をクリア
    if (prevCFAutoCalculated) {
      setPrevData(prev => ({ ...prev, operatingCF: '' }));
      setPrevCFAutoCalculated(false);
    }
  }

  // 前々期決算書アップロード（Step 1）のハンドラ
  function handlePrevPrevFileParsed(data: ParsedFinancialFields) {
    // 前々期BSデータを保存（営業CF自動計算用）
    setPrevPrevPeriodBSData(data);
    setPrevPrevPeriodFileLoaded(true);

    // 前々期データで営業CFを自動計算（前期PLがあれば優先、なければ前々期PLで代用）
    const autoCalcCF = tryCalculatePrevOperatingCF(prevData, data);
    if (autoCalcCF !== null) {
      const updated = { ...prevData, operatingCF: String(autoCalcCF) };
      setPrevData(updated);
      setPrevAutoFilledFields(prev => new Set([...prev, 'operatingCF']));
      setPrevCFAutoCalculated(true);
    }
  }

  function handlePrevPrevFileClear() {
    setPrevPrevPeriodBSData(null);
    setPrevPrevPeriodFileLoaded(false);
    // 前期営業CFの自動計算結果をクリア
    if (prevCFAutoCalculated) {
      setPrevData(prev => ({ ...prev, operatingCF: '0' }));
      setPrevAutoFilledFields(prev => {
        const next = new Set(prev);
        next.delete('operatingCF');
        return next;
      });
      setPrevCFAutoCalculated(false);
    }
  }

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

      // DATA-9: Check for partial extraction and collect warnings
      const partialWarnings: ValidationIssue[] = [];
      const hasBasicInfo = !!(processed.basicInfo.companyName || processed.basicInfo.permitNumber);
      const hasFinancials = processed.equity !== undefined && processed.equity !== null;
      const hasIndustries = processed.industries.length > 0;

      if (!hasBasicInfo) {
        partialWarnings.push({ field: 'basicInfo', label: '基本情報', severity: 'warning', message: '会社名・許可番号が抽出できませんでした。手動で入力してください。', originalValue: null });
      }
      if (!hasFinancials) {
        partialWarnings.push({ field: 'equity', label: '財務データ', severity: 'warning', message: '自己資本額が抽出できませんでした。手動で入力してください。', originalValue: null });
      }
      if (!hasIndustries) {
        partialWarnings.push({ field: 'industries', label: '業種データ', severity: 'warning', message: '業種別完成工事高が抽出できませんでした。手動で入力してください。', originalValue: null });
      }

      // バリデーション警告を保存（部分抽出警告を含む）
      const allWarnings = [...partialWarnings, ...processed.validationIssues];
      setExtractionWarnings(allWarnings);
      if (allWarnings.length > 0 && process.env.NODE_ENV !== 'production') {
        logger.debug('[Keishin PDF] Validation issues:', allWarnings.length,
          allWarnings.map(i => `[${i.severity}] ${i.field}: ${i.message}`).join(', '));
      }

      // Show toast for partial extraction
      if (partialWarnings.length > 0) {
        showToast(`${partialWarnings.length}項目が抽出できませんでした。該当箇所を手動で入力してください。`, 'warning');
      }

      // Step 2: 基本情報（バリデーション済み） - 単一の setState で更新
      if (hasBasicInfo) {
        setBasicInfo(prev => ({ ...prev, ...processed.basicInfo }));
      }

      // Step 2: X2データ
      if (processed.ebitda !== undefined && processed.ebitda !== null) setEbitda(String(processed.ebitda));
      // 自己資本額（= 純資産合計）→ Step1のequityにも反映
      if (processed.equity !== undefined && processed.equity !== null && !equity) setEquity(String(processed.equity));

      // Step 2: 業種別完成工事高（正規化済み業種名）
      if (processed.industries.length > 0) {
        setIndustries(processed.industries);
      }

      // Step 3: W項目（バリデーション済み、techStaffCount・businessYearsもマージ済み）
      if (Object.keys(processed.wItems).length > 0) {
        setExternalWItems(processed.wItems);
      }

      // Step 3: 技術職員リストをTechStaffPanelに渡す
      if (processed.staffList && processed.staffList.length > 0) {
        setExtractedStaff(processed.staffList);
      }

      setKeishinPdfMappings(data.mappings || []);
      setKeishinPdfLoaded(true);
      // Signal completion so progress bar jumps to 100%
      setKeishinPdfComplete(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '提出書PDFの解析に失敗しました';
      // DATA-9: Partial extraction error recovery
      // If the API returned partial data before the error, try to use it
      if (e instanceof Error && (e as Error & { partialData?: KeishinPdfResult }).partialData) {
        const partialData = (e as Error & { partialData?: KeishinPdfResult }).partialData!;
        try {
          const processed = extractedData.processExtraction(partialData);
          setExtractionWarnings([
            { field: '_global', label: 'PDF解析', severity: 'warning', message: `一部のデータのみ抽出されました: ${errorMsg}`, originalValue: null },
            ...processed.validationIssues,
          ]);
          if (processed.basicInfo.companyName || processed.basicInfo.permitNumber) {
            setBasicInfo(prev => ({ ...prev, ...processed.basicInfo }));
          }
          if (processed.equity !== undefined && processed.equity !== null) setEquity(String(processed.equity));
          if (processed.ebitda !== undefined && processed.ebitda !== null) setEbitda(String(processed.ebitda));
          if (processed.industries.length > 0) setIndustries(processed.industries);
          if (Object.keys(processed.wItems).length > 0) setExternalWItems(processed.wItems);
          if (processed.staffList && processed.staffList.length > 0) setExtractedStaff(processed.staffList);
          setKeishinPdfLoaded(true);
          setKeishinPdfComplete(true);
          showToast('一部のデータのみ抽出されました。不足項目を手動で入力してください。', 'warning');
        } catch {
          setKeishinPdfError(errorMsg);
        }
      } else {
        setKeishinPdfError(errorMsg);
      }
    } finally {
      setKeishinPdfProcessing(false);
    }
  }

  function addIndustry() {
    setIndustries([...industries, { name: '', permitType: '一般', prevCompletion: '', currCompletion: '', prevPrevCompletion: '', prevSubcontract: '', currSubcontract: '', techStaffValue: '' }]);
  }

  // Duplicate industry check when selecting a name
  function updateIndustryWithDuplicateCheck(index: number, field: keyof IndustryInput, value: string) {
    if (field === 'name' && detectIndustryDuplicate(industries, index, value)) {
      showToast(`「${value}」は既に追加されています。同じ業種を複数登録すると正しく計算されない場合があります。`, 'warning');
    }
    updateIndustry(index, field, value);
  }

  function removeIndustry(i: number) {
    setIndustries(industries.filter((_, idx) => idx !== i));
  }

  function updateIndustry(i: number, field: keyof IndustryInput, value: string) {
    const u = [...industries];
    u[i] = { ...u[i], [field]: value };
    setIndustries(u);
    extractedData.markUserEdited('industries');
  }

  // Calculate
  function handleCalculate() {
    setError(null);
    setCalculating(true);
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
          const currComp = num(ind.currCompletion);
          const prevComp = num(ind.prevCompletion);
          const prevPrevComp = num(ind.prevPrevCompletion) || undefined;
          const adoptedComp = calculateX1WithAverage(currComp, prevComp, prevPrevComp);
          const avgComp = Math.floor((prevComp + currComp) / 2);
          const threeYearAvg = prevPrevComp ? Math.floor((currComp + prevComp + prevPrevComp) / 3) : undefined;
          const x1Selected: '2年平均' | '当期' | '3年平均' =
            threeYearAvg !== undefined && adoptedComp === threeYearAvg ? '3年平均' :
            adoptedComp === avgComp && avgComp >= currComp ? '2年平均' : '当期';
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
      setStep(4); // Go to result
      setMaxStepReached(prev => Math.max(prev, 4));

      // 計算完了の成功フィードバック
      const mainIndustry = industryResults[0];
      showToast(
        mainIndustry
          ? `P点計算完了: ${mainIndustry.name} P=${mainIndustry.P}点`
          : 'P点計算が完了しました',
        'success',
      );

      // Scroll to top so the user sees the result immediately
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Clear localStorage auto-save on successful calculation
      clearAutoSave();

      // Auto-save to database
      const inputDataPayload = {
        sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome,
        currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets,
        retainedEarnings, corporateTax, depreciation, allowanceDoubtful,
        notesAndReceivable, constructionPayable, inventoryAndMaterials, advanceReceived,
        ebitda, basicInfo, industries, prevData, notes,
      };

      saveSimulation(inputDataPayload, resultObj);
    } catch (e) {
      setError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    } finally {
      setCalculating(false);
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
      logger.error('シミュレーション保存に失敗しました');
      setSaveWarning('自動保存に失敗しました。結果は画面上で確認できますが、アカウントには保存されていません。');
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

  // Re-calculate handler: go back to Step 1 with all data pre-filled
  const handleRecalculate = useCallback(() => {
    setResult(null);
    setStep(1);
    setMaxStepReached(3); // Keep steps 1-3 navigable, but result step requires recalculation
    setFileLoaded(true); // Mark as loaded so fields stay visible
    requestAnimationFrame(() => {
      wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // Only warn if the wizard has data and hasn't been submitted yet
      if (step <= 3 && !isWizardEmpty(wizardSnapshot)) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step, wizardSnapshot]);

  // FEATURE-2: Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Enter → trigger calculation (only on step 3, the last step before results)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && step === 3) {
        e.preventDefault();
        handleCalculate();
      }
      // Ctrl+S → trigger auto-save (prevent browser save dialog)
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && step <= 3) {
        e.preventDefault();
        showToast('データは自動保存されています', 'success');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Focus management: move focus to the step heading on step change for keyboard navigation
  useEffect(() => {
    if (step <= 3) {
      requestAnimationFrame(() => {
        const heading = wizardTopRef.current?.querySelector<HTMLElement>('h2');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      });
    }
  }, [step]);

  return (
    <div ref={wizardTopRef} className="space-y-6">
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

      {<StepIndicator current={step} maxReached={maxStepReached} onNavigate={(s) => { setStepError(null); setStepErrorField(null); setStep(s); requestAnimationFrame(() => { wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }} />}

      {/* Step 1: Upload + Financial */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 1: 決算書Excelアップロード</h2>
          <p className="text-sm text-muted-foreground">
            決算書Excelをアップロードすると、BS/PLの数値を自動読取します。手入力も可能です。
          </p>

          {/* 当期 / 前期 / 前々期 アップロードエリア */}
          <OnboardingCallout id="upload" text="ここにPDFまたはExcelをアップロードしてください">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                dropDescription="前期データ（営業CF計算用）を自動入力します"
              />
              {prevPeriodFileLoaded && prevAutoFilledFields.size > 0 && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  前期BS {prevAutoFilledFields.size}項目を自動読取
                </div>
              )}
              {prevPeriodFileLoaded && !prevCFAutoCalculated && (
                <p className="text-[10px] text-amber-600">
                  ※ 前期の営業CFは前期＋前々期の決算書が揃うと自動計算されます。前々期決算書もアップロードしてください。
                </p>
              )}
              {prevCFAutoCalculated && (
                <p className="text-[10px] text-green-600">
                  ※ 前期PL＋前期BS＋前々期BSから前期営業CFを自動計算しました。
                </p>
              )}
            </div>

            {/* 前々期決算書 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">前々期決算書（任意）</h3>
                {prevPrevPeriodFileLoaded && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="mr-1 h-3 w-3" />読取済み
                  </Badge>
                )}
              </div>
              <FileUpload
                onDataParsed={handlePrevPrevFileParsed}
                onClear={handlePrevPrevFileClear}
                dropLabel="前々期の決算書ファイルをドロップ、またはクリックして選択"
                dropDescription="営業CF計算の参考データとして使用します"
              />
              {prevPrevPeriodFileLoaded && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  前々期決算書を読取済み{prevCFAutoCalculated ? '（前期営業CFを自動計算済み）' : '（前期決算書も揃えば営業CFを自動計算します）'}
                </div>
              )}
            </div>
          </div>
          </OnboardingCallout>

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
                    <div>
                      {numField('完成工事高（売上高）', sales, handleSalesChange, '千円', '経審様式第25号の14 別紙一', fileLoaded ? (autoFilledFields.has('sales') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('完成工事高', sales, { mustBePositive: true }))}
                      {stepErrorField === 'sales' && <p className="text-xs text-destructive mt-1">{stepError}</p>}
                    </div>
                    {numField('売上総利益', grossProfit, setGrossProfit, '千円', undefined, fileLoaded ? (autoFilledFields.has('grossProfit') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('売上総利益', grossProfit))}
                    {numField('経常利益', ordinaryProfit, setOrdinaryProfit, '千円', undefined, fileLoaded ? (autoFilledFields.has('ordinaryProfit') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('経常利益', ordinaryProfit, { allowNegative: true }))}
                    {numField('支払利息', interestExpense, setInterestExpense, '千円', undefined, fileLoaded ? (autoFilledFields.has('interestExpense') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('支払利息', interestExpense))}
                    {numField('受取利息配当金', interestDividendIncome, setInterestDividendIncome, '千円', undefined, fileLoaded ? (autoFilledFields.has('interestDividendIncome') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('受取利息配当金', interestDividendIncome))}
                  </div>
                </div>

                {/* Group 2: B/S */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">貸借対照表（B/S）</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {numField('流動負債合計', currentLiabilities, setCurrentLiabilities, '千円', undefined, fileLoaded ? (autoFilledFields.has('currentLiabilities') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('流動負債合計', currentLiabilities))}
                    {numField('固定負債合計', fixedLiabilities, setFixedLiabilities, '千円', undefined, fileLoaded ? (autoFilledFields.has('fixedLiabilities') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('固定負債合計', fixedLiabilities))}
                    <div>
                      {numField('総資本（総資産）', totalCapital, (v) => { setTotalCapital(v); if (stepErrorField === 'totalCapital') { setStepError(null); setStepErrorField(null); } }, '千円', undefined, fileLoaded ? (autoFilledFields.has('totalCapital') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('総資本', totalCapital, { mustBePositive: true }))}
                      {stepErrorField === 'totalCapital' && <p className="text-xs text-destructive mt-1">{stepError}</p>}
                    </div>
                    {numField('純資産合計', equity, (v) => { setEquity(v); extractedData.markUserEdited('equity'); }, '千円', '財務諸表 貸借対照表の純資産の部', fileLoaded ? (autoFilledFields.has('equity') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('純資産合計', equity, { allowNegative: true }))}
                    {numField('固定資産合計', fixedAssets, setFixedAssets, '千円', undefined, fileLoaded ? (autoFilledFields.has('fixedAssets') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('固定資産合計', fixedAssets))}
                    {numField('利益剰余金合計', retainedEarnings, setRetainedEarnings, '千円', undefined, fileLoaded ? (autoFilledFields.has('retainedEarnings') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('利益剰余金合計', retainedEarnings, { allowNegative: true }))}
                    {numField('貸倒引当金（絶対値）', allowanceDoubtful, setAllowanceDoubtful, '千円', undefined, fileLoaded ? (autoFilledFields.has('allowanceDoubtful') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('貸倒引当金', allowanceDoubtful))}
                    {numField('受取手形+完成工事未収入金', notesAndReceivable, setNotesAndReceivable, '千円', undefined, fileLoaded ? (autoFilledFields.has('notesAndReceivable') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('受取手形+完成工事未収入金', notesAndReceivable))}
                    {numField('未成工事受入金', advanceReceived, setAdvanceReceived, '千円', undefined, fileLoaded ? (autoFilledFields.has('advanceReceived') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('未成工事受入金', advanceReceived))}
                  </div>
                </div>

                {/* Group 3: Other */}
                <div className="rounded-lg border border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">その他（原価報告書等）</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {numField('法人税等', corporateTax, setCorporateTax, '千円', undefined, fileLoaded ? (autoFilledFields.has('corporateTax') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('法人税等', corporateTax))}
                    {numField('減価償却実施額', depreciation, setDepreciation, '千円', undefined, fileLoaded ? (autoFilledFields.has('depreciation') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('減価償却実施額', depreciation))}
                    {numField('工事未払金', constructionPayable, setConstructionPayable, '千円', '未払経費を含めない', fileLoaded ? (autoFilledFields.has('constructionPayable') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('工事未払金', constructionPayable))}
                    {numField('未成工事支出金+材料貯蔵品', inventoryAndMaterials, setInventoryAndMaterials, '千円', undefined, fileLoaded ? (autoFilledFields.has('inventoryAndMaterials') ? 'auto-filled' : 'needs-input') : undefined, getFinancialFieldWarning('未成工事支出金+材料貯蔵品', inventoryAndMaterials))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 前期データ（営業CF計算用） */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                前期（経審用BS千円値）
                {prevPeriodFileLoaded && prevAutoFilledFields.size > 0 && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                    <CheckCircle className="mr-1 h-3 w-3" />{prevAutoFilledFields.size}項目を自動入力済み
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Y点の営業CF計算に前期の経審用BS千円値が必要です。
                {prevPeriodFileLoaded
                  ? '前期決算書から自動入力されています。内容を確認・修正してください。'
                  : '上の前期決算書アップロードまたは手入力してください。'}
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {numField('前期 資産合計（総資本）', prevData.totalCapital, (v) => setPrevData({ ...prevData, totalCapital: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('totalCapital') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 営業CF', prevData.operatingCF, (v) => { setPrevData({ ...prevData, operatingCF: v }); if (prevCFAutoCalculated) setPrevCFAutoCalculated(false); }, '千円', prevCFAutoCalculated ? '前期＋前々期決算書から自動計算済み（手動変更可）' : '前期＋前々期の決算書が揃うと自動計算', prevPeriodFileLoaded ? (prevCFAutoCalculated ? 'auto-filled' : (!prevPrevPeriodFileLoaded ? 'pending' : 'needs-input')) : undefined)}
              {numField('前期 貸倒引当金', prevData.allowanceDoubtful, (v) => setPrevData({ ...prevData, allowanceDoubtful: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('allowanceDoubtful') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 受取手形+完成工事未収入金', prevData.notesAndReceivable, (v) => setPrevData({ ...prevData, notesAndReceivable: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('notesAndReceivable') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 工事未払金', prevData.constructionPayable, (v) => setPrevData({ ...prevData, constructionPayable: v }), '千円', '未払経費を含めない', prevPeriodFileLoaded ? (prevAutoFilledFields.has('constructionPayable') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 未成工事支出金+材料貯蔵品', prevData.inventoryAndMaterials, (v) => setPrevData({ ...prevData, inventoryAndMaterials: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('inventoryAndMaterials') ? 'auto-filled' : 'needs-input') : undefined)}
              {numField('前期 未成工事受入金', prevData.advanceReceived, (v) => setPrevData({ ...prevData, advanceReceived: v }), '千円', undefined, prevPeriodFileLoaded ? (prevAutoFilledFields.has('advanceReceived') ? 'auto-filled' : 'needs-input') : undefined)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Submission Data */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 2: 経審提出書データ</h2>
          <p className="text-sm text-muted-foreground">
            経審提出書PDFをアップロードすると、基本情報・業種別完工高・W項目を自動読取します。手入力も可能です。
          </p>

          {/* 提出書PDFアップロード（ドラッグ&ドロップ対応） */}
          <Card
            className={`border-dashed border-2 transition-colors cursor-pointer ${
              keishinPdfDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
            } ${keishinPdfProcessing ? 'pointer-events-none opacity-60' : ''}`}
            onDrop={(e) => { e.preventDefault(); setKeishinPdfDragging(false); const f = e.dataTransfer.files[0]; if (f) handleKeishinPdfUpload(f); }}
            onDragOver={(e) => { e.preventDefault(); setKeishinPdfDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setKeishinPdfDragging(false); }}
            onClick={() => keishinPdfInputRef.current?.click()}
          >
            <CardContent className="py-4">
              <input
                ref={keishinPdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleKeishinPdfUpload(f); e.target.value = ''; }}
                disabled={keishinPdfProcessing}
              />
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
                  {keishinPdfDragging ? 'ここにドロップしてアップロード' : '経営規模等評価申請書・別紙一（業種別完工高）・別紙三（W項目）を自動で読み取ります'}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                    keishinPdfProcessing
                      ? 'bg-muted text-muted-foreground cursor-wait'
                      : 'bg-background hover:bg-accent text-foreground cursor-pointer'
                  }`}>
                    <Upload className="h-4 w-4" />
                    {keishinPdfProcessing ? '解析中...' : 'PDFをドロップまたは選択'}
                  </span>
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

          {/* 抽出結果サマリー */}
          {keishinPdfLoaded && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="py-4">
                <p className="text-sm font-medium text-green-800 mb-2">PDF読取結果サマリー</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {/* 基本情報 */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">基本情報</p>
                    <div className="flex items-center gap-1">
                      <span className={basicInfo.companyName ? 'text-green-600' : 'text-amber-500'}>{basicInfo.companyName ? '✓' : '△'}</span>
                      <span className="text-xs">会社名</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={basicInfo.permitNumber ? 'text-green-600' : 'text-amber-500'}>{basicInfo.permitNumber ? '✓' : '△'}</span>
                      <span className="text-xs">許可番号</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={basicInfo.reviewBaseDate ? 'text-green-600' : 'text-amber-500'}>{basicInfo.reviewBaseDate ? '✓' : '△'}</span>
                      <span className="text-xs">審査基準日</span>
                    </div>
                  </div>
                  {/* 業種・W項目 */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">業種・W項目</p>
                    <div className="flex items-center gap-1">
                      <span className={industries.filter(ind => ind.name).length > 0 ? 'text-green-600' : 'text-amber-500'}>
                        {industries.filter(ind => ind.name).length > 0 ? '✓' : '△'}
                      </span>
                      <span className="text-xs">{industries.filter(ind => ind.name).length}業種抽出</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={externalWItems && Object.keys(externalWItems).length > 0 ? 'text-green-600' : 'text-amber-500'}>
                        {externalWItems && Object.keys(externalWItems).length > 0 ? '✓' : '△'}
                      </span>
                      <span className="text-xs">{externalWItems ? Object.keys(externalWItems).length : 0}/31項目抽出</span>
                    </div>
                  </div>
                  {/* 技術職員 */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">技術職員</p>
                    <div className="flex items-center gap-1">
                      <span className={extractedStaff && extractedStaff.length > 0 ? 'text-green-600' : 'text-amber-500'}>
                        {extractedStaff && extractedStaff.length > 0 ? '✓' : '△'}
                      </span>
                      <span className="text-xs">{extractedStaff ? extractedStaff.length : 0}名抽出</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                <Input value={basicInfo.companyName} onChange={(e) => { setBasicInfo({ ...basicInfo, companyName: e.target.value }); extractedData.markUserEdited('basicInfo.companyName'); }} className="text-sm h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">許可番号</Label>
                <Input value={basicInfo.permitNumber} onChange={(e) => { setBasicInfo({ ...basicInfo, permitNumber: e.target.value }); extractedData.markUserEdited('basicInfo.permitNumber'); }} className="text-sm h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">審査基準日</Label>
                <Input value={basicInfo.reviewBaseDate} onChange={(e) => { setBasicInfo({ ...basicInfo, reviewBaseDate: e.target.value }); extractedData.markUserEdited('basicInfo.reviewBaseDate'); }} className="text-sm h-8" placeholder="R7.6.30" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">期</Label>
                <Input value={basicInfo.periodNumber} onChange={(e) => { setBasicInfo({ ...basicInfo, periodNumber: e.target.value }); extractedData.markUserEdited('basicInfo.periodNumber'); }} className="text-sm h-8" placeholder="第58期" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">続紙：X2用データ（千円）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {numField('利払後事業利益額（X22用 2期平均）', ebitda, (v) => { setEbitda(v); extractedData.markUserEdited('ebitda'); }, '千円', '営業利益＋減価償却費（提出書の続紙に記載）', undefined, getFinancialFieldWarning('EBITDA', ebitda, { allowNegative: true }))}
              <div className="space-y-1 self-end pb-2">
                {previewPL && num(depreciation) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const op = previewPL.operatingProfit ?? 0;
                      const dep = num(depreciation);
                      const computed = op + dep;
                      setEbitda(String(computed));
                      extractedData.markUserEdited('ebitda');
                      showToast(`EBITDA 自動計算: 営業利益(${op.toLocaleString()}) + 減価償却費(${dep.toLocaleString()}) = ${computed.toLocaleString()}`, 'success');
                    }}
                  >
                    <Calculator className="mr-1 h-3 w-3" />
                    自動計算
                  </Button>
                )}
                <div className="text-xs text-muted-foreground">
                  ※ X21は「純資産合計」（Step1で入力済み）から自動算出
                </div>
              </div>
            </CardContent>
          </Card>

          <OnboardingCallout id="industry" text="業種を選択して完工高を入力してください">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">別紙一：業種別完成工事高（千円）</CardTitle>
              {stepErrorField === 'industries' && <p className="text-xs text-destructive mt-1">{stepError}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {industries.map((ind, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="space-y-1 w-full sm:w-48">
                      <Label className="text-xs">業種名</Label>
                      <IndustryCodeSelect value={ind.name} onChange={(v) => updateIndustryWithDuplicateCheck(i, 'name', v)} />
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
                    {numField('前期完成工事高', ind.prevCompletion, (v) => updateIndustry(i, 'prevCompletion', v), '千円', undefined, undefined, getFinancialFieldWarning('前期完成工事高', ind.prevCompletion, { mustBePositive: true }))}
                    {numField('前年度元請完成工事高', ind.prevSubcontract, (v) => updateIndustry(i, 'prevSubcontract', v), '千円', undefined, undefined, getFinancialFieldWarning('前年度元請完成工事高', ind.prevSubcontract, { mustBePositive: true }))}
                    {numField('当期完成工事高', ind.currCompletion, (v) => updateIndustry(i, 'currCompletion', v), '千円', undefined, undefined, getFinancialFieldWarning('当期完成工事高', ind.currCompletion, { mustBePositive: true }))}
                    {numField('当年度元請完成工事高', ind.currSubcontract, (v) => updateIndustry(i, 'currSubcontract', v), '千円', undefined, undefined, getFinancialFieldWarning('当年度元請完成工事高', ind.currSubcontract, { mustBePositive: true }))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {numField('前々期完成工事高（激変緩和用）', ind.prevPrevCompletion, (v) => updateIndustry(i, 'prevPrevCompletion', v), '千円', undefined, undefined, getFinancialFieldWarning('前々期完成工事高', ind.prevPrevCompletion, { mustBePositive: true }))}
                  </div>
                  {/* 下請完成工事高（自動計算）: 完成工事高 - 元請完成工事高 */}
                  {(num(ind.prevCompletion) > 0 || num(ind.currCompletion) > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">前期 下請完成工事高（自動計算）</Label>
                        <div className="h-8 flex items-center px-2 text-sm font-mono bg-muted/40 rounded border border-dashed">
                          {num(ind.prevCompletion) > 0 ? `¥${(num(ind.prevCompletion) - num(ind.prevSubcontract)).toLocaleString()}千円` : '—'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">当期 下請完成工事高（自動計算）</Label>
                        <div className="h-8 flex items-center px-2 text-sm font-mono bg-muted/40 rounded border border-dashed">
                          {num(ind.currCompletion) > 0 ? `¥${(num(ind.currCompletion) - num(ind.currSubcontract)).toLocaleString()}千円` : '—'}
                        </div>
                      </div>
                      <div className="col-span-2 self-end text-[10px] text-muted-foreground pb-2">
                        下請完成工事高 = 完成工事高 − 元請完成工事高
                      </div>
                    </div>
                  )}
                  {/* 完工高 2年平均/当期の採用判定表示 */}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {(() => {
                      const avg = Math.floor((num(ind.prevCompletion) + num(ind.currCompletion)) / 2);
                      const curr = num(ind.currCompletion);
                      const isAvgSelected = avg >= curr;
                      return (
                        <div className="flex gap-3">
                          <span className={isAvgSelected ? 'text-green-600 font-medium' : ''}>
                            2年平均: {avg.toLocaleString()}千円{isAvgSelected && ' (採用)'}
                          </span>
                          <span className={!isAvgSelected ? 'text-green-600 font-medium' : ''}>
                            当期: {curr.toLocaleString()}千円{!isAvgSelected && ' (採用)'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIndustry}>+ 業種を追加</Button>
            </CardContent>
          </Card>
          </OnboardingCallout>
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

          {/* 経審提出書PDF: 未読込ならアップロード欄（ドラッグ&ドロップ対応） */}
          {!keishinPdfLoaded ? (
            <Card
              className={`border-dashed border-2 transition-colors cursor-pointer ${
                keishinPdfDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              } ${keishinPdfProcessing ? 'pointer-events-none opacity-60' : ''}`}
              onDrop={(e) => { e.preventDefault(); setKeishinPdfDragging(false); const f = e.dataTransfer.files[0]; if (f) handleKeishinPdfUpload(f); }}
              onDragOver={(e) => { e.preventDefault(); setKeishinPdfDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setKeishinPdfDragging(false); }}
              onClick={() => keishinPdfInputRef.current?.click()}
            >
              <CardContent className="py-4">
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  ref={keishinPdfInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleKeishinPdfUpload(f); e.target.value = ''; }}
                  disabled={keishinPdfProcessing}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">経審提出書PDFからW項目を自動入力</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {keishinPdfDragging ? 'ここにドロップしてアップロード' : 'Step 2 でアップロード済みなら自動反映されます。ここからもアップロードできます。'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border ${
                      keishinPdfProcessing
                        ? 'bg-muted text-muted-foreground cursor-wait'
                        : 'bg-background hover:bg-accent text-foreground cursor-pointer'
                    }`}>
                      <Upload className="h-4 w-4" />
                      {keishinPdfProcessing ? '解析中...' : '提出書PDFをドロップまたは選択'}
                    </span>
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

          {/* 業種推奨W項目設定ボタン */}
          {industries.filter(ind => ind.name).length > 0 && (
            (() => {
              const activeNames = industries.filter(ind => ind.name).map(ind => ind.name);
              const hasDefaults = activeNames.some(name => INDUSTRY_W_DEFAULTS[name]);
              if (!hasDefaults) return null;
              return (
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4" />
                          業種推奨設定
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          {activeNames.filter(name => INDUSTRY_W_DEFAULTS[name]).map(name => {
                            const defaults = INDUSTRY_W_DEFAULTS[name];
                            if (!defaults) return null;
                            const items: string[] = [];
                            if (defaults.disasterAgreement) items.push('防災協定');
                            if (defaults.constructionMachineCount) items.push('建設機械');
                            if (defaults.iso9001) items.push('ISO9001');
                            if (defaults.nonStatutoryAccidentInsurance) items.push('法定外労災');
                            if (defaults.employmentInsurance) items.push('雇用保険');
                            if (defaults.healthInsurance) items.push('健康保険');
                            if (defaults.pensionInsurance) items.push('厚生年金');
                            if (defaults.constructionRetirementMutualAid) items.push('建退共');
                            return `${name}: ${items.join('・')}`;
                          }).filter(Boolean).join(' / ')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          const defaults = getIndustryWDefaults(activeNames);
                          setExternalWItems(prev => ({ ...prev, ...defaults }));
                          const count = Object.keys(defaults).length;
                          showToast(`業種推奨設定を${count}項目適用しました`, 'success');
                        }}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        業種推奨設定を適用
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          )}

          <WItemsChecklist onWCalculated={handleWCalculated} externalItems={externalWItems} />

          {wDetail && (
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">W点（社会性等）</div>
              <div className="text-3xl font-bold">{wScore}</div>
              <div className="text-xs text-muted-foreground">素点合計 = {wTotal}</div>
            </div>
          )}

          {/* Data Validation Summary */}
          {(() => {
            const sections: { name: string; warnings: string[] }[] = [];

            // Cross-step consistency checks
            const crossStepWarnings = checkCrossStepConsistency(
              totalCapital, equity, sales, industries, wDetail, currentSocialItems, techValueDetails, num
            );

            // Step 1: Financial data
            const finWarnings: string[] = [];
            if (!sales || num(sales) <= 0) finWarnings.push('完成工事高（売上高）が未入力');
            if (!totalCapital || num(totalCapital) <= 0) finWarnings.push('総資本（総資産）が未入力');
            if (!equity) finWarnings.push('自己資本が未入力');
            if (!ordinaryProfit) finWarnings.push('経常利益が未入力');
            if (num(totalCapital) > 0 && num(equity) > num(totalCapital)) finWarnings.push('自己資本が総資本を超えています');
            if (!prevData.totalCapital) finWarnings.push('前期 総資本が未入力（Step 1の前期データ欄）');
            sections.push({ name: 'Step 1: 決算書データ', warnings: finWarnings });

            // Step 2: Industry data
            const indWarnings: string[] = [];
            const validIndustries = industries.filter((ind) => ind.name);
            if (validIndustries.length === 0) {
              indWarnings.push('業種が未登録');
            } else {
              validIndustries.forEach((ind) => {
                if (num(ind.currCompletion) <= 0) indWarnings.push(`${ind.name}: 当期完工高が未入力`);
              });
            }
            if (!ebitda && num(ebitda) === 0) indWarnings.push('EBITDA（利払前税引前償却前利益）が未入力');
            sections.push({ name: 'Step 2: 業種・提出書', warnings: indWarnings });

            // Step 3: W items
            const wWarnings: string[] = [];
            if (wTotal === 0 && wScore === 0) wWarnings.push('社会性(W)項目が未入力（全て0点）');
            sections.push({ name: 'Step 3: 技術職員・社会性', warnings: wWarnings });

            // Cross-step consistency
            if (crossStepWarnings.length > 0) {
              sections.push({ name: 'ステップ間整合性チェック', warnings: crossStepWarnings });
            }

            const totalWarnings = sections.reduce((s, sec) => s + sec.warnings.length, 0);
            const hasWarnings = totalWarnings > 0;

            return (
              <Card className={hasWarnings ? 'border-amber-300 bg-amber-50/50' : 'border-green-300 bg-green-50/50'}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {hasWarnings ? (
                      <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                    )}
                    入力データ検証サマリー
                    <Badge variant="outline" className={hasWarnings ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-green-100 text-green-700 border-green-300'}>
                      {hasWarnings ? `警告あり（${totalWarnings}件）` : '問題なし'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sections.map((sec) => (
                      <div key={sec.name} className="flex items-start gap-2 text-sm">
                        {sec.warnings.length === 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <div>
                          <span className="font-medium">{sec.name}</span>
                          {sec.warnings.length === 0 ? (
                            <span className="ml-2 text-green-700 text-xs">問題なし</span>
                          ) : (
                            <ul className="mt-1 space-y-0.5">
                              {sec.warnings.map((w, i) => (
                                <li key={i} className="text-xs text-amber-700">{w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasWarnings && (
                    <p className="mt-3 text-xs text-amber-600">
                      警告がある状態でも試算は実行できます。未入力の項目は0として計算されます。
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Result */}
      {step === 4 && result && (
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
          notes={notes}
          onNotesChange={setNotes}
          onRecalculate={handleRecalculate}
        />
      )}

      {/* Save Warning */}
      {saveWarning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span>{saveWarning}</span>
          <button type="button" onClick={() => setSaveWarning(null)} className="ml-2 text-amber-600 hover:text-amber-800 dark:text-amber-400 text-xs underline">閉じる</button>
        </div>
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
        {step > 1 && step <= 3 && (
          <Button variant="outline" onClick={() => { setStepError(null); setStepErrorField(null); setStep(step - 1); requestAnimationFrame(() => { wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }}>
            <ArrowLeft className="mr-2 h-4 w-4" />戻る
          </Button>
        )}
        {step === 4 && (
          <Button variant="outline" onClick={() => { setStep(3); requestAnimationFrame(() => { wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }}>
            <ArrowLeft className="mr-2 h-4 w-4" />入力に戻る
          </Button>
        )}
        <div className="ml-auto">
          {step < 3 && (
            <Button onClick={handleNextStep}>
              次へ<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <OnboardingCallout id="calculate" text="全ての入力が完了したら試算実行ボタンを押してください">
            <Button size="lg" onClick={handleCalculate} disabled={calculating} className="px-12">
              {calculating ? (
                <>
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  処理中...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-5 w-5" />
                  試算実行
                </>
              )}
            </Button>
            </OnboardingCallout>
          )}
        </div>
      </div>

      {saving && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          保存中...
        </p>
      )}

      {/* Auto-save indicator */}
      {step <= 3 && savedAt && !isWizardEmpty(wizardSnapshot) && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Save className="h-3 w-3" />
          自動保存済み {savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <p className="text-xs text-center text-muted-foreground">
        ※ 本試算は参考値であり、公式の経営事項審査結果通知書ではありません。
      </p>

      <KeyboardShortcutsHelp />
      <HelpPanel currentStep={step} />
    </div>
  );
}
