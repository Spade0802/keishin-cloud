'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ExtractionProgressProps {
  /** Whether the extraction is currently in progress */
  isActive: boolean;
  /** Called when the real API completes — triggers jump to 100% */
  isComplete?: boolean;
  /** Total estimated duration in ms (default: 25000) */
  estimatedDuration?: number;
  /** Optional label shown above the progress bar */
  label?: string;
}

const STAGES: { threshold: number; text: string }[] = [
  { threshold: 0, text: 'PDFを読み込んでいます...' },
  { threshold: 8, text: 'PDFを解析中...' },
  { threshold: 20, text: '基本情報を抽出中...' },
  { threshold: 35, text: '業種データを読み取り中...' },
  { threshold: 50, text: '社会性項目を解析中...' },
  { threshold: 65, text: '技術職員データを処理中...' },
  { threshold: 78, text: 'データを検証中...' },
  { threshold: 88, text: 'フォームに反映中...' },
  { threshold: 95, text: '完了処理中...' },
];

function getStageText(progress: number): string {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i].threshold) {
      return STAGES[i].text;
    }
  }
  return STAGES[0].text;
}

export function ExtractionProgress({
  isActive,
  isComplete = false,
  estimatedDuration = 25000,
  label,
}: ExtractionProgressProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Easing: fast start, slow towards 95%
  const easeProgress = useCallback(
    (elapsed: number): number => {
      const ratio = Math.min(elapsed / estimatedDuration, 1);
      // Use a curve that reaches ~95% at ratio=1
      // p = 95 * (1 - e^(-3*ratio))
      return 95 * (1 - Math.exp(-3 * ratio));
    },
    [estimatedDuration],
  );

  useEffect(() => {
    if (!isActive) {
      // Reset when deactivated
      setProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const p = easeProgress(elapsed);
      setProgress(p);
      if (p < 95) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, easeProgress]);

  // Jump to 100% when complete
  useEffect(() => {
    if (isComplete && isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setProgress(100);
    }
  }, [isComplete, isActive]);

  if (!isActive) return null;

  const displayPercent = Math.round(progress);
  const stageText = getStageText(progress);

  return (
    <div className="w-full space-y-2">
      {label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{stageText}</span>
        <span>{displayPercent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
