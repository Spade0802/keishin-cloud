'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ParsedRawBS, ParsedRawPL } from '@/components/file-upload';

function fmt(n: number): string {
  return n.toLocaleString();
}

function BSSection({
  title,
  items,
  total,
  totalLabel,
}: {
  title: string;
  items: Record<string, number>;
  total?: number;
  totalLabel?: string;
}) {
  const entries = Object.entries(items).filter(([, v]) => v !== 0);
  if (entries.length === 0 && !total) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-semibold text-muted-foreground border-b pb-0.5">
        {title}
      </div>
      {entries.map(([name, value]) => (
        <div key={name} className="flex justify-between text-xs py-0.5">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-mono tabular-nums">{fmt(value)}</span>
        </div>
      ))}
      {total !== undefined && (
        <div className="flex justify-between text-xs font-bold border-t pt-0.5">
          <span>{totalLabel || '合計'}</span>
          <span className="font-mono tabular-nums">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}

interface FinancialPreviewProps {
  bs?: ParsedRawBS;
  pl?: ParsedRawPL;
}

export function FinancialPreview({ bs, pl }: FinancialPreviewProps) {
  if (!bs && !pl) return null;

  return (
    <div className="space-y-4">
      {bs && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">貸借対照表（自動生成・千円）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 資産の部 */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-primary">【資産の部】</div>
                <BSSection
                  title="流動資産"
                  items={bs.currentAssets}
                  total={bs.totals.currentAssets}
                  totalLabel="流動資産合計"
                />
                <BSSection
                  title="有形固定資産"
                  items={bs.tangibleFixed}
                  total={bs.totals.tangibleFixed}
                  totalLabel="有形固定資産合計"
                />
                <BSSection
                  title="無形固定資産"
                  items={bs.intangibleFixed}
                  total={bs.totals.intangibleFixed}
                  totalLabel="無形固定資産合計"
                />
                <BSSection
                  title="投資その他の資産"
                  items={bs.investments}
                  total={bs.totals.investments}
                  totalLabel="投資その他合計"
                />
                {bs.totals.fixedAssets !== undefined && (
                  <div className="flex justify-between text-xs font-bold border-t-2 pt-1">
                    <span>固定資産合計</span>
                    <span className="font-mono tabular-nums">{fmt(bs.totals.fixedAssets)}</span>
                  </div>
                )}
                {bs.totals.totalAssets !== undefined && (
                  <div className="flex justify-between text-sm font-bold bg-muted/50 rounded px-2 py-1">
                    <span>資産合計</span>
                    <span className="font-mono tabular-nums">{fmt(bs.totals.totalAssets)}</span>
                  </div>
                )}
              </div>

              {/* 負債・純資産の部 */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-primary">【負債・純資産の部】</div>
                <BSSection
                  title="流動負債"
                  items={bs.currentLiabilities}
                  total={bs.totals.currentLiabilities}
                  totalLabel="流動負債合計"
                />
                <BSSection
                  title="固定負債"
                  items={bs.fixedLiabilities}
                  total={bs.totals.fixedLiabilities}
                  totalLabel="固定負債合計"
                />
                {bs.totals.totalLiabilities !== undefined && (
                  <div className="flex justify-between text-xs font-bold border-t-2 pt-1">
                    <span>負債合計</span>
                    <span className="font-mono tabular-nums">{fmt(bs.totals.totalLiabilities)}</span>
                  </div>
                )}
                <BSSection
                  title="純資産"
                  items={bs.equity}
                  total={bs.totals.totalEquity}
                  totalLabel="純資産合計"
                />
                {bs.totals.totalAssets !== undefined && (
                  <div className="flex justify-between text-sm font-bold bg-muted/50 rounded px-2 py-1">
                    <span>負債・純資産合計</span>
                    <span className="font-mono tabular-nums">
                      {fmt((bs.totals.totalLiabilities || 0) + (bs.totals.totalEquity || 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">損益計算書（自動生成・千円）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-w-md">
              <PLRow label="完成工事高" value={pl.completedConstruction} />
              {pl.totalSales !== pl.completedConstruction && (
                <PLRow label="売上高合計" value={pl.totalSales} />
              )}
              <PLRow label="売上原価" value={pl.costOfSales} />
              <PLRow label="売上総利益" value={pl.grossProfit} bold />
              <PLRow label="販管費合計" value={pl.sgaTotal} />
              <PLRow label="営業利益" value={pl.operatingProfit} bold />
              <PLRow label="受取利息" value={pl.interestIncome} sub />
              <PLRow label="受取配当金" value={pl.dividendIncome} sub />
              <PLRow label="支払利息" value={pl.interestExpense} sub />
              <PLRow label="経常利益" value={pl.ordinaryProfit} bold />
              {(pl.specialGain !== 0 || pl.specialLoss !== 0) && (
                <>
                  <PLRow label="特別利益" value={pl.specialGain} sub />
                  <PLRow label="特別損失" value={pl.specialLoss} sub />
                </>
              )}
              <PLRow label="税引前利益" value={pl.preTaxProfit} />
              <PLRow label="法人税等" value={pl.corporateTax} />
              <PLRow label="当期純利益" value={pl.netIncome} bold />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PLRow({
  label,
  value,
  bold,
  sub,
}: {
  label: string;
  value: number;
  bold?: boolean;
  sub?: boolean;
}) {
  if (value === 0 && sub) return null;
  return (
    <div
      className={`flex justify-between text-xs py-0.5 ${
        bold ? 'font-bold border-t pt-1' : ''
      } ${sub ? 'pl-4 text-muted-foreground' : ''}`}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{fmt(value)}</span>
    </div>
  );
}
