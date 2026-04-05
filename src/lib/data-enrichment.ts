/**
 * 抽出データ補完（Data Enrichment）
 *
 * Gemini等で抽出した生データから、計算で導出可能な空白フィールドを
 * 自動補完する。抽出精度を間接的に向上させる。
 *
 * ルール:
 * - 既に値がある項目は上書きしない（抽出値を尊重）
 * - 合計と内訳の整合性をチェックし、不足分を推定する
 * - 補完した項目はwarningとして返す
 */

import type { RawFinancialData } from './engine/types';

/** 補完結果 */
export interface EnrichmentResult {
  data: Partial<RawFinancialData>;
  enrichedFields: string[];
  warnings: string[];
}

/**
 * 決算書データの空白項目を計算値で補完する
 */
export function enrichFinancialData(
  data: Partial<RawFinancialData>,
): EnrichmentResult {
  const enrichedFields: string[] = [];
  const warnings: string[] = [];

  // Deep clone to avoid mutation
  const d = JSON.parse(JSON.stringify(data)) as Partial<RawFinancialData>;

  // ─── BS 合計の補完 ───
  if (d.bs) {
    const t = d.bs.totals ?? {
      currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
      investments: 0, fixedAssets: 0, totalAssets: 0,
      currentLiabilities: 0, fixedLiabilities: 0,
      totalLiabilities: 0, totalEquity: 0,
    };

    // 各セクションの内訳合計を計算
    const calcSectionSum = (section: Record<string, number> | undefined): number => {
      if (!section || typeof section !== 'object') return 0;
      return Object.values(section).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    };

    // currentAssets: 内訳の合計 vs totals
    const calcCA = calcSectionSum(d.bs.currentAssets);
    if (!t.currentAssets && calcCA > 0) {
      t.currentAssets = calcCA;
      enrichedFields.push('bs.totals.currentAssets');
    }

    // tangibleFixed
    const calcTF = calcSectionSum(d.bs.tangibleFixed);
    if (!t.tangibleFixed && calcTF > 0) {
      t.tangibleFixed = calcTF;
      enrichedFields.push('bs.totals.tangibleFixed');
    }

    // intangibleFixed
    const calcIF = calcSectionSum(d.bs.intangibleFixed);
    if (!t.intangibleFixed && calcIF > 0) {
      t.intangibleFixed = calcIF;
      enrichedFields.push('bs.totals.intangibleFixed');
    }

    // investments
    const calcInv = calcSectionSum(d.bs.investments);
    if (!t.investments && calcInv > 0) {
      t.investments = calcInv;
      enrichedFields.push('bs.totals.investments');
    }

    // fixedAssets = tangibleFixed + intangibleFixed + investments
    const calcFA = (t.tangibleFixed || 0) + (t.intangibleFixed || 0) + (t.investments || 0);
    if (!t.fixedAssets && calcFA > 0) {
      t.fixedAssets = calcFA;
      enrichedFields.push('bs.totals.fixedAssets');
    }

    // totalAssets = currentAssets + fixedAssets
    const calcTA = (t.currentAssets || 0) + (t.fixedAssets || 0);
    if (!t.totalAssets && calcTA > 0) {
      t.totalAssets = calcTA;
      enrichedFields.push('bs.totals.totalAssets');
    }

    // currentLiabilities
    const calcCL = calcSectionSum(d.bs.currentLiabilities);
    if (!t.currentLiabilities && calcCL > 0) {
      t.currentLiabilities = calcCL;
      enrichedFields.push('bs.totals.currentLiabilities');
    }

    // fixedLiabilities
    const calcFL = calcSectionSum(d.bs.fixedLiabilities);
    if (!t.fixedLiabilities && calcFL > 0) {
      t.fixedLiabilities = calcFL;
      enrichedFields.push('bs.totals.fixedLiabilities');
    }

    // totalLiabilities = currentLiabilities + fixedLiabilities
    const calcTL = (t.currentLiabilities || 0) + (t.fixedLiabilities || 0);
    if (!t.totalLiabilities && calcTL > 0) {
      t.totalLiabilities = calcTL;
      enrichedFields.push('bs.totals.totalLiabilities');
    }

    // totalEquity: 内訳合計
    const calcEq = calcSectionSum(d.bs.equity);
    if (!t.totalEquity && calcEq > 0) {
      t.totalEquity = calcEq;
      enrichedFields.push('bs.totals.totalEquity');
    }

    // BS均衡チェック: totalAssets = totalLiabilities + totalEquity
    if (t.totalAssets && t.totalLiabilities && t.totalEquity) {
      const diff = Math.abs(t.totalAssets - (t.totalLiabilities + t.totalEquity));
      if (diff > t.totalAssets * 0.01 && diff > 1) {
        warnings.push(
          `BS均衡不一致: 資産${t.totalAssets} ≠ 負債${t.totalLiabilities} + 純資産${t.totalEquity} (差額: ${diff}千円)`
        );
      }
    }

    // totalAssets が不明だが負債+純資産が分かる場合
    if (!t.totalAssets && t.totalLiabilities && t.totalEquity) {
      t.totalAssets = t.totalLiabilities + t.totalEquity;
      enrichedFields.push('bs.totals.totalAssets (from L+E)');
    }

    // totalEquity が不明だが資産-負債で求まる場合
    if (!t.totalEquity && t.totalAssets && t.totalLiabilities) {
      t.totalEquity = t.totalAssets - t.totalLiabilities;
      enrichedFields.push('bs.totals.totalEquity (from A-L)');
    }

    d.bs.totals = t;
  }

  // ─── PL の補完 ───
  if (d.pl) {
    const pl = d.pl;

    // totalSales = completedConstruction + progressConstruction
    if (!pl.totalSales && (pl.completedConstruction || pl.progressConstruction)) {
      pl.totalSales = (pl.completedConstruction || 0) + (pl.progressConstruction || 0);
      enrichedFields.push('pl.totalSales');
    }

    // grossProfit = totalSales - costOfSales
    if (!pl.grossProfit && pl.totalSales && pl.costOfSales) {
      pl.grossProfit = pl.totalSales - pl.costOfSales;
      enrichedFields.push('pl.grossProfit');
    }

    // sgaTotal: 販管費内訳の合計
    if (!pl.sgaTotal && pl.sgaItems && typeof pl.sgaItems === 'object') {
      const sgaSum = Object.values(pl.sgaItems).reduce(
        (sum, v) => sum + (typeof v === 'number' ? v : 0), 0
      );
      if (sgaSum > 0) {
        pl.sgaTotal = sgaSum;
        enrichedFields.push('pl.sgaTotal');
      }
    }

    // operatingProfit = grossProfit - sgaTotal
    if (!pl.operatingProfit && pl.grossProfit !== undefined && pl.sgaTotal) {
      pl.operatingProfit = pl.grossProfit - pl.sgaTotal;
      enrichedFields.push('pl.operatingProfit');
    }

    // ordinaryProfit = operatingProfit + 営業外収益 - 営業外費用
    if (!pl.ordinaryProfit && pl.operatingProfit !== undefined) {
      const nonOpIncome = (pl.interestIncome || 0) + (pl.dividendIncome || 0) + (pl.miscIncome || 0);
      const nonOpExpense = (pl.interestExpense || 0) + (pl.miscExpense || 0);
      if (nonOpIncome > 0 || nonOpExpense > 0) {
        pl.ordinaryProfit = pl.operatingProfit + nonOpIncome - nonOpExpense;
        enrichedFields.push('pl.ordinaryProfit');
      }
    }

    // preTaxProfit = ordinaryProfit + specialGain - specialLoss
    if (!pl.preTaxProfit && pl.ordinaryProfit !== undefined) {
      pl.preTaxProfit = pl.ordinaryProfit + (pl.specialGain || 0) - (pl.specialLoss || 0);
      enrichedFields.push('pl.preTaxProfit');
    }

    // netIncome = preTaxProfit - corporateTax
    if (!pl.netIncome && pl.preTaxProfit !== undefined && pl.corporateTax !== undefined) {
      pl.netIncome = pl.preTaxProfit - pl.corporateTax;
      enrichedFields.push('pl.netIncome');
    }

    // 逆方向: completedConstruction が不明だが totalSales - progressConstruction で求まる
    if (!pl.completedConstruction && pl.totalSales && pl.progressConstruction !== undefined) {
      pl.completedConstruction = pl.totalSales - (pl.progressConstruction || 0);
      enrichedFields.push('pl.completedConstruction');
    }

    // costOfSales が不明だが totalSales - grossProfit で求まる
    if (!pl.costOfSales && pl.totalSales && pl.grossProfit !== undefined) {
      pl.costOfSales = pl.totalSales - pl.grossProfit;
      enrichedFields.push('pl.costOfSales');
    }
  }

  // ─── 製造原価の補完 ───
  if (d.manufacturing) {
    const mfg = d.manufacturing;

    // totalCost = materials + labor + subcontract + expenses (+ wipBeginning - wipEnding)
    if (!mfg.totalCost) {
      const direct = (mfg.materials || 0) + (mfg.labor || 0) +
                     (mfg.subcontract || 0) + (mfg.expenses || 0);
      if (direct > 0) {
        const wip = (mfg.wipBeginning || 0) - (mfg.wipEnding || 0);
        mfg.totalCost = direct + wip;
        enrichedFields.push('manufacturing.totalCost');
      }
    }

    // totalCost は costOfSales と一致するはず（兼業がなければ）
    if (d.pl && mfg.totalCost && d.pl.costOfSales) {
      const diff = Math.abs(mfg.totalCost - d.pl.costOfSales);
      if (diff > d.pl.costOfSales * 0.05 && diff > 100) {
        warnings.push(
          `原価報告書合計(${mfg.totalCost}) と 完成工事原価(${d.pl.costOfSales}) に差異があります (${diff}千円)。兼業売上の有無を確認してください。`
        );
      }
    }
  }

  // ─── クロスチェック: PLとBSの整合性 ───
  if (d.pl && d.bs?.equity) {
    // 当期純利益がequityの繰越利益剰余金と整合するかは期首データが必要なので
    // ここではチェックしない（前期データがないため）
  }

  if (enrichedFields.length > 0) {
    console.log(`[enrichFinancialData] Enriched ${enrichedFields.length} fields:`, enrichedFields);
  }

  return { data: d, enrichedFields, warnings };
}

/**
 * 経審提出用データの補完
 * - 完工高の合計チェック
 * - 元請率の計算
 * - 技術職員数値の妥当性チェック
 */
export function enrichKeishinData(data: {
  equity?: number;
  ebitda?: number;
  industries?: Array<{
    name: string;
    code: string;
    prevCompletion: number;
    currCompletion: number;
    prevPrimeContract: number;
    currPrimeContract: number;
    techStaffValue?: number;
  }>;
  businessYears?: number;
}): { warnings: string[] } {
  const warnings: string[] = [];

  if (data.industries) {
    for (const ind of data.industries) {
      // 元請完工高 > 完工高はありえない
      if (ind.currPrimeContract > ind.currCompletion && ind.currCompletion > 0) {
        warnings.push(
          `${ind.name}: 当期元請完工高(${ind.currPrimeContract}) > 当期完工高(${ind.currCompletion})。読み取りミスの可能性があります。`
        );
      }
      if (ind.prevPrimeContract > ind.prevCompletion && ind.prevCompletion > 0) {
        warnings.push(
          `${ind.name}: 前期元請完工高(${ind.prevPrimeContract}) > 前期完工高(${ind.prevCompletion})。読み取りミスの可能性があります。`
        );
      }
    }
  }

  // 営業年数チェック
  if (data.businessYears && (data.businessYears < 1 || data.businessYears > 150)) {
    warnings.push(`営業年数(${data.businessYears})が異常値です。確認してください。`);
  }

  // 営業年数が1桁の場合、OCR桁落ちの可能性を警告
  if (data.businessYears && data.businessYears >= 1 && data.businessYears <= 9) {
    const hasSignificantRevenue = data.industries?.some(
      (ind) => ind.currCompletion > 100_000 || ind.prevCompletion > 100_000,
    );
    if (hasSignificantRevenue) {
      warnings.push(
        `営業年数(${data.businessYears})が1桁です。完工高の規模に対して短すぎる可能性があります。OCRの桁落ち（例: 57→5）がないか確認してください。`,
      );
    }
  }

  return { warnings };
}
