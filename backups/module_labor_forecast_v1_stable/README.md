# Backup Modułu: TPLH Forecast & Labor Balancing (v1.0 Stable)

**Data utworzenia kopii**: 2026-09-11 22:42 CEST  
**Status**: Wersja stabilna, przetestowana, zoptymalizowana i zabezpieczona przed dalszymi zmianami.

---

## 📦 Zawartość Kopii Zapasowej

1. **`LaborLogViewerModal.tsx`**:
   - Podwójny widok: `Lista Zmian` oraz `Zestawienie Pracowników` (agregacja imienna z % udziałem w robociznie).
   - Dynamiczne filtrowanie (Stanowisko, Wymiar Etatu, Tydzień, Wyszukiwarka tekstowa).
   - Sprzętowo akcelerowany Sticky Header i Sticky Footer.
   - Interaktywne sortowanie wielokolumnowe (`▲`/`▼`).
   - Dwuarkuszowy eksport do formatu Excel `.xlsx`.

2. **`WeeklyScheduleTable.tsx`**:
   - Tabela harmonogramu tygodniowego W1–W5 z dedykowanymi przyciskami podglądu logowań (`👥 Miesiąc` w nagłówku i stopce `<tfoot>`, `👥` przy każdym tygodniu).
   - Edycja transakcji (Act TRX) i ułożonego grafiku (Scheduled Hours).
   - Automatyczne oznaczanie ról tygodni w cyklu poniedziałkowym (Bieżący w toku, Opublikowany W+1, Cel planowania W+2, Zamknięty).

3. **`calculationEngine.ts`**:
   - Silnik Trend Velocity MTD z pełną świadomością stanów temporalnych (`past`, `current`, `future`).
   - Ochrona bezwzględna Floor Hours (32.0 h/dzień = 272.0 h/tydzień).
   - Automatyczne powiązanie transakcji rzeczywistych i TPLH dla miesięcy zamkniętych.

4. **`systemClock.ts`**:
   - Cichy zegar systemowy śledzący cykl poniedziałkowego planowania i relacje temporalne.

5. **`trendLearningEngine.ts`**:
   - Adaptacyjny silnik uczenia maszynowego analizujący profile sprzedażowe dni tygodnia i prognozujący odchylenia.

6. **`main.ts` & `db.ts`**:
   - Procedury IPC Electrona, indeks złożony `idx_labor_year_month` oraz bezpieczne zapytania SQL.

7. **`tplh_forecast.db`**:
   - Trwała baza danych SQLite zawierająca 16-letni kalendarz, dane AOP 2021–2036 oraz 1 676 rzeczywistych logowań MAPAL.

---

## 🔄 Przywrócenie z Kopii Zapasowej

W razie konieczności powrotu do tego stanu:
```bash
cp backups/module_labor_forecast_v1_stable/LaborLogViewerModal.tsx src/components/
cp backups/module_labor_forecast_v1_stable/WeeklyScheduleTable.tsx src/components/
cp backups/module_labor_forecast_v1_stable/calculationEngine.ts src/services/
cp backups/module_labor_forecast_v1_stable/systemClock.ts src/services/
cp backups/module_labor_forecast_v1_stable/trendLearningEngine.ts src/services/
cp backups/module_labor_forecast_v1_stable/db.ts electron/database/
cp backups/module_labor_forecast_v1_stable/main.ts electron/
cp backups/module_labor_forecast_v1_stable/tplh_forecast.db data/
```
