'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Calculator, ArrowRight, BarChart3, Info } from 'lucide-react';
import { ScenarioPanel } from '@/components/scenario-panel';
import { FileUpload } from '@/components/file-upload';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult } from '@/lib/engine/types';

interface IndustryInput {
  name: string;
  avgCompletion: string;
  avgSubcontract: string;
  techStaffValue: string;
}

interface CalculationResult {
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  wTotal: number;
  yResult: YResult;
  industries: {
    name: string;
    X1: number;
    Z: number;
    Z1: number;
    Z2: number;
    P: number;
  }[];
}

function numberField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  unit: string = '千円',
  helpText?: string
) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {label}
        {helpText && (
          <span className="ml-1 text-muted-foreground" title={helpText}>
            <Info className="inline h-3 w-3" />
          </span>
        )}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-right text-sm h-8"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap w-8">{unit}</span>
      </div>
    </div>
  );
}

export function SimulatorForm() {
  // Y input state
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
  const [notesAndAccountsReceivable, setNotesAndAccountsReceivable] = useState('');
  const [constructionPayable, setConstructionPayable] = useState('');
  const [inventoryAndMaterials, setInventoryAndMaterials] = useState('');
  const [advanceReceived, setAdvanceReceived] = useState('');

  // Prev period
  const [prevTotalCapital, setPrevTotalCapital] = useState('');
  const [prevOperatingCF, setPrevOperatingCF] = useState('');
  const [prevAllowanceDoubtful, setPrevAllowanceDoubtful] = useState('');
  const [prevNotesAndAccountsReceivable, setPrevNotesAndAccountsReceivable] = useState('');
  const [prevConstructionPayable, setPrevConstructionPayable] = useState('');
  const [prevInventoryAndMaterials, setPrevInventoryAndMaterials] = useState('');
  const [prevAdvanceReceived, setPrevAdvanceReceived] = useState('');

  // X22: 利益額（利払後事業利益額）直接入力
  const [ebitda, setEbitda] = useState('');

  // W total (simplified input)
  const [wTotal, setWTotal] = useState('');

  // Industries
  const [industries, setIndustries] = useState<IndustryInput[]>([
    { name: '', avgCompletion: '', avgSubcontract: '', techStaffValue: '' },
  ]);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addIndustry() {
    setIndustries([...industries, { name: '', avgCompletion: '', avgSubcontract: '', techStaffValue: '' }]);
  }

  function removeIndustry(index: number) {
    setIndustries(industries.filter((_, i) => i !== index));
  }

  function updateIndustry(index: number, field: keyof IndustryInput, value: string) {
    const updated = [...industries];
    updated[index] = { ...updated[index], [field]: value };
    setIndustries(updated);
  }

  function num(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function handleCalculate() {
    setError(null);
    try {
      const yInput: YInput = {
        sales: num(sales),
        grossProfit: num(grossProfit),
        ordinaryProfit: num(ordinaryProfit),
        interestExpense: num(interestExpense),
        interestDividendIncome: num(interestDividendIncome),
        currentLiabilities: num(currentLiabilities),
        fixedLiabilities: num(fixedLiabilities),
        totalCapital: num(totalCapital),
        equity: num(equity),
        fixedAssets: num(fixedAssets),
        retainedEarnings: num(retainedEarnings),
        corporateTax: num(corporateTax),
        depreciation: num(depreciation),
        allowanceDoubtful: num(allowanceDoubtful),
        notesAndAccountsReceivable: num(notesAndAccountsReceivable),
        constructionPayable: num(constructionPayable),
        inventoryAndMaterials: num(inventoryAndMaterials),
        advanceReceived: num(advanceReceived),
        prev: {
          totalCapital: num(prevTotalCapital),
          operatingCF: num(prevOperatingCF),
          allowanceDoubtful: num(prevAllowanceDoubtful),
          notesAndAccountsReceivable: num(prevNotesAndAccountsReceivable),
          constructionPayable: num(prevConstructionPayable),
          inventoryAndMaterials: num(prevInventoryAndMaterials),
          advanceReceived: num(prevAdvanceReceived),
        },
      };

      if (yInput.sales <= 0) {
        setError('完成工事高（売上高）を入力してください。');
        return;
      }

      const yResult = calculateY(yInput);

      // X2
      const equityVal = num(equity);
      const ebitdaVal = num(ebitda);
      const x21 = lookupScore(X21_TABLE, equityVal);
      const x22 = lookupScore(X22_TABLE, ebitdaVal);
      const x2 = calculateX2(x21, x22);

      // W
      const wTotalNum = num(wTotal);
      const W = Math.floor((wTotalNum * 1750) / 200);

      // Industries
      const industryResults = industries
        .filter((ind) => ind.name && num(ind.avgCompletion) > 0)
        .map((ind) => {
          const avgComp = num(ind.avgCompletion);
          const avgSub = num(ind.avgSubcontract);
          const techVal = num(ind.techStaffValue);

          const X1 = lookupScore(X1_TABLE, avgComp);
          const z1 = lookupScore(Z1_TABLE, techVal);
          const z2 = lookupScore(Z2_TABLE, avgSub);
          const Z = calculateZ(z1, z2);
          const P = calculateP(X1, x2, yResult.Y, Z, W);

          return { name: ind.name, X1, Z, Z1: z1, Z2: z2, P };
        });

      setResult({
        Y: yResult.Y,
        X2: x2,
        X21: x21,
        X22: x22,
        W,
        wTotal: wTotalNum,
        yResult,
        industries: industryResults,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    }
  }

  // Demo data: 58期実績
  function loadDemoData() {
    setSales('1668128');
    setGrossProfit('270254');
    setOrdinaryProfit('85784');
    setInterestExpense('6042');
    setInterestDividendIncome('844');
    setCurrentLiabilities('185776');
    setFixedLiabilities('227499');
    setTotalCapital('749286');
    setEquity('336010');
    setFixedAssets('236308');
    setRetainedEarnings('299650');
    setCorporateTax('29851');
    setDepreciation('5985');
    setAllowanceDoubtful('635');
    setNotesAndAccountsReceivable('129271');
    setConstructionPayable('137521');
    setInventoryAndMaterials('4836');
    setAdvanceReceived('682');
    setPrevTotalCapital('827777');
    setPrevOperatingCF('78454');
    setPrevAllowanceDoubtful('1200');
    setPrevNotesAndAccountsReceivable('223124');
    setPrevConstructionPayable('224090');
    setPrevInventoryAndMaterials('17836');
    setPrevAdvanceReceived('1653');
    setEbitda('44332');
    setWTotal('138');
    setIndustries([
      { name: '電気', avgCompletion: '1375760', avgSubcontract: '688475', techStaffValue: '62' },
      { name: '管', avgCompletion: '1685', avgSubcontract: '0', techStaffValue: '20' },
      { name: '電気通信', avgCompletion: '13876', avgSubcontract: '13876', techStaffValue: '0' },
      { name: '消防施設', avgCompletion: '921', avgSubcontract: '0', techStaffValue: '0' },
    ]);
  }

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
  }

  return (
    <div className="space-y-6">
      {/* File upload */}
      <FileUpload onDataParsed={handleFileParsed} />

      {/* Demo button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadDemoData}>
          デモデータを読み込む
        </Button>
      </div>

      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="financial">財務データ（Y点）</TabsTrigger>
          <TabsTrigger value="industry">業種データ（X1/Z）</TabsTrigger>
          <TabsTrigger value="social">社会性等（W）</TabsTrigger>
        </TabsList>

        {/* Tab 1: Financial Data */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">当期データ（千円）</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {numberField('完成工事高（売上高）', sales, setSales)}
              {numberField('売上総利益', grossProfit, setGrossProfit)}
              {numberField('経常利益', ordinaryProfit, setOrdinaryProfit)}
              {numberField('支払利息', interestExpense, setInterestExpense)}
              {numberField('受取利息配当金', interestDividendIncome, setInterestDividendIncome)}
              {numberField('流動負債合計', currentLiabilities, setCurrentLiabilities)}
              {numberField('固定負債合計', fixedLiabilities, setFixedLiabilities)}
              {numberField('総資本（総資産）', totalCapital, setTotalCapital)}
              {numberField('純資産合計', equity, setEquity)}
              {numberField('固定資産合計', fixedAssets, setFixedAssets)}
              {numberField('利益剰余金合計', retainedEarnings, setRetainedEarnings)}
              {numberField('法人税等', corporateTax, setCorporateTax)}
              {numberField('減価償却実施額', depreciation, setDepreciation)}
              {numberField('貸倒引当金（絶対値）', allowanceDoubtful, setAllowanceDoubtful)}
              {numberField('受取手形+完成工事未収入金', notesAndAccountsReceivable, setNotesAndAccountsReceivable)}
              {numberField('工事未払金', constructionPayable, setConstructionPayable, '千円', '未払経費を含めない')}
              {numberField('未成工事支出金+材料貯蔵品', inventoryAndMaterials, setInventoryAndMaterials)}
              {numberField('未成工事受入金', advanceReceived, setAdvanceReceived)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">X2関連（千円）</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {numberField('利払後事業利益額（X22用）', ebitda, setEbitda, '千円', '営業利益+減価償却の2年平均等。経審の結果通知書に記載の値を入力。')}
              <div className="col-span-full text-xs text-muted-foreground">
                ※ X21（自己資本額）は上の「純資産合計」から自動算出されます。
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">前期データ（千円）</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {numberField('前期 総資本', prevTotalCapital, setPrevTotalCapital)}
              {numberField('前期 営業CF', prevOperatingCF, setPrevOperatingCF)}
              {numberField('前期 貸倒引当金', prevAllowanceDoubtful, setPrevAllowanceDoubtful)}
              {numberField('前期 受取手形+未収入金', prevNotesAndAccountsReceivable, setPrevNotesAndAccountsReceivable)}
              {numberField('前期 工事未払金', prevConstructionPayable, setPrevConstructionPayable)}
              {numberField('前期 未成工事支出金+材料', prevInventoryAndMaterials, setPrevInventoryAndMaterials)}
              {numberField('前期 未成工事受入金', prevAdvanceReceived, setPrevAdvanceReceived)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Industry Data */}
        <TabsContent value="industry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">業種別データ（千円）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {industries.map((ind, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 pb-4 border-b last:border-0">
                  <div className="space-y-1 w-28">
                    <Label className="text-xs">業種名</Label>
                    <Input
                      value={ind.name}
                      onChange={(e) => updateIndustry(i, 'name', e.target.value)}
                      placeholder="例: 電気"
                      className="text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <Label className="text-xs">2年平均完成工事高</Label>
                    <Input
                      type="number"
                      value={ind.avgCompletion}
                      onChange={(e) => updateIndustry(i, 'avgCompletion', e.target.value)}
                      className="text-right text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <Label className="text-xs">2年平均元請完成工事高</Label>
                    <Input
                      type="number"
                      value={ind.avgSubcontract}
                      onChange={(e) => updateIndustry(i, 'avgSubcontract', e.target.value)}
                      className="text-right text-sm h-8"
                    />
                  </div>
                  <div className="space-y-1 w-28">
                    <Label className="text-xs">技術職員数値</Label>
                    <Input
                      type="number"
                      value={ind.techStaffValue}
                      onChange={(e) => updateIndustry(i, 'techStaffValue', e.target.value)}
                      className="text-right text-sm h-8"
                    />
                  </div>
                  {industries.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeIndustry(i)} className="text-destructive h-8">
                      削除
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIndustry}>
                + 業種を追加
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Social Items */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">社会性等（W）</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                W点の素点合計を直接入力してください。（詳細なW点計算機能は近日公開）
              </p>
              {numberField('W素点合計', wTotal, setWTotal, '点', 'W1〜W8の合計値')}
              <p className="text-xs text-muted-foreground mt-2">
                W = floor(素点合計 × 1750 / 200)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Calculate Button */}
      <div className="flex justify-center">
        <Button size="lg" onClick={handleCalculate} className="px-12">
          <Calculator className="mr-2 h-5 w-5" />
          P点を計算する
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6" id="results">
          <Separator />
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            試算結果
          </h2>
          <p className="text-xs text-muted-foreground">
            ※ 本試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
          </p>

          {/* P Score Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {result.industries.map((ind) => (
              <Card key={ind.name} className="text-center">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{ind.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary">{ind.P}</div>
                  <div className="text-xs text-muted-foreground mt-1">P点</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Common Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">共通評点</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">Y点（経営状況）</div>
                  <div className="text-2xl font-bold">{result.Y}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">X2（自己資本+利益）</div>
                  <div className="text-2xl font-bold">{result.X2}</div>
                  <div className="text-xs text-muted-foreground">X21={result.X21} / X22={result.X22}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">W点（社会性等）</div>
                  <div className="text-2xl font-bold">{result.W}</div>
                  <div className="text-xs text-muted-foreground">素点={result.wTotal}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground">営業CF</div>
                  <div className="text-2xl font-bold">{result.yResult.operatingCF.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">千円</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Industry Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">業種別内訳</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">業種</th>
                      <th className="py-2 text-right">X1</th>
                      <th className="py-2 text-right">X2</th>
                      <th className="py-2 text-right">Y</th>
                      <th className="py-2 text-right">Z</th>
                      <th className="py-2 text-right">W</th>
                      <th className="py-2 text-right font-bold">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.industries.map((ind) => (
                      <tr key={ind.name} className="border-b">
                        <td className="py-2 font-medium">{ind.name}</td>
                        <td className="py-2 text-right">{ind.X1}</td>
                        <td className="py-2 text-right">{result.X2}</td>
                        <td className="py-2 text-right">{result.Y}</td>
                        <td className="py-2 text-right">{ind.Z}</td>
                        <td className="py-2 text-right">{result.W}</td>
                        <td className="py-2 text-right font-bold text-primary">{ind.P}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
              </div>
            </CardContent>
          </Card>

          {/* Y Score Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Y点詳細（経営状況8指標）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ['x1', '純支払利息比率', '%'],
                    ['x2', '負債回転期間', 'ヶ月'],
                    ['x3', '総資本売上総利益率', '%'],
                    ['x4', '売上高経常利益率', '%'],
                    ['x5', '自己資本対固定資産比率', '%'],
                    ['x6', '自己資本比率', '%'],
                    ['x7', '営業CF（2期平均）', '億円'],
                    ['x8', '利益剰余金', '億円'],
                  ] as const
                ).map(([key, label, unit]) => (
                  <div key={key} className="p-2 rounded border text-center">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold">
                      {result.yResult.indicators[key].toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">{unit}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center text-sm">
                A = {result.yResult.A.toFixed(4)} → Y = {result.yResult.Y}
              </div>
            </CardContent>
          </Card>

          {/* What-if Scenario Panel */}
          <ScenarioPanel
            yInput={{
              sales: num(sales),
              grossProfit: num(grossProfit),
              ordinaryProfit: num(ordinaryProfit),
              interestExpense: num(interestExpense),
              interestDividendIncome: num(interestDividendIncome),
              currentLiabilities: num(currentLiabilities),
              fixedLiabilities: num(fixedLiabilities),
              totalCapital: num(totalCapital),
              equity: num(equity),
              fixedAssets: num(fixedAssets),
              retainedEarnings: num(retainedEarnings),
              corporateTax: num(corporateTax),
              depreciation: num(depreciation),
              allowanceDoubtful: num(allowanceDoubtful),
              notesAndAccountsReceivable: num(notesAndAccountsReceivable),
              constructionPayable: num(constructionPayable),
              inventoryAndMaterials: num(inventoryAndMaterials),
              advanceReceived: num(advanceReceived),
              prev: {
                totalCapital: num(prevTotalCapital),
                operatingCF: num(prevOperatingCF),
                allowanceDoubtful: num(prevAllowanceDoubtful),
                notesAndAccountsReceivable: num(prevNotesAndAccountsReceivable),
                constructionPayable: num(prevConstructionPayable),
                inventoryAndMaterials: num(prevInventoryAndMaterials),
                advanceReceived: num(prevAdvanceReceived),
              },
            }}
            equity={num(equity)}
            ebitda={num(ebitda)}
            wTotal={num(wTotal)}
            industries={industries
              .filter((ind) => ind.name && num(ind.avgCompletion) > 0)
              .map((ind) => ({
                name: ind.name,
                avgCompletion: num(ind.avgCompletion),
                avgSubcontract: num(ind.avgSubcontract),
                techStaffValue: num(ind.techStaffValue),
              }))}
          />
        </div>
      )}
    </div>
  );
}
