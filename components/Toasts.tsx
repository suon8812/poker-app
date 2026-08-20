'use client';

import { useUIStore } from '@/lib/store/uiStore';

export default function Toasts() {
  const toasts = useUIStore(s => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-full max-w-xs px-4">
      {toasts.map(t => (
        <div key={t.id} className="bg-black/80 text-white text-sm rounded-lg px-4 py-2 text-center shadow-lg">
          {t.message}
        </div>
      ))}
    </div>
  );
}
