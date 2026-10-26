# Handoff Report: Store Manager Operational Workflow & UX Audit (Module 1: Labor Forecast)

**Agent:** `explorer_m3_ux` (Store Manager Operational Workflow & UX Auditor)  
**Parent Agent:** `03bbd3fb-1f39-425e-8127-f2a22610fd5f`  
**Date:** 2026-10-24  
**Type:** Hard Handoff (Investigation & Audit Complete)

---

## 1. Observation

1. **Osierocenie `OperationalAlert.tsx` i `KpiSummaryCards.tsx` w `LaborForecastView.tsx`:**
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx`:
     Komponenty `OperationalAlert` i `KpiSummaryCards` są zaimportowane w `src/modules/labor-forecast/index.ts` (wiersze 5 i 7) oraz opisane w `src/modules/labor-forecast/AGENTS.md` (wiersze 27, 29), jednak w pliku `LaborForecastView.tsx` **w ogóle nie występują w drzewie komponentów JSX**. Zostały zastąpione jednolinijkowym paskiem *Hero Bar* (wiersze 128–252).
2. **Zapis dobowych godzin baristów w `localStorage` zamiast SQLite:**
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/WeeklyScheduleTable.tsx` wiersze 63–79:
     ```typescript
     const [dailyBaristaHours, setDailyBaristaHours] = useState<Record<string, number>>(() => {
       try {
         const saved = localStorage.getItem('sbux_daily_barista_hours');
         return saved ? JSON.parse(saved) : {};
       } catch {
         return {};
       }
     });
     ```
     Klucz jest globalny i niespójny z multi-store (`${weekKey}_${day}`), brak prefiksu `storeId` oraz brak trwałego zapisu w bazie danych SQLite.
3. **Pozorny wybór strategii planowania (Fasada UI):**
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/TrendIntelligencePanel.tsx` wiersze 227–314 użytkownik klika warianty: `floor_safe`, `balanced`, `growth`.
   - W pliku `/Users/dawidapel/COL Tool/src/App.tsx` wiersz 461:
     `summary.trendLearning.activeStrategy = selectedStrategy;`
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/services/calculationEngine.ts`:
     Grep po haśle `selectedStrategy` zwraca zero wyników (`No results found`). Wartość `selectedStrategy` **nie jest przekazywana do funkcji kalkulacji `CalculationEngine.calculateMonthlySummary`**, ani nie wpływa na wartość `hanwRecommendation`, `nextWeekHanwFinal` czy `baristaHoursPool`.
4. **Niedostępny modal importu Fichajes w widoku:**
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx` wiersz 83:
     `const [isImportModalOpen, setIsImportModalOpen] = useState(false);`
     Oraz wiersze 392–401:
     `{isImportModalOpen && <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} ... />}`
   - W całym pliku `LaborForecastView.tsx` funkcja `setIsImportModalOpen(true)` **nie jest wywoływana w żadnym elemencie JSX (brak przycisku otwierającego)**.
5. **Twardo zakodowane wartości w `OperationalAlert.tsx`:**
   - Wiersz 202: `const plan = pubRow?.planHours || 372.1;` (statyczna liczba fallbacku).
   - Wiersz 245: `const targetBudget = nextWeekHanwFinal ?? targetRow?.planHours ?? 417.3;` (statyczna liczba fallbacku).
   - Wiersz 229: `MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h` (statyczny string tekstowy niezależny od faktycznej delty godzin).
6. **Ślepota silnika na cząstkowe dane w trakcie tygodnia (Mid-Week Blindness):**
   - W pliku `/Users/dawidapel/COL Tool/src/modules/labor-forecast/services/calculationEngine.ts` wiersze 902–911:
     `const closedRows = baseRows.filter((r) => r.isClosed);`
     Trwający tydzień (`isCurrentCalendarWeek`) posiada `isClosed = false` (chyba że jest to poniedziałek z Flash Forecast). Transakcje i godziny cząstkowe wprowadzone w środę/piątek nie trafiają do `closedRows` i nie aktualizują `trendVelocityMtd`, ani pozostałego budżetu miesiąca.

---

## 2. Logic Chain

1. **Od Obserwacji 1 do oceny doświadczenia Store Managera:**
   Store Manager wchodząc do Modułu 1 w poniedziałek nie widzi panelu `OperationalAlert`, który został zaprojektowany, by odpowiadać na dwa kluczowe pytania: (1) *"Czy muszę korygować opublikowany grafik od jutra?"* oraz (2) *"Ile godzin mogę przeznaczyć na nowy grafik W+2?"*. Zamiast tego SM widzi skompresowany pasek Hero Bar z 15 parametrami, co powoduje dezorientację operacyjną.
2. **Od Obserwacji 2 do ryzyka integralności danych i Multi-Store:**
   Zgodnie z wymaganiami projektu aplikacja ma obsługiwać 100+ niezależnych kawiarni. Przechowywanie dobowego planu baristów w `localStorage` pod kluczem bez `storeId` powoduje natychmiastowe wymieszanie danych pomiędzy lokalami przy przełączaniu kawiarni oraz bezpowrotną utratę planu przy czyszczeniu cache.
3. **Od Obserwacji 3 do obniżenia zaufania użytkownika:**
   Prezentowanie Store Managerowi trzech opcji planistycznych (Konserwatywna, Zrównoważona, Wzrostowa) z obietnicą zmiany rezerwy godzin (`hoursDelta`), podczas gdy silnik obliczeniowy całkowicie ignoruje ten wybór, stanowi dezinformację użytkownika (Dark Pattern w UX).
4. **Od Obserwacji 4 i 6 do problemu rytmu pracy w tygodniu:**
   Store Manager codziennie lub co kilka dni pobiera raporty z MAPAL. Brak przycisku importu bezpośrednio w module zmusza do szukania funkcji w menu globalnym. Co więcej, wprowadzenie cząstkowych danych w środę/czwartek nie daje żadnej odpowiedzi co do wpływu na weekend, zmuszając kierownika do ręcznych obliczeń poza systemem.

---

## 3. Caveats

- **Zakres audytu:** Analiza została przeprowadzona w trybie ściśle analitycznym (Read-Only) bez modyfikacji kodu produkcyjnego.
- **Rzeczywiste zachowanie na fizycznym ekranie:** Oceny ergonomii dla laptopa 13"–14" (rozdzielczość 1366x768 / 1440x900) oparto na inspekcji stylów Tailwind CSS, szerokości tabeli w DOM oraz standardowych parametrach skalowania DPI w systemach macOS/Windows na zapleczach kawiarni.
- **Zależności Modułu 2:** Weryfikacja mostu menedżerskiego opierała się na danych przekazywanych w typach `ManagerScheduleShift[]` i `shiftDefinitions[]`. Nie testowano bezpośredniej wydajności bazy SQLite przy jednoczesnym zapisie z obu modułów.

---

## 4. Conclusion

Moduł 1 posiada zaawansowane fundamenty matematyczne (koncepcja Floor 32h/d, Pula Flex, Most Przełomu Miesięcy, Flash Forecast), jednak pod względem **ergonomii operacyjnej, spójności UI oraz persystencji danych wykazuje istotne wady krytyczne**:
1. Podstawowe komponenty decyzyjne (`OperationalAlert`, `KpiSummaryCards`) są osierocone w kodzie i nie docierają do użytkownika.
2. Dobowy rozkład baristów nie jest trwale zabezpieczony w SQLite, stwarzając ryzyko utraty danych w trybie Multi-Store.
3. Wybór strategii AI w panelu trendów jest wyłącznie atrapą wizualną.
4. Tabela harmonogramu jest zbyt szeroka i brakuje jej zakotwiczonych nagłówków (`sticky`) oraz obsługi klawiatury dla szybkiego wprowadzania danych.

Pełny raport audytowy wraz ze szczegółową mapą drogową i specyfikacją ulepszeń został zapisany w pliku:  
`/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m3_ux/report_m3_ux.md`.

---

## 5. Verification Method

Aby niezależnie zweryfikować twierdzenia zawarte w raporcie:
1. **Weryfikacja osierocenia komponentów:**
   Uruchom wyszukiwanie w `LaborForecastView.tsx`:
   ```bash
   grep -n "OperationalAlert" "/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx"
   grep -n "KpiSummaryCards" "/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx"
   ```
   *Warunek potwierdzenia:* Brak wyników (komponenty nie są renderowane w widoku).
2. **Weryfikacja zapisu do `localStorage`:**
   Sprawdź plik `WeeklyScheduleTable.tsx`:
   ```bash
   grep -n "localStorage" "/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/WeeklyScheduleTable.tsx"
   ```
   *Warunek potwierdzenia:* Wystąpienie `localStorage.getItem('sbux_daily_barista_hours')`.
3. **Weryfikacja pozornego wyboru strategii:**
   Sprawdź wystąpienia `selectedStrategy` w silniku obliczeniowym:
   ```bash
   grep -n "selectedStrategy" "/Users/dawidapel/COL Tool/src/modules/labor-forecast/services/calculationEngine.ts"
   ```
   *Warunek potwierdzenia:* Brak wystąpień — silnik nie uwzględnia wybranej strategii.
4. **Weryfikacja niepodpiętego importu w widoku:**
   Sprawdź wywołania `setIsImportModalOpen(true)`:
   ```bash
   grep -n "setIsImportModalOpen(true)" "/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx"
   ```
   *Warunek potwierdzenia:* Brak wystąpień (brak przycisku aktywującego modal).
