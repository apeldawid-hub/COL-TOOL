# Handoff Report — Explorer R3: TOR Quarterly Accounting & Fichajes RCP Collision Model

## 1. Observation
1. **Sztywne zerowanie godzin urlopu i L4 w weekendy**:
   W pliku `src/modules/managers-schedule/services/torEngine.ts` (linie 108–122):
   ```typescript
   const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
   const isHoliday = holidays.has(dateStr);
   const isNonWorkingDay = isWeekend || isHoliday;

   const code = s.shift_code;
   if (code === 'H') {
     hDays++;
     const dayH = isNonWorkingDay ? 0.0 : Number((8.0 * contractRatio).toFixed(1));
     hHours += dayH;
   } else if (code === 'L4') {
     l4Days++;
     const dayL4 = isNonWorkingDay ? 0.0 : Number((8.0 * contractRatio).toFixed(1));
     l4Hours += dayL4;
   }
   ```
2. **Sztywne naliczanie $8\text{h} \times \text{etat}$ w dni robocze dla niepełnego etatu**:
   W `torEngine.ts` (linia 116, 121) oraz `managerScheduleEngine.ts` (linie 812, 817):
   ```typescript
   effectiveHours = isNonWorkingDay ? 0.0 : Number((8.0 * empRatio).toFixed(1));
   ```
   Dla 0.5 etatu (Weronika Bieńkowska) `dayL4` oraz `dayH` wynoszą zawsze `4.0h`, bez względu na to, czy pracownik miał zaplanowaną w grafiku 8-godzinną zmianę operacyjną (`AM`/`PM`).
3. **Pasywny charakter `RcpAbsenceConflictDialog.tsx`**:
   W `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx` (linie 149–156):
   Jedynym elementem interaktywnym w stopce modala jest:
   ```tsx
   <button
     onClick={onClose}
     className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
   >
     Zamknij powiadomienie
   </button>
   ```
   Brak jakichkolwiek przycisków akcji (konwersja zmiany, podział zmiany, usunięcie absencji).
4. **Podwójne naliczanie godzin przy kolizji w TOR**:
   W `torEngine.ts` (linie 136–144):
   ```typescript
   if (hasActualRcp && actualRcpByMonth?.[emp.id]?.[m] !== undefined) {
     rcpHours = actualRcpByMonth[emp.id][m];
   }
   ...
   const totalHours = Number((rcpHours + hHours + l4Hours).toFixed(1));
   ```
   Gdy w danym dniu zarejestrowano odbicie na kasie (np. 8.0h w `rcpHours`) i jednocześnie w grafiku figuruje urlop `H` (8.0h w `hHours`), `totalHours` wynosi 16.0h.
5. **Cichy fallback do planu i wprowadzająca w błąd flaga `isRcpFromActuals`**:
   W `torEngine.ts` (linie 136–161):
   Jeśli `hasActualRcpByMonth[m]` jest prawdą dla kawiarni, ale `actualRcpByMonth[emp.id][m]` jest `undefined` dla konkretnego pracownika, silnik wchodzi do gałęzi `else`, przyjmując sumę zaplanowanych zmian z grafiku, ale zwracając `isRcpFromActuals = true`.
6. **Twardo zakodowane jednostki w imporcie i eksporcie**:
   W `electron/importer/universalReportParser.ts` (linie 563–567, 876) oraz `src/modules/managers-schedule/services/managerExcelExport.ts` (linia 121) występują ciągi `'18120'`, `'108120'`, `'384'`.
7. **Brak obsługi nietypowych etatów w modalach**:
   W `ManagerTeamModal.tsx` (linie 67–71) instrukcja `if-else` obsługuje tylko `FULL`, `0.75`, `0.5`, `0.25`, ignorując np. `0.80` (4/5 etatu).

## 2. Logic Chain
1. Z obserwacji 1 i 2 wynika, że pracownik na 0.5 etatu (Weronika Bieńkowska) pracujący w systemie zmian 8-godzinnych (norma 88h = 11 zmian po 8h), który zachoruje w dniu zaplanowanej zmiany `PM` (8h), otrzymuje od systemu tylko 4.0h kredytu. Jego bilans na koniec miesiąca wynosi $80\text{h} + 4\text{h} - 88\text{h} = -4.0\text{h}$ niedogodzin.
2. Zgodnie z art. 130 § 3 Kodeksu Pracy, wymiar czasu pracy pracownika w okresie rozliczeniowym ulega obniżeniu o liczbę godzin usprawiedliwionej nieobecności przypadających do przepracowania zgodnie z przyjętym rozkładem czasu pracy. Obniżenie o 4h zamiast 8h narusza ten przepis i bezpodstawnie karze pracownika niedogodzinami.
3. Z obserwacji 1 wynika ponadto, że pracownik chorujący w sobotę lub niedzielę handlową, na którą miał zaplanowany dyżur (np. 7h `PMN`), otrzymuje 0.0h zaliczenia. Zmiana robocza odpada z sumy przepracowanej, a kolumna `L4` nie otrzymuje godzin, co generuje deficyt -7.0h lub -8.0h.
4. Z obserwacji 3 i 4 wynika, że gdy pracownik pracuje w dniu zadeklarowanego urlopu lub L4, godziny sumują się ($8\text{h} + 8\text{h} = 16\text{h}$), generując fałszywe nadgodziny. Ponieważ dialog z obserwacji 3 jest czysto informacyjny i nie wymusza ani nie ułatwia korekty, kolizje pozostają w bazie.
5. Wykonywanie pracy w czasie orzeczonej niezdolności do pracy narusza art. 17 ust. 1 Ustawy zasiłkowej (utrata prawa do zasiłku za cały okres zwolnienia) oraz art. 207 i 229 KP (odpowiedzialność karna i wykroczeniowa pracodawcy, grzywna PIP od 1 000 do 30 000 zł wg art. 283 § 1 KP).
6. Z obserwacji 5 wynika, że w przypadku braku odbić pracownika w MAPAL lub literówki w nazwisku, aplikacja pobiera godziny z grafiku roboczego, oznaczając je zieloną kropką "Zarejestrowane z MAPAL", wprowadzając w błąd Store Managera co do wiarygodności rozliczenia.

## 3. Caveats
- Audyt przeprowadzono w trybie ściśle analityczno-projektowym (Design Mode) — nie wprowadzono żadnych zmian w kodzie źródłowym (`src/` i `electron/` pozostały nienaruszone).
- Przeanalizowano referencyjne pliki danych JSON z folderu `IMPORT/` (`manager_schedule_shifts.json`, `labor_actuals_log.json`, `manager_employees.json`, `manager_monthly_roster.json`).
- W analizie prawnej Kodeksu Pracy i ustawy zasiłkowej oparto się na obowiązującym stanie prawnym RP dla systemu równoważnego czasu pracy w placówkach handlowych i gastronomicznych.

## 4. Conclusion
1. **Architektura podsystemu TOR**: Bardzo dobra i przejrzysta podstawa (3 kolumny: RCP, H, L4), deterministyczna agregacja kwartalna, wzorowa obsługa zmian składu (`activeMonths`).
2. **Kluczowe wady do naprawy**:
   - Algorytm naliczania absencji musi stać się "Schedule-Aware" (uwzględniać wymiar zaplanowanego dyżuru w przyjętym grafiku zgodnie z art. 130 § 3 i art. 154² § 1 KP, w tym w weekendy).
   - Dialog `RcpAbsenceConflictDialog.tsx` musi zyskać przyciski akcji (1-Click Resolve: zamiana na dyżur operacyjny/wsparcie, podział zmiany).
   - Silnik `TorEngine` musi rozdzielić flagę `isRcpFromActuals` na poziom per-pracownik i nie podstawiać po cichu godzin z planu w zamkniętych miesiącach.
   - Należy wyeliminować twardo zakodowane kody lokali ('18120', '384') na rzecz dynamicznego `unit_code`.

## 5. Verification Method
- **Inspekcja plików źródłowych**:
  - `src/modules/managers-schedule/services/torEngine.ts`: linie 108–165.
  - `src/modules/managers-schedule/components/TorView.tsx`: linie 301–445.
  - `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx`: linie 140–158.
  - `electron/main.ts`: linie 1034–1129.
  - `electron/importer/universalReportParser.ts`: linie 563–572, 873–886.
- **Komenda weryfikacji kompilacji**: `npm run build` (potwierdza czystość typowania TypeScript i kompilacji Vite bez modyfikacji plików źródłowych).
- **Raport główny**: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_r3/report_r3_tor_rcp.md`.
