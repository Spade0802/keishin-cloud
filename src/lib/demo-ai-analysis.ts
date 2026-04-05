/**
 * デモ用のAI分析結果（静的データ）
 *
 * Gemini を呼ばずにデモページで表示するための事前生成データ。
 * 株式会社 〇×建設 第45期のデータに基づく。
 */
import type { AnalysisResult } from './ai-analysis-types';

export const demoAnalysisResult: AnalysisResult = {
  summary:
    '株式会社〇×建設は完工高28.5億円規模の中堅建設業者であり、Y点・W点に改善余地があります。' +
    '特に資本性借入金の認定、減価償却費の網羅的な配賦、CCUS実績の蓄積により' +
    'P点の5〜15点の上昇が見込まれます。一方、雑収入の完成工事高振替には慎重な検討が必要です。',

  disclaimer:
    '本レポートはAI（Gemini）による自動分析であり、専門家の助言ではありません。' +
    '経営事項審査の正式な申請にあたっては、必ず行政書士・公認会計士等の専門家にご相談ください。' +
    '虚偽記載・粉飾決算は建設業法違反であり、許可取消し等の厳しい処分の対象となります。',

  reclassificationReview: [
    {
      no: 1,
      item: '雑収入の完成工事高振替',
      currentTreatment: '兼業売上65,000千円を営業外収益で計上',
      alternativePlan: '建設業に付随する売上（重機リース等）を完成工事高に振替',
      legality: '建設業法施行規則に基づき、建設工事に直接関連する収入は完成工事高に計上可能。ただし実態が伴う必要あり',
      requiredDocuments: '契約書、請求書、工事台帳との紐付け資料',
      yImpact: '+3〜8',
      xImpact: 'X1に影響（完工高連動）',
      zImpact: '—',
      wImpact: '—',
      pImpact: '+2〜5',
      assessment: '要確認',
      risk: '税務調査で否認リスクあり。実態のない振替は粉飾に該当する可能性',
    },
    {
      no: 2,
      item: '資本性借入金の認定',
      currentTreatment: '長期借入金185,000千円を負債として計上',
      alternativePlan: '要件を満たす借入金を資本性借入金として認定申請',
      legality: '経審における資本性借入金の取扱い（国交省通知）に準拠。劣後ローン等で5年超の契約が対象',
      requiredDocuments: '金銭消費貸借契約書、銀行確認書、劣後特約の証憑',
      yImpact: '+5〜12',
      xImpact: 'X21に影響（自己資本増加）',
      zImpact: '—',
      wImpact: '—',
      pImpact: '+5〜8',
      assessment: '採用余地あり',
      risk: '契約条件の要件充足を慎重に確認する必要あり',
    },
    {
      no: 3,
      item: '支払利息から手形割引料の分離',
      currentTreatment: '支払利息8,200千円に手形割引料が含まれている可能性',
      alternativePlan: '手形割引料を営業外費用の別科目に分離',
      legality: '会計基準上適正。Y点のx2指標（負債回転期間）の改善に寄与',
      requiredDocuments: '銀行取引明細、手形割引料の内訳資料',
      yImpact: '+1〜3',
      xImpact: '—',
      zImpact: '—',
      wImpact: '—',
      pImpact: '+0〜1',
      assessment: '採用余地あり',
      risk: '軽微。会計処理として適正であれば問題なし',
    },
    {
      no: 4,
      item: '減価償却費の網羅性確認',
      currentTreatment: '減価償却実施額18,500千円（製造原価配賦含む）',
      alternativePlan: 'SGA内の償却費を含め全額を経審用に計上。リース資産の償却確認',
      legality: '建設業経理基準に基づく適正な配賦。網羅的に計上することで営業CFが改善',
      requiredDocuments: '固定資産台帳、リース契約書、減価償却明細',
      yImpact: '+2〜5',
      xImpact: '—',
      zImpact: '—',
      wImpact: '—',
      pImpact: '+1〜2',
      assessment: '採用余地あり',
      risk: '低い。正確な金額を固定資産台帳から確認すれば問題なし',
    },
    {
      no: 5,
      item: 'CPD単位の追加取得',
      currentTreatment: 'CPD合計580単位（技術職員48名）',
      alternativePlan: '技術職員のCPD受講を促進し、1人あたり平均を引き上げ',
      legality: '適法。各技術者団体のCPD制度に基づく正規の単位取得',
      requiredDocuments: 'CPD証明書、受講履歴',
      yImpact: '—',
      xImpact: '—',
      zImpact: '—',
      wImpact: '+1〜3',
      pImpact: '+0〜1',
      assessment: '採用余地あり',
      risk: 'なし。正規の取得であればリスクなし',
    },
    {
      no: 6,
      item: 'CCUS就業履歴の蓄積',
      currentTreatment: 'CCUS実施=1（導入済み）',
      alternativePlan: '就業履歴蓄積の実績を増やし、w5加点を最大化',
      legality: '建設キャリアアップシステム運用ガイドラインに準拠',
      requiredDocuments: 'CCUS利用実績レポート、現場登録実績',
      yImpact: '—',
      xImpact: '—',
      zImpact: '—',
      wImpact: '+2〜5',
      pImpact: '+0〜1',
      assessment: '採用余地あり',
      risk: 'なし。実績の積み上げに時間を要する',
    },
    {
      no: 7,
      item: 'ISO14001の取得',
      currentTreatment: 'ISO9001取得済み、ISO14001未取得',
      alternativePlan: 'ISO14001を新規取得しW点のw8加点を得る',
      legality: '適法。認証機関による正規の審査・認証が必要',
      requiredDocuments: 'ISO14001認証書',
      yImpact: '—',
      xImpact: '—',
      zImpact: '—',
      wImpact: '+3〜5',
      pImpact: '+1〜2',
      assessment: '採用余地あり',
      risk: '低い。取得・維持コストとのバランスを検討',
    },
    {
      no: 8,
      item: '法定外労災の加入',
      currentTreatment: '未加入',
      alternativePlan: '法定外労働災害補償制度に加入しw1加点を得る',
      legality: '適法。任意保険への加入',
      requiredDocuments: '保険証券、加入証明書',
      yImpact: '—',
      xImpact: '—',
      zImpact: '—',
      wImpact: '+2〜3',
      pImpact: '+0〜1',
      assessment: '採用余地あり',
      risk: 'なし。保険料負担のみ',
    },
  ],

  simulationComparison: [
    {
      label: 'Case A',
      description: '現状ベース（入力データそのまま）',
      assumptions: {
        '会計処理': '変更なし',
        '社会性項目': '現状維持',
        '技術力': '現状維持',
      },
      scores: {
        y: 798,
        x2: 718,
        z: { '土木一式': 783, '建築一式': 752, '電気': 658, '管': 620 },
        w: 849,
        p: { '土木一式': 845, '建築一式': 792, '電気': 668, '管': 630 },
      },
    },
    {
      label: 'Case B',
      description: '最適化ケース（全見直しを適用）',
      assumptions: {
        '資本性借入金': '50,000千円を認定',
        '減価償却': '全額網羅（+3,200千円）',
        '手形割引料': '分離（1,500千円）',
        'ISO14001': '取得',
        '法定外労災': '加入',
        'CCUS': '実績蓄積強化',
      },
      scores: {
        y: 812,
        x2: 732,
        z: { '土木一式': 783, '建築一式': 752, '電気': 658, '管': 620 },
        w: 878,
        p: { '土木一式': 860, '建築一式': 807, '電気': 682, '管': 644 },
      },
    },
    {
      label: 'Case C',
      description: '保守的ケース（確実に適用できるもののみ）',
      assumptions: {
        '減価償却': '網羅確認のみ（+1,800千円）',
        '手形割引料': '分離（1,500千円）',
        'CCUS': '実績蓄積',
      },
      scores: {
        y: 803,
        x2: 718,
        z: { '土木一式': 783, '建築一式': 752, '電気': 658, '管': 620 },
        w: 858,
        p: { '土木一式': 851, '建築一式': 798, '電気': 673, '管': 635 },
      },
    },
  ],

  itemAssessments: [
    {
      category: 'confirmed',
      item: '3保険の加入状況',
      currentPImpact: '減点なし',
      revisedPImpact: '—',
      action: '現状のまま確定。3保険とも加入済み',
    },
    {
      category: 'confirmed',
      item: '建退共の加入',
      currentPImpact: 'w1加点済み',
      revisedPImpact: '—',
      action: '現状のまま確定',
    },
    {
      category: 'confirmed',
      item: '退職一時金制度',
      currentPImpact: 'w1加点済み',
      revisedPImpact: '—',
      action: '現状のまま確定',
    },
    {
      category: 'confirmed',
      item: '防災協定の締結',
      currentPImpact: 'w6加点済み',
      revisedPImpact: '—',
      action: '現状のまま確定',
    },
    {
      category: 'confirmed',
      item: 'ISO9001認証',
      currentPImpact: 'w8加点済み',
      revisedPImpact: '—',
      action: '現状のまま確定',
    },
    {
      category: 'reviewable',
      item: '資本性借入金の認定',
      currentPImpact: '未適用',
      revisedPImpact: 'P +5〜8',
      action: '借入契約を精査し、要件を満たすものがないか確認',
    },
    {
      category: 'reviewable',
      item: '減価償却費の網羅性',
      currentPImpact: '一部未計上の可能性',
      revisedPImpact: 'P +1〜2',
      action: '固定資産台帳と突合し、SGA・リース資産の償却を確認',
    },
    {
      category: 'reviewable',
      item: 'ISO14001の新規取得',
      currentPImpact: '未取得',
      revisedPImpact: 'P +1〜2',
      action: '取得コストとW点加点効果を比較検討',
    },
    {
      category: 'reviewable',
      item: '法定外労災の加入',
      currentPImpact: '未加入',
      revisedPImpact: 'P +0〜1',
      action: '保険料と加点効果を比較検討',
    },
    {
      category: 'insufficientBasis',
      item: '雑収入の完成工事高振替',
      currentPImpact: '未適用',
      revisedPImpact: 'P +2〜5（不確実）',
      action: '兼業売上の内容を精査。建設工事に直接関連する部分のみ振替可能',
    },
    {
      category: 'shouldNotDo',
      item: '架空の完成工事高計上',
      currentPImpact: '—',
      revisedPImpact: '—',
      action: '粉飾決算に該当。建設業法違反で許可取消しリスク',
    },
  ],

  riskPoints: [
    {
      topic: '兼業売上比率の高さ',
      riskContent:
        '兼業売上65,000千円（総売上の2.2%）。振替を行う場合、建設工事との関連性の立証が必要',
      severity: '中',
      response:
        '契約内容を精査し、建設工事に直接関連する部分のみ振替。不明確なものは現状維持',
    },
    {
      topic: '自己資本比率',
      riskContent:
        '自己資本比率55.6%で健全だが、有価証券評価差額金-142,000千円が含まれる。時価変動リスクあり',
      severity: '中',
      response:
        '有価証券の保有方針を見直し、評価差額のボラティリティを管理',
    },
    {
      topic: '支払利息の水準',
      riskContent:
        '支払利息8,200千円は借入金規模に対して適正範囲だが、手形割引料の混入がないか確認が必要',
      severity: '低',
      response: '銀行取引明細で手形割引料を特定し、分離計上',
    },
    {
      topic: '特別損失の内容',
      riskContent:
        '特別損失8,200千円の内容が不明。経常的な費用が特別損失に計上されていないか確認',
      severity: '中',
      response: '特別損失の内訳を確認し、経常費用との区分の妥当性を検証',
    },
    {
      topic: '技術職員の高齢化リスク',
      riskContent:
        '技術職員48名中、若手技術者12名（25%）。中長期的にZ点への影響が懸念される',
      severity: '低',
      response:
        '若手技術者の採用・資格取得支援を継続。CPD・CCUS実績の蓄積も並行して推進',
    },
  ],

  impactRanking: [
    { rank: 1, item: '資本性借入金の認定', pImpact: 'P +5〜8', comment: '要確認（契約要件の充足が前提）' },
    { rank: 2, item: '雑収入の工事関連部分振替', pImpact: 'P +3〜4', comment: '採用余地あり（証憑次第）' },
    { rank: 3, item: 'CCUS就業履歴蓄積の確認', pImpact: 'P +0〜5', comment: '要確認（実績があれば即効性あり）' },
    { rank: 4, item: 'CPD単位取得の確認', pImpact: 'P +0〜3', comment: '要確認（取得実績があれば）' },
    { rank: 5, item: '減価償却実施額の網羅性確認', pImpact: 'P +0〜1', comment: '要確認（固定資産台帳が必要）' },
  ],

  checklistItems: [
    { item: '雑収入の内訳と工事関連性の確認（契約書・精算書）', target: '経理' },
    { item: '長期借入金の契約条件（資本性借入金該当可否）', target: '税理士' },
    { item: '支払利息割引料の内訳（手形割引料の有無）', target: '経理' },
    { item: '減価償却実施額の注記ベース確認（固定資産台帳）', target: '税理士' },
    { item: 'CPD取得実績の有無（各技術者の証明書）', target: '行政書士' },
    { item: 'CCUS現場利用の実績有無（事業者ID・利用データ）', target: '行政書士' },
    { item: 'ISO登録証の有効期限確認', target: '行政書士' },
  ],
};
