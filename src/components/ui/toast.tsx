'use client';

import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === 'success'
      ? 'bg-green-600'
      : type === 'error'
        ? 'bg-red-600'
        : 'bg-amber-600';

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="alert"
    >
      {message}
    </div>
  );
}

let containerEl: HTMLDivElement | null = null;
let toastRoot: ReturnType<typeof createRoot> | null = null;
let toasts: Array<{ id: number; message: string; type: 'success' | 'error' | 'warning' }> = [];
let nextId = 0;

function renderToasts() {
  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
    document.body.appendChild(containerEl);
    toastRoot = createRoot(containerEl);
  }

  toastRoot!.render(
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => {
            toasts = toasts.filter((x) => x.id !== t.id);
            renderToasts();
          }}
        />
      ))}
    </>
  );
}

export function showToast(message: string, type: 'success' | 'error' | 'warning' = 'error') {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  renderToasts();
}
