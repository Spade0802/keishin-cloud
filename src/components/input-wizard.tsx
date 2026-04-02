'use client';

import { useState, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { FileUpload } from '@/components/file-upload';
import { WItemsChecklist } from '@/components/w-items-checklist';
import { TechStaffPanel } from '@/components/tech-staff-panel';
import { ResultView } from '@/components/result-view';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult, WDetail, SocialItems } from '@/lib/engine/types';
import type { KeishinPdfResult } from '@/lib/keishin-pdf-parser';

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

function numField(label: string, value: string, onChange: (v: string) => void, unit: string = '千円', help?: string) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-1">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="text-right text-sm h-8" />
        <span className="text-xs text-muted-foreground whitespace-nowrap w-8">{unit}</span>
      </div>
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

// ---- Main Component ----

export function InputWizard() {
  const [step, setStep] = useState(1);

  // Step 1: Financial data from Excel
  const [sales, setSales] = useState('');
  const [grossProfit, setGrossProfit] = useState('');
  const [ordinaryProfit, setOrdinaryProfit] = useState('');
  const [interestExpense, setInterestExpense] = useState('');
  const [interestDividendIncome, setInterestDividendIncome] = useState('');
  const [currentLiabilities, setCurrentLiabilities] = useState('');
  const [fixedLiabilities, setFixedLiabilities] = useState('');
  const [totalCapital, setTotalCapital] = useState('');
  const [equity, setEquity] = useState('');
  const [fixedAssets, setFixedAssets] = useState('');
  const [retainedEarnings, setRetainedEarnings] = useState('');
  const [corporateTax, setCorporateTax] = useState('');
  const [depreciation, setDepreciation] = useState('');
  const [allowanceDoubtful, setAllowanceDoubtful] = useState('');
  const [notesAndReceivable, setNotesAndReceivable] = useState('');
  const [constructionPayable, setConstructionPayable] = useState('');
  const [inventoryAndMaterials, setInventoryAndMaterials] = useState('');
  const [advanceReceived, setAdvanceReceived] = useState('');
  const [fileLoaded, setFileLoaded] = useState(false);

  // Step 2: Basic info + industries + X2 data
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '',
  });
  const [ebitda, setEbitda] = useState('');
  const [industries, setIndustries] = useState<IndustryInput[]>([
    { name: '', permitType: '特定', prevCompletion: '', currCompletion: '', prevSubcontract: '', currSubcontract: '', techStaffValue: '' },
  ]);

  // Step 3: W items
  const [wDetail, setWDetail] = useState<WDetail | null>(null);
  const [wTotal, setWTotal] = useState(0);
  const [wScore, setWScore] = useState(0);
  const [externalWItems, setExternalWItems] = useState<Partial<SocialItems> | undefined>(undefined);

  // 提出書PDF読込状態
  const [keishinPdfLoaded, setKeishinPdfLoaded] = useState(false);
  const [keishinPdfProcessing, setKeishinPdfProcessing] = useState(false);
  const [keishinPdfError, setKeishinPdfError] = useState<string | null>(null);
  const [keishinPdfMappings, setKeishinPdfMappings] = useState<{ source: string; target: string; value: string | number }[]>([]);

  // Step 4: Previous period
  const [prevData, setPrevData] = useState<PrevPeriodData>({
    totalCapital: '', operatingCF: '', allowanceDoubtful: '', notesAndReceivable: '',
    constructionPayable: '', inventoryAndMaterials: '', advanceReceived: '',
  });
  const [prevFileLoading, setPrevFileLoading] = useState(false);
  const [prevFileName, setPrevFileName] = useState<string | null>(null);
  const [prevFileError, setPrevFileError] = useState<string | null>(null);
  const prevFileRef = useRef<HTMLInputElement>(null);

  // Result
  const [result, setResult] = useState<{
    Y: number; X2: number; X21: number; X22: number; W: number; wTotal: number;
    yResult: YResult; wDetail: WDetail;
    industries: Array<{ name: string; X1: number; Z: number; Z1: number; Z2: number; P: number }>;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  function num(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // File parsed handler
  function handleFileParsed(data: Record<string, number | undefined>) {
    if (data.sales !== undefined) setSales(String(data.sales));
    if (data.grossProfit !== undefined) setGrossProfit(String(data.grossProfit));
    if (data.ordinaryProfit !== undefined) setOrdinaryProfit(String(data.ordinaryProfit));
    if (data.interestExpense !== undefined) setInterestExpense(String(data.interestExpense));
    if (data.interestDividendIncome !== undefined) setInterestDividendIncome(String(data.interestDividendIncome));
    if (data.currentLiabilities !== undefined) setCurrentLiabilities(String(data.currentLiabilities));
    if (data.fixedLiabilities !== undefined) setFixedLiabilities(String(data.fixedLiabilities));
    if (data.totalCapital !== undefined) setTotalCapital(String(data.totalCapital));
    if (data.equity !== undefined) setEquity(String(data.equity));
    if (data.fixedAssets !== undefined) setFixedAssets(String(data.fixedAssets));
    if (data.retainedEarnings !== undefined) setRetainedEarnings(String(data.retainedEarnings));
    if (data.corporateTax !== undefined) setCorporateTax(String(data.corporateTax));
    if (data.depreciation !== undefined) setDepreciation(String(data.depreciation));
    setFileLoaded(true);
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

      // Map BS data to prevData fields (千円単位)
      const updated: PrevPeriodData = { ...prevData };
      if (data.bs?.totals?.totalAssets) updated.totalCapital = String(Math.round(data.bs.totals.totalAssets / 1000));
      if (data.bs?.currentAssets?.['貸倒引当金'] !== undefined) updated.allowanceDoubtful = String(Math.round(data.bs.currentAssets['貸倒引当金'] / 1000));

      // 受取手形 + 完成工事未収入金
      const notes = data.bs?.currentAssets?.['受取手形'] || 0;
      const acctRec = data.bs?.currentAssets?.['完成工事未収入金'] || 0;
      if (notes || acctRec) updated.notesAndReceivable = String(Math.round((notes + acctRec) / 1000));

      // 工事未払金
      if (data.bs?.currentLiabilities?.['工事未払金']) updated.constructionPayable = String(Math.round(data.bs.currentLiabilities['工事未払金'] / 1000));

      // 未成工事支出金 + 材料貯蔵品
      const wip = data.bs?.currentAssets?.['未成工事支出金'] || 0;
      const mat = data.bs?.currentAssets?.['材料貯蔵品'] || 0;
      if (wip || mat) updated.inventoryAndMaterials = String(Math.round((wip + mat) / 1000));

      // 未成工事受入金
      if (data.bs?.currentLiabilities?.['未成工事受入金']) updated.advanceReceived = String(Math.round(data.bs.currentLiabilities['未成工事受入金'] / 1000));

      setPrevData(updated);
    } catch (e) {
      setPrevFileError(e instanceof Error ? e.message : '解析に失敗しました。');
    } finally {
      setPrevFileLoading(false);
    }
  }, [prevData]);

  // Load demo data
  function loadDemoData() {
    // Step 1
    setSales('1668128'); setGrossProfit('270254'); setOrdinaryProfit('85784');
    setInterestExpense('6042'); setInterestDividendIncome('844');
    setCurrentLiabilities('185776'); setFixedLiabilities('227499');
    setTotalCapital('749286'); setEquity('336010'); setFixedAssets('236308');
    setRetainedEarnings('299650'); setCorporateTax('29851'); setDepreciation('5985');
    setAllowanceDoubtful('635'); setNotesAndReceivable('129271');
    setConstructionPayable('137521'); setInventoryAndMaterials('4836');
    setAdvanceReceived('682');
    setFileLoaded(true);
    // Step 2
    setBasicInfo({ companyName: 'アヅサ電気工業(株)', permitNumber: '千葉県知事許可', reviewBaseDate: 'R7.6.30', periodNumber: '第58期' });
    setEbitda('44332');
    setIndustries([
      { name: '電気', permitType: '特定', prevCompletion: '1125920', currCompletion: '1625600', prevSubcontract: '443950', currSubcontract: '933000', techStaffValue: '62' },
      { name: '管', permitType: '一般', prevCompletion: '3370', currCompletion: '0', prevSubcontract: '0', currSubcontract: '0', techStaffValue: '20' },
      { name: '電気通信', permitType: '一般', prevCompletion: '27752', currCompletion: '0', prevSubcontract: '27752', currSubcontract: '0', techStaffValue: '0' },
      { name: '消防施設', permitType: '一般', prevCompletion: '1842', currCompletion: '0', prevSubcontract: '0', currSubcontract: '0', techStaffValue: '0' },
    ]);
    // Step 4
    setPrevData({
      totalCapital: '827777', operatingCF: '78454', allowanceDoubtful: '1200',
      notesAndReceivable: '223124', constructionPayable: '224090',
      inventoryAndMaterials: '17836', advanceReceived: '1653',
    });
  }

  // 経審提出書PDFアップロード処理
  async function handleKeishinPdfUpload(file: File) {
    setKeishinPdfError(null);
    setKeishinPdfProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-keishin-pdf', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '解析に失敗しました');
      }
      const data: KeishinPdfResult = await res.json();

      // Step 2: 基本情報
      if (data.basicInfo.companyName) setBasicInfo(prev => ({ ...prev, companyName: data.basicInfo.companyName }));
      if (data.basicInfo.permitNumber) setBasicInfo(prev => ({ ...prev, permitNumber: data.basicInfo.permitNumber }));
      if (data.basicInfo.reviewBaseDate) setBasicInfo(prev => ({ ...prev, reviewBaseDate: data.basicInfo.reviewBaseDate }));

      // Step 2: X2データ
      if (data.ebitda) setEbitda(String(data.ebitda));
      // 自己資本額（= 純資産合計）→ Step1のequityにも反映
      if (data.equity && !equity) setEquity(String(data.equity));

      // Step 2: 業種別完成工事高
      if (data.industries.length > 0) {
        setIndustries(data.industries.map(ind => ({
          name: ind.name,
          permitType: '一般' as const,
          prevCompletion: String(ind.prevCompletion),
          currCompletion: String(ind.currCompletion),
          prevSubcontract: String(ind.prevPrimeContract),
          currSubcontract: String(ind.currPrimeContract),
          techStaffValue: '',
        })));
      }

      // Step 3: W項目（技術職員数・営業年数もマージ）
      const wItems: Partial<SocialItems> = { ...data.wItems };
      if (data.techStaffCount > 0 && !wItems.techStaffCount) {
        wItems.techStaffCount = data.techStaffCount;
      }
      if (data.businessYears > 0 && !wItems.businessYears) {
        wItems.businessYears = data.businessYears;
      }
      if (Object.keys(wItems).length > 0) {
        setExternalWItems(wItems);
      }

      setKeishinPdfMappings(data.mappings || []);
      setKeishinPdfLoaded(true);
    } catch (e) {
      setKeishinPdfError(e instanceof Error ? e.message : '提出書PDFの解析に失敗しました');
    } finally {
      setKeishinPdfProcessing(false);
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
          const avgSub = Math.floor((num(ind.prevSubcontract) + num(ind.currSubcontract)) / 2);
          const techVal = num(ind.techStaffValue);
          const X1 = lookupScore(X1_TABLE, avgComp);
          const z1 = lookupScore(Z1_TABLE, techVal);
          const z2 = lookupScore(Z2_TABLE, avgSub);
          const Z = calculateZ(z1, z2);
          const P = calculateP(X1, x2, yResult.Y, Z, W);
          return { name: ind.name, X1, Z, Z1: z1, Z2: z2, P };
        });

      setResult({ Y: yResult.Y, X2: x2, X21: x21, X22: x22, W, wTotal, yResult, wDetail: wDet, industries: industryResults });
      setStep(5); // Go to result
    } catch (e) {
      setError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    }
  }

  const handleWCalculated = useCallback((detail: WDetail, total: number, w: number) => {
    setWDetail(detail);
    setWTotal(total);
    setWScore(w);
  }, []);

  return (
    <div className="space-y-6">
      {step <= 4 && <StepIndicator current={step} />}

      {/* Demo Data Button */}
      {step <= 4 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={loadDemoData}>デモデータを読み込む（58期）</Button>
        </div>
      )}

      {/* Step 1: Upload + Financial */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Step 1: 決算書Excelアップロード</h2>
          <p className="text-sm text-muted-foreground">
            決算書Excelをアップロードすると、BS/PLの数値を自動読取します。手入力も可能です。
          </p>

          <FileUpload onDataParsed={handleFileParsed} />

          {fileLoaded && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="mr-1 h-3 w-3" />データ読取済み
            </Badge>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">当期財務データ（千円）</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {numField('完成工事高（売上高）', sales, setSales)}
              {numField('売上総利益', grossProfit, setGrossProfit)}
              {numField('経常利益', ordinaryProfit, setOrdinaryProfit)}
              {numField('支払利息', interestExpense, setInterestExpense)}
              {numField('受取利息配当金', interestDividendIncome, setInterestDividendIncome)}
              {numField('流動負債合計', currentLiabilities, setCurrentLiabilities)}
              {numField('固定負債合計', fixedLiabilities, setFixedLiabilities)}
              {numField('総資本（総資産）', totalCapital, setTotalCapital)}
              {numField('純資産合計', equity, setEquity)}
              {numField('固定資産合計', fixedAssets, setFixedAssets)}
              {numField('利益剰余金合計', retainedEarnings, setRetainedEarnings)}
              {numField('法人税等', corporateTax, setCorporateTax)}
              {numField('減価償却実施額', depreciation, setDepreciation)}
              {numField('貸倒引当金（絶対値）', allowanceDoubtful, setAllowanceDoubtful)}
              {numField('受取手形+完成工事未収入金', notesAndReceivable, setNotesAndReceivable)}
              {numField('工事未払金', constructionPayable, setConstructionPayable, '千円', '未払経費を含めない')}
              {numField('未成工事支出金+材料貯蔵品', inventoryAndMaterials, setInventoryAndMaterials)}
              {numField('未成工事受入金', advanceReceived, setAdvanceReceived)}
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
                    <div className="space-y-1 w-24">
                      <Label className="text-xs">業種名</Label>
                      <Input value={ind.name} onChange={(e) => updateIndustry(i, 'name', e.target.value)} className="text-sm h-8" placeholder="電気" />
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
                    {numField('前年度元請完工高', ind.prevSubcontract, (v) => updateIndustry(i, 'prevSubcontract', v))}
                    {numField('当年度元請完工高', ind.currSubcontract, (v) => updateIndustry(i, 'currSubcontract', v))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {numField('技術職員数値', ind.techStaffValue, (v) => updateIndustry(i, 'techStaffValue', v), '点')}
                    <div className="text-xs text-muted-foreground self-end pb-2">
                      2年平均完工高: {Math.floor((num(ind.prevCompletion) + num(ind.currCompletion)) / 2).toLocaleString()}千円
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
                {keishinPdfMappings.filter(m => m.source === '別紙三').length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {keishinPdfMappings.filter(m => m.source === '別紙三').map((m, i) => (
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
            Y点の営業CF計算に前期の経審用BS千円値が必要です。ファイルアップロードまたは手入力してください。
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
                  <p className="text-sm text-muted-foreground">解析中...</p>
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
            <CardHeader><CardTitle className="text-base">前期（経審用BS千円値）</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {numField('前期 資産合計（総資本）', prevData.totalCapital, (v) => setPrevData({ ...prevData, totalCapital: v }))}
              {numField('前期 営業CF', prevData.operatingCF, (v) => setPrevData({ ...prevData, operatingCF: v }), '千円', '前期③があれば。なければ前期BSから再計算')}
              {numField('前期 貸倒引当金', prevData.allowanceDoubtful, (v) => setPrevData({ ...prevData, allowanceDoubtful: v }))}
              {numField('前期 受取手形+完成工事未収入金', prevData.notesAndReceivable, (v) => setPrevData({ ...prevData, notesAndReceivable: v }))}
              {numField('前期 工事未払金', prevData.constructionPayable, (v) => setPrevData({ ...prevData, constructionPayable: v }), '千円', '未払経費を含めない')}
              {numField('前期 未成工事支出金+材料貯蔵品', prevData.inventoryAndMaterials, (v) => setPrevData({ ...prevData, inventoryAndMaterials: v }))}
              {numField('前期 未成工事受入金', prevData.advanceReceived, (v) => setPrevData({ ...prevData, advanceReceived: v }))}
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
        />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        {step > 1 && step <= 4 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
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
            <Button onClick={() => setStep(step + 1)}>
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

      <p className="text-xs text-center text-muted-foreground">
        ※ 本試算は参考値であり、公式の経営事項審査結果通知書ではありません。
      </p>
    </div>
  );
}
