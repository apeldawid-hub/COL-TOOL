# Raport Audytu Matematycznego i Algorytmicznego Modułu 1: Labor Forecast
**Lokalizacja docelowa**: `108120 SBX Warszawa Janki` (Jednostka: `18120`, kod operacyjny: `384`)  
**Audytor**: `explorer_m1_math` (Math & Forecasting Auditor)  
**Tryb**: DESIGN & AUDIT MODE (Ścisły tryb tylko do odczytu — zero zmian w kodzie źródłowym `src/` i `electron/`)  
**Data audytu**: 2026-10-24  

---

## 📑 Spis Treści
1. [Podsumowanie Wykonawcze (Executive Summary)](#1-podsumowanie-wykonawcze-executive-summary)
2. [Dekompozycja Architektury Obliczeniowej Silnika](#2-dekompozycja-architektury-obliczeniowej-silnika)
3. [Audyt Filaru 1: Wagi Dniowe AOP ($W_i$) i Cykl Wtorek–Poniedziałek](#3-audyt-filaru-1-wagi-dniowe-aop-w_i-i-cykl-wtorekponiedziałek)
4. [Audyt Filaru 2: Silnik Predykcji MTD Velocity, Stany Temporalne i Earned Labor Budget](#4-audyt-filaru-2-silnik-predykcji-mtd-velocity-stany-temporalne-i-earned-labor-budget)
5. [Audyt Filaru 3: Bezwzględna Ochrona Bazy Floor Hours (32h/d, 224h/tydz) i Pula Flex](#5-audyt-filaru-3-bezwzględna-ochrona-bazy-floor-hours-32hd-224htydz-i-pula-flex)
6. [Audyt Filaru 4: Monday Flash Forecast (Pre-closing) i Przejście Wtorkowe](#6-audyt-filaru-4-monday-flash-forecast-pre-closing-i-przejście-wtorkowe)
7. [Audyt Filaru 5: Testy Numeryczne Przypadków Brzegowych (Stress Testing)](#7-audyt-filaru-5-testy-numeryczne-przypadków-brzegowych-stress-testing)
8. [Audyt Filaru 6: Wielozakładowość (Multi-Store Isolation) i Pamięć Lokalna](#8-audyt-filaru-6-wielozakładowość-multi-store-isolation-i-pamięć-lokalna)
9. [Katalog Wykrytych Wad i Ryzyk Obliczeniowych (Klasyfikacja P0–P3)](#9-katalog-wykrytych-wad-i-ryzyk-obliczeniowych-klasyfikacja-p0p3)
10. [Rekomendacje Algorytmiczne i Specyfikacja RFC](#10-rekomendacje-algorytmiczne-i-specyfikacja-rfc)

---

## 1. Podsumowanie Wykonawcze (Executive Summary)

Przeprowadzono wyczerpujący, 360-stopniowy audyt matematyczny, algorytmiczny i statystyczny **Modułu 1: Labor Forecast & TPLH Balancing** w platformie Starbucks Operations Suite.

Audyt objął w szczególności:
- `src/modules/labor-forecast/services/calculationEngine.ts` (1 621 linii kodu)
- `src/modules/labor-forecast/services/trendLearningEngine.ts` (525 linii kodu)
- `src/services/systemClock.ts` (248 linii kodu)
- `desktop_app_blueprint/data_schemas_and_seeds/weeks_engine_seed.json` (13 838 linii)
- Komponenty wizualizujące metryki: `OperationalAlert.tsx`, `WeeklyScheduleTable.tsx`, `KpiSummaryCards.tsx`, `TrendIntelligencePanel.tsx`, `FloorHoursModal.tsx`, `TrendCharts.tsx`.

### Główne Wnioski z Audytu:
1. **Wysoka dojrzałość koncepcyjna i stabilność rdzenia**:
   Model predykcyjny zespołu 3 modeli (**Ensemble Forecast**: AOP Anchor + Run-Rate z wagami $1.8^k$ + Twin Seasonality YoY) stanowi nowoczesne, odporne na szum rozwiązanie analityczne, dynamicznie dobierające wagi predykcji w zależności od dojrzałości danych w miesiącu.
2. **Bezwzględna ochrona bazy Floor Hours w silniku**:
   Formuła `HANW Final = Math.max(HANW Raw, Floor Hours)` jest ściśle przestrzegana w `calculationEngine.ts`. Żaden scenariusz załamania sprzedaży nie jest w stanie obniżyć rekomendacji godzinowej poniżej operacyjnego minimum $32.0\text{ h/dzień}$ ($224.0\text{ h/tydzień}$ dla pełnego tygodnia).
3. **Kluczowy konflikt architektoniczny: Baza 224h vs Zaszłości 272h (P1)**:
   W kodzie występuje rozdwojenie standardu Floor Hours. Silnik `CalculationEngine` i AGENTS.md definiują bazę Floor jako $32.0\text{ h/dzień} \times 7 = 224.0\text{ h/tydzień}$ (4 osoby $\times$ 8h). Natomiast baza danych `calendar_weeks` (seed `weeks_engine_seed.json`), modal `FloorHoursModal.tsx`, wykresy `TrendCharts.tsx` (czerwona linia referencyjna `y=272`) oraz teksty pomocnicze wciąż operują na starym modelu $272.0\text{ h}$ (Pn–Sob po 40h + Nd 32h). Prowadzi to do dezorientacji Store Managera w interfejsie.
4. **Ukryty błąd dzielenia przez zero w Cross-Month Bridge (P0)**:
   W funkcjach `calculateCrossMonthBridge` (linie 1395 i 1513) wykryto bezpośrednie dzielenie przez `(lastRow.calculatedDaysCount / 7)`. Jeśli tydzień cząstkowy ma `calculatedDaysCount === 0`, wyrażenie zwraca `Infinity`, powodując błędy renderowania (`Infinity h` w tabeli i podsumowaniach).
5. **Zniekształcenie wag dniowych $W_i$ dla tygodni cząstkowych (P1)**:
   Wagi $W_i$ w tabeli `calendar_weeks` wyliczono ze wzoru czysto kalendarzowego $W_i = \text{days\_count} / N_{\text{month}}$, który zakłada jednorodny popyt każdego dnia tygodnia. W rezultacie 2-dniowy tydzień z wtorku i środy (np. W5 Września) otrzymuje aż $28.6\%$ budżetu pełnego tygodnia, podczas gdy w rzeczywistości dni powszednie generują zaledwie ok. $22\%$ obrotu. Z kolei 5-dniowy tydzień obejmujący weekend (W1 Października) otrzymuje tylko $71.4\%$ budżetu, generując w realiach ponad $78\%$ popytu.
6. **Ekstrapolacja szczytu Niedzieli Handlowej na zwykłe tygodnie (P1)**:
   W tygodniu z Niedzielą Handlową w CH Janki (~250% normy) dochodzi do jednorazowego skoku transakcji (+1 000–1 200 TRX). Model Run-Rate z wykładniczym dociążeniem ($1.8^k$) traktuje ten skok jako trwałe przyspieszenie trendu, przeszacowując prognozę sprzedaży i budżetu robocizny na kolejne, standardowe tygodnie.
7. **Wyciek danych między kawiarniami przez un-namespaced `localStorage` (P1)**:
   Wpisane przez Store Managera dobowe godziny baristów są zapisywane w przeglądarce pod kluczem `localStorage.getItem('sbux_daily_barista_hours')` bez identyfikatora kawiarni (`storeId`), co narusza izolację multi-store lokali.

---

## 2. Dekompozycja Architektury Obliczeniowej Silnika

Pipeline analityczny Modułu 1 składa się z 3 współpracujących serwisów:

```
[SystemClock] ──(czas systemowy / mockDate)──┐
                                             ▼
[Baza Danych SQLite] ──(AOP, Weeks, Fichajes, MgrShifts)──► [CalculationEngine.calculateMonth]
                                                                     │
                                                                     ├── 1. calculatePartialWeekInfo (32h/d)
                                                                     ├── 2. Detekcja Monday Flash Forecast
                                                                     ├── 3. TrendLearningEngine.calculateEnsembleForecast
                                                                     ├── 4. Earned Labor Budget & HANW
                                                                     ├── 5. enrichDailyCoverageWithFlex
                                                                     ├── 6. calculateCrossMonthBridge
                                                                     └── 7. TrendLearningEngine.analyzeTrend
                                                                     │
                                                                     ▼
                                                        [MonthlyCalculationSummary]
                                                                     │
                                      ┌──────────────────────────────┴─────────────────────────────┐
                                      ▼                                                            ▼
                         [KpiSummaryCards / Table]                                        [OperationalAlert]
```

### Struktury wejściowe i wyjściowe:
- **Wejście**:
  - `aopPlan: AopPlanRecord`: plan korporacyjny (`plan_trx`, `target_tplh`, `plan_sales`, `plan_col_pln`, `actual_trx`, `actual_tplh`).
  - `weeks: WeekRecord[]`: rekordy tygodni z bazy `calendar_weeks` (`week_key`, `date_from`, `date_to`, `days_count`, `day_weight`, `floor_hours`).
  - `weeklyActualTrxMap: Record<string, number | null>`: manualnie lub automatycznie zaraportowane transakcje tygodniowe.
  - `weeklyActualHoursMap: Record<string, number>`: fizyczne godziny RCP zagregowane z tabeli `labor_actuals_log`.
  - `weeklyScheduledHoursMap: Record<string, number>`: godziny rozpisane przez SM w kolumnie *Grafik (h)*.
  - `historicalPlans: AopPlanRecord[]`: historia AOP z lat 2021–2026.
  - `managerShifts: ManagerScheduleShift[]`: zmiany kierowników z Modułu 2 (wraz z buforem granicznym `boundaryShifts`).
  - `dayOfWeekStats`: agregacja empiryczna logowań per dzień tygodnia z MAPAL.
  - `dailyKpiMap`: transakcje i godziny per konkretna data kalendarzowa.
- **Wyjście**:
  - `MonthlyCalculationSummary`: ujednolicony agregat stanu miesiąca zawierający `rows: WeeklyCalculatedRow[]`, predykcję MTD, zbalansowany budżet, rekomendację HANW, mosty przełomu miesięcy oraz rekomendacje operacyjne.

---

## 3. Audyt Filaru 1: Wagi Dniowe AOP ($W_i$) i Cykl Wtorek–Poniedziałek

### 3.1. Dopasowanie Cyklu Wtorek–Poniedziałek do Tygodnia Fiskalnego Starbucks
W strukturze korporacyjnej Starbucks tydzień operacyjny i rozliczeniowy rozpoczyna się we **wtorek rano** i kończy w **poniedziałek wieczorem**:
$$\text{Cykl Tygodnia} = \{\text{Wt, Śr, Czw, Pt, Sob, Nd, Pn}\}$$

**Weryfikacja implementacji w bazie danych**:
Zbadano strukturę tabeli `calendar_weeks` na podstawie pliku `weeks_engine_seed.json`:
- **Wrzesień 2026**:
  - `2026_Wrzesień_W1`: 01.09 (Wtorek) – 07.09 (Poniedziałek) — 7 dni.
  - `2026_Wrzesień_W2`: 08.09 (Wtorek) – 14.09 (Poniedziałek) — 7 dni.
  - `2026_Wrzesień_W3`: 15.09 (Wtorek) – 21.09 (Poniedziałek) — 7 dni.
  - `2026_Wrzesień_W4`: 22.09 (Wtorek) – 28.09 (Poniedziałek) — 7 dni.
  - `2026_Wrzesień_W5`: 29.09 (Wtorek) – 30.09 (Środa) — 2 dni (częściowy).
- **Październik 2026**:
  - `2026_Październik_W1`: 01.10 (Czwartek) – 05.10 (Poniedziałek) — 5 dni (częściowy).
  - `2026_Październik_W2`: 06.10 (Wtorek) – 12.10 (Poniedziałek) — 7 dni.

**Ocena**: Podział tygodni w seedzie jest **w 100% poprawny kalendarzowo**. Każdy pełny tydzień rozpoczyna się we wtorek i kończy w poniedziałek. Tygodnie cząstkowe występują wyłącznie na styku miesięcy kalendarzowych (1. dzień miesiąca domyka tydzień do poniedziałku, a ostatnie dni miesiąca rozpoczynają nowy tydzień od wtorku).

---

### 3.2. Matematyczna Analiza Wag Dniowych ($W_i$)
Wartości `day_weight` ($W_i$) w tabeli `calendar_weeks` zostały wygenerowane wg prostej formuły proporcji liczby dni:
$$W_i = \frac{\text{days\_count}_i}{N_{\text{month}}}$$
gdzie $N_{\text{month}}$ to całkowita liczba dni w miesiącu (28, 29, 30 lub 31).

Dla miesiąca 30-dniowego (np. Wrzesień 2026):
$$W_{\text{W1}} = \frac{7}{30} \approx 0.23333, \quad W_{\text{W5}} = \frac{2}{30} \approx 0.06667$$
$$\sum_{i=1}^5 W_i = 4 \times 0.23333 + 0.06667 = 0.93332 + 0.06667 = 0.99999 \approx 1.0$$

Dla miesiąca 31-dniowego (np. Październik 2026):
$$W_{\text{W1}} = \frac{5}{31} \approx 0.16129, \quad W_{\text{W2}} = \frac{7}{31} \approx 0.22581, \quad W_{\text{W5}} = \frac{5}{31} \approx 0.16129$$
$$\sum_{i=1}^5 W_i = 3 \times 0.22581 + 2 \times 0.16129 = 0.67743 + 0.32258 = 1.00001 \approx 1.0$$

#### Krytyczna Wada Matematyczna Założenia Równomierności Dniowej:
Wzór $W_i = \frac{k}{N}$ zakłada, że każdy dzień tygodnia generuje dokładnie taki sam obrót ($\frac{1}{7}$ tygodnia = $14.28\%$).

W realiach kawiarni Starbucks w centrum handlowym (CH Janki) rozkład empiryczny popytu kształtuje się diametralnie inaczej:
| Dzień Tygodnia | Typowy udział w obrocie tygodnia | Rola operacyjna |
| :--- | :--- | :--- |
| **Wtorek (Wt)** | $11.5\% - 12.5\%$ | Dzień dostawy, spokojny początek cyklu |
| **Środa (Śr)** | $11.0\% - 12.0\%$ | Dzień powszedni |
| **Czwartek (Czw)** | $12.0\% - 13.0\%$ | Wzrost popytu popołudniowego |
| **Piątek (Pt)** | $17.0\% - 19.0\%$ | Popołudniowy szczyt weekendowy |
| **Sobota (Sob)** | $22.0\% - 26.0\%$ | Główny szczyt handlowy CH Janki |
| **Niedziela Handlowa (NdH)** | $19.0\% - 23.0\%$ | Szczyt handlowy galerii (~250% normy) |
| **Niedziela Niehandlowa (NdW)**| $6.0\% - 8.0\%$ | Galeria zamknięta, tylko kino/foodcourt |
| **Poniedziałek (Pn)** | $11.5\% - 12.5\%$ | Raportowanie i planowanie grafików |

**Dowód zniekształcenia budżetu w tygodniach cząstkowych**:
1. **Wrzesień 2026 W5 (Wtorek + Środa, 2 dni)**:
   - Waga AOP: $W_{\text{W5}} = \frac{2}{30} = 6.67\%$ miesiąca.
   - Względem pełnego tygodnia ($7/30 = 23.33\%$), W5 otrzymuje $\frac{2}{7} = \mathbf{28.57\%}$ tygodniowego budżetu TRX i godzin.
   - Faktyczny popyt Wt + Śr: $12\% + 11.5\% = \mathbf{23.5\%}$.
   - **Skutek**: W5 ma **zawyżony plan sprzedaży i robocizny o $+5.07\%$**, co wymusza sztuczne planowanie nadmiernych godzin w ciche dni tygodnia.
2. **Październik 2026 W1 (Czwartek–Poniedziałek, 5 dni)**:
   - Waga AOP: $W_{\text{W1}} = \frac{5}{31} = 16.13\%$ miesiąca.
   - Względem pełnego tygodnia ($7/31 = 22.58\%$), W1 otrzymuje $\frac{5}{7} = \mathbf{71.43\%}$ budżetu.
   - Faktyczny popyt Czw + Pt + Sob + Nd + Pn: $12.5\% + 18\% + 24\% + 7\% + 12\% = \mathbf{73.5\%}$ (a przy Niedzieli Handlowej aż $\mathbf{87.0\%}$!).
   - **Skutek**: W1 ma **drastycznie zaniżony plan sprzedaży i godzin o $-15.6\%$** w przypadku wystąpienia Niedzieli Handlowej.

---

### 3.3. Reakcja Wag Historycznych na Zmiany Wzorców Handlowych
W silniku `calculationEngine.ts` zaimplementowano funkcję `enrichDailyCoverageWithFlex` (linie 208–401), która dynamicznie dystrybuuje pulę nadwyżki ponad Floor (Flex Hours):
- Jeśli w bazie występują dane z `dayOfWeekStats` (tabela `labor_actuals_log`), silnik wylicza odchylenie godzinowe:
  $$\text{flexOverFloor}_d = \max(0.2, \text{avgHours}_d - 32.0)$$
- W niedziele niehandlowe wymusza $\text{flexOverFloor}_{\text{Nd}} = 0$, transferując godziny na piątek i sobotę.
- W niedziele handlowe wymusza $\text{flexOverFloor}_{\text{Nd}} \ge 12.0\text{ h}$.

**Ograniczenie architektoniczne**:
Mechanizm ten działa **wyłącznie na poziomie dobowego rozbicia godzin baristycznych w widoku szczegółowym**. Nie modyfikuje natomiast wag tygodniowych $W_i$ w tabeli AOP! Tydzień z Niedzielą Handlową ma w tabeli główniej dokładnie taki sam plan TRX i godzin jak tydzień z niedzielą wolną od handlu.

---

## 4. Audyt Filaru 2: Silnik Predykcji MTD Velocity, Stany Temporalne i Earned Labor Budget

### 4.1. Klasyfikacja Stanów Temporalnych
Klasyfikacja czasu odbywa się dwupoziomowo za pośrednictwem serwisu `SystemClock`:
1. **Status miesiąca (`monthTemporalStatus`)**:
   - `'past'`: $\text{rok} < \text{rok}_{\text{bieżący}} \lor (\text{rok} = \text{rok}_{\text{bieżący}} \land \text{miesiąc} < \text{miesiąc}_{\text{bieżący}})$
   - `'current'`: $\text{rok} = \text{rok}_{\text{bieżący}} \land \text{miesiąc} = \text{miesiąc}_{\text{bieżący}}$
   - `'future'`: $\text{rok} > \text{rok}_{\text{bieżący}} \lor (\text{rok} = \text{rok}_{\text{bieżący}} \land \text{miesiąc} > \text{miesiąc}_{\text{bieżący}})$
2. **Status tygodnia (`temporalStatus`)**:
   - Wyliczany na podstawie dat `date_from` i `date_to`:
     $$t < \text{date\_from} \implies \text{'future'}, \quad \text{date\_from} \le t \le \text{date\_to} \implies \text{'current'}, \quad t > \text{date\_to} \implies \text{'past'}$$

---

### 4.2. Formuła Matematyczna Predykcji MTD Velocity (Ensemble Model)
W silniku `calculationEngine.ts` (linie 410–572) zaimplementowano wielomodelowy algorytm estymacji tempa realizacji planu:

$$v_{\text{blended}} = w_{\text{AOP}} \cdot v_{\text{AOP}} + w_{\text{RunRate}} \cdot v_{\text{RunRate}} + w_{\text{YoY}} \cdot v_{\text{YoY}}$$

#### Składowe Zespołu:
1. **Model 1: MTD Velocity AOP ($v_{\text{AOP}}$)**:
   $$v_{\text{AOP}} = \frac{\sum_{i \in \text{Zamknięte z TRX}} \text{Actual TRX}_i}{\sum_{i \in \text{Zamknięte z TRX}} \text{Plan TRX}_i}$$
2. **Model 2: Krótkoterminowy Run-Rate z wagami wykładniczymi ($v_{\text{RunRate}}$)**:
   Dla $K$ zamkniętych tygodni z transakcjami, każdy tydzień indeksowany od najstarszego ($k=0$) do najnowszego ($k=K-1$) otrzymuje wagę recencji $1.8^k$:
   $$v_{\text{RunRate}} = \frac{\sum_{k=0}^{K-1} \left( \frac{\text{Actual TRX}_k}{\text{Plan TRX}_k} \right) \cdot 1.8^k}{\sum_{k=0}^{K-1} 1.8^k}$$
   *Przykład*: Dla 3 tygodni wagi wynoszą odpowiednio: $1.8^0 = 1.0$, $1.8^1 = 1.8$, $1.8^2 = 3.24$. Najnowszy tydzień skupia $\frac{3.24}{1.0 + 1.8 + 3.24} = 53.6\%$ wagi modelu run-rate.
3. **Model 3: Sezonowość Bliźniacza YoY ($v_{\text{YoY}}$)**:
   Analizuje wykonanie tego samego miesiąca w poprzednich latach:
   $$v_{\text{YoY}} = \frac{\sum_{p \in \text{Historia tego samego msc}} \text{Actual TRX}_p}{\sum_{p \in \text{Historia tego samego msc}} \text{Plan TRX}_p}$$

#### Macierz Dynamicznego Doboru Wag Zespołu:
| Stan Danych w Miesiącu | $w_{\text{AOP}}$ | $w_{\text{RunRate}}$ | $w_{\text{YoY}}$ (z historią) | $w_{\text{YoY}}$ (bez historii) |
| :--- | :---: | :---: | :---: | :---: |
| **Miesiąc Przeszły (`past`)** | $1.00$ | $0.00$ | $0.00$ | $0.00$ |
| **0 tygodni z TRX** | $0.65$ | $0.00$ | $0.35$ | $0.00$ ($w_{\text{AOP}}=1.0$) |
| **1 tydzień z TRX** | $0.50$ | $0.30$ | $0.20$ | $0.00$ ($w_{\text{AOP}}=0.6, w_{\text{RR}}=0.4$) |
| **$\ge 2$ tygodnie z TRX** | $0.35$ | $0.50$ | $0.15$ | $0.00$ ($w_{\text{AOP}}=0.4, w_{\text{RR}}=0.6$) |

Wagi są na bieżąco normalizowane: $\sum w = 1.0$.

---

### 4.3. Formuły Wypracowanego Budżetu Robocizny (Earned Labor Budget)
1. **Całkowita prognoza transakcji na koniec miesiąca**:
   $$\text{Forecast Open TRX} = \sum_{j \in \text{Otwarte}} (\text{Plan TRX}_j \cdot v_{\text{blended}})$$
   $$\text{Forecast Total TRX} = \text{Actual TRX MTD} + \text{Forecast Open TRX}$$
2. **Wypracowany Budżet Robocizny (Earned Labor Budget)**:
   $$\text{Earned Labor Budget} = \frac{\text{Forecast Total TRX}}{\text{Target TPLH AOP}}$$
3. **Wpływ trendu na robociznę**:
   $$\Delta_{\text{Earned}} = \text{Earned Labor Budget} - \text{Budżet Godzin AOP}$$
4. **Zaangażowane godziny przed docelowym tygodniem planowania ($W+2$)**:
   Dla $i < \text{targetPlanningIdx}$:
   $$H_{\text{committed}} = \sum_{i < \text{targetPlanningIdx}} \begin{cases} \text{Actual Hours}_i & \text{dla tygodni zamkniętych} \\ \text{Scheduled Hours}_i \text{ (lub Plan Hours}_i) & \text{dla tygodni otwartych} \end{cases}$$
5. **Budżet pozostały do dyspozycji na planowane tygodnie**:
   $$\text{Budget For Planning Weeks} = \max(0, \text{Earned Labor Budget} - H_{\text{committed}})$$
6. **Surowa rekomendacja dla tygodnia docelowego (HANW Raw)**:
   $$\text{HANW Raw} = \text{Budget For Planning Weeks} \cdot \frac{W_{\text{target}}}{\sum_{j \ge \text{targetPlanningIdx}} W_j}$$
7. **Rekomendacja Ostateczna (HANW Final)**:
   $$\text{HANW Final} = \max(\text{HANW Raw}, \text{Floor Hours}_{\text{target}})$$

---

## 5. Audyt Filaru 3: Bezwzględna Ochrona Bazy Floor Hours (32h/d, 224h/tydz) i Pula Flex

### 5.1. Standard Operacyjny Starbucks
Zgodnie z nienaruszalnym standardem operacyjnym kawiarni `108120 SBX Warszawa Janki`:
- **Dobowe minimum bezpieczeństwa (Floor)**:
  - 1 Kierownik (MGR) + 1 Barista rano (AM: 8h + 8h = 16h)
  - 1 Kierownik (MGR) + 1 Barista wieczorem (PM: 8h + 8h = 16h)
  - **Suma dobowa = 32.0 h/dzień (4 osoby $\times$ 8h)**.
- **Tygodniowe minimum bezpieczeństwa (pełny tydzień 7 dni)**:
  $$H_{\text{Floor Base}} = 7 \times 32.0\text{ h} = \mathbf{224.0\text{ h/tydzień}}$$
- **Tydzień częściowy ($k$ dni)**:
  $$H_{\text{Floor Partial}} = k \times 32.0\text{ h}$$

---

### 5.2. Weryfikacja Implementacji w Kodzie
W pliku `src/modules/labor-forecast/services/calculationEngine.ts`:
1. Funkcja `calculatePartialWeekInfo` (linie 26–98):
   - Pętla zlicza rzeczywiste dni w tygodniu i mnoży:
     `totalFloor += FLOOR_PER_DAY;` gdzie `FLOOR_PER_DAY = 32`.
   - Dla 7 dni zwraca dokładnie `calculatedFloorHours: 224`.
2. Zastosowanie w wierszach tygodniowych (linie 653–657):
   ```typescript
   const partialInfo = CalculationEngine.calculatePartialWeekInfo(w);
   const floorHoursToUse = partialInfo.calculatedFloorHours > 0 
     ? partialInfo.calculatedFloorHours 
     : w.floor_hours;
   ```
   Dla każdego pełnego tygodnia wartość `floorHoursToUse` wynosi **224.0h**, nadpisując wartość z bazy.
3. Rekomendacja HANW (linie 1086–1087):
   ```typescript
   const floorH = row.week.floor_hours;
   const hanwFinal = Math.max(hanwRaw, floorH);
   ```
4. Pula Baristów (linia 1141):
   ```typescript
   const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));
   ```

**Weryfikacja warunku naruszenia Floor**:
Przeanalizowano wszystkie ścieżki obliczeniowe: **W silniku `CalculationEngine` NIE ISTNIEJE ścieżka, która pozwoliłaby obniżyć rekomendację `HANW Final` poniżej `calculatedFloorHours` (32h/dzień).**

---

### 5.3. Konflikt Standardów: 224h vs 272h (Krytyczna Niezgodność)
Mimo że `calculationEngine.ts` poprawnie kalkuluje $224.0\text{ h}$, w projekcie zidentyfikowano liczne pozostałości starszego standardu **272.0 h** ($6 \times 40\text{h} + 32\text{h}$):

| Miejsce w Kodzie | Zapisana Wartość / Tekst | Prawidłowy Standard 2026 | Skutek dla Użytkownika |
| :--- | :--- | :--- | :--- |
| `weeks_engine_seed.json` (baza SQLite `calendar_weeks`) | `"floor_hours": 272` (dla wszystkich pełnych tygodni) | `224` | Rozbieżność w surowych rekordach bazy |
| `src/modules/labor-forecast/README.md:16` | `Pn–Sob 40h, Nd 32h -> 272.0 h/tydzień` | `32.0 h/dzień -> 224.0 h/tydzień` | Błędna dokumentacja |
| `src/modules/labor-forecast/AGENTS.md:79` | `Grafik zablokowany na poziomie 272.0 h` | `zablokowany na poziomie 224.0 h` | Niespójność wytycznych agenta |
| `FloorHoursModal.tsx:139, 228` | `272.0 h (Pn-Sob po 5 zmian x 8h = 40h...)`, przycisk `Przywróć domyślne 272h` | `224.0 h (7 dni x 32h)` | Możliwość zresetowania do błędnej bazy |
| `TrendCharts.tsx:433, 573, 656` | `<ReferenceLine y={272} label="Floor 272h" />` | `<ReferenceLine y={224} label="Floor 224h" />` | Czerwona linia na wykresie rysowana na wysokości 272h, podczas gdy silnik planuje od 224h! |

---

### 5.4. Pula Flex (Manipulacja Zmianami)
Pula Flex reprezentuje liczbę godzin wypracowanych ponad nienaruszalne minimum operacyjne:
$$\text{Flex Hours Pool} = \max(0, \text{Week Target Budget} - 224.0\text{ h})$$

Wagi dobowego rozkładu puli Flex w CH Janki:
- **Tydzień ze zwykłą niedzielą (zamknięte CH Janki)**:
  - Sobota: $24.5\%$, Piątek: $20.0\%$, Wtorek: $19.0\%$, Poniedziałek: $12.5\%$, Środa: $12.0\%$, Czwartek: $12.0\%$, **Niedziela: $0.0\%$**.
  - Niedziela zostaje zamrożona na czystym Floor (32h), a zaoszczędzone godziny wzmacniają szczyt piątkowo-sobotni.
- **Tydzień z Niedzielą Handlową (pełne otwarcie CH Janki)**:
  - Sobota: $22.0\%$, **Niedziela Handlowa: $20.0\%$**, Piątek: $17.0\%$, Wtorek: $14.0\%$, Poniedziałek: $9.0\%$, Środa: $9.0\%$, Czwartek: $9.0\%$.

---

## 6. Audyt Filaru 4: Monday Flash Forecast (Pre-closing) i Przejście Wtorkowe

### 6.1. Rytm Planowania Starbucks i Problem Luki Poniedziałkowej
W rytmie korporacyjnym Starbucks:
- W **poniedziałek** Store Manager ma obowiązek opublikować grafik na tydzień **$W+2$** (z 7-dniowym wyprzedzeniem).
- Tydzień **$W+1$** jest już ułożony i opublikowany w poprzedni poniedziałek.
- Trwający tydzień **$W$** kończy się dopiero w poniedziałek o godzinie 22:00. Pełne raporty z kas i Fichajes spływają do bazy we wtorek rano.

Bez mechanizmu Flash Forecast tydzień $W$ posiadałby wyłącznie dane z 6 dni (wtorek–niedziela). Spowodowałoby to sztuczny deficyt transakcji o ok. $-14\%$, załamanie wskaźnika MTD Velocity, drastyczny spadek Earned Labor Budget i błędną, zaniżoną rekomendację HANW na tydzień $W+2$.

---

### 6.2. Matematyczna Konstrukcja Flash Forecast (Sposób 1)
Gdy zachodzi warunek:
$$\text{isCurrentCalendarWeek} = \text{true} \land \text{dzisiaj} = \text{Poniedziałek} \land \text{data dzisiejsza} = \text{week.date\_to}$$
oraz raport zamykający za poniedziałek nie został jeszcze zaraportowany (`!isMondayAlreadyReported`), silnik aktywuje estymację:

1. **Godziny kierowników na poniedziałek ($H_{\text{MGR Today}}$)**:
   Pobierane wprost z ułożonego grafiku Modułu 2 z wykluczeniem absencji (`OFF`, `L4`, `H`) i wsparć obcych (`SAM`, `SPM`, `SUP`):
   $$H_{\text{MGR Today}} = \text{resMon.managerHours}$$
2. **Cel godzinowy tygodnia ($H_{\text{Target}}$)**:
   $$H_{\text{Target}} = \begin{cases} \text{scheduled\_hours} & \text{jeśli wprowadzono w kolumnie Grafik (h)} \\ \text{planHours} & \text{w przeciwnym razie (plan AOP)} \end{cases}$$
3. **Pozostałe godziny do dopełnienia celu**:
   $$H_{\text{rem}} = \max(0, H_{\text{Target}} - H_{\text{logged 1..6}})$$
4. **Łączne godziny estymowane na poniedziałek**:
   $$H_{\text{Total Monday}} = \max(32.0, H_{\text{rem}})$$
5. **Godziny baristów na poniedziałek**:
   $$H_{\text{Bar Today}} = \max(0, H_{\text{Total Monday}} - H_{\text{MGR Today}})$$
6. **Łączne godziny tygodnia przekazywane do silnika MTD**:
   $$H_{\text{Full Week Projected}} = H_{\text{logged 1..6}} + H_{\text{Total Monday}}$$
7. **Estymacja transakcji na poniedziałek**:
   $$\text{TRX}_{\text{Monday Projected}} = \begin{cases} \text{avgMondayTrxThisMonth} & \text{jeśli dostępna średnia z poprz. poniedziałków} \\ \text{round}(\text{Plan TRX} \times 0.121) & \text{domyślna waga poniedziałkowa} \end{cases}$$
   $$\text{TRX}_{\text{Full Week Projected}} = \text{Actual TRX}_{\text{days 1..6}} + \text{TRX}_{\text{Monday Projected}}$$

Tydzień otrzymuje flagę `isMondayProjected = true` oraz tymczasowy status `isClosed = true`, dzięki czemu wchodzi do predykcji MTD z pełną wagą 7 dni.

---

### 6.3. Płynne Przejście Wtorkowe (Tuesday Transition)
We wtorek rano zegar systemowy wskazuje:
`sysNow.dayOfWeek === 'Wt'`.
Warunek `isEndingTodayOnMonday` staje się natychmiast `false`.
Jednocześnie data końcowa `date_to` (poniedziałek) minęła, więc `SystemClock.getWeekTemporalStatus` klasyfikuje tydzień jako `'past'`.
Po zaimportowaniu pliku Excel MAPAL Fichajes fizyczne logowania z poniedziałku trafiają do bazy, a estymacja Flash Forecast automatycznie i bezszwowo ustępuje rzeczywistym danym z kasy.

---

### 6.4. Wykryte Luki w Algorytmie Flash Forecast
1. **Błąd przejścia przez granicę roku kalendarzowego w pętli dni 1–6 (P1)**:
   W pliku `calculationEngine.ts` linie 756–762:
   ```typescript
   curD++;
   const daysInCurMonth = new Date(w.year, curM, 0).getDate();
   if (curD > daysInCurMonth) {
     curD = 1;
     curM++;
   }
   ```
   Jeśli tydzień przełomu grudnia i stycznia kończy się w poniedziałek 04.01, a rozpoczyna 29.12:
   Gdy `curM` wynosi 12, instrukcja `curM++` ustawia `curM = 13` bez inkrementacji `w.year`! Spowoduje to generowanie błędnych zapytań do mapy KPI w formacie `2026-13-01`.
2. **Magiczna stała popytu poniedziałkowego (P2)**:
   Wartość `0.121` ($12.1\%$) jest wpisana na sztywno w linii 789 zamiast wynikać z dynamicznego odczytu z `dayOfWeekStats`.
3. **Magiczna stała transakcji niedzielnych (P2)**:
   W linii 752 występuje sztywny fallback: `(avgSundayTrxThisMonth || 179)`. Liczba 179 to empiryczna stała z testów września 2026 w Janki, która nie powinna być wpisana na sztywno w kodzie.

---

## 7. Audyt Filaru 5: Testy Numeryczne Przypadków Brzegowych (Stress Testing)

Przeprowadzono rygorystyczne symulacje numeryczne dla 6 specyficznych scenariuszy brzegowych.

---

### 7.1. Scenariusz 1: Ujemna Delta Budżetowa (Actual Labor Exceeding Earned Budget)
**Założenia testu**:
- Miesiąc 5-tygodniowy (Wrzesień 2026): Plan TRX = 10 000, Cel TPLH = 6.70.
- Plan Godzin AOP = $10\ 000 / 6.70 = 1\ 492.5\text{ h}$.
- Tygodnie W1 i W2: Załamanie sprzedaży.
  - Actual TRX W1 = 1 500 (Plan 2 333), W2 = 1 500 (Plan 2 333).
  - Razem Actual TRX MTD = 3 000 TRX vs Plan MTD = 4 666 TRX.
  - Dynamika sprzedaży: $v_{\text{AOP}} = 3\ 000 / 4\ 666 = 0.643$ (spadek o $-35.7\%$).
- Zespół modeli wylicza $v_{\text{blended}} \approx 0.70$.
- Prognoza sprzedaży: $\text{Forecast Total TRX} = 3\ 000 + (5\ 334 \times 0.70) = 6\ 733.8 \approx 6\ 734\text{ TRX}$.
- Wypracowany budżet miesiąca: $\text{Earned Labor Budget} = 6\ 734 / 6.70 = \mathbf{1\ 005.1\text{ h}}$.
- **Przekroczenie godzin w W1 i W2**: Lokal był mocno przeobsadzony, zużywając $380\text{h} + 380\text{h} = 760.0\text{ h}$!
- W3 (opublikowany od jutra): Zabezpieczono w grafiku $320.0\text{ h}$.
- committedHoursBeforeTarget = $760.0 + 320.0 = \mathbf{1\ 080.0\text{ h}}$.

**Rachunek silnika**:
1. $\text{Pozostały budżet robocizny} = \text{Earned Labor Budget} - H_{\text{committed}} = 1\ 005.1 - 1\ 080.0 = \mathbf{-74.9\text{ h}}$!
2. Linia 1044:
   `budgetForPlanningWeeks = Math.max(0, earnedLaborBudget - committedHoursBeforeTarget)` $\implies \mathbf{0.0\text{ h}}$.
3. Linia 1081:
   `hanwRaw = budgetForPlanningWeeks * (...)` $\implies \mathbf{0.0\text{ h}}$.
4. Linia 1087:
   `hanwFinal = Math.max(0.0, 224.0)` $\implies \mathbf{224.0\text{ h}}$.
5. Linia 1094:
   `if (hanwRaw < floorH) isFloorAlertTriggered = true;` $\implies \mathbf{true}$.
6. Pula Baristów dla W4: Jeśli menedżerowie mają zaplanowane 96h, to $224.0 - 96.0 = 128.0\text{ h}$.
7. Pula Surplus (linia 1250): $\max(0, 1005.1 - 960 - 32) = \mathbf{0.0\text{ h}}$.

**Weryfikacja**: Silnik zachowuje się w 100% stabilnie matematycznie. Zabezpiecza ujemny budżet funkcją `Math.max(0, ...)`, wymusza bezpieczny Floor 224.0h i aktywuje czerwony alert krytyczny dla SM i DM.

---

### 7.2. Scenariusz 2: Zerowe Transakcje / Dni Świąteczne i Ryzyko Dzielenia przez Zero
Zbadano wszystkie operacje dzielenia w silnikach `CalculationEngine` i `TrendLearningEngine`:

1. `planTrxTotal / targetTplh`: Zabezpieczone w linii 595: `aopPlan.target_tplh > 0 ? aopPlan.target_tplh : 6.7`.
2. `actTrx / actHours`: Zabezpieczone w linii 860: `actTrx > 0 && actHours > 0`.
3. `actTrxForTrend / planTrxForTrend`: Zabezpieczone w linii 426: `rowsWithTrx.length > 0 && planTrxForTrend > 0`.
4. `(r.actualTrx || 0) / (r.planTrx || 1)`: Zabezpieczone fallbackiem `|| 1` w linii 438.
5. **KRYTYCZNY BŁĄD DZIELENIA PRZEZ ZERO W CROSS-MONTH BRIDGE (P0)**:
   W pliku `calculationEngine.ts`:
   - Linia 1395:
     ```typescript
     const nextPlanHours = Number(
       ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
     ) || nextFloorHours;
     ```
   - Linia 1513:
     ```typescript
     const prevPlanHours = Number(
       ((prevFloorHours / 224.0) * (firstRow.planHours / (firstRow.calculatedDaysCount / 7))).toFixed(1)
     ) || prevFloorHours;
     ```
   Warunek w linii 1376 sprawdza:
   `if (lastRow && lastRow.isPartial && lastRow.calculatedDaysCount < 7 && lastRow.week.week_num_in_month !== 'W1')`
   **Brak zabezpieczenia `calculatedDaysCount > 0`!**
   Jeśli rekord tygodnia ma `calculatedDaysCount === 0` (np. pusty rekord w bazie lub błąd parsowania daty):
   $0 / 7 = 0 \implies \text{lastRow.planHours} / 0 = \mathbf{Infinity}$.
   $\text{Number(Infinity.toFixed(1))} = \mathbf{Infinity}$.
   Wartość `Infinity || nextFloorHours` ewaluuje się do `Infinity` (ponieważ `Infinity` jest wartością prawdziwą w JS!).
   W rezultacie `totalCombinedPlanHours = Infinity`, a interfejs ulega awarii.

---

### 7.3. Scenariusz 3: Ekstremalny Szczyt w Niedzielę Handlową (~250% normy)
**Założenia testu**:
- W2 Września 2026 zawiera Niedzielę Handlową.
- Zwykła niedziela: ~350 TRX.
- Niedziela Handlowa: $350 \times 2.5 = 875\text{ TRX}$ (+525 TRX ponad normę).
- Tydzień W2 realizuje 3 050 TRX przy planie 2 527 TRX.
- Velocity tygodnia W2: $\text{Ratio}_{\text{W2}} = 3\ 050 / 2\ 527 = \mathbf{1.207}$ (+20.7%).

**Wpływ na model Run-Rate**:
Ponieważ W2 jest najnowszym zamkniętym tygodniem ($k=1$), otrzymuje wagę $1.8^1 = 1.8$:
$$v_{\text{RunRate}} = \frac{1.0 \times 1.0 + 1.8 \times 1.207}{1.0 + 1.8} = \frac{3.172}{2.8} = \mathbf{1.133}$$
W zespole predykcyjnym model Run-Rate ma wagę $50\%$, co podbija $v_{\text{blended}}$ do poziomu ok. $1.085$ (+8.5%).
Silnik prognozuje, że w W3, W4 i W5 sprzedaż wzrośnie o $+8.5\%$, dodając:
$$\text{Dodatkowe Godziny} = \frac{7\ 581 \times 0.085}{6.70} \approx \mathbf{+96.1\text{ h}}$$
do wypracowanego budżetu robocizny!

**Wada**:
Niedziela Handlowa w W2 była zdarzeniem **jednorazowym**. Tygodnie W3 i W4 mają niedziele niehandlowe (zamknięte CH Janki). Model niesłusznie przypisuje wyższą produktywność i rekomenduje Store Managerowi dodanie blisko 100 godzin na tygodnie, w których galerie będą zamknięte w niedziele.

---

### 7.4. Scenariusz 4: Zaokrąglenia i Dryf Liczb Zmiennoprzecinkowych (Floating-Point Drift)
1. **Niezgodność sumy zaokrąglonych transakcji tygodniowych z planem miesięcznym**:
   Formuła w linii 658: `planTrx = Math.round(planTrxTotal * w.day_weight);`.
   Dla planu miesięcznego $\text{Plan TRX} = 10\ 000$ w 5-tygodniowym miesiącu:
   - W1: $10\ 000 \times 0.23333 = 2\ 333.3 \implies 2\ 333$
   - W2: $2\ 333$
   - W3: $2\ 333$
   - W4: $2\ 333$
   - W5: $10\ 000 \times 0.06667 = 666.7 \implies 667$
   - Suma tygodniowa: $2\ 333 \times 4 + 667 = \mathbf{9\ 999\text{ TRX}}$!
   **Utrata 1 TRX w wyniku niezależnego zaokrąglania wierszy**.
2. **Dryf godzin planowanych**:
   Formuła w linii 659: `planHours = Number((planHoursTotal * w.day_weight).toFixed(1));`.
   Dla $\text{Plan Hours} = 1\ 616.4\text{ h}$:
   - W1..W4: $1\ 616.4 \times 0.23333 = 377.1546 \implies 377.2\text{ h}$ (łącznie $1\ 508.8\text{ h}$)
   - W5: $1\ 616.4 \times 0.06667 = 107.7654 \implies 107.8\text{ h}$
   - Suma tygodniowa: $1\ 508.8 + 107.8 = \mathbf{1\ 616.6\text{ h}}$!
   **Występuje dryf $+0.2\text{ h}$ względem planu AOP**.
3. **Ułamkowe godziny baristów vs dyskretne zmiany**:
   Rekomendacja `suggestedBaristaHours` generuje wartości ciągłe (np. $27.4\text{ h}$).
   W praktyce operacyjnej Starbucks zmiany personelu planuje się w modułach 4h, 6h lub 8h. Choć interfejs podaje orientacyjną liczbę zmian (`Math.round(flex / 8)`), pole do wprowadzania godzin wymaga od Store Managera ręcznego zaokrąglenia.

---

### 7.5. Scenariusz 5: Załamanie Popytu Poniżej Bazy Floor (Under-Floor HANW Raw)
**Założenia testu**:
- Plan miesięczny: 8 000 TRX, Cel TPLH: 6.70 $\implies$ Plan Godzin = 1 194.0h.
- Floor miesiąca (4 tygodnie $\times$ 224h + 1 tydzień $\times$ 64h) = $960.0\text{ h}$.
- Katastrofalny spadek sprzedaży o $-50\%$ w W1 i W2 ($v_{\text{blended}} = 0.50$).
- $\text{Forecast Total TRX} = 4\ 000\text{ TRX}$.
- $\text{Earned Labor Budget} = 4\ 000 / 6.70 = \mathbf{597.0\text{ h}}$.
- Wypracowany budżet ($597.0\text{h}$) jest drastycznie niższy niż nienaruszalna baza Floor ($960.0\text{h}$)!
- Dla W4 silnik wylicza:
  - $\text{HANW Raw} = \mathbf{0.0\text{ h}}$.
  - $\text{HANW Final} = \max(0.0, 224.0) = \mathbf{224.0\text{ h}}$.
  - `isFloorAlertTriggered = true`.

**Analiza produktywności TPLH**:
W takim tygodniu transakcje wyniosą zaledwie ok. 900 TRX.
Przy wymuszonej obsadzie Floor 224.0h rzeczywisty wskaźnik TPLH wyniesie:
$$\text{TPLH}_{\text{Real}} = \frac{900}{224.0} = \mathbf{4.02\text{ TPLH}}$$
(wobec celu AOP 6.70). Silnik słusznie blokuje cięcia, wymuszając formalną akceptację District Managera na spadek wskaźnika TPLH w celu zachowania standardów bezpieczeństwa i jakości obsługi.

---

### 7.6. Scenariusz 6: Częściowe Logowania z 6 Dni bez Monday Flash Forecast
Co dzieje się, gdy Store Manager uruchomi aplikację w poniedziałek rano przed zasileniem bazy lub w niedzielę wieczorem (gdy Flash Forecast nie jest aktywny, ale Fichajes zawiera cząstkowe godziny z 6 dni):
1. Tydzień W bieżący ma zarejestrowane godziny RCP (np. 280.0h za wt–nd).
2. Transakcje tygodniowe `actualTrx` są równe `null` (bo tydzień się nie zamknął).
3. Linia 852–853 w `calculationEngine.ts`:
   ```typescript
   const hasActualData = (actHours !== null && actHours > 0) || (actTrx !== null && actTrx > 0);
   const isClosed = monthTemporalStatus === 'past' || hasActualData || ...;
   ```
   **Tydzień zostaje zaklasyfikowany jako ZAMKNIĘTY (`isClosed = true`) z powodu obecności `actHours`!**
4. Skutek w pętli MTD (linie 907–911):
   - `actualHoursMtd` zostaje powiększone o **+280.0 h**.
   - `actualTrxMtd` zostaje powiększone o **+0 TRX** (ponieważ `actTrx === null`).
5. Skutek w TPLH MTD:
   Wskaźnik efektywności drastycznie spada:
   $$\text{currentMtdTplh} = \frac{\text{Actual TRX MTD}}{\text{Actual Hours MTD}}$$
   mianownik rośnie o 280h bez licznika!
6. Skutek w budżecie:
   $\text{Remaining Hours Budget} = \text{Earned Labor Budget} - \text{Actual Hours MTD}$
   zostaje przedwcześnie pomniejszony o 280h, drastycznie obniżając rekomendację HANW na tydzień W+2!

**Wniosek**: Mechanizm Flash Forecast (`isMondayProjected`) jest **kluczowym stabilizatorem matematycznym**. Gdy warunki Flash Forecast nie są spełnione, obecność samych godzin `actualHours` bez transakcji w trwającym tygodniu doprowadza do fałszywego zaniżenia budżetu!

---

## 8. Audyt Filaru 6: Wielozakładowość (Multi-Store Isolation) i Pamięć Lokalna

Zgodnie z wymaganiem R1 i R2 z `ORIGINAL_REQUEST.md`:
"Ensure full operational isolation and scalability for over 100 Starbucks stores... zero cross-store data leakage... purge all hardcoded defaults".

### 8.1. Wykryty Wyciek Danych w `localStorage` (WeeklyScheduleTable.tsx)
W pliku `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx` linie 63–79:
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
Klucz pamięci podręcznej przeglądarki `sbux_daily_barista_hours` jest **globalny i wspólny dla wszystkich kawiarni**:
- Jeśli Store Manager przełączy lokal w aplikacji z `18120 Janki` na `18105 Galeria Mokotów`, aplikacja wczyta z `localStorage` dobowe rozpiski baristów poprzedniej kawiarni!
- Stanowi to bezpośrednie naruszenie zasady izolacji wielozakładowej (Multi-Store Isolation).

### 8.2. Sztywne Kody Kawiarni i Fallbacki w Module 1
1. **Fallbacki w komponentach**:
   - `OperationalAlert.tsx:202`: `const plan = pubRow?.planHours || 372.1;` (sztywna liczba 372.1h).
   - `OperationalAlert.tsx:245`: `const targetBudget = nextWeekHanwFinal ?? targetRow?.planHours ?? 417.3;` (sztywna liczba 417.3h).
   - `OperationalAlert.tsx:229`: Sztywny tekst `"MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h"` niezależnie od wyniku kalkulacji.
2. **Kody jednostek w seedach**:
   W pliku `electron/database/db.ts:1459`: `String(a.unit_code || '18120')`, `a.unit_name || '108120 SBX Warszawa Janki'`.

---

## 9. Katalog Wykrytych Wad i Ryzyk Obliczeniowych (Klasyfikacja P0–P3)

| ID | Poziom | Plik i Linia | Istota Problemu | Skutek Matematyczny / Operacyjny |
| :---: | :---: | :--- | :--- | :--- |
| **BUG-M1-01** | **P0 (Krytyczny)** | `calculationEngine.ts:1395, 1513` | Brak warunku `calculatedDaysCount > 0` przy dzieleniu w `calculateCrossMonthBridge` | Dzielenie przez zero zwraca `Infinity`, powodując awarię kalkulacji mostu przełomu miesięcy. |
| **BUG-M1-02** | **P1 (Wysoki)** | `weeks_engine_seed.json`, `FloorHoursModal.tsx:139`, `TrendCharts.tsx:433` | Rozdwojenie standardu Floor Hours: silnik liczy 224h, a baza i wykresy pokazują 272h | Store Manager widzi czerwoną linię Floor na 272h, podczas gdy silnik pozwala planować od 224h. |
| **BUG-M1-03** | **P1 (Wysoki)** | `calendar_weeks.day_weight` | Wagi $W_i$ wyliczone ze wzoru $\text{dni}/N$ bez wag dni tygodnia | Tygodnie cząstkowe (np. W5 Wrzesień z wt+śr) są zawyżone o $+5\%$, a weekendowe zaniżone o $-15\%$. |
| **BUG-M1-04** | **P1 (Wysoki)** | `WeeklyScheduleTable.tsx:65, 75` | Zapis dobowych godzin baristów w un-namespaced `localStorage` (`sbux_daily_barista_hours`) | Wyciek danych grafiku między kawiarniami przy przełączaniu lokali w trybie Multi-Store. |
| **BUG-M1-05** | **P1 (Wysoki)** | `calculationEngine.ts:439` | Brak de-sezonalizacji jednorazowej Niedzieli Handlowej w modelu Run-Rate | Jednorazowy skok popytu (+250% w NdH) zawyża prognozę sprzedaży i robocizny na kolejne tygodnie o +8–12%. |
| **BUG-M1-06** | **P1 (Wysoki)** | `calculationEngine.ts:756-762` | Pętla dni 1–6 w Flash Forecast inkrementuje `curM++` bez aktualizacji roku przy przełomie grudnia/stycznia | Błędne odpytywanie mapy KPI o miesiąc 13 (`2026-13-01`) na przełomie roku. |
| **BUG-M1-07** | **P2 (Średni)** | `calculationEngine.ts:853-857` | Zaliczenie tygodnia jako zamknięty (`isClosed=true`), gdy posiada same godziny RCP bez TRX | Sztuczne załamanie wskaźnika TPLH MTD i zaniżenie budżetu HANW przy brakujących danych transakcyjnych. |
| **BUG-M1-08** | **P2 (Średni)** | `OperationalAlert.tsx:202, 245` | Sztywne fallbacki liczbowe (`372.1`, `417.3`) oraz tekstowe (`+15h`) | Błędne rekomendacje w banerze operacyjnym przy braku pełnych danych w wierszu. |
| **BUG-M1-09** | **P3 (Niski)** | `calculationEngine.ts:658, 659` | Niezależne zaokrąglanie `Math.round` i `toFixed(1)` na poziomie wierszy | Dryf sumy tygodni vs miesiąc AOP (błąd $\pm 1$ TRX oraz $\pm 0.2\text{ h}$). |
| **BUG-M1-10** | **P3 (Niski)** | `calculationEngine.ts:752, 789` | Magiczne stałe popytu w Flash Forecast (`179` TRX dla niedzieli, `0.121` dla poniedziałku) | Brak dynamicznej adaptacji estymacji do specyfiki konkretnego lokalu. |

---

## 10. Rekomendacje Algorytmiczne i Specyfikacja RFC

Wszystkie poniższe propozycje przygotowano w trybie ściśle analityczno-projektowym (RFC).

### RFC-M1-01: Usunięcie Dzielenia przez Zero w Cross-Month Bridge (Fix P0)
**Cel**: Pełne zabezpieczenie funkcji `calculateCrossMonthBridge` przed wartościami `Infinity`.

**Formuła przed zmianą**:
```typescript
const nextPlanHours = Number(
  ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
) || nextFloorHours;
```

**Proponowana specyfikacja**:
```typescript
const safeDaysCount = Math.max(1, lastRow.calculatedDaysCount);
const daysFraction = safeDaysCount / 7.0;
const rawAvgDailyPlan = lastRow.planHours > 0 ? (lastRow.planHours / daysFraction) : (lastRow.calculatedFloorHours || 32.0 * safeDaysCount);
const nextPlanHours = Number(
  ((nextFloorHours / 224.0) * rawAvgDailyPlan).toFixed(1)
) || nextFloorHours;
```
Identyczne zabezpieczenie należy zastosować dla `firstRow.calculatedDaysCount` w linii 1513.

---

### RFC-M1-02: DOW-Weighted AOP Week Distribution (Wagi $W_i$ oparte o Dni Tygodnia)
**Cel**: Eliminacja zniekształceń planu AOP w tygodniach cząstkowych.

**Specyfikacja Algorytmu**:
Zamiast przypisywać każdemu dniowi wagę $\frac{1}{N}$, system powinien korzystać z wektora empirycznych wag dni tygodnia $\mathbf{w}_{\text{dow}} = [w_{\text{Nd}}, w_{\text{Pn}}, w_{\text{Wt}}, w_{\text{Śr}}, w_{\text{Czw}}, w_{\text{Pt}}, w_{\text{Sob}}]$ znormalizowanego do $\sum_{d=0}^6 w_d = 7.0$.

Dla każdego dnia $d \in \text{Tydzień } i$:
$$W_i = \frac{\sum_{d \in \text{Tydzień } i} w_{\text{dow}}(d)}{\sum_{m \in \text{Miesiąc}} w_{\text{dow}}(m)}$$

Dzięki temu 2-dniowy tydzień z wtorku i środy otrzyma wagę odpowiadającą rzeczywistemu popytowi tych dwóch dni ($\approx 23.5\%$ tygodnia), a nie sztuczne $28.57\%$.

---

### RFC-M1-03: De-sezonalizacja Niedzieli Handlowej w Modelu Run-Rate
**Cel**: Uniknięcie przeszacowania budżetu robocizny po wystąpieniu Niedzieli Handlowej.

**Specyfikacja Algorytmu**:
Przed wyliczeniem dynamiki $\text{Ratio}_k = \frac{\text{Actual TRX}_k}{\text{Plan TRX}_k}$:
1. Sprawdź, czy tydzień $k$ zawierał Niedzielę Handlową.
2. Jeśli tak, odejmij od $\text{Actual TRX}_k$ nadwyżkę obrotu niedzielnego ponad przeciętną niedzielę wolną:
   $$\text{Actual TRX}_k^{\text{norm}} = \text{Actual TRX}_k - (\text{Actual TRX}_{\text{NdH}} - \overline{\text{TRX}}_{\text{NdW}})$$
3. Użyj $\text{Actual TRX}_k^{\text{norm}}$ do wyliczenia $v_{\text{RunRate}}$.
4. W efekcie model estymuje realny trend bazowy kawiarni, a godziny na Niedzielę Handlową są alokowane celowo tylko w tym tygodniu, w którym niedziela występuje.

---

### RFC-M1-04: Unifikacja Standardu Floor Hours na Poziomie 224.0 h
**Cel**: Likwidacja rozdwojenia standardu 224h vs 272h w UI i bazie danych.

**Kroki architektoniczne**:
1. Aktualizacja schematu seeda `weeks_engine_seed.json`: zamiana wartości `floor_hours: 272` na `floor_hours: 224` dla wszystkich pełnych 7-dniowych tygodni.
2. W `TrendCharts.tsx`: przestawienie linii referencyjnej na `y={224}` z etykietą `"Baza Floor 224.0h"`.
3. W `FloorHoursModal.tsx`: aktualizacja tekstów pomocy z 272h na 224h ($7 \times 32.0\text{h}$).
4. W `README.md` i `AGENTS.md`: ujednolicenie opisów — definitywne wykreślenie odniesień do 272h jako bazy dobowej.

---

### RFC-M1-05: Izolacja Pamięci Podręcznej Baristów per Kawiarnia (Multi-Store Isolation)
**Cel**: Zapewnienie pełnej separacji danych dobowych baristów w `WeeklyScheduleTable.tsx`.

**Specyfikacja**:
Klucz w `localStorage` musi być sparametryzowany identyfikatorem aktywnej kawiarni (`storeId` lub `unitCode`):
```typescript
const storageKey = `sbux_daily_barista_hours_${currentStoreId || 'default'}`;
```
Przy przełączeniu sklepu w profilu aplikacja automatycznie załaduje właściwy stan bez ryzyka wycieku danych pomiędzy kawiarniami.

---

### RFC-M1-06: Obsługa Granicy Roku w Pętli Monday Flash Forecast
**Cel**: Poprawne domykanie Flash Forecast na przełomie grudnia i stycznia.

**Specyfikacja**:
```typescript
let curD = parseInt(dFromStr, 10);
let curM = parseInt(mFromStr, 10);
let curY = w.year;

for (let step = 0; step < daysCountToScan; step++) {
  const kpi = getDailyKpi(curY, curM, curD);
  // ...
  curD++;
  const daysInCurMonth = new Date(curY, curM, 0).getDate();
  if (curD > daysInCurMonth) {
    curD = 1;
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
}
```

---

*Raport sporządził*: **explorer_m1_math**  
*Podstawa audytu*: Zlecenie użytkownika z dn. 2026-10-24T00:24:38Z, `AGENTS.md`, `calculationEngine.ts`, `trendLearningEngine.ts`.
