'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, XCircle, Upload, ArrowRight } from 'lucide-react';

interface ActualValues {
  Y?: number;
  x1?: number;
  x2?: number;
  x3?: number;
  x4?: number;
  x5?: number;
  x6?: number;
  x7?: number;
  x8?: number;
  X21?: number;
  X22?: number;
  X2?: number;
  W?: number;
  industries?: Array<{
    name: string;
    X1?: number;
    Z?: number;
    P?: number;
  }>;
}

interface EstimatedValues {
  Y?: number;
  x1?: number;
  x2?: number;
  x3?: number;
  x4?: number;
  x5?: number;
  x6?: number;
  x7?: number;
  x8?: number;
  X21?: number;
  X22?: number;
  X2?: number;
  W?: number;
  industries?: Array<{
    name: string;
    X1?: number;
    Z?: number;
    P?: number;
  }>;
}

interface ComparisonRow {
  label: string;
  estimated: number | undefined;
  actual: number | undefined;
  match: 'exact' | 'close' | 'mismatch' | 'unknown';
  cause?: string;
  remedy?: string;
}

const CAUSES: Record<string, { cause: string; remedy: string }> = {
  x1: {
    cause: '支払利息または受取利息配当金の分類差',
    remedy: '利息の計上基準を確認してください。',
  },
  x2: {
    cause: '負債合計または売上高の千円変換差',
    remedy: '千円切捨ての処理順序を確認してください。',
  },
  x3: {
    cause: '売上総利益または総資本の端数処理差',
    remedy: '2期平均の計算基準を確認してください。',
  },
  x4: {
    cause: '経常利益率のキャップ処理の差（上限5.1%）',
    remedy: '経常利益率が5.1%付近の場合、端数処理の差が原因の可能性があります。',
  },
  x5: {
    cause: '自己資本または固定資産の分類差',
    remedy: '純資産の千円変換値を確認してください。',
  },
  x6: {
    cause: '自己資本比率の計算差',
    remedy: '総資本（総資産）の値を確認してください。',
  },
  x7: {
    cause: '営業CFの構成要素の分類差（工事未払金に未払経費を含めた等）',
    remedy: '工事未払金の範囲を確認。未払経費は未払費用に分類してください。',
  },
  x8: {
    cause: '利益剰余金の構成差',
    remedy: '利益準備金+別途積立金+繰越利益剰余金の合計を確認してください。',
  },
  X21: {
    cause: '自己資本額の評点テーブルのブラケット差',
    remedy: 'X21テーブルの該当区間を確認してください。',
  },
  X22: {
    cause: 'EBITDA（利払後事業利益額）の計算差',
    remedy: '営業利益+減価償却の2年平均の計算を確認してください。',
  },
  Y: {
    cause: 'Y点算出式(A値)の端数処理差',
    remedy: 'A値の計算精度を確認してください。',
  },
};

function compare(est: number | undefined, act: number | undefined, tolerance: number = 0): ComparisonRow['match'] {
  if (est === undefined || act === undefined) return 'unknown';
  if (est === act) return 'exact';
  if (Math.abs(est - act) <= tolerance) return 'close';
  return 'mismatch';
}

function MatchIcon({ match }: { match: ComparisonRow['match'] }) {
  switch (match) {
    case 'exact':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'close':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'mismatch':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <span className="h-4 w-4 text-muted-foreground">—</span>;
  }
}

function MatchBadge({ match }: { match: ComparisonRow['match'] }) {
  switch (match) {
    case 'exact':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">完全一致</Badge>;
    case 'close':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">近似</Badge>;
    case 'mismatch':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">差あり</Badge>;
    default:
      return <Badge variant="outline">未入力</Badge>;
  }
}

export function VerificationForm() {
  // Estimated values (from simulator)
  const [estY, setEstY] = useState('');
  const [estX1Indicators, setEstX1Indicators] = useState({
    x1: '', x2: '', x3: '', x4: '', x5: '', x6: '', x7: '', x8: '',
  });
  const [estX21, setEstX21] = useState('');
  const [estX22, setEstX22] = useState('');
  const [estX2, setEstX2] = useState('');
  const [estW, setEstW] = useState('');
  const [estIndustries, setEstIndustries] = useState([
    { name: '電気', X1: '', Z: '', P: '' },
  ]);

  // Actual values (from notification)
  const [actY, setActY] = useState('');
  const [actX1Indicators, setActX1Indicators] = useState({
    x1: '', x2: '', x3: '', x4: '', x5: '', x6: '', x7: '', x8: '',
  });
  const [actX21, setActX21] = useState('');
  const [actX22, setActX22] = useState('');
  const [actX2, setActX2] = useState('');
  const [actW, setActW] = useState('');
  const [actIndustries, setActIndustries] = useState([
    { name: '電気', X1: '', Z: '', P: '' },
  ]);

  const [showResult, setShowResult] = useState(false);

  function num(s: string): number | undefined {
    if (s === '') return undefined;
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }

  function addIndustry() {
    setEstIndustries([...estIndustries, { name: '', X1: '', Z: '', P: '' }]);
    setActIndustries([...actIndustries, { name: '', X1: '', Z: '', P: '' }]);
  }

  function loadDemoEstimated() {
    setEstY('852');
    setEstX1Indicators({
      x1: '0.312', x2: '2.973', x3: '34.27', x4: '5.100',
      x5: '142.2', x6: '44.84', x7: '0.796', x8: '2.997',
    });
    setEstX21('810');
    setEstX22('687');
    setEstX2('748');
    setEstW('1207');
    setEstIndustries([
      { name: '電気', X1: '1067', Z: '1028', P: '987' },
      { name: '管', X1: '400', Z: '512', P: '732' },
      { name: '電気通信', X1: '456', Z: '510', P: '733' },
      { name: '消防施設', X1: '394', Z: '510', P: '680' },
    ]);
    setActY('852');
    setActX1Indicators({
      x1: '0.312', x2: '2.973', x3: '34.27', x4: '5.100',
      x5: '142.2', x6: '44.84', x7: '0.796', x8: '2.997',
    });
    setActX21('810');
    setActX22('687');
    setActX2('748');
    setActW('1207');
    setActIndustries([
      { name: '電気', X1: '1067', Z: '1028', P: '987' },
      { name: '管', X1: '400', Z: '512', P: '732' },
      { name: '電気通信', X1: '456', Z: '510', P: '733' },
      { name: '消防施設', X1: '394', Z: '510', P: '680' },
    ]);
  }

  const handleVerify = useCallback(() => {
    setShowResult(true);
  }, []);

  // Build comparison rows
  const indicatorRows: ComparisonRow[] = [
    'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8',
  ].map((key) => {
    const k = key as keyof typeof estX1Indicators;
    const est = num(estX1Indicators[k]);
    const act = num(actX1Indicators[k]);
    const match = compare(est, act, 0.01);
    return {
      label: key,
      estimated: est,
      actual: act,
      match,
      ...(match === 'mismatch' ? CAUSES[key] : {}),
    };
  });

  const scoreRows: ComparisonRow[] = [
    { label: 'Y点', estimated: num(estY), actual: num(actY), match: compare(num(estY), num(actY)) },
    { label: 'X21', estimated: num(estX21), actual: num(actX21), match: compare(num(estX21), num(actX21)), ...(compare(num(estX21), num(actX21)) === 'mismatch' ? CAUSES.X21 : {}) },
    { label: 'X22', estimated: num(estX22), actual: num(actX22), match: compare(num(estX22), num(actX22)), ...(compare(num(estX22), num(actX22)) === 'mismatch' ? CAUSES.X22 : {}) },
    { label: 'X2', estimated: num(estX2), actual: num(actX2), match: compare(num(estX2), num(actX2)) },
    { label: 'W', estimated: num(estW), actual: num(actW), match: compare(num(estW), num(actW)) },
  ];

  const industryRows = estIndustries.map((est, i) => {
    const act = actIndustries[i] || { name: '', X1: '', Z: '', P: '' };
    return {
      name: est.name || act.name || `業種${i + 1}`,
      X1: { est: num(est.X1), act: num(act.X1), match: compare(num(est.X1), num(act.X1)) },
      Z: { est: num(est.Z), act: num(act.Z), match: compare(num(est.Z), num(act.Z)) },
      P: { est: num(est.P), act: num(act.P), match: compare(num(est.P), num(act.P)) },
    };
  });

  const allMatched = showResult &&
    [...indicatorRows, ...scoreRows].every((r) => r.match === 'exact' || r.match === 'unknown') &&
    industryRows.every((r) => r.P.match === 'exact' || r.P.match === 'unknown');

  const mismatchCount = showResult
    ? [...indicatorRows, ...scoreRows].filter((r) => r.match === 'mismatch').length +
      industryRows.filter((r) => r.P.match === 'mismatch').length
    : 0;

  const INDICATOR_LABELS: Record<string, string> = {
    x1: '純支払利息比率',
    x2: '負債回転期間',
    x3: '総資本売上総利益率',
    x4: '売上高経常利益率',
    x5: '自己資本対固定資産比率',
    x6: '自己資本比率',
    x7: '営業CF（2期平均）',
    x8: '利益剰余金',
  };

  function inputField(label: string, value: string, onChange: (v: string) => void, className?: string) {
    return (
      <div className={`space-y-1 ${className || ''}`}>
        <Label className="text-xs">{label}</Label>
        <Input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} className="text-right text-sm h-7" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={loadDemoEstimated}>
          デモデータを読み込む
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Estimated */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">試算値</Badge>
              KeishinCloud試算結果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {inputField('Y点', estY, setEstY)}
              {inputField('X2', estX2, setEstX2)}
              {inputField('X21', estX21, setEstX21)}
              {inputField('X22', estX22, setEstX22)}
              {inputField('W', estW, setEstW)}
            </div>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">Y点8指標</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(estX1Indicators).map(([key, val]) => (
                inputField(key, val, (v) => setEstX1Indicators((prev) => ({ ...prev, [key]: v })), undefined)
              ))}
            </div>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">業種別</div>
            {estIndustries.map((ind, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">業種</Label>
                  <Input value={ind.name} onChange={(e) => {
                    const u = [...estIndustries]; u[i] = { ...u[i], name: e.target.value }; setEstIndustries(u);
                  }} className="text-sm h-7" />
                </div>
                {inputField('X1', ind.X1, (v) => { const u = [...estIndustries]; u[i] = { ...u[i], X1: v }; setEstIndustries(u); })}
                {inputField('Z', ind.Z, (v) => { const u = [...estIndustries]; u[i] = { ...u[i], Z: v }; setEstIndustries(u); })}
                {inputField('P', ind.P, (v) => { const u = [...estIndustries]; u[i] = { ...u[i], P: v }; setEstIndustries(u); })}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right: Actual */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="bg-orange-50 text-orange-700">実績値</Badge>
              結果通知書の値
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {inputField('Y点', actY, setActY)}
              {inputField('X2', actX2, setActX2)}
              {inputField('X21', actX21, setActX21)}
              {inputField('X22', actX22, setActX22)}
              {inputField('W', actW, setActW)}
            </div>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">Y点8指標</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(actX1Indicators).map(([key, val]) => (
                inputField(key, val, (v) => setActX1Indicators((prev) => ({ ...prev, [key]: v })), undefined)
              ))}
            </div>
            <Separator />
            <div className="text-xs font-medium text-muted-foreground">業種別</div>
            {actIndustries.map((ind, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">業種</Label>
                  <Input value={ind.name} onChange={(e) => {
                    const u = [...actIndustries]; u[i] = { ...u[i], name: e.target.value }; setActIndustries(u);
                  }} className="text-sm h-7" />
                </div>
                {inputField('X1', ind.X1, (v) => { const u = [...actIndustries]; u[i] = { ...u[i], X1: v }; setActIndustries(u); })}
                {inputField('Z', ind.Z, (v) => { const u = [...actIndustries]; u[i] = { ...u[i], Z: v }; setActIndustries(u); })}
                {inputField('P', ind.P, (v) => { const u = [...actIndustries]; u[i] = { ...u[i], P: v }; setActIndustries(u); })}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline" size="sm" onClick={addIndustry}>+ 業種を追加</Button>
        <Button size="lg" onClick={handleVerify} className="px-12">
          <ArrowRight className="mr-2 h-5 w-5" />
          突合を実行する
        </Button>
      </div>

      {/* Results */}
      {showResult && (
        <div className="space-y-6">
          <Separator />

          {/* Summary */}
          <Card className={allMatched ? 'border-green-300 bg-green-50/50' : 'border-red-300 bg-red-50/50'}>
            <CardContent className="py-6 text-center">
              {allMatched ? (
                <>
                  <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
                  <p className="mt-3 text-lg font-bold text-green-800">全項目一致</p>
                  <p className="text-sm text-green-700">試算値と実績値が全て一致しました。</p>
                </>
              ) : (
                <>
                  <XCircle className="mx-auto h-12 w-12 text-red-600" />
                  <p className="mt-3 text-lg font-bold text-red-800">{mismatchCount}項目に差異あり</p>
                  <p className="text-sm text-red-700">以下の項目で試算値と実績値に差異が見つかりました。</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Y Indicators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Y点8指標の突合</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">指標</th>
                      <th className="py-2 text-left">名称</th>
                      <th className="py-2 text-right">試算値</th>
                      <th className="py-2 text-center"></th>
                      <th className="py-2 text-right">実績値</th>
                      <th className="py-2 text-center">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicatorRows.map((row) => (
                      <tr key={row.label} className="border-b">
                        <td className="py-2 font-mono font-medium">{row.label}</td>
                        <td className="py-2 text-xs text-muted-foreground">{INDICATOR_LABELS[row.label]}</td>
                        <td className="py-2 text-right font-mono">{row.estimated?.toFixed(3) ?? '—'}</td>
                        <td className="py-2 text-center"><MatchIcon match={row.match} /></td>
                        <td className="py-2 text-right font-mono">{row.actual?.toFixed(3) ?? '—'}</td>
                        <td className="py-2 text-center"><MatchBadge match={row.match} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Score Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">評点の突合</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">評点</th>
                      <th className="py-2 text-right">試算値</th>
                      <th className="py-2 text-center"></th>
                      <th className="py-2 text-right">実績値</th>
                      <th className="py-2 text-center">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreRows.map((row) => (
                      <tr key={row.label} className="border-b">
                        <td className="py-2 font-medium">{row.label}</td>
                        <td className="py-2 text-right font-mono">{row.estimated ?? '—'}</td>
                        <td className="py-2 text-center"><MatchIcon match={row.match} /></td>
                        <td className="py-2 text-right font-mono">{row.actual ?? '—'}</td>
                        <td className="py-2 text-center"><MatchBadge match={row.match} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Industry P Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">業種別P点の突合</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">業種</th>
                      <th className="py-2 text-right">試算X1</th>
                      <th className="py-2 text-right">実績X1</th>
                      <th className="py-2 text-right">試算Z</th>
                      <th className="py-2 text-right">実績Z</th>
                      <th className="py-2 text-right">試算P</th>
                      <th className="py-2 text-right">実績P</th>
                      <th className="py-2 text-center">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industryRows.map((row) => (
                      <tr key={row.name} className="border-b">
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2 text-right font-mono">{row.X1.est ?? '—'}</td>
                        <td className="py-2 text-right font-mono">{row.X1.act ?? '—'}</td>
                        <td className="py-2 text-right font-mono">{row.Z.est ?? '—'}</td>
                        <td className="py-2 text-right font-mono">{row.Z.act ?? '—'}</td>
                        <td className="py-2 text-right font-mono font-bold">{row.P.est ?? '—'}</td>
                        <td className="py-2 text-right font-mono font-bold">{row.P.act ?? '—'}</td>
                        <td className="py-2 text-center"><MatchBadge match={row.P.match} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mismatch Details */}
          {mismatchCount > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  差異の推定原因と対処法
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...indicatorRows, ...scoreRows]
                  .filter((r) => r.match === 'mismatch' && r.cause)
                  .map((row) => (
                    <div key={row.label} className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-red-50 text-red-700">{row.label}</Badge>
                        <span className="text-sm">
                          試算値 {row.estimated} ≠ 実績値 {row.actual}
                        </span>
                      </div>
                      <p className="text-sm">
                        <span className="font-medium">推定原因：</span> {row.cause}
                      </p>
                      <p className="text-sm mt-1">
                        <span className="font-medium">対処法：</span> {row.remedy}
                      </p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
