import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface RestoreNoticeData {
  snapshotId: string;
  restoredDomains?: string[];
  restoredAt?: string;
  author?: string;
}

export const CloudRestoreNoticeModal: React.FC = () => {
  const [notice, setNotice] = useState<RestoreNoticeData | null>(null);

  useEffect(() => {
    const handleNotice = (_event: any, data: RestoreNoticeData) => {
      setNotice(data);
    };

    if (typeof window !== 'undefined' && (window as any).api?.onStoreRestored) {
      (window as any).api.onStoreRestored(handleNotice);
    }

    return () => {
      if (typeof window !== 'undefined' && (window as any).api?.removeStoreRestoredListener) {
        (window as any).api.removeStoreRestoredListener(handleNotice);
      }
    };
  }, []);

  if (!notice) return null;

  const formattedDate = notice.restoredAt
    ? new Date(notice.restoredAt).toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'przed chwilą';

  const handleDismiss = () => {
    setNotice(null);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 text-[#006241] shrink-0">
            <CheckCircle2 className="w-6 h-6 text-[#006241]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-stone-900">
              Baza lokalu została zaktualizowana
            </h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Kierownik <strong>{notice.author || 'Store Manager'}</strong> przywrócił punkt bezpieczeństwa lokalu z dnia <strong>{formattedDate}</strong>.
            </p>
            {notice.restoredDomains && notice.restoredDomains.length > 0 && (
              <p className="text-[11px] text-stone-500 mt-2 bg-stone-50 p-2 rounded-lg border border-stone-200">
                Przywrócone obszary: <strong>{notice.restoredDomains.join(', ')}</strong>
              </p>
            )}
            <p className="text-[11px] text-stone-500 mt-2">
              Widok aplikacji został automatycznie zsynchronizowany ze stanem chmury, aby zapobiec rozbieżności danych (Split-Brain).
            </p>
            <div className="mt-5">
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 rounded-xl bg-[#006241] hover:bg-[#1E3932] text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rozumiem (Odśwież widok)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
