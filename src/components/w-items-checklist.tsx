'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, AlertCircle, Shield, Building2, FileCheck, HelpCircle } from 'lucide-react';
import { calculateW } from '@/lib/engine/p-calculator';
import type { SocialItems, WDetail } from '@/lib/engine/types';

interface WItemsChecklistProps {
  onWCalculated: (detail: WDetail, total: number, W: number, items?: SocialItems) => void;
  /** 外部から初期値を設定（提出書PDF読込時） */
  externalItems?: Partial<SocialItems>;
}

function defaultSocialItems(): SocialItems {
  return {
    employmentInsurance: false,
    healthInsurance: false,
    pensionInsurance: false,
    constructionRetirementMutualAid: false,
    retirementSystem: false,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: false,
    youngTechNew: false,
    techStaffCount: 0,
    youngTechCount: 0,
    newYoungTechCount: 0,
    cpdTotalUnits: 0,
    skillLevelUpCount: 0,
    skilledWorkerCount: 0,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 0,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 0,
    certifiedAccountants: 0,
    firstClassAccountants: 0,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 0,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
  };
}

function SectionBadge({ score, max, isPenalty }: { score: number; max?: string; isPenalty?: boolean }) {
  const variant = isPenalty && score < 0
    ? 'destructive'
    : score > 0
      ? 'default'
      : 'secondary';
  return (
    <Badge variant={variant} className="ml-2 text-xs">
      {score}点{max ? ` / ${max}` : ''}
    </Badge>
  );
}

function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-64 px-3 py-2 text-xs text-popover-foreground bg-popover border rounded-md shadow-md whitespace-normal leading-relaxed pointer-events-none">
        {text}
      </span>
    </span>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
  description,
  tooltip,
  type = 'positive',
  autoFilled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  tooltip?: string;
  type?: 'positive' | 'negative' | 'penalty';
  autoFilled?: boolean;
}) {
  const iconColor = type === 'penalty'
    ? checked ? 'text-red-500' : 'text-gray-300'
    : type === 'negative'
      ? checked ? 'text-green-500' : 'text-orange-500'
      : checked ? 'text-green-500' : 'text-gray-300';

  const Icon = type === 'penalty'
    ? checked ? AlertCircle : Check
    : checked ? Check : X;

  return (
    <label className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
          <span className="text-sm font-medium">{label}</span>
          {autoFilled && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-0.5 bg-blue-50 text-blue-600 border-blue-200">
              PDF
            </Badge>
          )}
          {tooltip && <HelpTooltip text={tooltip} />}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">{description}</p>
        )}
      </div>
    </label>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  unit,
  tooltip,
  min,
  max,
  autoFilled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  tooltip?: string;
  min?: number;
  max?: number;
  autoFilled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3">
      <Label className="text-sm font-medium flex-1 min-w-0 flex items-center">
        {label}
        {autoFilled && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-blue-50 text-blue-600 border-blue-200">
            PDF
          </Badge>
        )}
        {tooltip && <HelpTooltip text={tooltip} />}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          min={min}
          max={max}
          className="w-24 text-right text-sm h-8"
        />
        {unit && <span className="text-xs text-muted-foreground whitespace-nowrap w-8">{unit}</span>}
      </div>
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  tooltip,
  autoFilled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  tooltip?: string;
  autoFilled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3">
      <Label className="text-sm font-medium flex-1 min-w-0 flex items-center">
        {label}
        {autoFilled && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 bg-blue-50 text-blue-600 border-blue-200">
            PDF
          </Badge>
        )}
        {tooltip && <HelpTooltip text={tooltip} />}
      </Label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function WItemsChecklist({ onWCalculated, externalItems }: WItemsChecklistProps) {
  const [items, setItems] = useState<SocialItems>(defaultSocialItems);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  /** 前回反映した externalItems の JSON を保持し、同一データの再適用を防ぐ */
  const appliedHashRef = useRef<string>('');

  // 外部からの初期値反映（externalItems が実質的に変わった場合のみ再適用）
  useEffect(() => {
    if (!externalItems || Object.keys(externalItems).length === 0) return;

    const hash = JSON.stringify(externalItems);
    if (appliedHashRef.current === hash) return;
    appliedHashRef.current = hash;

    const filled = new Set<string>();
    for (const [key, value] of Object.entries(externalItems)) {
      if (value !== undefined && value !== null && value !== 0 && value !== false) {
        filled.add(key);
      }
    }
    setAutoFilledFields(filled);
    setItems((prev) => ({ ...prev, ...externalItems }));
    console.log('[WItemsChecklist] Applied external items:', filled.size, 'fields');
  }, [externalItems]);

  const update = useCallback(<K extends keyof SocialItems>(key: K, value: SocialItems[K]) => {
    setItems((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const result = calculateW(items);
    onWCalculated(result.detail, result.total, result.W, items);
  }, [items, onWCalculated]);

  const result = calculateW(items);
  const { detail } = result;

  return (
    <div className="space-y-4">
      {/* W1: 労働福祉の状況 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Shield className="h-5 w-5 mr-2 text-blue-500" />
            W1: 労働福祉の状況
            <SectionBadge score={detail.w1} max="~75" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground px-3 pt-1 pb-0.5">
            社会保険加入（未加入で減点）
          </div>
          <CheckboxRow
            label="雇用保険加入"
            checked={items.employmentInsurance}
            onChange={(v) => update('employmentInsurance', v)}
            description="未加入: -40点"
            type="negative"
            autoFilled={autoFilledFields.has('employmentInsurance')}
          />
          <CheckboxRow
            label="健康保険加入"
            checked={items.healthInsurance}
            onChange={(v) => update('healthInsurance', v)}
            description="未加入: -40点"
            type="negative"
            autoFilled={autoFilledFields.has('healthInsurance')}
          />
          <CheckboxRow
            label="厚生年金保険加入"
            checked={items.pensionInsurance}
            onChange={(v) => update('pensionInsurance', v)}
            description="未加入: -40点"
            type="negative"
            autoFilled={autoFilledFields.has('pensionInsurance')}
          />

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            退職金・労災補償（加入で加点）
          </div>
          <CheckboxRow
            label="建設業退職金共済制度"
            checked={items.constructionRetirementMutualAid}
            onChange={(v) => update('constructionRetirementMutualAid', v)}
            description="加入: +15点"
            tooltip="建設業で働く人のための退職金制度（建退共）への加入"
            autoFilled={autoFilledFields.has('constructionRetirementMutualAid')}
          />
          <CheckboxRow
            label="退職一時金制度"
            checked={items.retirementSystem}
            onChange={(v) => update('retirementSystem', v)}
            description="加入: +15点"
            tooltip="従業員への退職一時金支給制度の有無。企業年金制度（厚生年金基金、確定給付企業年金、確定拠出年金）も対象"
            autoFilled={autoFilledFields.has('retirementSystem')}
          />
          <CheckboxRow
            label="法定外労災補償制度"
            checked={items.nonStatutoryAccidentInsurance}
            onChange={(v) => update('nonStatutoryAccidentInsurance', v)}
            description="加入: +15点"
            tooltip="法定の労災保険に上乗せする任意の労災補償制度への加入"
            autoFilled={autoFilledFields.has('nonStatutoryAccidentInsurance')}
          />

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            若年技術職員の育成確保
          </div>
          <CheckboxRow
            label="若年技術職員の継続的な育成及び確保"
            checked={items.youngTechContinuous}
            onChange={(v) => update('youngTechContinuous', v)}
            description="技術職員のうち35歳以下が15%以上で+1点"
            tooltip="CPD単位取得や若年技術者の継続的な雇用・育成の取り組み状況"
            autoFilled={autoFilledFields.has('youngTechContinuous')}
          />
          <NumberRow
            label="技術職員数"
            value={items.techStaffCount}
            onChange={(v) => update('techStaffCount', v)}
            unit="人"
            min={0}
            tooltip="経審の対象業種で技術者として計上できる職員の合計数"
            autoFilled={autoFilledFields.has('techStaffCount')}
          />
          <NumberRow
            label="35歳以下の技術職員数"
            value={items.youngTechCount}
            onChange={(v) => update('youngTechCount', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('youngTechCount')}
          />
          <CheckboxRow
            label="新規若年技術職員の育成及び確保"
            checked={items.youngTechNew}
            onChange={(v) => update('youngTechNew', v)}
            description="新規若年技術職員がいれば+1点"
            tooltip="審査基準日時点で35歳以下の新規雇用技術職員がいるかどうか"
            autoFilled={autoFilledFields.has('youngTechNew')}
          />
          <NumberRow
            label="新規若年技術職員数"
            value={items.newYoungTechCount}
            onChange={(v) => update('newYoungTechCount', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('newYoungTechCount')}
          />

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            CPD単位取得
          </div>
          <NumberRow
            label="CPD単位合計"
            value={items.cpdTotalUnits}
            onChange={(v) => update('cpdTotalUnits', v)}
            unit="単位"
            min={0}
            tooltip="技術者の継続的な専門能力開発（Continuing Professional Development）の取得単位数合計"
            autoFilled={autoFilledFields.has('cpdTotalUnits')}
          />
          {items.techStaffCount > 0 && (
            <p className="text-xs text-muted-foreground px-3">
              1人あたり: {(items.cpdTotalUnits / items.techStaffCount).toFixed(1)} 単位
              {items.cpdTotalUnits / items.techStaffCount >= 30
                ? ' (+10点)'
                : items.cpdTotalUnits / items.techStaffCount >= 15
                  ? ' (+5点)'
                  : items.cpdTotalUnits / items.techStaffCount >= 5
                    ? ' (+3点)'
                    : items.cpdTotalUnits / items.techStaffCount >= 1
                      ? ' (+1点)'
                      : ' (0点)'}
            </p>
          )}

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            技能レベル向上
          </div>
          <NumberRow
            label="技能レベル向上者数"
            value={items.skillLevelUpCount}
            onChange={(v) => update('skillLevelUpCount', v)}
            unit="人"
            min={0}
            tooltip="技術研修・資格取得支援等により技能レベルが向上した者の数"
            autoFilled={autoFilledFields.has('skillLevelUpCount')}
          />
          <NumberRow
            label="技能者数"
            value={items.skilledWorkerCount}
            onChange={(v) => update('skilledWorkerCount', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('skilledWorkerCount')}
          />
          <NumberRow
            label="控除対象者数"
            value={items.deductionTargetCount}
            onChange={(v) => update('deductionTargetCount', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('deductionTargetCount')}
          />

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            ワーク・ライフ・バランス
          </div>
          <SelectRow
            label="えるぼし認定"
            value={items.wlbEruboshi}
            onChange={(v) => update('wlbEruboshi', v)}
            options={[
              { value: 0, label: '認定なし' },
              { value: 1, label: '1段階目 (+1点)' },
              { value: 2, label: '2段階目 (+2点)' },
              { value: 3, label: '3段階目 (+3点)' },
              { value: 4, label: 'プラチナえるぼし (+5点)' },
            ]}
            tooltip="女性活躍推進法に基づく認定制度。女性の採用・継続就業・管理職比率等の基準を満たした企業に認定"
            autoFilled={autoFilledFields.has('wlbEruboshi')}
          />
          <SelectRow
            label="くるみん認定"
            value={items.wlbKurumin}
            onChange={(v) => update('wlbKurumin', v)}
            options={[
              { value: 0, label: '認定なし' },
              { value: 1, label: 'くるみん (+1点)' },
              { value: 2, label: 'トライくるみん (+2点)' },
              { value: 3, label: 'プラチナくるみん (+3点)' },
              { value: 4, label: 'プラチナくるみんプラス (+5点)' },
            ]}
            tooltip="次世代育成支援対策推進法に基づく子育て支援の認定制度。育児休業取得率等の基準を満たした企業に認定"
            autoFilled={autoFilledFields.has('wlbKurumin')}
          />
          <SelectRow
            label="ユースエール認定"
            value={items.wlbYouth}
            onChange={(v) => update('wlbYouth', v)}
            options={[
              { value: 0, label: '認定なし' },
              { value: 1, label: 'ユースエール (+2点)' },
              { value: 2, label: 'ユースエール（上位） (+4点)' },
            ]}
            tooltip="若者雇用促進法に基づく認定制度。若者の採用・育成に積極的な中小企業に認定"
            autoFilled={autoFilledFields.has('wlbYouth')}
          />

          <div className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-0.5">
            CCUS就業履歴蓄積
          </div>
          <SelectRow
            label="CCUS活用レベル"
            value={items.ccusImplementation}
            onChange={(v) => update('ccusImplementation', v)}
            options={[
              { value: 0, label: '未実施' },
              { value: 1, label: 'レベル1 (+5点)' },
              { value: 2, label: 'レベル2 (+10点)' },
              { value: 3, label: 'レベル3 (+15点)' },
            ]}
            tooltip="建設キャリアアップシステム（CCUS）等による就業履歴の蓄積状況"
            autoFilled={autoFilledFields.has('ccusImplementation')}
          />
        </CardContent>
      </Card>

      {/* W2: 営業年数 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Building2 className="h-5 w-5 mr-2 text-indigo-500" />
            W2: 営業年数
            <SectionBadge score={detail.w2} max="60" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <NumberRow
            label="営業年数"
            value={items.businessYears}
            onChange={(v) => update('businessYears', v)}
            unit="年"
            min={0}
            tooltip="建設業許可を受けてからの年数。6年目から加点開始、最大35年で60点"
            autoFilled={autoFilledFields.has('businessYears')}
          />
          {items.businessYears > 0 && !items.civilRehabilitation && (
            <p className="text-xs text-muted-foreground px-3">
              {items.businessYears >= 35
                ? '60点（上限）'
                : items.businessYears > 5
                  ? `${(items.businessYears - 5) * 2}点`
                  : '0点（6年目から加点開始）'}
            </p>
          )}
          <CheckboxRow
            label="民事再生法・会社更生法の適用あり"
            checked={items.civilRehabilitation}
            onChange={(v) => update('civilRehabilitation', v)}
            description="適用あり: -60点（営業年数の加点が無効化）"
            type="penalty"
            autoFilled={autoFilledFields.has('civilRehabilitation')}
          />
        </CardContent>
      </Card>

      {/* W3: 防災活動 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Shield className="h-5 w-5 mr-2 text-emerald-500" />
            W3: 防災活動
            <SectionBadge score={detail.w3} max="20" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxRow
            label="防災協定の締結"
            checked={items.disasterAgreement}
            onChange={(v) => update('disasterAgreement', v)}
            description="締結あり: +20点"
            tooltip="防災協定の締結等、地域の防災活動への貢献"
            autoFilled={autoFilledFields.has('disasterAgreement')}
          />
        </CardContent>
      </Card>

      {/* W4: 法令遵守 */}
      <Card className={detail.w4 < 0 ? 'border-red-200' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
            W4: 法令遵守
            <SectionBadge score={detail.w4} max="0 (min -30)" isPenalty />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <CheckboxRow
            label="営業停止処分"
            checked={items.suspensionOrder}
            onChange={(v) => update('suspensionOrder', v)}
            description="処分あり: -30点"
            type="penalty"
            autoFilled={autoFilledFields.has('suspensionOrder')}
          />
          <CheckboxRow
            label="指示処分"
            checked={items.instructionOrder}
            onChange={(v) => update('instructionOrder', v)}
            description="処分あり: -15点"
            type="penalty"
            autoFilled={autoFilledFields.has('instructionOrder')}
          />
        </CardContent>
      </Card>

      {/* W5: 監査の受審状況 + 経理 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <FileCheck className="h-5 w-5 mr-2 text-purple-500" />
            W5: 監査の受審状況・経理
            <SectionBadge score={detail.w5} max="~20+" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <SelectRow
            label="監査受審状況"
            value={items.auditStatus}
            onChange={(v) => update('auditStatus', v)}
            options={[
              { value: 0, label: '受審なし (0点)' },
              { value: 1, label: '社内監査 (+4点)' },
              { value: 2, label: '会計参与設置 (+8点)' },
              { value: 3, label: '経理士監査 (+14点)' },
              { value: 4, label: '会計監査人設置 (+20点)' },
            ]}
            autoFilled={autoFilledFields.has('auditStatus')}
          />
          <div className="text-xs font-semibold text-muted-foreground px-3 pt-2 pb-0.5">
            経理体制
          </div>
          <NumberRow
            label="公認会計士数"
            value={items.certifiedAccountants}
            onChange={(v) => update('certifiedAccountants', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('certifiedAccountants')}
          />
          <NumberRow
            label="建設業経理士1級"
            value={items.firstClassAccountants}
            onChange={(v) => update('firstClassAccountants', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('firstClassAccountants')}
          />
          <NumberRow
            label="建設業経理士2級"
            value={items.secondClassAccountants}
            onChange={(v) => update('secondClassAccountants', v)}
            unit="人"
            min={0}
            autoFilled={autoFilledFields.has('secondClassAccountants')}
          />
        </CardContent>
      </Card>

      {/* W6: 研究開発費 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Building2 className="h-5 w-5 mr-2 text-cyan-500" />
            W6: 研究開発費
            <SectionBadge score={detail.w6} max="25" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NumberRow
            label="研究開発費（2期平均）"
            value={items.rdExpense2YearAvg}
            onChange={(v) => update('rdExpense2YearAvg', v)}
            unit="千円"
            min={0}
            tooltip="研究開発のための投資額。会計監査人設置会社のみ加点対象"
            autoFilled={autoFilledFields.has('rdExpense2YearAvg')}
          />
          {items.rdExpense2YearAvg > 0 && (
            <p className="text-xs text-muted-foreground px-3">
              評点: {Math.min(25, Math.floor(items.rdExpense2YearAvg / 10000))}点
            </p>
          )}
        </CardContent>
      </Card>

      {/* W7: 建設機械保有 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Building2 className="h-5 w-5 mr-2 text-amber-500" />
            W7: 建設機械保有
            <SectionBadge score={detail.w7} max="15" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NumberRow
            label="建設機械保有台数"
            value={items.constructionMachineCount}
            onChange={(v) => update('constructionMachineCount', v)}
            unit="台"
            min={0}
            tooltip="特定の建設機械（ショベル系掘削機、ブルドーザー等）の保有台数。1台1点、上限15点"
            autoFilled={autoFilledFields.has('constructionMachineCount')}
          />
          <p className="text-xs text-muted-foreground px-3">
            1台につき1点（上限15点）
          </p>
        </CardContent>
      </Card>

      {/* W8: ISO等 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <FileCheck className="h-5 w-5 mr-2 text-teal-500" />
            W8: ISO等
            <SectionBadge score={detail.w8} max="10" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <CheckboxRow
            label="ISO 9001 認証取得"
            checked={items.iso9001}
            onChange={(v) => update('iso9001', v)}
            description="+5点"
            tooltip="品質マネジメントシステムの国際規格認証"
            autoFilled={autoFilledFields.has('iso9001')}
          />
          <CheckboxRow
            label="ISO 14001 認証取得"
            checked={items.iso14001}
            onChange={(v) => update('iso14001', v)}
            description="+5点"
            tooltip="環境マネジメントシステムの国際規格認証"
            autoFilled={autoFilledFields.has('iso14001')}
          />
          <CheckboxRow
            label="エコアクション21 認証取得"
            checked={items.ecoAction21}
            onChange={(v) => update('ecoAction21', v)}
            description="+5点（ISO14001との合計で上限10点）"
            tooltip="中小企業向けの環境経営認証制度。環境省が策定したガイドラインに基づく認証"
            autoFilled={autoFilledFields.has('ecoAction21')}
          />
        </CardContent>
      </Card>

      {/* 合計スコア */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">W点 合計</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {([
              ['W1', detail.w1, '労働福祉'],
              ['W2', detail.w2, '営業年数'],
              ['W3', detail.w3, '防災活動'],
              ['W4', detail.w4, '法令遵守'],
              ['W5', detail.w5, '監査・経理'],
              ['W6', detail.w6, '研究開発'],
              ['W7', detail.w7, '建設機械'],
              ['W8', detail.w8, 'ISO等'],
            ] as const).map(([key, score, label]) => (
              <div key={key} className="text-center p-2 rounded-lg bg-background border">
                <div className="text-xs text-muted-foreground">{key}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-lg font-bold ${score < 0 ? 'text-red-600' : score > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {score}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border">
            <div>
              <span className="text-sm text-muted-foreground">素点合計</span>
              <span className="ml-2 text-lg font-bold">{result.total}点</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">W = floor(素点 x 1750 / 200)</span>
              <span className="ml-2 text-2xl font-bold text-primary">{result.W}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
