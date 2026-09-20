import React from 'react';
import { HelpCircle, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight } from 'lucide-react';

export const ColUserGuideSheet: React.FC = () => {
  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-xs">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-[#007343] text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">ARKUSZ: USER GUIDE (Przewodnik Store Managera)</h2>
              <p className="text-emerald-200 text-xs">
                Oficjalne zasady planowania i weryfikacji kosztów COL w kawiarniach Starbucks (AmRest)
              </p>
            </div>
          </div>
          <span className="bg-black/20 text-white font-mono px-3 py-1 rounded text-xs border border-white/10">
            Wsparcie: maciej.andrzejewski@amrest.eu
          </span>
        </div>

        {/* Sekcja 1: Złota Zasada Żółtych Pól */}
        <div className="border-2 border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ZASADA NR 1: Edycja wyłącznie w żółtych polach!
          </div>
          <p className="text-slate-700 dark:text-zinc-300 text-xs leading-relaxed">
            W całym arkuszu uzupełniaj tylko <strong>żółte pola (<span className="bg-[#ffffcc] px-1 py-0.5 border border-amber-300 rounded font-mono text-black font-bold">#FFFFCC</span>)</strong>.
            Wszystkie pozostałe komórki posiadają zablokowane formuły wyliczane automatycznie, które są w 100% spójne z raportem P&L i wytycznymi Payroll.
          </p>
        </div>

        {/* Sekcja 2: Etap 1 - Planowanie Miesiąca (TARGET) */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
          <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            KROK 1: Planowanie Nowego Miesiąca (TARGET)
          </h3>
          <ul className="space-y-2 text-slate-600 dark:text-zinc-400 text-xs list-disc pl-5">
            <li><strong>Wybór kawiarni i miesiąca:</strong> w nagłówku wybierz numer MPK (108120 Janki) oraz planowany miesiąc i wprowadź ilość dni otwarcia kawiarni.</li>
            <li><strong>Sprzedaż i Transakcje:</strong> wprowadź planowaną wartość sprzedaży (Sales PLN) oraz liczbę transakcji (Transactions) na podstawie AOP lub wytycznych DM.</li>
            <li><strong>Wybór macierzy TPLH:</strong> wybierz Plan A (dane CCE), Plan B (mieszane CCE/DE) lub Plan C (Niemcy) i ustal docelowy <strong>TPLH Target</strong> (np. 6.60).</li>
            <li><strong>Godziny kadry menedżerskiej:</strong> w części <em>Manager Target</em> wprowadź planowany czas pracy, urlopy oraz ewentualne zwolnienia lekarskie. Suma godzin powinna pokrywać nominał etatu.</li>
            <li><strong>Rezerwa urlopowa:</strong> przejdź do arkusza <em>Rezerwa urlopowa</em>, wprowadź dni niewykorzystanego urlopu menedżerów; kwota automatycznie zasili wiersz <em>Holiday accrual</em>.</li>
            <li><strong>Załoga UoP i UZ:</strong> zaplanuj godziny dla baristów na umowie o pracę (zwracając uwagę na alerty niedogodzin/nadgodzin) oraz rozdziel godziny dla zleceniobiorców UZ.</li>
            <li><strong>Koszty Inne i Dostawy:</strong> określ budżet premii załogi (0.2% sprzedaży), opłatę ADP (600 zł), ryczałt badań (150 zł) oraz prognozowaną liczbę zamówień delivery.</li>
          </ul>
        </div>

        {/* Sekcja 3: Etap 2 - Zamknięcie Miesiąca (ESTIMATION) */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
          <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            KROK 2: Weryfikacja Wykonania i Zamknięcie (ESTIMATION)
          </h3>
          <ul className="space-y-2 text-slate-600 dark:text-zinc-400 text-xs list-disc pl-5">
            <li>W kolumnie <em>Estimation</em> wprowadź ostatecznie osiągniętą sprzedaż i transakcje.</li>
            <li>Uzupełnij rzeczywisty czas pracy, zwolnienia lekarskie i urlopy menedżerów oraz baristów.</li>
            <li>Zaktualizuj rzeczywistą prowizję agregatorów dostaw (TRX delivery × stawka drop).</li>
            <li>W arkuszu <em>BONUS</em> wprowadź końcowe wartości Sales i Ops Profit, aby otrzymać autoryzowaną premię kadry kierowniczej.</li>
            <li>Porównaj w lewym panelu wskaźnik <strong>TOTAL COL %</strong> z budżetem AOP.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
