# Handoff Report — explorer_m2_arch: Module 1 Architecture & Data Flow Audit

## 1. Observation
1. **Osierocony komponent `CrossMonthBridgeCard.tsx`**:
   - Ścieżka: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/CrossMonthBridgeCard.tsx` (linie 10–268).
   - Wyszukiwanie grep w `src/`:
     ```
     {"File":"/Users/dawidapel/COL Tool/src/modules/labor-forecast/index.ts","LineNumber":2,"LineContent":"export * from './components/CrossMonthBridgeCard';"}
     {"File":"/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/CrossMonthBridgeCard.tsx","LineNumber":10,"LineContent":"export const CrossMonthBridgeCard: React.FC<CrossMonthBridgeCardProps> = ({"}
     ```
     Komponent nie jest importowany ani renderowany w żadnym pliku JSX w aplikacji.
2. **Krytyczny błąd kontaminacji budżetu przy zapisie grafiku tygodnia cząstkowego**:
   - `WeeklyScheduleTable.tsx`, linie 851–853:
     `const targetBudget = isFullSplit && crossMonthBridge ? (crossMonthBridge.recommendedCombinedHours || crossMonthBridge.totalCombinedPlanHours) : ...;`
   - `WeeklyScheduleTable.tsx`, linie 157–159:
     `if (onSaveScheduledHours) { await onSaveScheduledHours(weekKey, Number(targetTotal.toFixed(1))); }`
   - `weekKey` to klucz wiersza bieżącego miesiąca (np. `2026_Wrzesień_W5`). 7-dniowa łączna suma (np. 272.0h) jest zapisywana bezpośrednio do `weekly_actual_trx` dla W5 Września (zamiast 2-dniowego planu ~80h), wywołując sztuczny deficyt +192h w zamykanym miesiącu.
3. **Złamanie multi-store w pamięci podręcznej baristów**:
   - `WeeklyScheduleTable.tsx`, linie 63–76:
     `const saved = localStorage.getItem('sbux_daily_barista_hours');`
     Zapis pod jednym globalnym kluczem bez identyfikatora kawiarni `storeId`.
4. **Twardo zakodowane filtry kawiarni 18120 w zapytaniach SQL**:
   - `electron/main.ts`, linia 530:
     `AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')`
   - `electron/main.ts`, linie 602, 799, 860 powielają ten sam sztywny filtr.
   - `electron/importer/mapalParser.ts`, linie 276, 301.
5. **Kwalifikacja szkoleń baristów T1–T10**:
   - `src/modules/labor-forecast/services/calculationEngine.ts`, linia 155:
     `const isNc = shiftDef?.is_nc === 1 || ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes(code);`
   - Kody `T1`..`T10` nie występują w `shift_definitions` ani na powyższej liście.
6. **Formuła puli baristów**:
   - `calculationEngine.ts`, linie 1136–1141:
     `const managerHours = Number((managerCoverageHours + managerNcHours).toFixed(1));`
     `const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));`
   - Odejmuje godziny Non-Coverage menedżerów od celu Coverage na sali.
7. **Brak memoizacji w kontrolerze głównym**:
   - `src/App.tsx`, linie 441–463:
     `CalculationEngine.calculateMonth(...)` jest wywoływany synchronicznie na każdym renderze komponentu `App` (825 linii).

## 2. Logic Chain
1. **Z obserwacji 1 i 2**: Dokumentacja projektowa (`AGENTS.md`) deklaruje istnienie mostu `CrossMonthBridgeCard`, ale w kodzie komponent jest osierocony, a jego zubożona kopia w `WeeklyScheduleTable.tsx` zapisuje 7-dniową sumę do 2-dniowego tygodnia cząstkowego. To dowodzi, że integracja przełomów miesięcy jest rozbita na poziomie modelu danych i persystencji.
2. **Z obserwacji 4**: Zapytanie SQL filtrujące rzeczywiste godziny pracy odrzuca wszystkie rekordy z `unit_code != '18120'`. W konsekwencji żadna inna kawiarnia w systemie nie otrzyma danych RCP, co uniemożliwia realizację wymagania R2 (skalowanie na 100+ lokali).
3. **Z obserwacji 3**: Ponieważ dobowe godziny baristów są przechowywane w globalnym `localStorage`, przełączenie kawiarni w `StoreSwitcherModal` powoduje załadowanie danych poprzedniej kawiarni, co stanowi wyciek danych między lokalami.
4. **Z obserwacji 5 i 6**: Zmiany szkoleniowe `T1`–`T10` nie są izolowane w Non-Coverage i trafiają do `dayCovH`. Jednocześnie godziny NC menedżerów pomniejszają `baristaHoursPool`. Te dwie anomalie matematyczne wzajemnie destabilizują bilans sali: godziny zaplecza menedżerów fałszywie redukują obsadę baru, a szkolenia baristów fałszywie liczą się jako obsada kasy.

## 3. Caveats
- Niniejszy audyt przeprowadzono w trybie ściśle analityczno-projektowym (Strict Design Mode / Read-Only). Nie wprowadzono żadnych zmian w kodzie produkcyjnym `src/` ani `electron/`.
- Repozytorium jest w stanie czystym (`git status` bez zmian w kodzie).
- Wydajność WebAssembly SQLite (`sql.js`) badano na podstawie analizy kodu źródłowego i logiki transakcyjnej, bez obciążeniowych testów fizycznych 100 baz równocześnie.

## 4. Conclusion
Moduł 1 posiada zaawansowane fundamenty matematyczne i bogatą logikę biznesową, lecz cierpi na 4 krytyczne wady architektoniczne (P0/P1):
1. **Sztuczne zafałszowanie budżetu AOP o +192h na przełomach miesięcy (Split-Week)** przez brak dwustronnego podziału zapisu godzin granicznych.
2. **Całkowita blokada skalowalności Multi-Store** przez sztywne filtry SQL `unit_code = '18120'` w `electron/main.ts` oraz globalny klucz `localStorage`.
3. **Zaburzenie ochrony Floor Hours** poprzez niewłaściwe odejmowanie Non-Coverage menedżerów oraz brak kwalifikacji szkoleń baristycznych `T1`–`T10`.
4. **Przeciążenie głównego wątku UI** w `App.tsx` przez brak memoizacji `CalculationEngine.calculateMonth` i 11 równoległych wywołań IPC z destrukcyjnym `reloadFromDisk()`.

Wszystkie wady zostały szczegółowo opisane wraz ze specyfikacją techniczną (RFC) w dokumencie:  
`/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m2_arch/report_m2_arch.md`.

## 5. Verification Method
1. **Weryfikacja braku modyfikacji w repozytorium**:
   ```bash
   git status
   ```
   *Warunek sukcesu:* Brak jakichkolwiek zmodyfikowanych lub dodanych plików w `src/` i `electron/`.
2. **Weryfikacja osieroconego komponentu `CrossMonthBridgeCard`**:
   ```bash
   grep -rn "<CrossMonthBridgeCard" src/
   ```
   *Wynik:* 0 wyników poza plikiem źródłowym `CrossMonthBridgeCard.tsx`.
3. **Weryfikacja sztywnych filtrów SQL 18120 w Electronie**:
   ```bash
   grep -rn "unit_code = '18120'" electron/
   ```
   *Wynik:* Linie 530, 602, 860 w `electron/main.ts` oraz w `electron/importer/mapalParser.ts`.
4. **Weryfikacja formuły Barista Pool**:
   Przegląd linii 1136–1141 w `src/modules/labor-forecast/services/calculationEngine.ts`.
