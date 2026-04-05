'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Users, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  QUALIFICATION_MULTIPLIERS,
  calculateTechStaffValueByIndustry,
  getEffectiveMultiplier,
} from '@/lib/engine/score-tables';

// ---- Industry name <-> 2-digit code mapping ----

const INDUSTRY_NAME_TO_CODE: Record<string, string> = {
  // Full official names (from input-wizard INDUSTRY_CODES)
  '土木一式工事': '01', '建築一式工事': '02', '大工工事': '03', '左官工事': '04',
  'とび・土工・コンクリート工事': '05', '石工事': '06', '屋根工事': '07', '電気工事': '08',
  '管工事': '09', 'タイル・れんが・ブロック工事': '10', '鋼構造物工事': '11', '鉄筋工事': '12',
  '舗装工事': '13', 'しゅんせつ工事': '14', '板金工事': '15', 'ガラス工事': '16',
  '塗装工事': '17', '防水工事': '18', '内装仕上工事': '19', '機械器具設置工事': '20',
  '熱絶縁工事': '21', '電気通信工事': '22', '造園工事': '23', 'さく井工事': '24',
  '建具工事': '25', '水道施設工事': '26', '消防施設工事': '27', '清掃施設工事': '28', '解体工事': '29',
  // Short name aliases (for compatibility with Gemini extraction)
  '土木': '01', '建築': '02', '大工': '03', '左官': '04',
  'とび': '05', '石': '06', '屋根': '07', '電気': '08',
  '管': '09', 'タイル': '10', '鋼構造物': '11', '鉄筋': '12',
  'ほ装': '13', '舗装': '13', 'しゅんせつ': '14', '板金': '15', 'ガラス': '16',
  '塗装': '17', '防水': '18', '内装': '19', '内装仕上': '19', '機械器具': '20',
  '熱絶縁': '21', '電気通信': '22', '造園': '23', 'さく井': '24',
  '建具': '25', '水道': '26', '水道施設': '26', '消防施設': '27', '清掃': '28', '解体': '29',
};


// ---- Types ----

export interface StaffEntry {
  id: number;
  name: string;
  industryCode1: string;
  qualificationCode1: string;
  lectureFlag1: string;
  industryCode2: string;
  qualificationCode2: string;
  lectureFlag2: string;
  hasSupervisorCert: boolean;
}

/** Per-industry calculated value with breakdown details */
export interface IndustryTechValue {
  code: string;
  name: string;
  value: number;
  breakdown: Array<{
    staffName: string;
    qualName: string;
    multiplier: number;
  }>;
}

/** Extracted staff member from PDF (numbers as used in ExtractedStaffMember) */
export interface ExternalStaffEntry {
  name: string;
  industryCode1?: string;
  qualificationCode1?: number;
  lectureFlag1?: number;
  industryCode2?: string;
  qualificationCode2?: number;
  lectureFlag2?: number;
  supervisorCertNumber?: string;
}

interface TechStaffPanelProps {
  /** Names of industries from Step 2 (e.g., ['電気', '管']) */
  industryNames: string[];
  /** Callback with per-industry tech staff values: Record<industryName, value> */
  onValuesCalculated?: (values: Record<string, number>, details: IndustryTechValue[]) => void;
  /** Pre-extracted staff list from PDF to auto-populate the panel */
  externalStaff?: ExternalStaffEntry[];
}

let nextId = 1;

export function TechStaffPanel({ industryNames, onValuesCalculated, externalStaff }: TechStaffPanelProps) {
  const [staff, setStaff] = useState<StaffEntry[]>([
    {
      id: nextId++,
      name: '',
      industryCode1: '',
      qualificationCode1: '',
      lectureFlag1: '2',
      industryCode2: '',
      qualificationCode2: '',
      lectureFlag2: '2',
      hasSupervisorCert: false,
    },
  ]);
  const [showBreakdown, setShowBreakdown] = useState(true);

  // Auto-populate from PDF-extracted staff list
  useEffect(() => {
    if (!externalStaff || externalStaff.length === 0) return;
    // Only auto-populate if staff list is the default single empty entry
    const isDefault = staff.length === 1 && !staff[0].name && !staff[0].industryCode1 && !staff[0].qualificationCode1;
    if (!isDefault) return;

    const mapped: StaffEntry[] = externalStaff.map((s) => ({
      id: nextId++,
      name: s.name || '',
      industryCode1: s.industryCode1 ? String(s.industryCode1).padStart(2, '0') : '',
      qualificationCode1: s.qualificationCode1 ? String(s.qualificationCode1) : '',
      lectureFlag1: s.lectureFlag1 != null ? String(s.lectureFlag1) : '2',
      industryCode2: s.industryCode2 ? String(s.industryCode2).padStart(2, '0') : '',
      qualificationCode2: s.qualificationCode2 ? String(s.qualificationCode2) : '',
      lectureFlag2: s.lectureFlag2 != null ? String(s.lectureFlag2) : '2',
      hasSupervisorCert: !!s.supervisorCertNumber,
    }));

    if (mapped.length > 0) {
      setStaff(mapped);
      console.log(`[TechStaffPanel] Auto-populated ${mapped.length} staff from PDF extraction`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalStaff]);

  function addStaff() {
    setStaff((prev) => [
      ...prev,
      {
        id: nextId++,
        name: '',
        industryCode1: '',
        qualificationCode1: '',
        lectureFlag1: '2',
        industryCode2: '',
        qualificationCode2: '',
        lectureFlag2: '2',
        hasSupervisorCert: false,
      },
    ]);
  }

  function removeStaff(id: number) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStaff(id: number, field: keyof StaffEntry, value: string | boolean) {
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  // Build the industry code options from current industryNames
  const industryCodeOptions = useMemo(() => {
    return industryNames
      .map((name) => {
        const code = INDUSTRY_NAME_TO_CODE[name];
        return code ? { code, name } : null;
      })
      .filter((x): x is { code: string; name: string } => x !== null);
  }, [industryNames]);

  // All qualification options
  const allQualOptions = useMemo(
    () =>
      Object.entries(QUALIFICATION_MULTIPLIERS).map(([code, info]) => ({
        code,
        label: `${code}: ${info.name} (${info.grade} x${info.multiplier})`,
        name: info.name,
      })),
    []
  );

  // Calculate per-industry values using the engine function
  const industryValues = useMemo(() => {
    const staffForCalc = staff
      .filter((s) => s.industryCode1 && s.qualificationCode1)
      .map((s) => ({
        industryCode1: parseInt(s.industryCode1),
        qualificationCode1: parseInt(s.qualificationCode1),
        lectureFlag1: parseInt(s.lectureFlag1) || 2,
        industryCode2: s.industryCode2 ? parseInt(s.industryCode2) : undefined,
        qualificationCode2: s.qualificationCode2
          ? parseInt(s.qualificationCode2)
          : undefined,
        lectureFlag2: s.lectureFlag2 ? parseInt(s.lectureFlag2) : undefined,
        supervisorCertNumber: s.hasSupervisorCert ? 'YES' : undefined,
      }));

    const rawValues = calculateTechStaffValueByIndustry(staffForCalc);

    // Build detailed breakdown per industry
    const details: IndustryTechValue[] = [];
    const valuesByName: Record<string, number> = {};

    for (const { code, name } of industryCodeOptions) {
      const value = rawValues[code] ?? 0;
      const breakdown: IndustryTechValue['breakdown'] = [];

      // Find which staff contribute to this industry
      for (const s of staff) {
        if (!s.qualificationCode1) continue;
        const ic1 = s.industryCode1;
        const ic2 = s.industryCode2;
        const qc1 = parseInt(s.qualificationCode1);
        const qc2 = s.qualificationCode2 ? parseInt(s.qualificationCode2) : 0;
        const lf1 = parseInt(s.lectureFlag1) || 2;
        const lf2 = parseInt(s.lectureFlag2) || 2;
        const hasCert = s.hasSupervisorCert;

        if (ic1 === code && QUALIFICATION_MULTIPLIERS[qc1]) {
          const mult = getEffectiveMultiplier(qc1, lf1, hasCert);
          breakdown.push({
            staffName: s.name || `職員#${staff.indexOf(s) + 1}`,
            qualName: QUALIFICATION_MULTIPLIERS[qc1].name,
            multiplier: mult,
          });
        }
        if (ic2 === code && qc2 && QUALIFICATION_MULTIPLIERS[qc2]) {
          const mult = getEffectiveMultiplier(qc2, lf2, hasCert);
          breakdown.push({
            staffName: s.name || `職員#${staff.indexOf(s) + 1}`,
            qualName: QUALIFICATION_MULTIPLIERS[qc2].name,
            multiplier: mult,
          });
        }
      }

      details.push({ code, name, value, breakdown });
      valuesByName[name] = value;
    }

    return { rawValues, details, valuesByName };
  }, [staff, industryCodeOptions]);

  // Notify parent when values change
  useEffect(() => {
    onValuesCalculated?.(industryValues.valuesByName, industryValues.details);
  }, [industryValues, onValuesCalculated]);

  const hasAnyStaffData = staff.some((s) => s.qualificationCode1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          別紙二：技術職員名簿から自動計算
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {industryCodeOptions.length === 0 && (
          <p className="text-sm text-amber-600">
            先にStep 2で業種を入力してください。業種名から対応する資格が表示されます。
          </p>
        )}

        {/* Staff List */}
        <div className="space-y-3">
          {staff.map((s, i) => (
            <div key={s.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground w-6">
                  #{i + 1}
                </span>
                <div className="flex-1">
                  <Input
                    placeholder="氏名"
                    value={s.name}
                    onChange={(e) => updateStaff(s.id, 'name', e.target.value)}
                    className="h-7 text-sm"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={s.hasSupervisorCert}
                    onChange={(e) =>
                      updateStaff(s.id, 'hasSupervisorCert', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300"
                    id={`cert-${s.id}`}
                  />
                  <label htmlFor={`cert-${s.id}`} className="text-xs">
                    監理技術者証
                  </label>
                </div>
                {staff.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStaff(s.id)}
                    className="h-7 w-7 p-0 text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Industry 1 + Qualification 1 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-industry1`} className="text-xs">業種1</Label>
                  <select
                    id={`staff-${s.id}-industry1`}
                    value={s.industryCode1}
                    onChange={(e) =>
                      updateStaff(s.id, 'industryCode1', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="">（選択）</option>
                    {industryCodeOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.name}({opt.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-qual1`} className="text-xs">資格区分1</Label>
                  <select
                    id={`staff-${s.id}-qual1`}
                    value={s.qualificationCode1}
                    onChange={(e) =>
                      updateStaff(s.id, 'qualificationCode1', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="">（選択）</option>
                    {allQualOptions.map((q) => (
                      <option key={q.code} value={q.code}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-lecture1`} className="text-xs">講習受講1</Label>
                  <select
                    id={`staff-${s.id}-lecture1`}
                    value={s.lectureFlag1}
                    onChange={(e) =>
                      updateStaff(s.id, 'lectureFlag1', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="1">受講済</option>
                    <option value="2">未受講</option>
                  </select>
                </div>
              </div>

              {/* Industry 2 + Qualification 2 (optional) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-industry2`} className="text-xs text-muted-foreground">
                    業種2（任意）
                  </Label>
                  <select
                    id={`staff-${s.id}-industry2`}
                    value={s.industryCode2}
                    onChange={(e) =>
                      updateStaff(s.id, 'industryCode2', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="">（なし）</option>
                    {industryCodeOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.name}({opt.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-qual2`} className="text-xs text-muted-foreground">
                    資格区分2
                  </Label>
                  <select
                    id={`staff-${s.id}-qual2`}
                    value={s.qualificationCode2}
                    onChange={(e) =>
                      updateStaff(s.id, 'qualificationCode2', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="">（なし）</option>
                    {allQualOptions.map((q) => (
                      <option key={q.code} value={q.code}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`staff-${s.id}-lecture2`} className="text-xs text-muted-foreground">
                    講習受講2
                  </Label>
                  <select
                    id={`staff-${s.id}-lecture2`}
                    value={s.lectureFlag2}
                    onChange={(e) =>
                      updateStaff(s.id, 'lectureFlag2', e.target.value)
                    }
                    className="w-full h-9 sm:h-7 text-xs border rounded px-2 bg-background"
                  >
                    <option value="1">受講済</option>
                    <option value="2">未受講</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addStaff} className="w-full">
          <Plus className="mr-1 h-3 w-3" />
          技術職員を追加
        </Button>

        <Separator />

        {/* Per-industry summary with breakdown */}
        {hasAnyStaffData && industryValues.details.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">業種別 技術職員数値（自動計算）</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="h-6 text-xs"
              >
                {showBreakdown ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    内訳を隠す
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    内訳を表示
                  </>
                )}
              </Button>
            </div>

            {industryValues.details.map((detail) => (
              <div
                key={detail.code}
                className="rounded-lg bg-muted/50 p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {detail.name}（{detail.code}）
                  </span>
                  <span className="text-lg font-bold">{detail.value}点</span>
                </div>

                {showBreakdown && detail.breakdown.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                    {detail.breakdown.map((b, bi) => (
                      <div key={bi} className="flex items-center gap-1">
                        <span>{b.staffName}</span>
                        <span className="text-muted-foreground/60">-</span>
                        <span>{b.qualName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ml-auto ${
                            b.multiplier >= 5
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : b.multiplier >= 2
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : ''
                          }`}
                        >
                          +{b.multiplier}
                        </Badge>
                      </div>
                    ))}
                    <div className="border-t mt-1 pt-1 text-right font-medium">
                      {detail.breakdown.map((b) => b.multiplier).join('+')} ={' '}
                      {detail.value}点
                    </div>
                  </div>
                )}

                {detail.breakdown.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    該当する技術職員がいません
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {!hasAnyStaffData && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <Info className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">
              技術職員の資格情報を入力すると、業種別の技術職員数値が自動計算されます。
              <br />
              入力しない場合は、各業種の技術職員数値を手動で入力できます。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
