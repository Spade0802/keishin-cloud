'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { KeishinPL } from '@/lib/engine/types';

function fmt(n: number): string {
  return n.toLocaleString();
}

function Row({ label, value, indent = 0, bold = false }: { label: string; value: number; indent?: number; bold?: boolean }) {
  return (
    <tr className={`border-b ${bold ? 'font-bold bg-muted/30' : ''}`}>
      <td className="py-1 text-sm" style={{ paddingLeft: `${indent * 16 + 8}px` }}>{label}</td>
      <td className="py-1 text-right text-sm font-mono">{fmt(value)}</td>
    </tr>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="border-b bg-muted/50">
      <td colSpan={2} className="py-1.5 text-xs font-bold text-muted-foreground px-2">{title}</td>
    </tr>
  );
}

export function KeishinPLTable({ pl }: { pl: KeishinPL }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">経審用損益計算書（様式第十六号）</CardTitle>
        <p className="text-xs text-muted-foreground">単位：千円</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* P/L main */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 text-xs">
                  <th className="py-1 text-left px-2">【損益計算書】</th>
                  <th className="py-1 text-right px-2">金額</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader title="売上高" />
                <Row label="完成工事高" value={pl.completedConstructionRevenue} indent={1} />
                <Row label="兼業事業売上高" value={pl.sideBusiness} indent={1} />
                <Row label="売上高合計" value={pl.totalSales} bold />

                <SectionHeader title="売上原価" />
                <Row label="完成工事原価" value={pl.completedConstructionCost} indent={1} />
                <Row label="兼業事業売上原価" value={pl.sideBusinessCost} indent={1} />
                <Row label="売上総利益" value={pl.grossProfit} bold />

                <SectionHeader title="販売費及び一般管理費" />
                <Row label="販管費合計" value={pl.sgaTotal} indent={1} />
                <Row label="営業利益" value={pl.operatingProfit} bold />

                <SectionHeader title="営業外収益" />
                <Row label="受取利息配当金" value={pl.interestDividendIncome} indent={1} />
                <Row label="その他" value={pl.otherNonOpIncome} indent={1} />
                <Row label="営業外収益合計" value={pl.nonOpIncomeTotal} bold />

                <SectionHeader title="営業外費用" />
                <Row label="支払利息" value={pl.interestExpense} indent={1} />
                <Row label="その他" value={pl.otherNonOpExpense} indent={1} />
                <Row label="営業外費用合計" value={pl.nonOpExpenseTotal} bold />

                <Row label="経常利益" value={pl.ordinaryProfit} bold />

                <SectionHeader title="特別損益" />
                <Row label="特別利益" value={pl.specialGain} indent={1} />
                <Row label="特別損失" value={pl.specialLoss} indent={1} />
                <Row label="税引前当期純利益" value={pl.preTaxProfit} bold />

                <SectionHeader title="法人税等" />
                <Row label="法人税、住民税及び事業税" value={pl.corporateTax} indent={1} />
                <Row label="法人税等調整額" value={pl.taxAdjustment} indent={1} />
                <tr className="border-t-2 font-bold bg-primary/5">
                  <td className="py-2 text-sm px-2">当期純利益</td>
                  <td className="py-2 text-right text-sm font-mono px-2">{fmt(pl.netIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cost Report */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 text-xs">
                  <th className="py-1 text-left px-2">【完成工事原価報告書】</th>
                  <th className="py-1 text-right px-2">金額</th>
                </tr>
              </thead>
              <tbody>
                <Row label="材料費" value={pl.costReport.materials} indent={1} />
                <Row label="労務費" value={pl.costReport.labor} indent={1} />
                <Row label="（うち労務外注費）" value={pl.costReport.laborSubcontract} indent={2} />
                <Row label="外注費" value={pl.costReport.subcontract} indent={1} />
                <Row label="経費" value={pl.costReport.expenses} indent={1} />
                <Row label="（うち人件費）" value={pl.costReport.personnelInExpenses} indent={2} />
                <tr className="border-t-2 font-bold bg-primary/5">
                  <td className="py-2 text-sm px-2">完成工事原価合計</td>
                  <td className="py-2 text-right text-sm font-mono px-2">{fmt(pl.costReport.totalCost)}</td>
                </tr>

                <tr><td colSpan={2} className="py-4" /></tr>

                <SectionHeader title="減価償却実施額" />
                <Row label="減価償却実施額" value={pl.depreciation} indent={1} />
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
