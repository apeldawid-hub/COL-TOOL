# Raport Audytu Architektury i Przepływu Danych Modułu 1: Labor Forecast
**Autor:** Architecture & Data Flow Auditor (`explorer_m2_arch`)  
**Data audytu:** 2026-10-24  
**Środowisko:** Starbucks Operations Suite — Tryb Audytu / Design Mode (Strict Read-Only)  
**Kawiarnia referencyjna:** `108120 SBX Warszawa Janki` (Unit Code: `18120` / `384`)  
**Status modułu:** v1.0 Stable (Audyt architektury i gotowości na skalę 100+ lokali)

---

## Executive Summary (Podsumowanie Audytu)

Niniejszy raport stanowi wyczerpujący audyt architektoniczny, strukturalny oraz integracyjny **Modułu 1: TPLH Forecast & Labor Balancing** (`src/modules/labor-forecast/`). Audyt przeprowadzono w oparciu o autorytatywne wymagania użytkownika z dnia 2026-10-24T00:24:38Z oraz wymagania nadrzędne platformy (eliminacja mocków, skalowalność na 100+ kawiarni, nienaruszalność bazy SQLite i standardy Floor Hours 32.0h/dzień).

### Główne Wnioski i Zidentyfikowane Zagrożenia:
1. **Osierocony Komponent `CrossMonthBridgeCard.tsx` (P1)**: Komponent dedykowany do prezentacji scalonego przełomu miesięcy istnieje w kodzie i jest eksportowany, ale **nie jest renderowany w żadnym widoku aplikacji** (`<CrossMonthBridgeCard` występuje 0 razy w drzewie JSX).
2. **Krytyczny Błąd Kontaminacji Budżetu na Przełomie Miesięcy (P0)**: W zaimplementowanej w `WeeklyScheduleTable.tsx` tabeli rozbicia dni tygodnia cząstkowego (Split-Week), zapisanie ułożonego grafiku dla tygodnia granicznego (np. W5 Września: 29–30.09) zapisuje 7-dniową sumę (np. 272.0 h) bezpośrednio do klucza tygodnia bieżącego miesiąca (`2026_Wrzesień_W5`). Powoduje to natychmiastowe zafałszowanie miesięcznego P&L AOP o **+192h fikcyjnego przekroczenia budżetu** w miesiącu zamykanym oraz podwójne zliczenie robocizny w kolejnym miesiącu.
3. **Złamanie Izolacji Bazy Baristów w Multi-Store (P0)**: Dobowe godziny baristów (`dailyBaristaHours`) zapisywane są w przeglądarce pod pojedynczym, globalnym kluczem `localStorage.getItem('sbux_daily_barista_hours')`. Przełączenie kawiarni w `StoreSwitcherModal` powoduje natychmiastowy wyciek danych grafiku między lokalami!
4. **Twardo Zakodowane Filtry SQL Lokalu 18120 (P0)**: W `electron/main.ts` (linie 530, 602, 799, 860) zapytania SQL do tabeli `labor_actuals_log` posiadają na sztywno wpisany warunek: `WHERE ... AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%'...)`. Jakakolwiek nowa kawiarnia (np. 18155) otrzymuje **0.0 godzin rzeczywistych RCP**, co uniemożliwia wdrożenie multi-store.
5. **Wyciek Szkoleń Baristów T1–T10 do Obsady Coverage (P1)**: Zmiany szkoleniowe baristów (`T1`–`T10`) z Modułu 3 nie występują w `shift_definitions` Modułu 2 ani w sztywnej liście `calculationEngine.ts`. W efekcie silnik kwalifikuje je jako godziny operacyjne Coverage (`dayCovH`), co obniża dobowy Floor Deficit i redukuje pulę baristów na barze, wbrew standardom Starbucks.
6. **Błędne Odejjmowanie Non-Coverage Menedżerów od Puli Baristów (P1)**: Formuła `baristaHoursPool = max(0, Target - managerHours)` odejmuje `managerCoverageHours + managerNcHours`. Odejmując godziny administracyjne/szkoleniowe menedżerów od minimalnego flooru, system generuje deficyt obsady fizycznej na barze.
7. **Antywzorzec "God Component" w `App.tsx` & Brak Memoizacji (P2)**: `App.tsx` (825 linii) wykonuje synchronicznie `CalculationEngine.calculateMonth` na **każdym renderze Reacta** (brak `useMemo`), a dane pobierane są przez 11 osobnych wywołań IPC, z których 3 współbieżnie wywołują destrukcyjny `dbManager.reloadFromDisk()`.
8. **Ścisłe Sprzężenie Międzymodułowe (P2)**: Moduł 1 importuje funkcję kalendarza handlowego `getPolishTradingSundays` bezpośrednio z wewnętrznego silnika Modułu 2 (`src/modules/managers-schedule/services/managerScheduleEngine.ts`).

---

## 1. Struktura Modułu 1 (`src/modules/labor-forecast/`)

### 1.1. Inwentaryzacja Plików i Komponentów
```
src/modules/labor-forecast/
├── components/
│   ├── AopManagerModal.tsx          # Modal edycji celów rocznych i miesięcznych AOP (2021-2036)
│   ├── CrossMonthBridgeCard.tsx     # ⚠️ OS Sierocony: karta przełomu miesięcy (brak użycia w JSX)
│   ├── FloorHoursModal.tsx          # Konfiguracja Floor Hours per dzień tygodnia
│   ├── ImportModal.tsx              # Import raportów MAPAL Fichajes i AOP P&L
│   ├── KpiSummaryCards.tsx          # Kafelki KPI (Plan AOP, MTD Velocity, Rekomendacja HANW)
│   ├── LaborForecastView.tsx        # Główny kontener widoku Modułu 1 (prezentacyjny)
│   ├── LaborForecastWidget.tsx      # Pływający Speed-Dial Widget (szybkie akcje i nawigacja)
│   ├── LaborLogViewerModal.tsx      # Przeglądarka ewidencji logowań RCP z eksportem Excel
│   ├── ManagerLaborBridgeModal.tsx  # Modal inspekcji obsady kierowniczej i bilansu Floor
│   ├── MondayProjectionModal.tsx    # Modal edycji predykcji poniedziałkowej (Flash Forecast)
│   ├── OperationalAlert.tsx         # Banery alertów i rekomendacji operacyjnych Store Managera
│   ├── SettingsModal.tsx            # Ustawienia celów AOP, budżetu Non-Coverage (NC) i bazy
│   ├── TrendCharts.tsx              # Wykresy Recharts (TRX, Robocizna, TPLH)
│   ├── TrendIntelligencePanel.tsx   # Panel uczenia maszynowego trendów (AI Learning Engine)
│   └── WeeklyScheduleTable.tsx      # Główna interaktywna tabela tygodniowa W1-W5
├── services/
│   ├── calculationEngine.ts         # Silnik obliczeniowy AOP, MTD, HANW, Flex i Bridge (1621 linii)
│   └── trendLearningEngine.ts       # Silnik uczenia trendów z wieloletniej historii (525 linii)
├── index.ts                         # Barrel export modułu
├── AGENTS.md                        # Dokumentacja algorytmów i standardów technicznych
└── README.md                        # Podręcznik użytkownika
```

### 1.2. Architektura Przepływu Stanu i Braki Abstrakcji
- **Brak Dedykowanego Hooka / Kontekstu:** Moduł 1 nie posiada własnego hooka (np. `useLaborForecast(year, month)`) ani dostawcy stanu (`LaborForecastContext`).
- **Zależność od `App.tsx`:** Całość danych wejściowych jest ładowana w `src/App.tsx` (linie 225–298) i przekazywana do `LaborForecastView` poprzez 20 oddzielnych propsów.
- **Brak Memoizacji Obliczeń (`src/App.tsx:441`):**
  ```typescript
  // src/App.tsx, linie 441-459
  let summary: MonthlyCalculationSummary | null = null;
  if (aopPlan && weeks.length > 0) {
    summary = CalculationEngine.calculateMonth(
      aopPlan,
      weeks,
      weeklyTrxMap,
      actualHoursMap,
      scheduledHoursMap,
      targetWeekKeyOverride,
      historicalPlans,
      ncRules,
      dayOfWeekStats,
      managerShifts,
      shiftDefinitions,
      managerEmployees,
      dailyKpiMap,
      dailyActualHoursMap
    );
  ```
  `CalculationEngine.calculateMonth` wykonuje skomplikowane algorytmy (agregacja historii 192 miesięcy, analiza 7-dniowych siatek, pętle po setkach zmian menedżerskich). Wykonywanie tego synchronicznie przy każdym renderze `App.tsx` (np. przy zwijaniu paska bocznego `isSidebarCollapsed`, otwarciu okna błędów czy zmianie zakładki ustawień) powoduje niepotrzebny narzut procesora i zacięcia interfejsu.

---

## 2. Audyt Mostu Przełomu Miesięcy (Cross-Month Split-Week Bridge)

### 2.1. Status Komponentu `CrossMonthBridgeCard.tsx`
Komponent `CrossMonthBridgeCard.tsx` (268 linii) został zaprojektowany jako elegancka, dwukolumnowa wizualizacja scalająca dwa niepełne tygodnie kalendarzowe (np. W5 Września: 29–30.09 i W1 Października: 01–05.10) z graficznym łącznikiem, wskaźnikiem łącznego Flooru (224.0h) oraz dobową siatką obsady AM/PM.

**Obserwacja z audytu:**
Wyszukiwanie w całym kodzie źródłowym (`src/`):
```bash
grep -rn "<CrossMonthBridgeCard" src/
# Wynik: 0 wystąpień poza samą deklaracją w CrossMonthBridgeCard.tsx!
```
Komponent ten jest **całkowicie osierocony**. Zamiast niego, w `WeeklyScheduleTable.tsx` zduplikowano część logiki mostu w postaci rozwijanego wiersza tabeli (linie 850–920).

### 2.2. Algorytm Partycjonowania Dni i Godzin (Trailing vs Leading)
W `calculationEngine.ts` (linie 1351–1619) zaimplementowano funkcję `calculateCrossMonthBridge`:
- **Typ `trailing` (koniec miesiąca, np. W5 Września):**
  - Część 1 (bieżąca): `lastRow` (np. 2 dni: 29.09–30.09). `calculatedFloorHours = 64.0h`.
  - Część 2 (sąsiednia): pierwsze dni kolejnego miesiąca (np. 5 dni: 01.10–05.10). `nextFloorHours = 224.0 - 64.0 = 160.0h`.
- **Typ `leading` (początek miesiąca, np. W1 Października):**
  - Część 1 (bieżąca): `firstRow` (np. 5 dni: 01.10–05.10). `calculatedFloorHours = 160.0h`.
  - Część 2 (sąsiednia): ostatnie dni poprzedniego miesiąca (np. 2 dni: 29.09–30.09). `prevFloorHours = 224.0 - 160.0 = 64.0h`.

### 2.3. Wykryte Błędy w Algorytmie Bridge:

#### Błąd 1 (KRYTYCZNY - P0): Kontaminacja Budżetu Miesięcznego przy Zapisie Grafiku
W `WeeklyScheduleTable.tsx` (linie 850–918 oraz 150–160):
1. Gdy wiersz przełomu jest rozwinięty (`isFullSplit = true`), jako budżet docelowy tygodnia przyjmowana jest **łączna suma 7 dni**:
   ```typescript
   // WeeklyScheduleTable.tsx:851-853
   const targetBudget = isFullSplit && crossMonthBridge
     ? (crossMonthBridge.recommendedCombinedHours || crossMonthBridge.totalCombinedPlanHours)
     : ...; // np. 272.0 h dla całych 7 dni
   ```
2. Gdy Store Manager użyje przycisku *"Rozdziel wg Trendu AI"* (`handleDistributeByTrend`) lub *"Po równo"* (`handleDistributeEvenly`), funkcja wywołuje:
   ```typescript
   // WeeklyScheduleTable.tsx:158
   await onSaveScheduledHours(weekKey, Number(targetTotal.toFixed(1))); // targetTotal = 272.0 h
   ```
3. Parametr `weekKey` to klucz wiersza bieżącego miesiąca, np. `2026_Wrzesień_W5`!
4. Wartość 272.0 h zostaje zapisana w bazie SQLite do `weekly_actual_trx` pod kluczem `2026_Wrzesień_W5`.
5. **Skutek w P&L AOP Września:**
   - Plan AOP Września dla W5 przewidywał **80.0h** (dla 2 dni).
   - Wpisanie 272.0h powoduje, że wrzesień wykazuje **+192h przekroczenia budżetu**!
   - Co gorsza, w Październiku dla `2026_Październik_W1` (5 dni) wciąż figuruje plan 192.0h. Te same 5 dni zostają podwójnie obciążone w budżecie firmy!

#### Błąd 2 (P2): Szacowanie Planu Sąsiedniego Miesiąca bez Odczytu Realnego AOP
W `calculationEngine.ts` (linie 1394–1396 oraz 1512–1514):
```typescript
const nextPlanHours = Number(
  ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
) || nextFloorHours;
```
Plan robocizny sąsiedniego miesiąca jest **estymowany poprzez liniowe skalowanie planu bieżącego miesiąca**, zamiast bezpośredniego pobrania planu AOP z tabeli `aop_plans` dla sąsiedniego miesiąca. Jeśli w październiku popyt AOP rośnie o 20%, estymacja w moście wrześniowym tego nie uwzględnia.

#### Błąd 3 (P1): Zapis Dystrybucji Dobowej w `localStorage` bez Separacji Kawiarni
W `WeeklyScheduleTable.tsx` (linie 63–79):
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
- Klucz w `localStorage` jest globalny (`'sbux_daily_barista_hours'`).
- Nie zawiera ID sklepu (`storeId`).
- Nie jest zapisywany w bazie SQLite! Jeśli Store Manager przesiądzie się na inny komputer lub zsynchronizuje dane z chmurą, dobowy rozkład baristów zostanie utracony.

---

## 3. Audyt Integracji z Modułem 2: Managers Schedule (Manager Labor Bridge)

### 3.1. Mechanizm Ingestii Danych
Moduł 1 pobiera dane grafiku kierowniczego za pośrednictwem IPC Electrona:
- Kanał: `ipcRenderer.invoke('db:get-manager-schedule-data', year, monthNum)`
- Implementacja: `electron/main.ts` (linie 881–1031).
- W `App.tsx` (linie 286–291) zmiany z 3 miesięcy są spłaszczane do jednej tablicy:
  ```typescript
  const allShifts: ManagerScheduleShift[] = [
    ...(mgrData.boundaryShifts?.prevMonthShifts || []),
    ...(mgrData.shifts || []),
    ...(mgrData.boundaryShifts?.nextMonthShifts || []),
  ];
  setManagerShifts(allShifts);
  ```

### 3.2. Weryfikacja Logiki Filtrowania Zmian Menedżerskich
W `calculationEngine.ts` (linie 143–150):
```typescript
for (const s of dayShifts) {
  const code = s.shift_code;
  if (!code || ['OFF', 'L4', 'H', 'SAM', 'SPM', 'SUP', 'M', 'Z', 'FULL'].includes(code)) {
    continue;
  }
  if (s.hours <= 0) continue;
```
**Ocena weryfikacji:**
- ✅ **Zmiany wsparcia obcych lokali (`SAM`, `SPM`, `SUP`)**: Są poprawnie odrzucane i nie zasilają obsady otwarć/zamknięć lokalu bazowego.
- ✅ **Absencje (`OFF`, `L4`, `H`) oraz dyspozycje (`M`, `Z`, `FULL`)**: Są poprawnie pomijane (`continue`).
- ⚠️ **Kruchość architektoniczna (P2):** Pominięcie bazuje na **sztywno zaszytej liście stringów**, zamiast weryfikacji atrybutu domenowego `shiftDef.is_absence === 1`. W przypadku dodania nowego kodu absencji w Module 2 (np. `UW` - urlop na żądanie, `UO` - okolicznościowy, `K` - krwiodawstwo, `NN`), kod ten nie zostanie odrzucony i niesłusznie wejdzie do godzin pracy!

### 3.3. Weryfikacja Izolacji Budżetu Szkoleń (Non-Coverage) i Barista Pool

#### Błąd 1 (KRYTYCZNY - P1): Brak Obsługi Szkoleń Baristów T1–T10 z Modułu 3
W `calculationEngine.ts` (linia 154–156):
```typescript
const isNc =
  shiftDef?.is_nc === 1 || ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes(code);
```
- Moduł 3 (Szkolenia) operuje na 10 certyfikowanych modułach baristycznych: `T1` do `T10`.
- W `DEFAULT_SHIFT_DEFINITIONS` (`src/modules/managers-schedule/constants/defaultShifts.ts`) kody `T1`..`T10` w ogóle nie istnieją (zdefiniowano tylko ogólne `T`, `TAM`, `TPM`).
- Jeśli Store Manager zaplanuje na grafiku szkolenie baristy `T1`–`T10`:
  1. `shiftDef` zwróci `undefined`.
  2. Tablica `['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT']` zwróci `false`.
  3. Zmiana wejdzie do `dayCovH += s.hours` (zostanie potraktowana jako obsada Coverage!).
  4. Jest to **bezpośrednie złamanie nienaruszalnego standardu Starbucks** (AGENTS.md, pkt 1.3: *"Zmiany szkoleniowe baristów (T1–T10) są w 100% rozliczane w budżecie Non-Coverage (NC Training) i nie pomniejszają bazy Floor Hours 32h"*).

#### Błąd 2 (P1): Błędna Formuła Puli Baristów (Barista Pool Starvation)
W `calculationEngine.ts` (linie 1136–1141):
```typescript
const managerCoverageHours = Number(weekManagerCoverageHours.toFixed(1));
const managerNcHours = Number(weekManagerNcHours.toFixed(1));
const managerHours = Number((managerCoverageHours + managerNcHours).toFixed(1));
const weekTargetBudget = ...; // np. 224.0 h (Floor)

const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));
```
**Analiza matematyczna błędu:**
- Cel minimalny Floor Hours na sali wynosi **224.0 h/tydzień** (32.0h/dobę: 2 osoby rano + 2 osoby wieczorem).
- Na sali fizycznie pracują menedżerowie na zmianach Coverage (`managerCoverageHours`) oraz barisci (`baristaHoursPool`).
- Zmiany Non-Coverage menedżera (`managerNcHours`, np. administracja `NC` 8h) odbywają się na zapleczu i **nie stanowią obsady sali**.
- Jeśli menedżer ma w tygodniu 32h Coverage + 8h NC, to `managerHours = 40.0h`.
- Formuła wylicza:
  $$H_{\text{Barista Pool}} = 224.0 - 40.0 = 184.0\,\text{h}$$
- Łączna obsada sali w tygodniu wyniesie:
  $$H_{\text{Sala}} = H_{\text{MGR Coverage}} + H_{\text{Barista Pool}} = 32.0 + 184.0 = 216.0\,\text{h}$$
- **Wynik:** Na sali brakuje 8 godzin roboczych do bezpiecznego otwarcia/zamknięcia kawiarni ($216.0 < 224.0$)! Godziny zaplecza menedżera "zjadły" obsadę baristów na barze!
- **Prawidłowa formuła:**
  $$H_{\text{Barista Pool (Floor)}} = \max(0, H_{\text{Target Coverage}} - H_{\text{MGR Coverage}})$$

---

## 4. Efektywność Bazy Danych SQLite, Stan React i Multi-Store Isolation

### 4.1. Zapytania do SQLite i Naruszenia Wydajności

#### Zagrożenie 1 (P1): Concurrency Hazard przy `reloadFromDisk()` w `sql.js`
W `electron/database/db.ts` (linie 151–160):
```typescript
public reloadFromDisk(): Database {
  const fileBuffer = fs.readFileSync(this.dbFilePath);
  if (this.db) {
    try {
      this.db.close();
    } catch (_) {}
  }
  this.db = new this.SQL.Database(fileBuffer);
  this.createSchema();
  return this.db!;
}
```
W `App.tsx` (linie 230–258) w `Promise.all` jednocześnie wywoływane są:
- `getAopPlan` -> wywołuje `dbManager.reloadFromDisk()`
- `getWeeklyScheduledHoursMap` -> wywołuje `dbManager.reloadFromDisk()`
- `getManagerScheduleData` -> wywołuje `dbManager.reloadFromDisk()`
Wszystkie trzy procedury asynchronicznie zamykają instancję WebAssembly bazy danych i tworzą ją na nowo, wykonując pełne `createSchema()`. Może to doprowadzić do zablokowania lub unieważnienia wskaźników pamięci WebAssembly podczas wykonywania równoległych zapytań `prepare()`.

#### Zagrożenie 2 (P2): Brak Indeksacji i Wyszukiwanie z Wildcardem z Lewej Strony
W `electron/main.ts` (linie 591–605, pobieranie `daily_actual_hours_map`):
```sql
SELECT date, SUM(computable_time) as total_hours
FROM labor_actuals_log
WHERE (date LIKE ? OR date LIKE ?)
  AND computable_time > 0
...
```
Gdzie parametr `dotPattern` ma postać `%.${month}.${year}%`. Znak `%` na początku ciągu znaków uniemożliwia wykorzystanie indeksu B-drzewa `idx_labor_date` i zmusza silnik SQLite do pełnego skanowania tabeli (*Full Table Scan*).

### 4.2. Naruszenia Multi-Store Isolation (Wymóg R2: 100+ Lokali)
W całym kodzie Modułu 1 i jego integracji z Electronem zidentyfikowano krytyczne twarde zależności od lokalu `108120 Janki` (`18120` / `384`):

| Plik | Linia | Zidentyfikowany Kod / Tekst | Skutek dla Multi-Store |
| :--- | :--- | :--- | :--- |
| `electron/main.ts` | 530 | `AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%'...)` | Całkowity brak godzin RCP dla kawiarni innej niż Janki. |
| `electron/main.ts` | 602 | `AND (unit_code = '18120' OR unit_code = '384'...)` | Brak dobowych godzin RCP dla kawiarni obcych. |
| `electron/main.ts` | 799 | `WHERE store_code = '18120' OR store_code = '384'` | Aktualizacja Floor Hours zawsze modyfikuje lokal 18120. |
| `electron/importer/mapalParser.ts` | 276, 301 | `WHERE (unit_code = '18120' OR unit_code = '384'...)` | Usuwanie i import ograniczone na sztywno do 18120. |
| `electron/database/db.ts` | 179 | `const isJanki = storeId === '108120_janki' \|\| storeInfo?.unitCode === '18120';` | Wyjątek w nazwie pliku bazy danych (`tplh_forecast.db`). |
| `WeeklyScheduleTable.tsx` | 65 | `localStorage.getItem('sbux_daily_barista_hours')` | Współdzielenie rozkładu dobowego baristów między sklepami. |
| `ManagerLaborBridgeModal.tsx` | 516 | `"Godziny dyżurów kierowniczych w lokalu Janki (18120)..."` | Błędny tekst w UI dla Store Managerów innych kawiarni. |
| `ImportModal.tsx` | 259 | `const isJanki = r.unit_code === '18120' \|\| ...` | Sztywna logika weryfikacji raportu w UI. |

---

## 5. Sprzężenia Międzymodułowe i Brakujące Abstrakcje

### 5.1. Bezpośredni Import z Wnętrza Modułu 2
W `src/modules/labor-forecast/services/calculationEngine.ts` (linia 20) oraz `trendLearningEngine.ts` (linia 10):
```typescript
import { getPolishTradingSundays } from '../../managers-schedule/services/managerScheduleEngine';
```
- Moduł 1 importuje funkcję pomocniczą z prywatnego pliku serwisu Modułu 2.
- Narusza to zasadę modularności.
- **Rekomendacja:** Przeniesienie kalendarza niedziel handlowych i świąt do wspólnego pakietu domenowego: `src/shared/domain/calendar/polishTradingCalendar.ts`.

### 5.2. Brak Sztywno Otypowanego DTO Bridge pomiędzy Modułami
Obecnie Moduł 1 przetwarza surowe rekordy bazy danych `ManagerScheduleShift[]`, `ShiftDefinition[]`, `ManagerEmployee[]`. Moduł 1 musi "wiedzieć", jak interpretować kody zmian (`AM`, `PM`, `AMN`, `PMN`, `NC`), co prowadzi do powielania logiki kwalifikacji zmian.
Wymagany jest dedykowany kontrakt:
```typescript
export interface ManagerCoverageBridgeDTO {
  storeId: string;
  year: number;
  month: number;
  dailyCoverage: Array<{
    date: string;
    dayOfWeek: string;
    hasAmOpening: boolean;
    hasPmClosing: boolean;
    coverageHours: number;
    ncHours: number;
    floorDeficitHours: number;
    assignedManagerNames: string[];
  }>;
  totalCoverageHours: number;
  totalNcHours: number;
}
```

---

## 6. Priorytetyzowany Katalog Rekomendacji i RFC

### 6.1. Szybkie Wygrane (Quick Wins — Priorytet P0/P1)
1. **Dynamiczny Unit Code w SQL (`electron/main.ts`):** Zastąpić sztywne `'18120'` parametrem `currentStore.unitCode` przekazywanym z aktywnego profilu kawiarni.
2. **Korekta Formuły Puli Baristów:** W `calculationEngine.ts:1141` zmienić bazę odejmowania: odejmować wyłącznie `managerCoverageHours`, a nie `managerHours` (które zawierało NC).
3. **Kwalifikacja Szkoleń `T1`–`T10`:** Dodać rozpoznawanie prefiksu `code.startsWith('T') && code.length <= 3` lub `is_nc === 1` w `calculateDaysManagerCoverage`.
4. **Separacja Klucza `localStorage`:** Zmienić klucz zapisu godzin dobowych baristów na: `sbux_daily_barista_hours_${storeId}_${year}_${month}`.
5. **Usunięcie `CrossMonthBridgeCard` lub Przywrócenie w JSX:** Jeśli komponent ma być używany, wpiąć go w `LaborForecastView.tsx` nad `WeeklyScheduleTable`. Jeśli zastępuje go rozwijany wiersz w tabeli, usunąć martwy plik.

### 6.2. Średnioterminowe Refaktoryzacje Architektoniczne (P2)
1. **Wdrożenie Hooka `useLaborForecast(year, month)`:** Odciążyć `App.tsx` z 13 stanów i 11 wywołań IPC, enkapsulując logikę w dedykowanym hooku z `useMemo`.
2. **Ekstrakcja `PolishTradingCalendar`:** Wydzielić algorytm niedziel handlowych z `managers-schedule` do `src/shared/services/calendar/`.
3. **Architektura Przełomu Miesięcy (RFC Split-Week):**
   - Przy zapisie grafiku tygodnia granicznego, automatycznie rozdzielać godziny:
     - Dni należące do miesiąca $M$ zapisywać do `${year}_${month}_W5`.
     - Dni należące do miesiąca $M+1$ zapisywać do `${nextYear}_${nextMonth}_W1`.
   - Eliminuje to natychmiast sztuczne przekroczenie budżetu we wrześniu (+192h).

### 6.3. Długofalowe Innowacje (P3)
1. **Przejście z `sql.js` (RAM) na `better-sqlite3` z fizycznymi blokadami:** Wyeliminuje to całkowicie konieczność wywoływania destrukcyjnego `dbManager.reloadFromDisk()` i zapobiegnie wyciekom pamięci.
2. **Web Worker dla Obliczeń Trendów:** Oddelegowanie wieloletniej analizy trendów `TrendLearningEngine` do wątku w tle (Web Worker), aby interfejs użytkownika pozostawał w 100% responsywny (60 FPS).
