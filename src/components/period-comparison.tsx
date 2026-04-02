'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight, Upload, CheckCircle } from 'lucide-react';

interface PeriodData {
  label: string;
  Y: string;
  X2: string;
  X21: string;
  X22: string;
  W: string;
  industries: Array<{ name: string; X1: string; Z: string; P: string }>;
}

function DiffBadge({ prev, curr }: { prev: number; curr: number }) {
  const diff = curr - prev;
  if (diff > 0) return (
    <span className="inline-flex items-center text-green-600 font-medium">
      <ArrowUpRight className="h-3 w-3" />+{diff}
    </span>
  );
  if (diff < 0) return (
    <span className="inline-flex items-center text-red-600 font-medium">
      <ArrowDownRight className="h-3 w-3" />{diff}
    </span>
  );
  return (
    <span className="inline-flex items-center text-muted-foreground">
      <Minus className="h-3 w-3" />±0
    </span>
  );
}

function PdfUploadZone({ label, loading, fileName, error, onFile }: {
  label: string;
  loading: boolean;
  fileName: string | null;
  error: string | null;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed p-3 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        {loading ? (
          <p className="text-xs text-muted-foreground">解析中...</p>
        ) : fileName && !error ? (
          <div className="flex items-center justify-center gap-1 text-xs text-green-700">
            <CheckCircle className="h-3 w-3" />
            <span>{fileName} から読込済</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            <span>{label}の結果通知書PDFをアップロード</span>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PeriodComparison() {
  const [prev, setPrev] = useState<PeriodData>({
    label: '第57期',
    Y: '792', X2: '742', X21: '821', X22: '663', W: '1207',
    industries: [
      { name: '電気', X1: '1025', Z: '990', P: '941' },
      { name: '管', X1: '546', Z: '512', P: '790' },
      { name: '電気通信', X1: '394', Z: '510', P: '668' },
      { name: '消防施設', X1: '397', Z: '510', P: '656' },
    ],
  });

  const [curr, setCurr] = useState<PeriodData>({
    label: '第58期',
    Y: '852', X2: '748', X21: '810', X22: '687', W: '1207',
    industries: [
      { name: '電気', X1: '1067', Z: '1028', P: '987' },
      { name: '管', X1: '400', Z: '512', P: '732' },
      { name: '電気通信', X1: '456', Z: '510', P: '733' },
      { name: '消防施設', X1: '394', Z: '510', P: '680' },
    ],
  });

  const [showResult, setShowResult] = useState(false);

  // File upload state
  const [prevFile, setPrevFile] = useState<{ loading: boolean; name: string | null; error: string | null }>({ loading: false, name: null, error: null });
  const [currFile, setCurrFile] = useState<{ loading: boolean; name: string | null; error: string | null }>({ loading: false, name: null, error: null });

  const handleUpload = useCallback(async (file: File, target: 'prev' | 'curr') => {
    const setFileState = target === 'prev' ? setPrevFile : setCurrFile;
    const setData = target === 'prev' ? setPrev : setCurr;

    setFileState({ loading: true, name: file.name, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-result-pdf', { method: 'POST', body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `解析エラー (${res.status})`);
      }
      const { scores } = await res.json();

      setData((d) => {
        const updated = { ...d };
        if (scores.label) updated.label = scores.label;
        if (scores.Y) updated.Y = scores.Y;
        if (scores.X2) updated.X2 = scores.X2;
        if (scores.X21) updated.X21 = scores.X21;
        if (scores.X22) updated.X22 = scores.X22;
        if (scores.W) updated.W = scores.W;
        if (scores.industries?.length > 0) updated.industries = scores.industries;
        return updated;
      });
      setFileState({ loading: false, name: file.name, error: null });
    } catch (e) {
      setFileState({ loading: false, name: file.name, error: e instanceof Error ? e.message : '解析失敗' });
    }
  }, []);

  function num(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function updatePrev(field: string, value: string) {
    setPrev((p) => ({ ...p, [field]: value }));
  }
  function updateCurr(field: string, value: string) {
    setCurr((p) => ({ ...p, [field]: value }));
  }

  function updatePrevIndustry(i: number, field: string, value: string) {
    setPrev((p) => {
      const ind = [...p.industries];
      ind[i] = { ...ind[i], [field]: value };
      return { ...p, industries: ind };
    });
  }
  function updateCurrIndustry(i: number, field: string, value: string) {
    setCurr((p) => {
      const ind = [...p.industries];
      ind[i] = { ...ind[i], [field]: value };
      return { ...p, industries: ind };
    });
  }

  function addIndustry() {
    setPrev((p) => ({ ...p, industries: [...p.industries, { name: '', X1: '', Z: '', P: '' }] }));
    setCurr((p) => ({ ...p, industries: [...p.industries, { name: '', X1: '', Z: '', P: '' }] }));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Previous Period */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline">前期</Badge>
              <Input value={prev.label} onChange={(e) => updatePrev('label', e.target.value)} className="w-28 h-7 text-sm" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PdfUploadZone label="前期" loading={prevFile.loading} fileName={prevFile.name} error={prevFile.error} onFile={(f) => handleUpload(f, 'prev')} />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-xs">Y</Label><Input value={prev.Y} onChange={(e) => updatePrev('Y', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X2</Label><Input value={prev.X2} onChange={(e) => updatePrev('X2', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">W</Label><Input value={prev.W} onChange={(e) => updatePrev('W', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X21</Label><Input value={prev.X21} onChange={(e) => updatePrev('X21', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X22</Label><Input value={prev.X22} onChange={(e) => updatePrev('X22', e.target.value)} className="text-right h-7 text-sm" /></div>
            </div>
            <Separator />
            {prev.industries.map((ind, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <div className="space-y-1"><Label className="text-xs">業種</Label><Input value={ind.name} onChange={(e) => updatePrevIndustry(i, 'name', e.target.value)} className="h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">X1</Label><Input value={ind.X1} onChange={(e) => updatePrevIndustry(i, 'X1', e.target.value)} className="text-right h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Z</Label><Input value={ind.Z} onChange={(e) => updatePrevIndustry(i, 'Z', e.target.value)} className="text-right h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">P</Label><Input value={ind.P} onChange={(e) => updatePrevIndustry(i, 'P', e.target.value)} className="text-right h-7 text-sm" /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Current Period */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">当期</Badge>
              <Input value={curr.label} onChange={(e) => updateCurr('label', e.target.value)} className="w-28 h-7 text-sm" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PdfUploadZone label="当期" loading={currFile.loading} fileName={currFile.name} error={currFile.error} onFile={(f) => handleUpload(f, 'curr')} />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-xs">Y</Label><Input value={curr.Y} onChange={(e) => updateCurr('Y', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X2</Label><Input value={curr.X2} onChange={(e) => updateCurr('X2', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">W</Label><Input value={curr.W} onChange={(e) => updateCurr('W', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X21</Label><Input value={curr.X21} onChange={(e) => updateCurr('X21', e.target.value)} className="text-right h-7 text-sm" /></div>
              <div className="space-y-1"><Label className="text-xs">X22</Label><Input value={curr.X22} onChange={(e) => updateCurr('X22', e.target.value)} className="text-right h-7 text-sm" /></div>
            </div>
            <Separator />
            {curr.industries.map((ind, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <div className="space-y-1"><Label className="text-xs">業種</Label><Input value={ind.name} onChange={(e) => updateCurrIndustry(i, 'name', e.target.value)} className="h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">X1</Label><Input value={ind.X1} onChange={(e) => updateCurrIndustry(i, 'X1', e.target.value)} className="text-right h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Z</Label><Input value={ind.Z} onChange={(e) => updateCurrIndustry(i, 'Z', e.target.value)} className="text-right h-7 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">P</Label><Input value={ind.P} onChange={(e) => updateCurrIndustry(i, 'P', e.target.value)} className="text-right h-7 text-sm" /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center gap-4">
        <Button variant="outline" size="sm" onClick={addIndustry}>+ 業種を追加</Button>
        <Button size="lg" onClick={() => setShowResult(true)} className="px-12">
          <ArrowRight className="mr-2 h-5 w-5" />
          比較表を生成
        </Button>
      </div>

      {showResult && (
        <div className="space-y-6">
          <Separator />

          {/* Common Scores Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">共通評点の比較</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left">評点</th>
                    <th className="py-2 text-right">{prev.label}</th>
                    <th className="py-2 text-right">{curr.label}</th>
                    <th className="py-2 text-center">変動</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Y点（経営状況）', prevVal: prev.Y, currVal: curr.Y },
                    { label: 'X2（自己資本+利益）', prevVal: prev.X2, currVal: curr.X2 },
                    { label: 'X21（自己資本額）', prevVal: prev.X21, currVal: curr.X21 },
                    { label: 'X22（利益額）', prevVal: prev.X22, currVal: curr.X22 },
                    { label: 'W（社会性等）', prevVal: prev.W, currVal: curr.W },
                  ].map((row) => (
                    <tr key={row.label} className="border-b">
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2 text-right font-mono">{num(row.prevVal)}</td>
                      <td className="py-2 text-right font-mono">{num(row.currVal)}</td>
                      <td className="py-2 text-center">
                        <DiffBadge prev={num(row.prevVal)} curr={num(row.currVal)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Industry P Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">業種別P点の比較</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left">業種</th>
                    <th className="py-2 text-right">{prev.label} X1</th>
                    <th className="py-2 text-right">{curr.label} X1</th>
                    <th className="py-2 text-center">X1変動</th>
                    <th className="py-2 text-right">{prev.label} Z</th>
                    <th className="py-2 text-right">{curr.label} Z</th>
                    <th className="py-2 text-center">Z変動</th>
                    <th className="py-2 text-right font-bold">{prev.label} P</th>
                    <th className="py-2 text-right font-bold">{curr.label} P</th>
                    <th className="py-2 text-center font-bold">P変動</th>
                  </tr>
                </thead>
                <tbody>
                  {curr.industries.map((cInd, i) => {
                    const pInd = prev.industries[i] || { name: '', X1: '0', Z: '0', P: '0' };
                    return (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-medium">{cInd.name || pInd.name}</td>
                        <td className="py-2 text-right font-mono">{num(pInd.X1)}</td>
                        <td className="py-2 text-right font-mono">{num(cInd.X1)}</td>
                        <td className="py-2 text-center"><DiffBadge prev={num(pInd.X1)} curr={num(cInd.X1)} /></td>
                        <td className="py-2 text-right font-mono">{num(pInd.Z)}</td>
                        <td className="py-2 text-right font-mono">{num(cInd.Z)}</td>
                        <td className="py-2 text-center"><DiffBadge prev={num(pInd.Z)} curr={num(cInd.Z)} /></td>
                        <td className="py-2 text-right font-mono font-bold">{num(pInd.P)}</td>
                        <td className="py-2 text-right font-mono font-bold">{num(cInd.P)}</td>
                        <td className="py-2 text-center font-bold"><DiffBadge prev={num(pInd.P)} curr={num(cInd.P)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Highlight significant changes */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="text-base">注目ポイント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {curr.industries.map((cInd, i) => {
                const pInd = prev.industries[i];
                if (!pInd) return null;
                const pDiff = num(cInd.P) - num(pInd.P);
                if (Math.abs(pDiff) < 10) return null;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant={pDiff > 0 ? 'default' : 'destructive'}>
                      {cInd.name}
                    </Badge>
                    <span>
                      P点が{pDiff > 0 ? '+' : ''}{pDiff}変動（{num(pInd.P)} → {num(cInd.P)}）
                    </span>
                    {Math.abs(num(cInd.X1) - num(pInd.X1)) > 20 && (
                      <span className="text-xs text-muted-foreground">
                        ← X1変動（完工高変動）が主因
                      </span>
                    )}
                    {Math.abs(num(cInd.Z) - num(pInd.Z)) > 20 && (
                      <span className="text-xs text-muted-foreground">
                        ← Z変動（技術力変動）が主因
                      </span>
                    )}
                  </div>
                );
              })}
              {(() => {
                const yDiff = num(curr.Y) - num(prev.Y);
                if (Math.abs(yDiff) >= 10) {
                  return (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={yDiff > 0 ? 'default' : 'destructive'}>Y点</Badge>
                      <span>Y点が{yDiff > 0 ? '+' : ''}{yDiff}変動 → 全業種のP点に影響</span>
                    </div>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
