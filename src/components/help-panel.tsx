'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HELP_CONTENT: Record<number, { title: string; sections: { heading: string; body: string }[] }> = {
  1: {
    title: 'Step 1: 決算書アップロード',
    sections: [
      {
        heading: '経審の概要',
        body: '経営事項審査（経審）は、公共工事の入札に参加する建設業者が受ける審査です。経営状況・経営規模・技術力・社会性を総合的に評価し、総合評定値（P点）を算出します。',
      },
      {
        heading: '必要書類の説明',
        body: '決算書（BS/PL）のExcelまたはPDFをアップロードしてください。手動入力も可能です。前期の決算書があれば、前期データの自動入力にも対応しています。',
      },
      {
        heading: 'ファイル形式',
        body: 'Excel（.xlsx）またはPDF（.pdf）に対応しています。経審申請書のPDFをアップロードすると、AI-OCRで数値を自動抽出します。',
      },
    ],
  },
  2: {
    title: 'Step 2: 提出書データ',
    sections: [
      {
        heading: 'PDF抽出の仕組み',
        body: 'アップロードされたPDFからAI-OCRを使って会社名・許可番号・業種別完工高などを自動抽出します。抽出結果は必ず確認・修正してください。',
      },
      {
        heading: '手動入力の方法',
        body: '会社名、許可番号、審査基準日を入力し、業種ごとに完工高・元請完工高を入力します。業種は29種類から選択できます。',
      },
      {
        heading: '業種の選び方',
        body: '建設業許可を受けている業種のうち、経審を受けたい業種を選択してください。複数業種の同時申請が可能です。',
      },
    ],
  },
  3: {
    title: 'Step 3: 技術職員・社会性（W項目）',
    sections: [
      {
        heading: 'W項目の解説',
        body: 'W点は社会性等を評価する項目です。労働福祉・建設業経理・防災活動・法令遵守・建設機械保有・ISO認証などが対象です。',
      },
      {
        heading: '各項目の意味',
        body: '・雇用保険/健康保険/厚生年金: 加入していれば加点\n・建退共/退職一時金制度: 退職金制度の有無\n・法定外労災: 加入で加点\n・建設業経理士: 1級・2級の人数\n・ISO9001/14001: 認証取得で加点\n・若年技術者: 35歳未満の技術者割合で加点',
      },
      {
        heading: '技術職員の入力方法',
        body: '業種ごとに1級・2級技術者の人数を入力します。1級技術者は監理技術者として5点、2級は主任技術者として2点で評価されます。',
      },
    ],
  },
  4: {
    title: 'Step 4: 前期データ確認',
    sections: [
      {
        heading: '前期データの役割',
        body: '一部の評点（X2: 経営状況分析）では、前期と当期の2期分のデータを使って評価します。前期データが正確であることを確認してください。',
      },
      {
        heading: '確認ポイント',
        body: '・総資本（前期）\n・営業キャッシュフロー（前期）\n・貸倒引当金（前期）\n・受取手形＋完成工事未収入金（前期）\n・工事未払金（前期）\n・未成工事支出金＋材料貯蔵品（前期）\n・未成工事受入金（前期）',
      },
    ],
  },
  5: {
    title: '結果',
    sections: [
      {
        heading: '結果の見方',
        body: 'P点（総合評定値）は X1（完工高）25% + X2（経営状況）20% + Y（経営規模）15% + Z（技術力）25% + W（社会性）15% の重み付けで算出されます。',
      },
      {
        heading: '改善のポイント',
        body: '・X1: 完工高を増やす（3年平均も考慮）\n・X2: 経営状況の改善（自己資本比率、営業CF等）\n・Y: 自己資本額・利益額の改善\n・Z: 技術職員数・資格の充実\n・W: 社会保険加入、ISO取得、経理士配置など',
      },
      {
        heading: 'シミュレーション',
        body: '結果画面からシナリオシミュレーションができます。数値を変更して「もし〜だったら」をシミュレーションし、P点改善の戦略を立てましょう。',
      },
    ],
  },
};

export function HelpPanel({ currentStep }: { currentStep: number }) {
  const [open, setOpen] = useState(false);
  const content = HELP_CONTENT[currentStep] || HELP_CONTENT[1];

  return (
    <>
      {/* Floating help button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg border-2"
        onClick={() => setOpen(true)}
        aria-label="ヘルプを開く"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-80 max-w-[90vw] bg-background border-l shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">{content.title}</h3>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-1 hover:bg-muted transition-colors"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-52px)] px-4 py-4 space-y-5">
          {content.sections.map((section, i) => (
            <div key={i} className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground">
                {section.heading}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
