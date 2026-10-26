# Original User Request

## Initial Request — 2026-10-24T00:12:17Z

Comprehensive audit and production hardening of the Starbucks Operations Suite to support 100+ autonomous stores, purge all hardcoded defaults (e.g. 108120 Janki fallbacks), eliminate AI placeholder texts, implement hybrid per-store AES-256 cloud encryption in Firebase, and provide a seamless cloud migration bridge to safely transfer all existing local store data to cloud vaults.

Working directory: /Users/dawidapel/COL Tool
Integrity mode: development

## Requirements

### R1. Deep Codebase Audit & Elimination of Mock/Hardcoded Data & AI Artifacts
Conduct an exhaustive audit across the entire codebase (frontend components, services, Electron IPC handlers, and Firestore rules) to remove all hardcoded fallback values, unit codes (e.g. static '18120' / '108120' / '384' defaults), mock schedules, dummy sales metrics, and AI filler texts. On clean launch, the application must require proper store initialization via onboarding rather than assuming a pre-configured store.

### R2. Scalable Multi-Store Architecture (100+ Stores Support)
Ensure full operational isolation and scalability for over 100 Starbucks stores. Each store operates independently with its unique unit code, MPK, shift configurations, and SQLite database storage (`store_${id}.db`). Switching between stores must guarantee clean cache invalidation, separate state contexts, and zero cross-store data leakage.

### R3. Hybrid Per-Store Cloud Encryption for Firebase/Firestore
Implement hybrid cloud security:
1. Client-Side AES-256-GCM encryption for all sensitive payloads (financial P&L, employee hourly rates, contracts, private staff vault data) using a store-specific cryptographic key before writing to Firebase.
2. Production Firestore Security Rules enforcing strict per-store tenant isolation (`/stores/{storeId}/*`) and role-based access control (RBAC) for operational data (public schedules, shift logs).

### R4. Local-to-Cloud Migration Bridge (Zero Data Loss)
Provide an automated or guided bulk migration bridge allowing the user to seamlessly encrypt and push all existing local store datasets (including all previously created schedules, employee rosters, and historical records) into their respective per-store cloud vaults in Firebase without losing any active data.

## Acceptance Criteria

### Audit & Data Hygiene
- [ ] Automated scan verifies zero occurrences of static fallback store codes ('18120', '108120', '384') hardcoded as logic defaults in `src/` and `electron/`.
- [ ] No placeholder AI filler texts, fake employee records, or mock financial numbers exist in production UI views.
- [ ] Fresh app launch with an empty profile displays the onboarding flow to select or configure a store from the store catalog.

### Multi-Store Isolation & Scale
- [ ] Store switching cleanly unloads prior store state and connects to the selected store's isolated SQLite database.
- [ ] The app handles 100+ distinct store configurations without performance degradation or database locking conflicts.

### Security & Encryption Integrity
- [ ] Sensitive financial and HR documents written to Firebase Firestore contain only ciphertext payloads (AES-256-GCM) that cannot be deciphered without the store's cryptographic key.
- [ ] Firestore Security Rules successfully validate store boundaries (`request.auth.token.storeId == storeId`) and reject cross-store access attempts.
- [ ] Cryptographic unit tests verify round-trip encryption/decryption with valid keys and rejection of invalid keys.

### Data Migration & Preservation
- [ ] The migration bridge reads all existing local store records and successfully uploads them to the corresponding store cloud vaults in Firebase.
- [ ] Verification check proves 100% data parity between local legacy records and synced cloud records.
- [ ] Application builds without TypeScript or Vite errors (`npm run build`).


## Follow-up — 2026-10-24T00:24:38Z

Perform an in-depth 360° architectural, mathematical, and operational audit of Module 1: Labor Forecast (`src/modules/labor-forecast/`) for Starbucks Store 18120 (CH Janki), and deliver a prioritized improvement roadmap and architectural RFCs strictly in design mode (no source code modifications).

Working directory: `/Users/dawidapel/COL Tool`
Integrity mode: development

## Requirements

### R1. Mathematical & Forecasting Engine Audit
Evaluate the mathematical rigor, stability, and edge-case resilience of `src/modules/labor-forecast/services/calculationEngine.ts` and `trendLearningEngine.ts`.
- Verify AOP day weighting ($W_i$) across Tuesday–Monday business cycles.
- Audit MTD Velocity prediction, temporal states (`past`, `current`, `future`), and Earned Labor Budget calculations.
- Audit the absolute enforcement of the Floor Hours rule (32.0 h/day, 224.0 h/week base) and Flex Pool behavior.
- Validate Monday Flash Forecast (Pre-closing projection) behavior and seamless Tuesday transition.
- Test edge cases: negative budget deltas, zero TRX, extreme sales spikes (e.g. trading Sundays at ~250% norm in CH Janki), and rounding discrepancies.

### R2. Architecture & Data Flow Audit
Audit the structural integrity, separation of concerns, and integration boundaries of Module 1.
- Audit the Cross-Month Split-Week Bridge (`CrossMonthBridgeCard.tsx`, boundary shift handling for `trailing` and `leading` split weeks).
- Audit the Manager Labor Bridge integration with Module 2 (exclusion of foreign support shifts `SAM`/`SPM`/`SUP` and leaves `OFF`/`L4`/`H`, calculation of Remaining Barista Hours Pool, and Non-Coverage tracking).
- Audit data fetching, local state management, and SQLite query efficiency in `src/modules/labor-forecast/`.
- Identify architectural bottlenecks, coupling issues, or missing abstractions.

### R3. Operational Workflow & UX Audit for Store Manager
Analyze the Store Manager operational journey within Module 1 against the weekly scheduling rhythm.
- Evaluate the Monday schedule release workflow (clarity of recommendations, alert visibility in `OperationalAlert.tsx`).
- Evaluate the ergonomics of `WeeklyScheduleTable.tsx` (MGR vs Barista hour breakdown, inline overrides).
- Assess the readability and cognitive load of KPI cards (`KpiSummaryCards.tsx`) and Trend Intelligence (`TrendIntelligencePanel.tsx`).

### R4. Strategic Improvement Proposals (RFC & Roadmap)
Synthesize all audit findings into a structured, prioritized architectural specification and improvement roadmap.
- Provide concrete algorithmic refinements with mathematical formulas.
- Provide architectural recommendations (e.g. modular decoupling, typed bridge contracts).
- Categorize proposals into: Quick Wins, Medium-Term Refactorings, and Long-Term Innovations.
- Strictly adhere to Design Mode: do not modify or create application source code files.

## Acceptance Criteria

### Completeness & Coverage
- [ ] Audit covers all 3 core pillars: Mathematical/Forecasting engine, Software Architecture/Integrity, and Store Manager UX/Operations.
- [ ] Audit specifically evaluates CH Janki rules: 32.0 h/day Floor Hours, 7 Trading Sundays vs Non-Trading Sundays, and Manager Labor Bridge exclusions.
- [ ] Every identified issue or vulnerability includes direct file references and mathematical or code citations from `src/modules/labor-forecast/`.

### Rigor & Verification
- [ ] Mathematical edge-case analysis includes specific numeric scenarios (e.g. under-floor HANW Raw, missing Monday MAPAL actuals, split-week boundary mismatches).
- [ ] Audit report classifies findings by severity: Critical (P0), High (P1), Medium (P2), and Low/Enhancement (P3).
- [ ] Architecture recommendations include actionable technical designs (RFCs) without altering repository code files.
- [ ] Repository integrity: zero modifications made to application source code files (`git status` remains clean).


## Follow-up — 2026-10-24T00:24:55Z

Kompleksowy audyt 360° architektury, algorytmów Kodeksu Pracy, wydajności solvera AutoScheduler AI oraz ergonomii Modułu 2: Managers Schedule w projekcie Starbucks Operations Suite wraz z opracowaniem katalogu gotowych do wdrożenia propozycji usprawnień w trybie ściśle projektowym (bez wprowadzania zmian w plikach kodu źródłowego).

Working directory: /Users/dawidapel/COL Tool
Integrity mode: development

## Requirements

### R1. Audyt Zgodności z Kodeksem Pracy i Standardami Starbucks Janki
Przeanalizować implementację i przypadki brzegowe weryfikatora norm prawnych (art. 130, 132 [11h], 133 [35h], 135 [12h], 151¹⁰ [4. niedziela], 154² i 166 KP [H i L4]), ze szczególnym uwzględnieniem ciągłości na przejściach miesięcy ($M-1 \rightarrow D_1$ oraz $D_{\text{last}} \rightarrow M+1$), autonomicznego składu miesięcznego oraz specyfiki lokalu 108120 Janki (niedziele handlowe, kody AMN/PMN, obsada Floor Hours).

### R2. Audyt Wydajności i Jakości Heurystyk Solvera AutoScheduler AI (20k prób)
Zbadać architekturę obliczeniową solvera Monte Carlo (20 000 prób w batchach), obciążenie wątku UI/React, heurystyki sprawiedliwości (Fairness & Equity: rozkład weekendów, rotacja zamknięć, pakiety 2 dni OFF, korytarze tygodniowe) oraz asystenta negocjacji sytuacji patowych.

### R3. Audyt Kwartalnego Rozliczenia TOR (Q1–Q4) i Ewidencji Fichajes RCP
Zweryfikować poprawność 3-kolumnowego modelu godzinowego (RCP, H, L4), obsługę częściowego zatrudnienia bez fałszywych niedogodzin, odporność na brakujące wpisy w bazie oraz mechanizm detekcji kolizji RCP vs absencje (L4/H).

### R4. Katalog Architektonicznych i Ergonomicznych Rekomendacji (Design Mode Only)
Sformułować ustrukturyzowany, priorytetyzowany katalog usprawnień architektonicznych, algorytmicznych (np. delegacja do Web Workera, ulepszone scoringi heurystyk) oraz UX/UI (ergonomia pracy Store Managera na zapleczu). Całość ma mieć charakter analityczno-projektowy bez bezpośredniej edycji plików w repozytorium.

## Acceptance Criteria

### Weryfikacja Analityczna Kodeksu Pracy i Danych
- [ ] Zidentyfikowanie i udokumentowanie minimum 3 specyficznych scenariuszy brzegowych (np. styk lat/kwartałów, przejście pracownika w trakcie miesiąca na inny etat, nakładanie się świąt na niedziele handlowe).
- [ ] Raport potwierdza zgodność algorytmów z referencyjnym arkuszem `Grafik wrzesień Janki 2026.xlsm`.

### Solver AutoScheduler & Wydajność
- [ ] Przedstawienie konkretnej specyfikacji architektonicznej dla ewentualnego oddelegowania obliczeń solvera do Web Workera / Worker Threads (z uwzględnieniem serializacji danych stanu).
- [ ] Identyfikacja wąskich gardeł w obecnej pętli 20k prób i propozycja ulepszeń funkcji heurystyki celu (score function).

### Tryb Projektowy i Jakość Dokumentacji
- [ ] Żaden plik kodu źródłowego (`.ts`, `.tsx`, `.js`, `.json`) w katalogu `src/` nie zostaje zmodyfikowany (zero mutacji kodu).
- [ ] Raport końcowy dostarczony w ustrukturyzowanej formie z podziałem na: Diagnoza Stanu Obecnego, Wykryte Ryzyka / Dług Techniczny, Propozycje Usprawnień (Szybkie wygrane / Długofalowe) oraz Rekomendowana Mapa Drogowa.


## Follow-up — 2026-10-24T00:44:10Z

Kompleksowy projekt architektoniczny i operacyjny doprowadzenia Modułu 4 (COL Calculator / Cost of Labor Suite) ze stanu szkieletowego/początkowego do w pełni funkcjonalnego, spójnego i zintegrowanego modułu platformy Starbucks Operations Suite (`108120 SBX Warszawa Janki`), w pełnej synergii z Modułem 1 (Labor Forecast), Modułem 2 (Managers Schedule & RCP) oraz Modułem 3 (Trainings). Zadanie realizowane jest w trybie projektowania architektonicznego (strictly design mode — bez wprowadzania zmian w kodzie produkcyjnym).

Working directory: /Users/dawidapel/COL Tool
Integrity mode: development

## Requirements

### R1. Architektura Silnika P&L i Modelu 3 Filarów (AOP, Target, Estymacja MTD)
Zaprojektować kompletny, produkcyjny model kalkulacyjny P&L dla Starbucks/AmRest:
- Szczegółowa specyfikacja algorytmów w `colEngine`:
  - 🏛️ Filar AOP: źródła danych rocznych (Sales, TRX, TPLH, Budżet PLN, COL % AOP),
  - 🎯 Filar Target: plan miesięczny tworzony przez SM, wyliczanie godzin menedżerów i załogi,
  - ⚡ Filar Estymacja: dynamiczna estymacja domknięcia miesiąca w oparciu o postęp miesiąca (MTD),
  - Automatyczne wyliczanie odchyleń $\Delta$ vs AOP i $\Delta$ vs Target (kwotowe w PLN i punktach procentowych p.p.).
- Formuły finansowe P&L:
  - Total COL % ($\frac{\text{Total COL Costs}}{\text{Sales}}$), TPLH Total vs TPLH Coverage (z wyłączeniem urlopów i szkoleń),
  - Narzuty ZUS (16.93%, FP/FGŚP 2.55%, PFRON 200 zł/etat) z rygorystycznym podziałem na Menedżerów, Załogę UoP (zabezpieczenie stawką minimalną 2025/2026) oraz Zleceniobiorców UZ (stawki godzinowe),
  - Rezerwa urlopowa (Holiday Accrual, dzielnik 21 dni roboczych), ekwiwalent odzieżowy (0.85 zł/h dla załogi, ryczałty dla MGR), bonusy SM/ASM/SSV oraz koszty dostaw (delivery orders $\times$ drop cost 14 zł).

### R2. Architektura Integracji Między-Modułowej (End-to-End Data Bus)
Zaprojektować bezszwowy i automatyczny przepływ danych pomiędzy Modułem 4 a całą aplikacją:
- Integracja z Modułem 1 (Labor Forecast):
  - Automatyczny import `Sales AOP`, `TRX AOP`, `TPLH AOP`,
  - Pobieranie predykcji MTD Velocity i trendu sprzedaży na dany miesiąc,
  - Synchronizacja zapotrzebowania godzinowego (`HANW`).
- Integracja z Modułem 2 (Managers Schedule & Fichajes RCP):
  - Automatyczne pobieranie składu menedżerów (`manager_monthly_roster`), ich etatów, stawek bazowych oraz zaplanowanych godzin z grafiku (Moduł 2),
  - Dwutorowa zasilana kolumna Estymacji: dla dni przeszłych rzeczywiste godziny pracy z ewidencji MAPAL Fichajes (RCP), dla dni przyszłych zaplanowane godziny z grafiku,
  - Synchronizacja absencji: zwolnienia chorobowe L4 (80% / potrącenie 20%) i urlopy wypoczynkowe (H).
- Integracja z Modułem 3 (Trainings):
  - Automatyczny transfer godzin szkoleń baristycznych (sesje T1-T10) do pozycji budżetowej Non-Coverage (`TRAINING` 75h), bez obciążania godzin Floor.
- Warstwa Danych SQLite:
  - Projekt schematu tabel dla Modułu 4 w SQLite z zachowaniem Multi-Store Isolation (`store_${id}.db`) i separacji bazy użytkownika w Application Support.

### R3. Architektura UI/UX i Modułów Arkuszy (Excel Replica & Symulator What-If)
Zaprojektować ergonomiczną architekturę interfejsu repliki oficjalnego arkusza Excel:
- Układ 6 zakładek: `CALCULATOR` (główny widok 3 Filarów + edytory personelu), `BONUS` (matryca premiowa), `Rezerwa urlopowa`, `DANE` (nominały, stawki, lista kawiarni), `Fields Description` (słownik 66 wskaźników) oraz `USER GUIDE`,
- Architektura interaktywnego symulatora What-If P&L: dynamiczny suwak/pole poprawy TPLH, natychmiastowe przeliczanie zaoszczędzonych godzin załogi i zysku finansowego w PLN i % COL,
- Ergonomia i responsywność pod kątem pracy Store Managera na laptopie na zapleczu (wygodna edycja, skróty klawiszowe, wyraźne wskaźniki statusu KPI).

### R4. Kompletny Blueprint Realizacyjny (Fazy Wdrożenia i Specyfikacja Zadań)
Dostarczyć gotową do wdrożenia, szczegółową roadmapę implementacyjną w podziale na logiczne etapy:
- Faza 1: Modele danych i schemat SQLite (tabele, relacje, migracje),
- Faza 2: Silnik obliczeniowy `colEngine` i testy regresyjne matematyki P&L,
- Faza 3: Usługi integracyjne (mosty z Modułami 1, 2 i 3),
- Faza 4: Interfejs użytkownika, zakładki Excela i symulator What-If.

## Acceptance Criteria

### Wymagania wobec Raportu Projektowego
- [ ] Kompletny blueprint architektoniczny Modułu 4: od struktur danych SQLite, przez silnik obliczeniowy, aż po UI.
- [ ] Precyzyjne zdefiniowanie kontraktów interfejsowych (API / TypeScript types) dla wymiany danych z Modułem 1, Modułem 2 (Fichajes) i Modułem 3.
- [ ] Dokładna specyfikacja matematyczna wszystkich 66 wskaźników i formuł P&L Starbucks/AmRest.
- [ ] Szczegółowy projekt UI/UX uwzględniający realia pracy Store Managera.
- [ ] Harmonogram wdrożenia podzielony na etapy, przygotowany do późniejszej implementacji.
- [ ] Raport pozostaje ściśle w trybie projektowym — bez wprowadzania modyfikacji w plikach źródłowych projektu.
