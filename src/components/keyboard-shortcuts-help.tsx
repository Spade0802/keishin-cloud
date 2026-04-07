'use client';

import { useEffect, useState, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'Enter'], description: '計算を実行（Step 3）' },
  { keys: ['Ctrl', 'S'], description: 'データを保存' },
  { keys: ['Esc'], description: 'ダイアログを閉じる' },
  { keys: ['?'], description: 'このショートカット一覧を表示' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-sm min-w-[24px]">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // "?" key opens the dialog (ignore when typing in inputs)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        toggle();
        return;
      }

      // Esc closes the dialog
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, toggle]);

  return (
    <>
      {/* Floating "?" button - positioned above the help panel button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-[4.5rem] right-6 z-50 h-10 w-10 rounded-full shadow-lg border-2"
        onClick={toggle}
        aria-label="キーボードショートカット一覧"
      >
        <Keyboard className="h-5 w-5" />
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modal dialog */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="キーボードショートカット"
          className="fixed left-1/2 top-1/2 z-50 w-[360px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">キーボードショートカット</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 hover:bg-muted transition-colors"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Shortcuts list */}
          <div className="px-5 py-4 space-y-3">
            {SHORTCUTS.map((shortcut, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-foreground">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {shortcut.keys.map((key, j) => (
                    <span key={j} className="flex items-center gap-1">
                      {j > 0 && (
                        <span className="text-[10px] text-muted-foreground">+</span>
                      )}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3">
            <p className="text-[11px] text-muted-foreground text-center">
              <Kbd>?</Kbd>
              <span className="ml-1.5">を押すといつでも表示できます</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
