import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    success: boolean;
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsProcessing(true);
    setResultMessage(null);

    try {
      if ((window as any).api?.importFichajesBuffer) {
        const buffer = await file.arrayBuffer();
        const res = await (window as any).api.importFichajesBuffer(buffer);
        setResultMessage({
          success: res.success,
          text: res.message,
        });
        if (res.success) {
          onImportSuccess();
        }
      } else {
        setResultMessage({
          success: false,
          text: 'Brak aktywnego połączenia z procesem desktopowym Electron.',
        });
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `Błąd odczytu pliku: ${err.message || String(err)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNativeFileDialog = async () => {
    if (!(window as any).api?.openFileDialog) return;
    setIsProcessing(true);
    setResultMessage(null);

    try {
      const filePath = await (window as any).api.openFileDialog();
      if (filePath) {
        const res = await (window as any).api.importFichajesFile(filePath);
        setResultMessage({
          success: res.success,
          text: res.message,
        });
        if (res.success) {
          onImportSuccess();
        }
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `Błąd importu: ${err.message || String(err)}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#D0DCD6] rounded-3xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Zamknięcie */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full bg-[#F0F4F2] text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#E2E8E5] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tytuł */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 rounded-2xl bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
            <FileSpreadsheet className="w-6 h-6 text-[#006241]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1E3932]">
              Import Raportu MAPAL (Fichajes)
            </h3>
            <p className="text-xs text-[#5C6F68]">
              Kawiarnia: <strong>108120 SBX Warszawa Janki (kod: 384)</strong>
            </p>
          </div>
        </div>

        {/* Obszar Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleNativeFileDialog}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
            isDragging
              ? 'border-[#006241] bg-[#F0FDF4] scale-[0.99]'
              : 'border-[#D0DCD6] hover:border-[#006241] bg-[#F7F9F8] hover:bg-[#F0FDF4]'
          }`}
        >
          <UploadCloud className="w-12 h-12 text-[#006241] mb-3 animate-bounce" />
          <p className="text-sm font-bold text-[#1E3932] mb-1">
            Przeciągnij raport tutaj lub kliknij, aby wybrać
          </p>
          <p className="text-xs text-[#5C6F68] mb-3">
            Obsługiwane formaty: <strong>.xls (BIFF8)</strong> oraz <strong>.xlsx</strong>
          </p>

          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-white border border-[#D0DCD6] hover:bg-[#E8F5E9] text-xs font-bold text-[#006241] shadow-xs transition-colors"
          >
            Przeglądaj pliki...
          </button>
        </div>

        {/* Ukryty input dla przeglądarki */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleProcessFile(e.target.files[0]);
            }
          }}
        />

        {/* Informacje o logice czyszczenia */}
        <div className="mt-4 p-3.5 rounded-xl bg-[#F7F9F8] border border-[#E2E8E5] text-xs text-[#2D3748] space-y-1">
          <div className="font-bold text-[#1E3932] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#006241]" />
            Zasady bezpiecznego importu:
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-[#5C6F68]">
            <li>Automatyczne pomijanie pustego wiersza 7 i odczyt danych od wiersza 8 wzwyż.</li>
            <li>Filtracja wyłącznie dla kawiarni Janki (kod 384).</li>
            <li>Pobieranie fizycznych godzin z kolumny <em>Computable Time</em>.</li>
            <li><strong>Idempotencja</strong>: stare logowania w importowanym zakresie dat są bezpiecznie zastępowane bez duplikacji.</li>
          </ul>
        </div>

        {/* Loader podczas przetwarzania */}
        {isProcessing && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-[#006241] font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Przetwarzanie i walidacja raportu MAPAL...</span>
          </div>
        )}

        {/* Komunikat o wyniku */}
        {resultMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border flex items-start space-x-2 text-xs font-bold ${
              resultMessage.success
                ? 'bg-[#E8F5E9] border-[#C8E6C9] text-[#006241]'
                : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]'
            }`}
          >
            {resultMessage.success ? (
              <CheckCircle2 className="w-4 h-4 text-[#006241] mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
            )}
            <span>{resultMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
