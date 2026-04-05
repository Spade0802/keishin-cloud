'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ONBOARDING_KEY = 'keishin-onboarding-seen';

interface TooltipItem {
  id: string;
  text: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIPS: TooltipItem[] = [
  {
    id: 'upload',
    text: 'ここにPDFをアップロード',
    targetSelector: '[data-onboarding="upload"]',
    position: 'bottom',
  },
  {
    id: 'industry',
    text: '業種を選択',
    targetSelector: '[data-onboarding="industry"]',
    position: 'bottom',
  },
  {
    id: 'calculate',
    text: '計算実行',
    targetSelector: '[data-onboarding="calculate"]',
    position: 'top',
  },
];

function OnboardingTooltip({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  return (
    <div className="relative inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/60 dark:border-blue-700 px-3 py-2 text-sm text-blue-800 dark:text-blue-200 shadow-md animate-in fade-in-0 slide-in-from-top-2 duration-300">
      <span className="font-medium">{text}</span>
      <button
        onClick={onDismiss}
        className="ml-1 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        aria-label="閉じる"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Wraps a target element to show an onboarding callout on first visit.
 * Usage: <OnboardingCallout id="upload" text="ここにPDFをアップロード">...</OnboardingCallout>
 */
export function OnboardingCallout({
  id,
  text,
  children,
}: {
  id: string;
  text: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
      if (!seen[id]) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, [id]);

  function dismiss() {
    setVisible(false);
    try {
      const seen = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
      seen[id] = true;
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(seen));
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" data-onboarding={id}>
      {visible && (
        <div className="mb-2">
          <OnboardingTooltip text={text} onDismiss={dismiss} />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Dismisses all onboarding tooltips at once.
 */
export function dismissAllOnboarding() {
  const allIds = TOOLTIPS.map((t) => t.id);
  try {
    const seen = JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
    for (const id of allIds) {
      seen[id] = true;
    }
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
}
