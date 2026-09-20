# AGENTS.md — Główny Przewodnik Architektury i Modułów (Starbucks Operations Suite)

Dokument stanowi **główny rejestr architektoniczny (Root Orchestrator)** dla agentów AI pracujących z repozytorium **Starbucks Operations Suite** (`108120 SBX Warszawa Janki`, Kod jednostki: `384`).

---

## 🏛️ 1. Wizja Platformy i Architektura Modułowa

Aplikacja jest rozwijana jako wielomodułowa platforma desktopowa dla Store Managera (SM) oraz District Managera (DM).
Każdy moduł operuje jako autonomiczna jednostka biznesowa z własnymi komponentami, silnikami obliczeniowymi, instrukcjami technicznymi `AGENTS.md` oraz dokumentacją `README.md`.

```
src/
├── modules/
│   ├── labor-forecast/          # MODUŁ 1: TPLH Forecast & Labor Balancing (v1.0 Stable)
│   │   ├── components/          # Komponenty UI Modułu 1 (tabele W1-W5, kafelki, modale)
│   │   ├── services/            # Silnik AOP, MTD, Floor Hours i AI Learning
│   │   ├── index.ts             # Barrel export
│   │   ├── AGENTS.md            # Instrukcje techniczne i algorytmy Modułu 1
│   │   └── README.md            # Przewodnik użytkownika Modułu 1
│   │
│   └── managers-schedule/       # MODUŁ 2: Managers Schedule — Grafik Managerski (v1.0 Active)
│       ├── components/          # Komponenty UI Modułu 2 (matryca miesięczna, popover, zespół)
│       ├── services/            # Silnik Kodeksu Pracy, święta, bilans godzin i eksport Excel
│       ├── index.ts             # Barrel export
│       ├── AGENTS.md            # Instrukcje techniczne i reguły zmian Modułu 2
│       └── README.md            # Przewodnik użytkownika Modułu 2
│
├── components/
│   └── Header.tsx               # Wspólny pasek nawigacji z Globalnym Module Switcherem
├── services/
│   └── systemClock.ts           # Centralny zegar systemowy i stan temporalny miesięcy
├── hooks/
│   └── useSystemClock.ts        # Reaktywny hook zegara systemowego
├── types/
│   └── index.ts                 # Globalne definicje typów TypeScript
└── App.tsx                      # Główny kontener aplikacji zarządzający modułami
```

---

## 📦 2. Rejestr Modułów Platformy

### [Moduł 1: 📊 TPLH Forecast & Labor Balancing](./src/modules/labor-forecast/AGENTS.md)
- **Status**: ✅ **v1.0 Stable** (zamknięty na dalsze zmiany wsteczne; zintegrowany z Modułem 2).
- **Kopia zapasowa**: `backups/module_labor_forecast_v1_stable/`.
- **Kluczowe zagadnienia**:
  - Silnik obliczeniowy AOP (2021–2036, 192 miesiące, 1 152 tygodnie biznesowe).
  - Predykcja MTD Trend Velocity i kalkulacja wypracowanego budżetu robocizny (Earned Labor).
  - Ochrona Floor Hours: **32.0 h/dzień (272.0 h/tydzień)**.
  - Tygodniowy harmonogram poniedziałkowy (W+1 opublikowany, W+2 cel).
  - Ewidencja logowań MAPAL Fichajes z podwójnym widokiem i 2-arkuszowym eksportem Excel.
  - **Dwukierunkowy Manager Labor Bridge & Split-Week Cross-Month Bridge**: Automatyczny import godzin i zmian kierowników z Modułu 2, wyliczanie Puli Baristów ($H_{\text{Barista Pool}} = \text{HANW} - H_{\text{MGR}}$), rozbicie kolumny *Grafik (h)* na $H_{\text{MGR}} + H_{\text{BAR}}$, inspekcja dobowego Floor Hours (32h/dzień) i obsady otwarć/zamknięć AM/PM (`ManagerLaborBridgeModal`), monitoring budżetu Non-Coverage oraz pełna obsługa scalania tygodni przełomowych na styku miesięcy (trailing i leading) w spójny 7-dniowy grafik operacyjny z dobową siatką obsady (`CrossMonthBridgeCard`).
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 1](./src/modules/labor-forecast/AGENTS.md)** | **[README.md Modułu 1](./src/modules/labor-forecast/README.md)**.

### [Moduł 2: 🗓️ Managers Schedule (Grafik Managerski)](./src/modules/managers-schedule/AGENTS.md)
- **Status**: ✅ **v1.0 Active** (w pełni zaimplementowany, przetestowany).
- **Plik referencyjny**: `./Grafik/Grafik wrzesień Janki 2026.xlsm`.
- **Kopia zapasowa platformy v2.0**: `backups/release_v2_integrated_suite_stable/`.
- **Kluczowe zagadnienia**:
  - Matryca miesięczna dla zespołu 7 menedżerów kawiarni 108120 Janki z dedykowaną stawką godzinową i rolami.
  - Silnik polskiego Kodeksu Pracy (normy miesięczne, dni robocze, dni wolne, art. 130 § 2 KP).
  - Tarcza Kodeksu Pracy z inspekcją 4 norm (odpoczynek 11h, 35h tygodniowy, max 12h, max 3 niedziele).
  - **Pre-flight walidacja KP (`LaborLawViolationDialog`)**: ostrzeżenie przed zapisem naruszającej zmiany z podaniem przyczyny i artykułu KP.
  - **Katalog zmian Starbucks i reguła niedzieli**: dedykowany modal konfiguracji, blokada zmian niedzielnych w dni powszednie.
  - **Obsługa zmian Support (`SUP`, `SAM`, `SPM`)**: Wsparcie w innej kawiarni wlicza się do czasu pracy menedżera oraz rozliczenia TOR, ale nie wlicza się do obsady kawiarni Janki ani otwarć/zamknięć Janki.
  - **Dyspozycyjność menedżera, Zbiorcza Matryca i Import z Excela (`ManagerDispositionsModal`)**: Wprowadzanie dyspozycyjności (`OFF`, `M`, `Z`, `FULL`) w popoverze lub zbiorczo na dedykowanej matrycy miesiąca z inteligentnym wklejaniem danych prosto z arkusza Excela (`Ctrl+V` / Smart Paste); dyspozycyjność inna niż `OFF` wyświetla się eleganckim badge'em po lewej stronie kwadratu dnia.
  - **Wersjonowanie i publikacja 7 dni (`ScheduleVersionModal`)**: zamrożenie wersji roboczych na 7 dni przed startem (art. 129 § 3 KP), blokada cofania i automatyczny rejestr modyfikacji po publikacji.
  - **Baza norm na -10 i +10 lat (`manager_monthly_norms`) i klikalny kafelek**: 252 miesiące oficjalnych norm KP (2016–2036) z modalem manualnej edycji/przywracania (`MonthNormEditModal`).
  - **Urlop (H) i L4 per etat oraz wyłączenie weekendów i świąt (art. 154² § 1 KP)**: Chorobowe L4 i urlop H zaliczają dobowy wymiar etatu ($8.0\text{h} \times \text{etat}$, np. 6h dla 0.75, 4h dla 0.50) wyłącznie w dni robocze. W weekendy i święta państwowe wynoszą $0.0\text{h}$, nie obciążając limitu urlopowego ani nie fałszując wypracowanych godzin.
  - **Kalendarz Dni Wolnych i Niedziel Handlowych na Matrycy**: Wizualizacja 7 niedziel handlowych w roku (ustawa o handlu) oraz świąt państwowych w nagłówku tabeli (`STATUS`: `ŚWIĘTO`, `🛒 HANDL.`, `WOLNA`, `SOB`, `Praca`), unikalne podświetlenia kolumn oraz baner podsumowania kalendarza miesiąca.
  - **Trzymiesięczny Okres Rozliczeniowy (`TorView`, `torEngine`)**: Kwartalne rozliczenie menedżerów Q1–Q4 z podziałem na 3 kolumny godzinowe per miesiąc: **RCP (h)**, **H (h)**, **L4 (h)** oraz **Bilans**, saldo kwartału (status: `OK`, `nadgodziny`, `niedogodziny`) z dedykowanym eksportem do Excela `.xlsx`.
  - **Reguła pierwszeństwa L4 nad H (art. 166 KP)**: Zachorowanie pracownika w trakcie zaplanowanego urlopu zalicza godziny wyłącznie do kolumny `L4` i nie obciąża urlopu `H`.
  - **Blokada edycji zamkniętych miesięcy (`isMonthClosed`)**: Miesiące przeszłe względem bieżącego czasu systemowego przechodzą w tryb tylko do odczytu z blokadą edycji grafiku, notatek, matrycy dyspozycji i normy miesiąca oraz oznaczeniem `🔒 Miesiąc zamknięty`.
  - **Inspekcja Kodeksu Pracy na przejściach między miesiącami**: Weryfikacja odpoczynku 11h na granicy miesięcy ($M-1 \rightarrow D_1$ oraz $D_{last} \rightarrow M+1$), ciągłości 35h odpoczynku tygodniowego i serii kolejnych pracujących niedziel.
  - **Integracja RCP z systemem MAPAL Fichajes**: Automatyczne zasilanie kolumny `RCP (h)` rzeczywistymi godzinami menedżerów ze wszystkich kawiarni (w tym dyżury i wsparcia poza lokalem 108120 Janki); kolumna RCP jest nieedytowalna, zabezpieczona przed manipulacją.
  - **Detekcja kolizji RCP vs L4 / H (`RcpAbsenceConflictDialog`)**: Ciągły nadzór nad logowaniami w systemie MAPAL w dniach zaplanowanych absencji (chorobowe L4 i urlop H); sygnalizacja w UI pulsującym badge'em `⚡`, dedykowany baner ostrzegawczy, dialog ze szczegółami kolizji i rekomendacjami SM oraz pre-flight ostrzeżenie przy próbie manualnego przypisania L4/H na zalogowane godziny.
  - **Nawigacja Klawiaturą w Grafiku Managerskim (`ManagerScheduleGrid`)**: Błyskawiczne poruszanie się po matrycy strzałkami (`↑`, `↓`, `←`, `→`), `Tab` / `Shift+Tab`, `Home`, `End` z zielonym podświetleniem aktywnej komórki i płynnym autoscrollem; bezpośrednie wprowadzanie zmian klawiszami `A` (AM), `P` (PM), `O` (OFF), `H` (Urlop), `L` (L4), `Delete`/`Backspace` (Wyczyść) oraz `Enter`/`Spacja` (pełny popover) z automatyczną pre-flight walidacją Tarczy Kodeksu Pracy.
  - **Autonomiczny Skład Miesięczny Menedżerów i Auto-Dziedziczenie (`manager_monthly_roster`, `ManagerTeamModal`)**: Każdy miesiąc posiada autonomiczny skład zespołu kierowników. Nowo otwierany miesiąc automatycznie dziedziczy strukturę zespołu z miesiąca poprzedniego. Edycja składu (dodanie, usunięcie ze składu, zmiana roli/etatu/stawki) jest w 100% izolowana dla wybranego miesiąca z opcjonalnym przełącznikiem propagacji na miesiące przyszłe (`propagateToFuture`). Zapewniona pełna obsługa menedżerów odchodzących i dochodzących (np. Hanna Domachowska w lipcu i sierpniu 2026, brak we wrześniu 2026; Dawid Apel jako SSV w lipcu i ASM w sierpniu/wrześniu). W rozliczeniu kwartalnym TOR (`TorEngine`, `TorView`) menedżerowie z częściowym zatrudnieniem mają normy i godziny naliczane wyłącznie za miesiące ich aktywności w składzie (`normHours = 0.0h`, `isActiveInMonth = false` w miesiącach po odejściu lub przed zatrudnieniem).
  - **System Bezpieczeństwa i Kopii Zapasowych SQLite (`BackupManager`, `DatabaseBackupModal`)**: Automatyczny menedżer backupów z bezpieczną rotacją ostatnich 15 kopii w `backups/db_backups/`; automatyczne zrzuty bazy przed publikacją wersji grafiku (`pre_version_publish`), importem MAPAL (`pre_import_mapal`) i startem aplikacji (`auto_startup`); dedykowany interfejs w UI do tworzenia ręcznych kopii oraz bezpiecznego przywracania z automatyczną kopią ratunkową (`pre_restore_safety`).
  - **Obsługa zmian Support ze wszystkich kawiarni i słownik zdrobnień (`NICKNAME_MAP`)**: Godziny wypracowane przez menedżerów na wsparciach w obcych lokalach (np. Nowy Świat 323, Sadyba 341, San Park 756, Arkadia 327 itd.) wliczają się w 100% do ich etatu w grafiku i rozliczeniu kwartalnym TOR. Wbudowany słownik polskich zdrobnień (`canonicalToken`: `Gabi` $\leftrightarrow$ `Gabriela`, `Zuza` $\leftrightarrow$ `Zuzanna`, `Werka` $\leftrightarrow$ `Weronika`, `Hania` $\leftrightarrow$ `Hanna`, `Ola` $\leftrightarrow$ `Aleksandra` itd.) zapewnia bezbłędną integrację nazwisk z systemu MAPAL Fichajes.
  - **Ścisła separacja Modułu 1 i Modułu 2 w zasilaniu RCP**: Zapytania kalkulacyjne Modułu 1 (TPLH forecast, velocity MTD, floor hours, wagi dni) filtrują dane ściśle po kawiarni 108120 Janki (`unit_code = '384'`), chroniąc lokalny budżet robocizny przed zawyżeniem godzinami ze wsparć. Moduł 2 uwzględnia dyżury menedżera ze wszystkich lokali Starbucks.
  - **Kompletny rejestr 9 miesięcy grafików operacyjnych 2026 (Styczeń – Wrzesień)**: Zaimportowano wszystkie 9 plików grafików `.xlsm` z katalogu `Grafik/`. System posiada pełną bazę zmian, miesięcznych składów autorskich (`manager_monthly_roster` z rolami, etatami i stawkami) oraz ważnych wydarzeń (audyty, CSR, wizyty zarządu Brian Niccol, start Pumpkin), zasilając kwartały Q1, Q2 oraz Q3 2026 w module TOR.
  - **Dostosowywanie godzin zmian elastycznych (MID, SUP, SAM, SPM, NC) per zmiana oraz globalne presety (`ShiftPickerPopover`, `ShiftConfigModal`, `ManagerScheduleGrid`)**: Menedżerowie i Store Manager mogą elastycznie ustalać godziny dobowe dla zmian wsparciowych, administracyjnych i środkowych w popoverze grafiku (`ShiftPickerPopover`) za pomocą szybkich pigułek presetów (`4.0h`, `5.0h`, `6.0h`, `7.0h`, `8.0h`, `9.0h`, `10.0h`) lub precyzyjnego steppera `+/- 0.5h` (od 1.0h do 12.0h). W siatce grafiku zmiany o niestandardowym wymiarze są prezentowane z czytelnym indeksem godzin (np. `NC 4h`). W oknie konfiguracji katalogu zmian (`ShiftConfigModal`) dostępna jest dedykowana zakładka *Elastyczne & Presety* pozwalająca 1-klikiem ustawić globalny domyślny wymiar w katalogu. Pre-flight Tarcza Kodeksu Pracy (limit dobowy 12h, odpoczynek 11h) oraz kwartalny bilans TOR w 100% uwzględniają dostosowany wymiar godzinowy.
  - **Dostosowywanie przedziału czasowego zmian (Od – Do, np. 09:00 – 17:00 zamiast 08:00 – 16:00) (`ShiftPickerPopover`, `ManagerScheduleEngine`, `manager_schedule_shifts`)**: Pełna elastyczność ustawiania konkretnych godzin rozpoczęcia i zakończenia zmiany z inteligentną synchronizacją w popoverze (`ShiftPickerPopover`). Zmiana godziny rozpoczęcia automatycznie przelicza godzinę zakończenia zgodnie z wybranym wymiarem godzinowym; zmiana godziny zakończenia przelicza wymiar godzinowy; presety startu (`07:00`, `08:00`, `08:30`, `09:00`, `10:00`, `11:00`...) oraz przyciski steppera `+/- 30m`. Wartości `custom_start_time` i `custom_end_time` są trwale persystowane w bazie SQLite, wyświetlane w tooltipie komórki i badgu w siatce grafiku oraz włączone w pre-flight walidację Tarczy Kodeksu Pracy (weryfikacja 11h odpoczynku dobowego art. 132 KP między kolejnymi dniami oraz na przejściach miesięcy uwzględnia rzeczywisty przedział godzinowy).
  - Bieżący bilans godzin (+/- h), licznik dni OFF i weryfikacja obsady otwarć/zamknięć (AM/PM).
  - Wiersz ważnych wydarzeń operacyjnych (promocje, audyty, wsparcia).
  - Wzbogacony tooltip komórki w siatce grafiku informujący o lokalu wsparcia MAPAL (`📍 Zalogowano wsparcie MAPAL: Xh w [Nazwa Lokalu] (kod: XXX)`).
  - Generator eksportu arkusza `.xlsx` odwzorowujący układ szablonu.
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 2](./src/modules/managers-schedule/AGENTS.md)** | **[README.md Modułu 2](./src/modules/managers-schedule/README.md)**.

---

## 🏗️ 3. Globalny Stos Technologiczny

- **Desktop Framework**: Electron 34+ z Vite 8+
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 z oficjalnym pluginem `@tailwindcss/vite`
- **Kolorystyka Starbucks**:
  - Czysta biel: `#FFFFFF`
  - Ciepłe tło: `#F7F9F8` i `#F4F7F5`
  - House Green: `#006241`
  - Dark Forest Green: `#1E3932`
  - Accent Light Green: `#00754A`
  - Gold: `#CBA258`
  - Border: `#E2E8E5`
- **Baza danych**: SQLite (`sql.js` WebAssembly) z persystencją plikową w `data/tplh_forecast.db`
- **Eksport/Import**: SheetJS (`xlsx`)
- **Wykresy**: Recharts

---

## 🗄️ 4. Schemat Bazy Danych SQLite (`data/tplh_forecast.db`)

1. **Tabele Modułu 1**:
   - `stores`: ustawienia kawiarni (kod 384, nazwa, floor hours).
   - `aop_plans`: budżety miesięczne AOP (2021–2036).
   - `calendar_weeks`: kalendarz tygodni biznesowych z wagami i Floor Hours.
   - `labor_actuals_log`: logowania RCP z systemu MAPAL.
   - `weekly_actual_trx`: rzeczywiste transakcje i ułożone grafiki SM.
   - `floor_rules` & `nc_rules`: reguły obsady i zadań stałych.
2. **Tabele Modułu 2**:
   - `manager_employees`: lista kierowników (rola, etat, stawka godzinowa, kolejność, status).
   - `shift_definitions`: katalog zmian Starbucks z godzinami i kategoriami.
   - `manager_schedule_shifts`: przypisane zmiany menedżerów per dzień.
   - `manager_schedule_events`: wydarzenia i notatki dzienne.
3. **Indeksy Wydajnościowe**:
   - `idx_labor_week_key`, `idx_labor_date`, `idx_labor_year_month`, `idx_calendar_year_month`
   - `idx_mgr_shifts_ym`, `idx_mgr_shifts_emp`, `idx_mgr_events_ym`.

---

## 💻 5. Komendy Deweloperskie

- `npm run dev`: start serwera Vite i okna Electrona z hot-reloadingiem.
- `npm run build`: pełna walidacja typów TypeScript (`tsc`) oraz produkcyjne bundle (`dist/` i `dist-electron/`).
- `npx tsc --noEmit`: szybka weryfikacja statyczna typów.
