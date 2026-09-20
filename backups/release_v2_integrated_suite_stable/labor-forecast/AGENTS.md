# AGENTS.md — Instrukcje Agenta dla Modułu 1: TPLH Forecast & Labor Balancing

Plik definiuje kontekst domenowy, algorytmy obliczeniowe, strukturę bazy danych oraz reguły biznesowe dla **Modułu 1: TPLH Forecast & Labor Balancing** (Starbucks Coffee Company).

---

## ☕ 1. Kontekst Domenowy i Biznesowy

- **Status modułu**: ✅ **v1.0 Stable** (zamknięty, zoptymalizowany, zarchiwizowany w `backups/module_labor_forecast_v1_stable/`).
- **Cel modułu**: Autonomiczne wsparcie Store Managera (SM) oraz District Managera (DM) w zarządzaniu robocizną (Labor Planning), prognozowaniu transakcji oraz bezpiecznym układaniu tygodniowych grafików.
- **Kawiarnia bazowa**: `108120 SBX Warszawa Janki` (Kod jednostki: `384`).
- **Horyzont czasowy**: 2021–2036 (16 lat, 192 miesiące AOP, 1 152 tygodnie biznesowe w cyklu wtorek–poniedziałek).
- **Złota reguła bezpieczeństwa Floor Hours**: **Floor = 32.0 h/dzień** (4 baristów/kierowników x 8h na zmianę). Dla pełnego 7-dniowego tygodnia daje to **Floor Hours = 272.0 h/tydzień** (Pn–Sob 40h/dzień = 5 zmian x 8h, Nd 32h/dzień = 4 zmiany x 8h). Grafik nie może spaść poniżej tej bariery bez autoryzacji DM.

---

## 📁 2. Struktura Plików Modułu (`src/modules/labor-forecast/`)

```
src/modules/labor-forecast/
├── components/
│   ├── AopManagerModal.tsx          # Modal edycji celów rocznych i miesięcznych AOP
│   ├── CrossMonthBridgeCard.tsx     # Karta przełomu miesięcy (Split-Week Bridge)
│   ├── FloorHoursModal.tsx          # Konfiguracja reguł Floor Hours per dzień tygodnia
│   ├── ImportModal.tsx              # Import raportów MAPAL Fichajes (.xls, .xlsx)
│   ├── KpiSummaryCards.tsx          # 4 główne kafelki KPI (AOP, RCP, Trend, Rekomendacja)
│   ├── LaborLogViewerModal.tsx      # Przeglądarka ewidencji logowań MAPAL z 2-arkuszowym eksportem Excel
│   ├── OperationalAlert.tsx         # Banery alertów operacyjnych i rekomendacji SM
│   ├── SettingsModal.tsx            # Ustawienia AOP (2021-2036) i reguły Non-Coverage (NC)
│   ├── TrendCharts.tsx              # Interaktywne wykresy Recharts (TRX, TPLH, Godziny)
│   ├── TrendIntelligencePanel.tsx   # Panel uczenia maszynowego trendów (AI Learning Engine)
│   └── WeeklyScheduleTable.tsx      # Główna tabela tygodniowa W1-W5 z rytmem poniedziałkowym
├── services/
│   ├── calculationEngine.ts         # Główny silnik obliczeniowy AOP, MTD i HANW
│   └── trendLearningEngine.ts       # Adaptacyjny silnik analizy trendów historycznych
├── index.ts                         # Barrel export modułu
├── AGENTS.md                        # Niniejsze instrukcje techniczne agenta
└── README.md                        # Dokumentacja użytkowa modułu
```

---

## 🧮 3. Kluczowe Algorytmy Obliczeniowe (`services/calculationEngine.ts`)

### Algorytm 1: Planowanie Bazowe AOP i Tygodniowe Rozbicie
1. Miesięczny budżet robocizny:
   $$\text{Budżet Godzin AOP} = \frac{\text{Plan TRX}}{\text{Cel TPLH AOP}}$$
2. Tygodnie biznesowe w danym miesiącu mają przypisane wagi dniowe $W_i = \text{day\_weight}$:
   $$\text{Plan TRX}_i = \text{round}(\text{Plan TRX} \times W_i), \quad \text{Plan Godziny}_i = \text{round}(\text{Budżet Godzin AOP} \times W_i, 1)$$

### Algorytm 2: Silnik Predykcyjny Trend Velocity (MTD) i Stany Temporalne
Klasyfikacja miesiąca wg zegara systemowego (`SystemClock.getMonthTemporalStatus`):
- **Miesiąc Przeszły (`past`)**:
  - Wszystkie tygodnie są zamknięte (`isClosed = true`, status `closed`).
  - Godziny rzeczywiste `actualHoursMtd` pobierane są wprost z zarejestrowanych logowań RCP z MAPAL (`labor_actuals_log`).
  - Rzeczywiste transakcje i TPLH pobierane są z karty wyników w `aop_plans` (`actual_trx`, `actual_tplh`) i proporcjonalnie przypisywane do tygodni wg wag dniowych.
- **Miesiąc Bieżący (`current`)**:
  - Tydzień uznaje się za zamknięty, gdy minął w czasie (`temporalStatus === 'past'`) i posiada zarejestrowane godziny RCP lub transakcje.
  - Trend sprzedaży MTD wyliczany z tygodni z zarejestrowanymi transakcjami:
    $$\text{Trend TRX MTD} = \frac{\sum_{i \in \text{Zamknięte}} \text{Actual TRX}_i}{\sum_{i \in \text{Zamknięte}} \text{Plan TRX}_i}$$
  - Całkowita prognoza sprzedaży:
    $$\text{Forecast Total TRX} = \sum_{i \in \text{Zamknięte}} \text{Actual TRX}_i + \sum_{j \in \text{Otwarte}} (\text{Plan TRX}_j \times \text{Trend TRX MTD})$$
- **Miesiąc Przyszły (`future`)**:
  - Wszystkie tygodnie są otwarte do planowania według AOP (`status: 'future'`).
  - Alert i karty KPI skupiają się na puli na dodatkowe zmiany (Surplus Hours) ponad Floor i godziny NC.

### Algorytm 3: Wypracowany Budżet (Earned Labor Budget) i HANW
1. Wypracowany budżet miesiąca:
   $$\text{Earned Labor Budget} = \frac{\text{Forecast Total TRX}}{\text{Cel TPLH AOP}}$$
2. Wpływ trendu na robociznę: $\Delta_{\text{Earned}} = \text{Earned Labor Budget} - \text{Budżet Godzin AOP}$.
3. Pozostały budżet do rozdysponowania na otwarte tygodnie:
   $$\text{Pozostały Budżet} = \text{Earned Labor Budget} - \sum_{i \in \text{Zamknięte}} \text{Actual Godziny}_i$$
4. Surowa rekomendacja na kolejny grafik (**HANW Raw**):
   $$\text{HANW Raw} = \text{Pozostały Budżet} \times \frac{W_{\text{kolejny}}}{\sum_{j \in \text{Otwarte}} W_j}$$

### Algorytm 4: Ochrona Bezwzględna Floor Hours
$$\text{HANW Final} = \max(\text{HANW Raw}, \text{Floor Hours})$$
- Jeśli $\text{HANW Raw} < \text{Floor Hours}$: Aplikacja aktywuje czerwony alert krytyczny (`🚨 KRYTYCZNY DEFICYT: Sprzedaż wymusza cięcia poniżej Floor Hours. Grafik zablokowany na poziomie 272.0 h. Wymagana akceptacja District Managera.`).

### Algorytm 5: Dwukierunkowa Integracja z Grafikiem Managerskim (Manager Labor Bridge)
W ramach integracji z Modułem 2 (Grafik Managerski), zaplanowane zmiany kierownicze zasilają Moduł 1 i determinują pulę robocizny dla baristów:
1. **Reguły Lokalizacyjne (SBX Janki 384)**:
   - Zmiany wsparcia na innych kawiarniach (`SAM`, `SPM`, `SUP`) są bezwzględnie wykluczane z czasu pracy lokalu 384 oraz obsady otwarć/zamknięć lokalu.
   - Absencje (`OFF`, `L4`, `H`) oraz dyspozycje (`M`, `Z`, `FULL`) nie generują godzin roboczych na sali.
2. **Kalkulator Puli Baristów (Remaining Barista Hours Pool)**:
   - Godziny rekomendowane lub zaplanowane zostają pomniejszone o zaplanowane godziny kierowników w danym tygodniu biznesowym:
     $$H_{\text{Barista Pool}} = \max(0, \text{Target Hours} - H_{\text{MGR Total}})$$
   - W kolumnie *Grafik (h)* widoczne jest czytelne rozbicie: `MGR: Xh` + `BAR: Yh` z interaktywnym asystentem dodawania godzin MGR.
3. **Weryfikator Dobowego Floor Hours (32h/dzień) i Obsady AM/PM**:
   - Sprawdzenie obsady kluczowych pozycji otwarcia (AM) i zamknięcia (PM) kawiarni dzień po dniu (`hasAm`, `hasPm`).
   - Obliczenie dobowego deficytu baristycznego do wymaganego minimum Floor Hours (32.0 h/dzień):
     $$\text{Floor Deficit} = \max(0, 32.0 - H_{\text{MGR Coverage}})$$
   - Inspekcja i wizualizacja w dedykowanym oknie `ManagerLaborBridgeModal`.
4. **Monitoring Budżetu Non-Coverage (NC)**:
   - Zestawienie zaplanowanych godzin kierowniczych NC (`NC`, `PRE`, `TAM`, `TPM`, `MEE`, `BT`) z regułami budżetowymi `nc_rules` (np. 32h/miesiąc).
   - Prezentacja odchyleń w banerze operacyjnym oraz podsumowaniu miesiąca.

---

## 👥 4. Ewidencja Logowań MAPAL Fichajes (`components/LaborLogViewerModal.tsx`)

- **Podwójny widok**:
  1. `📋 Lista Zmian`: szczegółowy wykaz wszystkich zarejestrowanych zmian.
  2. `👥 Zestawienie Pracowników`: zagregowana tabela per pracownik z liczbą zmian, sumą godzin, średnią długością zmiany oraz udziałem w robociznie (% Labor Share).
- **Sortowanie i Filtrowanie**: wielopoziomowe filtry kategorii, stanowisk, wymiaru etatu, tygodnia oraz wyszukiwarka tekstowa.
- **Eksport Excel**: dwuarkuszowy skoroszyt `.xlsx` z automatycznymi szerokościami kolumn i wierszami sumarycznymi.

---

## 🗄️ 5. Tabele SQLite Obsługujące Moduł 1
- `aop_plans`: plany miesięczne AOP (2021–2036).
- `calendar_weeks`: 1 152 tygodnie biznesowe z wagami dniowymi i Floor Hours.
- `labor_actuals_log`: fizyczne logowania RCP zaimportowane z MAPAL.
- `weekly_actual_trx`: rzeczywiste transakcje i ułożone grafiki SM.
- `floor_rules` & `nc_rules`: parametry bezpieczeństwa i zadania stałe.
- Indeksy: `idx_labor_week_key`, `idx_labor_date`, `idx_labor_year_month`, `idx_calendar_year_month`.
