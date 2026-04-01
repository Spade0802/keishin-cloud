'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { KeishinBS } from '@/lib/engine/types';

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

export function KeishinBSTable({ bs }: { bs: KeishinBS }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">経審用貸借対照表（様式第十五号）</CardTitle>
        <p className="text-xs text-muted-foreground">単位：千円</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assets side */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 text-xs">
                  <th className="py-1 text-left px-2">【資産の部】</th>
                  <th className="py-1 text-right px-2">金額</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader title="流動資産" />
                <Row label="現金預金" value={bs.cashDeposits} indent={1} />
                <Row label="受取手形" value={bs.notesReceivable} indent={1} />
                <Row label="完成工事未収入金" value={bs.accountsReceivableConstruction} indent={1} />
                <Row label="有価証券" value={bs.securities} indent={1} />
                <Row label="未成工事支出金" value={bs.wipConstruction} indent={1} />
                <Row label="材料貯蔵品" value={bs.materialInventory} indent={1} />
                <Row label="短期貸付金" value={bs.shortTermLoans} indent={1} />
                <Row label="前払費用" value={bs.prepaidExpenses} indent={1} />
                <Row label="繰延税金資産(流動)" value={bs.deferredTaxAssetCurrent} indent={1} />
                <Row label="その他" value={bs.otherCurrent} indent={1} />
                <Row label="貸倒引当金" value={bs.allowanceDoubtful} indent={1} />
                <Row label="流動資産合計" value={bs.currentAssetsTotal} bold />

                <SectionHeader title="有形固定資産" />
                <Row label="建物・構築物" value={bs.buildingsStructures} indent={1} />
                <Row label="機械・運搬具" value={bs.machineryVehicles} indent={1} />
                <Row label="工具器具・備品" value={bs.toolsEquipment} indent={1} />
                <Row label="土地" value={bs.land} indent={1} />
                <Row label="有形固定資産合計" value={bs.tangibleFixedTotal} bold />

                <SectionHeader title="無形固定資産" />
                <Row label="特許権" value={bs.patent} indent={1} />
                <Row label="その他" value={bs.otherIntangible} indent={1} />
                <Row label="無形固定資産合計" value={bs.intangibleFixedTotal} bold />

                <SectionHeader title="投資その他の資産" />
                <Row label="関係会社株式" value={bs.relatedCompanyShares} indent={1} />
                <Row label="長期貸付金" value={bs.longTermLoans} indent={1} />
                <Row label="保険積立金" value={bs.insuranceReserve} indent={1} />
                <Row label="長期前払費用" value={bs.longTermPrepaid} indent={1} />
                <Row label="繰延税金資産(固定)" value={bs.deferredTaxAssetFixed} indent={1} />
                <Row label="その他" value={bs.otherInvestments} indent={1} />
                <Row label="投資その他合計" value={bs.investmentsTotal} bold />

                <Row label="固定資産合計" value={bs.fixedAssetsTotal} bold />
                <Row label="繰延資産合計" value={bs.deferredAssetsTotal} bold />
                <tr className="border-t-2 font-bold bg-primary/5">
                  <td className="py-2 text-sm px-2">資産合計</td>
                  <td className="py-2 text-right text-sm font-mono px-2">{fmt(bs.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Liabilities + Equity side */}
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 text-xs">
                  <th className="py-1 text-left px-2">【負債・純資産の部】</th>
                  <th className="py-1 text-right px-2">金額</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader title="流動負債" />
                <Row label="支払手形" value={bs.notesPayable} indent={1} />
                <Row label="工事未払金" value={bs.constructionPayable} indent={1} />
                <Row label="短期借入金" value={bs.shortTermBorrowing} indent={1} />
                <Row label="リース債務" value={bs.leaseDebt} indent={1} />
                <Row label="未払金" value={bs.accountsPayable} indent={1} />
                <Row label="未払費用" value={bs.unpaidExpenses} indent={1} />
                <Row label="未払法人税等" value={bs.unpaidCorporateTax} indent={1} />
                <Row label="繰延税金負債" value={bs.deferredTaxLiability} indent={1} />
                <Row label="未成工事受入金" value={bs.advanceReceivedConstruction} indent={1} />
                <Row label="預り金" value={bs.depositsReceived} indent={1} />
                <Row label="前受収益" value={bs.advanceRevenue} indent={1} />
                <Row label="引当金" value={bs.provisions} indent={1} />
                <Row label="未払消費税等" value={bs.unpaidConsumptionTax} indent={1} />
                <Row label="流動負債合計" value={bs.currentLiabilitiesTotal} bold />

                <SectionHeader title="固定負債" />
                <Row label="長期借入金" value={bs.longTermBorrowing} indent={1} />
                <Row label="固定負債合計" value={bs.fixedLiabilitiesTotal} bold />
                <Row label="負債合計" value={bs.totalLiabilities} bold />

                <SectionHeader title="純資産の部" />
                <Row label="資本金" value={bs.capitalStock} indent={1} />
                <Row label="利益準備金" value={bs.legalReserve} indent={1} />
                <Row label="その他利益剰余金" value={bs.otherRetainedEarnings} indent={1} />
                <Row label="別途積立金" value={bs.specialReserve} indent={2} />
                <Row label="繰越利益剰余金" value={bs.retainedEarningsCF} indent={2} />
                <Row label="利益剰余金合計" value={bs.retainedEarningsTotal} bold />
                <Row label="自己株式" value={bs.treasuryStock} indent={1} />
                <Row label="株主資本合計" value={bs.shareholdersEquityTotal} bold />
                <Row label="有価証券評価差額金" value={bs.securitiesValuation} indent={1} />
                <Row label="評価差額等合計" value={bs.evaluationTotal} bold />
                <Row label="純資産合計" value={bs.totalEquity} bold />
                <tr className="border-t-2 font-bold bg-primary/5">
                  <td className="py-2 text-sm px-2">負債・純資産合計</td>
                  <td className="py-2 text-right text-sm font-mono px-2">{fmt(bs.totalLiabilitiesEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
