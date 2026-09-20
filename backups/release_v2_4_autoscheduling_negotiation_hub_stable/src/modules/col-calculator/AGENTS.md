# AGENTS.md — Moduł 4: COL Calculator (Cost of Labor Suite)

Dokument stanowi techniczną specyfikację architektoniczną i algorytmiczną dla modułu **COL Calculator** w repozytorium **Starbucks Operations Suite** (`108120 SBX Warszawa Janki`).

---

## 🏛️ 1. Cel i Architektura 3 Filarów (AOP, Target, Estymacja)

Kalkulator operuje w spójnym trójfilarowym modelu kalkulacyjnym:
1. **🏛️ AOP (Plan Roczny)**:
   - Oficjalny budżet roczny zaplanowany przez centralę Starbucks / AmRest dla jednostki `18120`.
   - `Sales AOP`, `TRX AOP`, `TPLH AOP`, `Budżet Robocizny AOP` oraz `COL % AOP`.
2. **🎯 TARGET (Plan Miesięczny)**:
   - Operacyjny plan miesięczny tworzony przez Store Managera (SM).
   - Sprzedaż i transakcje docelowe, cel TPLH, zaplanowane godziny menedżerów z grafiku (Moduł 2) oraz załogi (UoP / UZ), z wyliczeniem `COL Target PLN` i `COL Target %`.
3. **⚡ ESTYMACJA (Prognoza Domknięcia ze względu na TRX, Sales i RCP)**:
   - Dynamiczna prognoza domknięcia miesiąca w oparciu o zmienne rzeczywiste:
     - **Sales & TRX**: predykcja MTD Velocity z Modułu 1 lub manualna korekta trendu.
     - **Godziny Menedżerów z RCP**: zintegrowane logowania z systemu MAPAL Fichajes (dla dni zrealizowanych rzeczywiste godziny RCP, dla dni przyszłych godziny z grafiku).
     - **Godziny Załogi (UoP / UZ)**: prognozowane wykonanie godzin załogi.
     - **TOTAL COL % Estymacja**: `Total COL Estymacja PLN / Sales Estymacja PLN`.
     - **Odchylenie vs AOP ($\Delta$)**: automatyczny monitoring przekroczenia / oszczędności budżetu AOP.

---

## 🧮 2. Model Obliczeniowy i Formuły Matematyczne (`colEngine.ts`)

### A. Główne Wskaźniki Efektywności
- **TOTAL COL %**:
  $$\text{TOTAL COL \%} = \frac{\text{Total COL Costs (PLN)}}{\text{Sales (PLN)}}$$
- **TPLH (Total)**:
  $$\text{TPLH}_{\text{Total}} = \frac{\text{Transakcje}}{\text{Godziny pracy (MGR + Crew)}}$$
- **TPLH (Coverage)**:
  $$\text{TPLH}_{\text{Coverage}} = \frac{\text{Transakcje}}{\text{Godziny pracy} - \text{Urlopy} - \text{Szkolenia NC}}$$
- **Budżet Godzin Robocizny**:
  $$\text{Budżet godzin} = \frac{\text{Transakcje}}{\text{Cel TPLH}}$$
- **Symulator Poprawy TPLH (What-If)**:
  $$\text{Godziny zaoszczędzone} = \text{Godziny Plan} - \frac{\text{Transakcje}}{\text{Symulowany TPLH}}$$
  $$\text{Oszczędność COL} = \text{Godziny zaoszczędzone} \times \text{Średni koszt godziny załogi}$$

### B. Podział Kosztów P&L
1. **Manager**:
   - `Payroll Manager`: Płaca zasadnicza brutto (etat × stawka × Store Cost % - potrącenie chorobowe 20%) + ekwiwalent odzieżowy (SM/ASM 300 zł, SSV 350 zł) + Holiday Accrual (rezerwa urlopowa).
   - `Bonus Manager`: Premia ze sprzedaży i zysku operacyjnego (Cap SM 2250 zł, ASM 1000 zł, SSV 700 zł) + JPA Accrual (367 zł dla SM) + DM costs (prowizja).
   - `Social Contribution Manager`: Składki ZUS 16.93% (emerytalne 9.76%, rentowe 6.50%, wypadkowe 0.67%) + PPK Manager (250 zł).
   - `Disability Fund Manager (PFRON)`: 200 zł / etat.
   - `Social Fund Manager`: Składki FGŚP (0.10%) + Fundusz Pracy (2.45%) = 2.55%.
   - `Other Manager`: Comp&Ben (SM 300 zł, ASM 250 zł, SSV 200 zł).
2. **Crew (Załoga)**:
   - `Payroll Crew`: Basic Salary UoP (zabezpieczenie stawką minimalną) + Ekwiwalent za odzież (0.85 zł / h) + Wynagrodzenia zleceniobiorców UZ (20 partnerów) + L4 (80%) + Urlopy (100%).
   - `Bonus Crew`: Sugerowany budżet 0.2% Sprzedaży dla załogi oraz 0.1% dla SSV No Area.
   - `Social Contribution Crew`: Narzuty ZUS 16.93% na wynagrodzenia UoP oraz narzuty od premii.
   - `Disability Fund Crew (PFRON)`: 200 zł × suma etatów UoP.
   - `Social Fund Crew`: FGŚP + FP = 2.55% od płac UoP.
   - `Other Crew`: Ryczałt medycyny pracy (150 zł) + ADP (600 zł).
3. **Drivers (Dostawy)**:
   - Koszt prowizji agregatorów: Liczba zamówień delivery (TRX) × Cost per drop (14 zł).

---

## 📑 3. Struktura Zakładek Arkusza (Excel Replica)

1. **`CALCULATOR`**: Czterokolumnowy układ wskaźników (Wskaźnik, AOP, Target, Estymacja) + prawy panel tabel personelu.
2. **`BONUS`**: Kalkulator premii SM, ASM i SSV na podstawie wskaźników Sales vs AOP oraz Ops Profit vs AOP.
3. **`Rezerwa urlopowa`**: Narzędzie bilansowej wyceny niewykorzystanych dni urlopu menedżerów (dzielnik 21 dni roboczych, ZUS 19.5%, delta m/m).
4. **`DANE`**: Tabela nominałów 2025, minimalne stawki miesięczne, dodatki nocne, stawki ZUS i katalog 96 kawiarni.
5. **`Fields Description`**: Kompletny słownik 66 wskaźników operacyjnych i finansowych Starbucks / AmRest.
6. **`USER GUIDE`**: Oficjalne wytyczne postępowania krok po kroku dla Store Managera.

---

## 🔄 4. Most Integracyjny z Modułami Suite

- **Moduł 1 (Labor Forecast)**: Zasilanie `Sales AOP`, `Transactions AOP`, `TPLH AOP`, predykcji MTD Velocity oraz wyliczonego `HANW`.
- **Moduł 2 (Managers Schedule)**: Automatyczny import składu kierowników (`manager_monthly_roster`), ich stawek, etatów, godzin dyżurów, urlopów (H), zwolnień (L4) oraz **rzeczywistych logowań RCP (MAPAL Fichajes)** zasilających kolumnę Estymacji.
- **Moduł 3 (Szkolenia)**: Zmiany T (T1-T10) zasilają w 100% pozycję `TRAINING` (75h) w budżecie Non-Coverage.
