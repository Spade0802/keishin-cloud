'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Users } from 'lucide-react';
import { QUALIFICATION_MULTIPLIERS, getEffectiveMultiplier } from '@/lib/engine/score-tables';

interface StaffEntry {
  id: number;
  name: string;
  qualificationCode1: string;
  lectureFlag1: string;
  hasSupervisorCert: boolean;
  qualificationCode2: string;
  lectureFlag2: string;
}

interface TechStaffPanelProps {
  onTechValueCalculated?: (value: number) => void;
}

const INDUSTRY_QUAL_CODES: Record<string, number[]> = {
  '土木': [101, 103, 151, 153, 201],
  '建築': [105, 157, 201],
  '電気': [127, 155, 228, 256, 201],
  '管': [129, 230, 201],
  '電気通信': [133, 233, 201],
  '造園': [131, 231, 201],
};

let nextId = 1;

export function TechStaffPanel({ onTechValueCalculated }: TechStaffPanelProps) {
  const [selectedIndustry, setSelectedIndustry] = useState('電気');
  const [staff, setStaff] = useState<StaffEntry[]>([
    { id: nextId++, name: '', qualificationCode1: '', lectureFlag1: '2', hasSupervisorCert: false, qualificationCode2: '', lectureFlag2: '2' },
  ]);

  function addStaff() {
    setStaff((prev) => [
      ...prev,
      { id: nextId++, name: '', qualificationCode1: '', lectureFlag1: '2', hasSupervisorCert: false, qualificationCode2: '', lectureFlag2: '2' },
    ]);
  }

  function removeStaff(id: number) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStaff(id: number, field: keyof StaffEntry, value: string | boolean) {
    setStaff((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  // Calculate tech staff value for each person
  const staffResults = useMemo(() => {
    return staff.map((s) => {
      const code1 = parseInt(s.qualificationCode1);
      const code2 = parseInt(s.qualificationCode2);
      const lecture1 = parseInt(s.lectureFlag1) || 2;
      const lecture2 = parseInt(s.lectureFlag2) || 2;

      let multiplier1 = 0;
      let qualName1 = '';
      if (!isNaN(code1) && QUALIFICATION_MULTIPLIERS[code1]) {
        multiplier1 = getEffectiveMultiplier(code1, lecture1, s.hasSupervisorCert);
        qualName1 = QUALIFICATION_MULTIPLIERS[code1].name;
      }

      let multiplier2 = 0;
      let qualName2 = '';
      if (!isNaN(code2) && QUALIFICATION_MULTIPLIERS[code2]) {
        multiplier2 = getEffectiveMultiplier(code2, lecture2, s.hasSupervisorCert);
        qualName2 = QUALIFICATION_MULTIPLIERS[code2].name;
      }

      // Use higher multiplier (person can only contribute once per industry)
      const effectiveMultiplier = Math.max(multiplier1, multiplier2);

      return {
        ...s,
        qualName1,
        qualName2,
        multiplier1,
        multiplier2,
        effectiveMultiplier,
      };
    });
  }, [staff]);

  const totalValue = useMemo(() => {
    const total = staffResults.reduce((sum, s) => sum + s.effectiveMultiplier, 0);
    onTechValueCalculated?.(total);
    return total;
  }, [staffResults, onTechValueCalculated]);

  // Available qualification codes for select
  const qualOptions = Object.entries(QUALIFICATION_MULTIPLIERS).map(([code, info]) => ({
    code,
    label: `${code}: ${info.name}（${info.grade} ×${info.multiplier}）`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" />
          技術職員Z値計算
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Industry selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-sm">対象業種:</Label>
          {Object.keys(INDUSTRY_QUAL_CODES).map((ind) => (
            <Button
              key={ind}
              variant={selectedIndustry === ind ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedIndustry(ind)}
              className="h-7 text-xs"
            >
              {ind}
            </Button>
          ))}
        </div>

        <Separator />

        {/* Staff List */}
        <div className="space-y-3">
          {staff.map((s, i) => {
            const result = staffResults[i];
            return (
              <div key={s.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <Input
                      placeholder="氏名"
                      value={s.name}
                      onChange={(e) => updateStaff(s.id, 'name', e.target.value)}
                      className="h-7 text-sm"
                    />
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      result.effectiveMultiplier >= 5
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : result.effectiveMultiplier >= 2
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-gray-50 text-gray-700'
                    }
                  >
                    ×{result.effectiveMultiplier}
                  </Badge>
                  {staff.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeStaff(s.id)} className="h-7 w-7 p-0 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Qualification 1 */}
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">資格区分コード1</Label>
                    <select
                      value={s.qualificationCode1}
                      onChange={(e) => updateStaff(s.id, 'qualificationCode1', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background"
                    >
                      <option value="">（選択してください）</option>
                      {qualOptions.map((q) => (
                        <option key={q.code} value={q.code}>{q.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">講習受講1</Label>
                    <select
                      value={s.lectureFlag1}
                      onChange={(e) => updateStaff(s.id, 'lectureFlag1', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background"
                    >
                      <option value="1">受講済</option>
                      <option value="2">未受講</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">監理技術者証</Label>
                    <div className="flex items-center h-7">
                      <input
                        type="checkbox"
                        checked={s.hasSupervisorCert}
                        onChange={(e) => updateStaff(s.id, 'hasSupervisorCert', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="ml-2 text-xs">あり</span>
                    </div>
                  </div>
                </div>

                {/* Qualification 2 (optional) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground">資格区分コード2（任意）</Label>
                    <select
                      value={s.qualificationCode2}
                      onChange={(e) => updateStaff(s.id, 'qualificationCode2', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background"
                    >
                      <option value="">（なし）</option>
                      {qualOptions.map((q) => (
                        <option key={q.code} value={q.code}>{q.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">講習受講2</Label>
                    <select
                      value={s.lectureFlag2}
                      onChange={(e) => updateStaff(s.id, 'lectureFlag2', e.target.value)}
                      className="w-full h-7 text-xs border rounded px-2 bg-background"
                    >
                      <option value="1">受講済</option>
                      <option value="2">未受講</option>
                    </select>
                  </div>
                </div>

                {/* Result display */}
                {result.qualName1 && (
                  <div className="text-xs text-muted-foreground">
                    {result.qualName1}
                    {result.multiplier1 === 6 && ' （1級監理受講）'}
                    {result.qualName2 && ` / ${result.qualName2}`}
                    → 有効乗数: ×{result.effectiveMultiplier}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={addStaff} className="w-full">
          <Plus className="mr-1 h-3 w-3" />
          技術職員を追加
        </Button>

        <Separator />

        {/* Summary */}
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <div className="text-xs text-muted-foreground">技術職員数値（{selectedIndustry}）</div>
          <div className="text-3xl font-bold mt-1">{totalValue}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {staffResults.filter((s) => s.effectiveMultiplier > 0).length}名 × 各乗数の合計
          </div>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">×5/6</Badge>
              {staffResults.filter((s) => s.effectiveMultiplier >= 5).length}名
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">×2</Badge>
              {staffResults.filter((s) => s.effectiveMultiplier === 2).length}名
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px]">×1</Badge>
              {staffResults.filter((s) => s.effectiveMultiplier === 1).length}名
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
