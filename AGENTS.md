# AGENTS.md — Główny Przewodnik Architektury i Modułów (Starbucks Operations Suite)

Dokument stanowi **główny rejestr architektoniczny (Root Orchestrator)** dla agentów AI pracujących z repozytorium **Starbucks Operations Suite** (`108120 SBX Warszawa Janki`, Kod jednostki: `18120`).

---

## 🔒 0. Żelazna Zasada Bezpieczeństwa: Zero Danych Wrażliwych w Git (Code-Only Repository Policy)

> [!CRITICAL]
> **BEZWZGLĘDNA REGUŁA DLA WSZYSTKICH AGENTÓW AI I DEPLOYMENTU:**
> Repozytorium Git (`apeldawid-hub/COL-TOOL`) oraz pakiety aktualizacji publikowane online zawierają **WYŁĄCZNIE CZYSTY KOD ŹRÓDŁOWY APLIKACJI** (TypeScript, React, Electron, Tailwind CSS, ikony `.icns`/`.png`, skrypty budowania oraz dokumentację techniczną `AGENTS.md` / `README.md`).
> 
> 1. **Bezwzględny zakaz śledzenia i commitowania danych operacyjnych:**
>    - Żadne pliki arkuszy Excel (`Grafik/`, `AOP/`, `COL CALC/`, `*.xlsx`, `*.xlsm`, `*.xls`)
>    - Żadne pliki szkoleń i dokumentów wewnętrznych (`Szkolenia/`, `*.pdf`)
>    - Żadne bazy danych i zrzuty tabel (`data/`, `IMPORT/`, `backups/`, `*.db`, `*.csv`)
>    - Żadne poświadczenia i tokeny dostępowe (`.env`, `GH_TOKEN`)
> 2. **Aktualizowany jest wyłącznie program:**
>    - Każda kolejna wersja (np. `v2.7.0`, `v2.8.0`...) podmienia wyłącznie kod aplikacji (`dist/`, `dist-electron/`, `.app`).
>    - Baza danych użytkownika na docelowym komputerze jest trwale odseparowana w systemowym folderze `~/Library/Application Support/Starbucks Operations Suite/` — instalacja nowej wersji kodu nigdy nie narusza ani nie kasuje wprowadzonych danych.

### 🔄 0.1. Standardowy Cykl Pracy: Development ➔ Release on Demand

1. **Wszystkie zmiany w trybie deweloperskim:**
   - Wszelkie modyfikacje kodu, interfejsu, algorytmów oraz nowe moduły są tworzone i testowane lokalnie w środowisku deweloperskim (`npm run dev` z szybkim odświeżaniem Vite Hot-Reload).
2. **Publikacja wydania WYŁĄCZNIE na wyraźne polecenie Użytkownika:**
   - Nowa wersja produkcyjna oraz pakiety aktualizacji na GitHub (`COL-TOOL Releases`) są kompilowane i wysyłane **tylko wtedy, gdy Użytkownik wyda wyraźne polecenie publikacji/aktualizacji**.
   - Procedura publikacji na żądanie:
     1. Podbicie wersji w `package.json` (np. `2.6.0` $\rightarrow$ `2.7.0`).
     2. Walidacja czystej kompilacji (`npm run build`).
     3. Automatyczny deploy i publikacja pakietu (`npm run publish:mac`).
     4. Zsynchronizowanie czystego kodu z gałęzią `main` w Git.

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
│   ├── managers-schedule/       # MODUŁ 2: Managers Schedule — Grafik Managerski (v1.0 Active)
│   │   ├── components/          # Komponenty UI Modułu 2 (matryca miesięczna, popover, zespół)
│   │   ├── services/            # Silnik Kodeksu Pracy, święta, bilans godzin i eksport Excel
│   │   ├── index.ts             # Barrel export
│   │   ├── AGENTS.md            # Instrukcje techniczne i reguły zmian Modułu 2
│   │   └── README.md            # Przewodnik użytkownika Modułu 2
│   │
│   └── trainings/               # MODUŁ 3: Szkolenia — Starbucks Training Suite (v1.0 Active)
│       ├── components/          # Komponenty UI Modułu 3 (Zmiany T, Skill Check, Oś Czasu, Partnerzy)
│       ├── services/            # Szablony T1-T10, kryteria egzaminacyjne i silnik kalkulacji
│       ├── types/               # Typy TypeScript Modułu 3
│       ├── index.ts             # Barrel export
│       ├── AGENTS.md            # Instrukcje techniczne Modułu 3
│       └── README.md            # Przewodnik użytkownika Modułu 3
│
│   └── col-calculator/          # MODUŁ 4: COL Calculator — Cost of Labor Suite (v1.0 Active)
│       ├── components/          # Komponenty UI Modułu 4 (Siatka 1:1 Excel, BONUS, Rezerwa, DANE)
│       ├── services/            # Silnik kalkulacyjny P&L, ZUS 19.48%, What-If i dane fabryczne
│       ├── types/               # Typy TypeScript Modułu 4
│       ├── index.ts             # Barrel export
│       ├── AGENTS.md            # Instrukcje techniczne Modułu 4
│       └── README.md            # Przewodnik użytkownika Modułu 4
│
├── components/
│   ├── LoginView.tsx            # Ekran logowania Starbucks z wyborem profilu SM/DM/ASM
│   ├── OnboardingWizardView.tsx # Pełnoekranowe Menu Startowe / Kreator Pierwszego Uruchomienia
│   ├── Sidebar.tsx              # Wysuwany pasek boczny z modułami i narzędziami (collapsible)
│   ├── DashboardView.tsx        # Domyślny pulpit podsumowania po zalogowaniu
│   ├── ModulePlaceholderView.tsx# Szablon modułów w budowie (Analiza, IBS&IMS)
│   ├── Header.tsx               # Pasek kontekstu, selektory okresu AOP i profilu
│   ├── DatabaseBackupModal.tsx  # Modal kopii zapasowych SQLite
│   ├── ErrorBoundary.tsx        # Globalna Tarcza Antyawaryjna (Starbucks Crash Screen)
│   ├── BugReporterModal.tsx     # Centrum Zgłaszania Błędów & Diagnostyki
│   ├── AppUpdateModal.tsx       # Modal sprawdzania i instalacji aktualizacji
│   └── UnifiedSettingsModal.tsx # Centralny modal konfiguracji modułów
├── services/
│   ├── systemClock.ts           # Centralny zegar systemowy i stan temporalny miesięcy
│   └── logger.ts                # Klient logowania, telemetria i bufor Czarnej Skrzynki
├── hooks/
│   └── useSystemClock.ts        # Reaktywny hook zegara systemowego
├── types/
│   └── index.ts                 # Globalne definicje typów TypeScript (AppModule)
└── App.tsx                      # Główny kontener aplikacji zarządzający sesją i routingiem modułów
```

---

## 📦 2. Rejestr Modułów Platformy

### [Moduł 1: 📊 TPLH Forecast & Labor Balancing](./src/modules/labor-forecast/AGENTS.md)
- **Status**: ✅ **v1.0 Stable** (zamknięty na dalsze zmiany wsteczne; zintegrowany z Modułem 2).
- **Kopia zapasowa**: `backups/module_labor_forecast_v1_stable/`.
- **Kluczowe zagadnienia**:
  - Silnik obliczeniowy AOP (2021–2036, 192 miesiące, 1 152 tygodnie biznesowe).
  - Predykcja MTD Trend Velocity i kalkulacja wypracowanego budżetu robocizny (Earned Labor).
  - Ochrona Floor Hours: **32.0 h/dzień (1 MGR + 1 Barista rano/AM + 1 MGR + 1 Barista wieczorem/PM = 224.0 h/tydzień bazy nienaruszalnej)**.
  - **Pula Flex & Manipulacja Zmianami Baristów w każdym tygodniu**: Uczenie maszynowe na podstawie ułożonych grafików i historii transakcji/robocizny z poprzednich miesięcy/lat wylicza w każdym tygodniu (W1–W5) pulę godzin ponad Floor ($H_{\text{Tydzień}} - H_{\text{Floor}}$) oraz sugeruje konkretne dobowe widełki i manipulację zmianami w poszczególne dni (szczyty Sob/Pt vs oszczędności w dni powszednie).
  - Tygodniowy harmonogram poniedziałkowy (W+1 opublikowany, W+2 cel).
  - Ewidencja logowań MAPAL Fichajes z podwójnym widokiem i 2-arkuszowym eksportem Excel.
  - **Dwukierunkowy Manager Labor Bridge & Split-Week Cross-Month Bridge**: Automatyczny import godzin i zmian kierowników z Modułu 2, wyliczanie Puli Baristów ($H_{\text{Barista Pool}} = \text{HANW} - H_{\text{MGR}}$), rozbicie kolumny *Grafik (h)* na $H_{\text{MGR}} + H_{\text{BAR}}$, inspekcja dobowego Floor Hours (32h/dzień) i obsady otwarć/zamknięć AM/PM (`ManagerLaborBridgeModal`), monitoring budżetu Non-Coverage oraz pełna obsługa scalania tygodni przełomowych na styku miesięcy (trailing i leading) w spójny 7-dniowy grafik operacyjny z dobową siatką obsady (`CrossMonthBridgeCard`).
  - **Flash Forecast / Pre-closing Projection dla Poniedziałku (Sposób 1)**: W poniedziałek (dzień planowania grafiku W+2), zanim zjadą wieczorne logowania MAPAL Fichajes za ostatni dzień trwającego tygodnia, silnik automatycznie domyka tydzień predykcją: menedżerowie z grafiku Modułu 2 ($H_{\text{MGR}}$), barisci z dopełnienia celu tygodnia ($H_{\text{Bar}} = \max(0, \text{Cel} - \text{RCP}_{6\text{ dni}} - H_{\text{MGR}})$) oraz transakcje z różnicy planu AOP ($\text{Plan TRX} - \text{TRX}_{6\text{ dni}}$). Tydzień jest oznaczony jako `isMondayProjected = true` (`🔮 Pn est.`), włączany do MTD Velocity i zaangażowanego budżetu robocizny, co natychmiast odblokowuje zbalansowane i niezafałszowane HANW dla tygodnia docelowego W+2 (`target_planning`). We wtorek rano po imporcie Fichajes estymacja płynnie i bezobsługowo ustępuje rzeczywistym danym.
  - **Uczenie Maszynowe Trendów Rocznych i Sezonowych AOP**: Analiza wielomiesięczna z bazy AOP oraz logowań MAPAL (89 tygodni) identyfikuje miesiące szczytowe (ponad plan AOP: Maj–Sierpień, średnio +4.6% TRX i TPLH 6.94) vs miesiące spowolnienia (Styczeń–Kwiecień). Model powiązuje warunki popytowe z optymalną robocizną: w warunkach szczytowych wyucza bufor +12.0h flex/tydzień (głównie dociążenie sobót do ~57h i piątków do ~48h) chroniąc Customer Connection, a w niskim sezonie rekomenduje powrót do bazy Floor (32h/dzień) z buforem $\le 4\text{h/tydzień}$, zabezpieczając TPLH. Wnioski zasilają istniejący panel `TrendIntelligencePanel` oraz warianty strategii (Floor-Safe, Balanced, Growth).
  - **Inteligentny Import Raportów z Automatyczną Detekcją (Universal Report Auto-Detect)**: Silnik importu (`UniversalReportParser`, `ImportModal`) dynamicznie analizuje strukturę wewnętrzną przesłanego pliku Excel bez względu na jego nazwę. Automatycznie rozróżnia **Raport AOP P&L** (wykrycie hierarchii Equity P&L, `SALES`, `TRANSACTIONS`, `COL`, filtrów lokalu 108120 Janki i aktualizacja celów rocznych/miesięcznych) oraz **Raport MAPAL Fichajes** (ewidencja rzeczywistego czasu pracy personelu i menedżerów). Idempotentny zapis w SQLite z automatycznym backupem ratunkowym.
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 1](./src/modules/labor-forecast/AGENTS.md)** | **[README.md Modułu 1](./src/modules/labor-forecast/README.md)**.

### [Moduł 2: 🗓️ Managers Schedule (Grafik Managerski)](./src/modules/managers-schedule/AGENTS.md)
- **Status**: ✅ **v1.0 Active** (w pełni zaimplementowany, przetestowany).
- **Plik referencyjny**: `./Grafik/Grafik wrzesień Janki 2026.xlsm`.
- **Kopia zapasowa platformy v2.0**: `backups/release_v2_integrated_suite_stable/`.
- **Kopia zapasowa platformy v2.2 (AI Seasonal Stable)**: `backups/release_v2_2_seasonal_learning_stable/`.
- **Kopia zapasowa platformy v2.3 (Clean Panoramic & Speed-Dial Stable)**: `backups/release_v2_3_clean_layout_speed_dial_stable/`.
- **Kopia zapasowa platformy v2.4 (AutoScheduling Negotiation Hub Stable)**: `backups/release_v2_4_autoscheduling_negotiation_hub_stable/`.
- **Kluczowe zagadnienia**:
  - Matryca miesięczna dla zespołu 7 menedżerów kawiarni 108120 Janki z dedykowaną stawką godzinową i rolami.
  - Silnik polskiego Kodeksu Pracy (normy miesięczne, dni robocze, dni wolne, art. 130 § 2 KP).
  - Tarcza Kodeksu Pracy z inspekcją 4 norm (odpoczynek 11h, 35h tygodniowy, max 12h, max 3 niedziele).
  - **AutoScheduling AI (20 000 prób) z Asystentem Negocjacji z Zespołem (`AutoSchedulerEngine`, `AutoScheduleModal`)**:
    - **Globalne Optimum**: Generowanie grafiku w <150ms z dociążeniem etatów do 100% (błąd bilansu $\pm 0.9\text{h}$ na pracownika, eliminacja niedogodzin).
    - **Asystent Kompromisów i Negocjacji**: Wykrywanie patów obsadowych (wszyscy na `OFF`, ograniczenia 11h odpoczynku, urlopy H/L4), generowanie 3-4 wariantów kompromisu dla Store Managera (zamiana z rekompensatą, wsparcie `SUP`), 1-klik kopiowanie gotowych wiadomości na WhatsApp/SMS oraz 1-klik aplikacja w pamięci.
    - **Twarda Ochrona Dobowych Limitów TPLH i Floor Hours**: W niedziele i święta (w tym 1.11 Wszystkich Świętych) bezwzględny limit max 2 osób (1x `AMN` + 1x `PMN`) — zakaz duplikowania otwarć/zamknięć. Nadmiarowe godziny dopełniające etat trafiają na dni powszednie i soboty jako `MIB` (Barista w szczycie) oraz `SUP` (Support do oddania do innej kawiarni w Warszawie lub 2. osoba na barze).
  - **Pre-flight walidacja KP (`LaborLawViolationDialog`)**: ostrzeżenie przed zapisem naruszającej zmiany z podaniem przyczyny i artykułu KP.
  - **Katalog zmian Starbucks i reguła niedzieli**: dedykowany modal konfiguracji, blokada zmian niedzielnych w dni powszednie.
  - **Obsługa zmian Support (`SUP`, `SAM`, `SPM`)**: Wsparcie w innej kawiarni wlicza się do czasu pracy menedżera oraz rozliczenia TOR, ale nie wlicza się do obsady kawiarni Janki ani otwarć/zamknięć Janki.
  - **Dyspozycyjność menedżera, Zbiorcza Matryca i Import z Excela (`ManagerDispositionsModal`)**: Wprowadzanie dyspozycyjności (`FULL`, `AM`, `PM`, `OFF`) w popoverze lub zbiorczo na dedykowanej matrycy miesiąca z inteligentnym wklejaniem danych prosto z arkusza Excela (`Ctrl+V` / Smart Paste); skróty klawiszowe <kbd>A</kbd> (AM), <kbd>P</kbd> (PM), <kbd>O</kbd> (OFF), domyślną wartością jest pełna dostępność `FULL` (puste okienko), a prośby o wolne `OFF` są prezentowane w wyróżniającym się czerwonym kolorze i fizycznie rozdzielone w UI. Zgłoszone dyspozycje (`AM`, `PM`, `OFF`) wyświetlają się eleganckim badge'em po lewej stronie kwadratu dnia w grafiku.
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
  - **Ścisła separacja Modułu 1 i Modułu 2 w zasilaniu RCP**: Zapytania kalkulacyjne Modułu 1 (TPLH forecast, velocity MTD, floor hours, wagi dni) filtrują dane ściśle po kawiarni 108120 Janki (`unit_code = '18120'` lub alias `'384'`), chroniąc lokalny budżet robocizny przed zawyżeniem godzinami ze wsparć. Moduł 2 uwzględnia dyżury menedżera ze wszystkich lokali Starbucks.
  - **Kompletny rejestr 9 miesięcy grafików operacyjnych 2026 (Styczeń – Wrzesień)**: Zaimportowano wszystkie 9 plików grafików `.xlsm` z katalogu `Grafik/`. System posiada pełną bazę zmian, miesięcznych składów autorskich (`manager_monthly_roster` z rolami, etatami i stawkami) oraz ważnych wydarzeń (audyty, CSR, wizyty zarządu Brian Niccol, start Pumpkin), zasilając kwartały Q1, Q2 oraz Q3 2026 w module TOR.
  - **Dostosowywanie godzin zmian elastycznych (MID, SUP, SAM, SPM, NC) per zmiana oraz globalne presety (`ShiftPickerPopover`, `ShiftConfigModal`, `ManagerScheduleGrid`)**: Menedżerowie i Store Manager mogą elastycznie ustalać godziny dobowe dla zmian wsparciowych, administracyjnych i środkowych w popoverze grafiku (`ShiftPickerPopover`) za pomocą szybkich pigułek presetów (`4.0h`, `5.0h`, `6.0h`, `7.0h`, `8.0h`, `9.0h`, `10.0h`) lub precyzyjnego steppera `+/- 0.5h` (od 1.0h do 12.0h). W siatce grafiku zmiany o niestandardowym wymiarze są prezentowane z czytelnym indeksem godzin (np. `NC 4h`). W oknie konfiguracji katalogu zmian (`ShiftConfigModal`) dostępna jest dedykowana zakładka *Elastyczne & Presety* pozwalająca 1-klikiem ustawić globalny domyślny wymiar w katalogu. Pre-flight Tarcza Kodeksu Pracy (limit dobowy 12h, odpoczynek 11h) oraz kwartalny bilans TOR w 100% uwzględniają dostosowany wymiar godzinowy.
  - **Dostosowywanie przedziału czasowego zmian (Od – Do, np. 09:00 – 17:00 zamiast 08:00 – 16:00) (`ShiftPickerPopover`, `ManagerScheduleEngine`, `manager_schedule_shifts`)**: Pełna elastyczność ustawiania konkretnych godzin rozpoczęcia i zakończenia zmiany z inteligentną synchronizacją w popoverze (`ShiftPickerPopover`). Zmiana godziny rozpoczęcia automatycznie przelicza godzinę zakończenia zgodnie z wybranym wymiarem godzinowym; zmiana godziny zakończenia przelicza wymiar godzinowy; presety startu (`07:00`, `08:00`, `08:30`, `09:00`, `10:00`, `11:00`...) oraz przyciski steppera `+/- 30m`. Wartości `custom_start_time` i `custom_end_time` są trwale persystowane w bazie SQLite, wyświetlane w tooltipie komórki i badgu w siatce grafiku oraz włączone w pre-flight walidację Tarczy Kodeksu Pracy (weryfikacja 11h odpoczynku dobowego art. 132 KP między kolejnymi dniami oraz na przejściach miesięcy uwzględnia rzeczywisty przedział godzinowy).
  - **✨ Floating Starbucks Speed-Dial Navigation Hub & Czysty Widok 100% Full-Width (`AutoScheduleWidget.tsx`)**: Całkowicie usunięto górny pasek nawigacyjny z widoku grafiku, a cała kontrola nad okresem i akcjami została przeniesiona do **Pływającego Logo Starbucks** w prawym dolnym rogu ekranu. Po kliknięciu w logo rozwija się ergonomiczny **Speed-Dial z mini-ikonkami szybkiej nawigacji**:
    1. **Nawigacja Miesięcy**: `‹` Poprzedni Miesiąc (LM), `[ Wrzesień 2026 ]` Powrót do bieżącego (MTD), `›` Następny Miesiąc (NM).
    2. **Mini-Ikonki Szybkich Akcji**: ✨ `Auto AI` (AutoScheduling 20k prób Smart Full / Fill Gaps z radialnym zegarowym wskaźnikiem), 📋 `Dyspo` (Matryca Dyspozycji i Smart Paste), 🤝 `Wsparcie` (Asystent Wsparcia Międzykawiarnianego), ⚖️ `TOR` (Szybki przełącznik Grafik ↔ TOR), 📜 `Wersje` (Historia i publikacja 7 dni), 📊 `Eksport (.xlsx)` oraz 🔄 `Odśwież`.
    3. **Subtelny Wskaźnik w Belce Głównej**: Aktualnie wybrany miesiąc i rok (`Wrzesień 2026`) jest prezentowany eleganckim badgem w nagłówku aplikacji obok tytułu modułu. Dzięki temu grafik zyskuje maksymalną przestrzeń roboczą od samej góry do dołu ekranu.
  - **🤝 Asystent Wsparcia Międzykawiarnianego (`InterStoreSupportEngine`, `InterStoreSupportModal`)**: Automatyczny analizator i generator bezpiecznych wariantów oddania zmian wsparciowych (`SAM`, `SPM`, `SUP`) do innych kawiarni Starbucks w dystrykcie (323 Nowy Świat, 341 Sadyba, 756 San Park, 327 Arkadia itp.). Silnik generuje 3 scenariusze (Bezpośrednia Nadwyżka MIB/SUP, Wewnętrzna Sztafeta ze zmiennikiem z OFF, Rotacja z dniem rekompensaty), rygorystycznie chroni obsadę otwarcia/zamknięcia Janki (1x AM + 1x PM) oraz 11h/35h odpoczynku Kodeksu Pracy, a także oferuje 1-klik kopiowanie gotowych wiadomości SMS/WhatsApp i 1-klik zapis w bazie SQLite.
  - Bieżący bilans godzin (+/- h), licznik dni OFF i weryfikacja obsady otwarć/zamknięć (AM/PM).
  - Wiersz ważnych wydarzeń operacyjnych (promocje, audyty, wsparcia).
  - Wzbogacony tooltip komórki w siatce grafiku informujący o lokalu wsparcia MAPAL (`📍 Zalogowano wsparcie MAPAL: Xh w [Nazwa Lokalu] (kod: XXX)`).
  - Generator eksportu arkusza `.xlsx` odwzorowujący układ szablonu.
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 2](./src/modules/managers-schedule/AGENTS.md)** | **[README.md Modułu 2](./src/modules/managers-schedule/README.md)**.

### [Moduł 3: 🎓 Szkolenia (Starbucks Training Suite)](./src/modules/trainings/AGENTS.md)
- **Status**: ✅ **v1.0 Active** (w pełni zaimplementowany, przetestowany).
- **Materiały referencyjne**: `./Szkolenia/Barista 30 - Training.pdf` oraz `./Szkolenia/Barista 30 - Plan Treningowy .pdf`.
- **Kluczowe zagadnienia**:
  - **Pełna autonomia i brak sprzężenia z grafikiem menedżerskim**: Moduł operuje niezależnie od siatki 7 menedżerów (Moduł 2), zarządzając partnerami w tabeli `training_partners`.
  - **Koncepcja Zmian T (Training Shifts)**: Zmiany `T1`–`T10` (oraz kolejne `B90-1`, `B180-1`, `BT-1`) rozliczane w 100% w budżecie **Non-Coverage (NC Training)** bez obciążania dobowego progu Floor Hours (32h/dzień) kawiarni.
  - **Precyzyjne rozbicie godzin Zmian T**: Barista `(T)` (38h 45m), Trener Baristów BT `(T)` (14h 15m), Store Manager SM `(T)` (3h 30m); łączna inwestycja 56.5h na wdrożenie nowego baristy.
  - **Cyfrowe Arkusze Egzaminacyjne Skill Check**: Praktyczne formularze z natychmiastowym wyliczeniem wyniku i progiem zdawalności 80% (Milk Steaming 5 kroków, Espresso Bar #1, Cold Beverage #2, Teaching Model 4 etapy dla Trenera, Certyfikacja First 30 i wręczenie zielonej przypinki Green Pin).
  - **The Barista Journey**: Wizualna oś czasu kamieni milowych (First 30, Barista 90, Barista 180, Barista Trener, Coffee Master).
  - **Nadzór nad badaniami Sanepid i szkoleniem BHP**: Wykrywanie badań wygasających w ciągu 30 dni z ostrzeżeniem w UI.
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 3](./src/modules/trainings/AGENTS.md)** | **[README.md Modułu 3](./src/modules/trainings/README.md)**.

### [Moduł 4: 🧮 COL Calculator (Cost of Labor Suite)](./src/modules/col-calculator/AGENTS.md)
- **Status**: ✅ **v1.0 Active** (wierna cyfrowa replika 1:1 oficjalnego arkusza Excel `COL plan na wrzesień 2025.xlsx` z architekturą 3 Filarów).
- **Plik referencyjny**: `./COL CALC/COL plan na wrzesień 2025.xlsx`.
- **Kluczowe zagadnienia**:
  - **Architektura 3 Filarów (AOP, Target, Estymacja)**:
    1. **🏛️ AOP (Plan Roczny)**: Firmowy budżet roczny z bazy AOP (`Sales AOP`, `TRX AOP`, `TPLH AOP`, `Budżet Robocizny AOP`, `COL % AOP`).
    2. **🎯 TARGET (Plan Miesięczny)**: Miesięczny plan robocizny Store Managera z automatycznym importem obsady i godzin menedżerów z Modułu 2 (`planWorkHours`, `H`, `L4`) oraz godzin załogi UoP i UZ.
    3. **⚡ ESTYMACJA (Dynamiczna Prognoza Domknięcia)**: Prognoza domknięcia miesiąca na podstawie zmiennych dynamicznych: **TRX & Sales** (predykcja MTD Velocity / trendy) oraz **rzeczywistych logowań RCP (MAPAL Fichajes)** menedżerów i załogi z automatycznym wyliczaniem odchyleń $\Delta$ vs AOP.
  - **Siatka kalkulacyjna 1:1 Excel**: Czterokolumnowy lewy panel wskaźników i linii P&L (Wskaźnik, AOP, Target, Estymacja) oraz prawy panel tabel personelu.
  - **Złota zasada żółtych pól**: Bezpośrednia edycja stawek, planowanych i rzeczywistych godzin w żółtych komórkach (`#FFFFCC`) z natychmiastowym przeliczaniem w czasie rzeczywistym.
  - **Kategorie P&L i Narzuty ZUS**: Płace zasadnicze, ZUS pracodawcy 19.48% (16.93% ubezpieczenia społeczne + 2.55% FP/FGŚP), wpłata PFRON (200 zł/etat), ekwiwalenty odzieżowe (0.85 zł/h dla załogi, 300-350 zł dla kierowników), Comp&Ben, PPK, obsługa ADP i prowizje dostawców delivery (TRX × koszt per drop).
  - **Symulator Poprawy TPLH (What-If Analysis)**: Interaktywne wyliczanie oszczędności finansowych (COL Savings w PLN) i wpływu na procentowy udział kosztów pracy (COL % influence).
  - **Kalkulator Premii Kierowników (`BONUS`)**: Odzwierciedlenie progowania realizacji celów Sales vs AOP oraz Ops Profit vs AOP (Cap SM 2250 zł, ASM 1000 zł, SSV 700 zł) do 150% limitu.
  - **Rezerwa Urlopowa (`Rezerwa urlopowa`)**: Wycena bilansowa niewykorzystanych dni urlopu (stawka dobowe na bazie 21 dni roboczych, narzut ZUS 19.5%, delta m/m do raportu DOS+).
  - **Dolny pasek arkuszy**: Wygodna nawigacja pomiędzy arkuszami `CALCULATOR`, `BONUS`, `Rezerwa urlopowa`, `DANE`, `Fields Description` i `USER GUIDE`.
  - Dokumentacja modułu: 👉 **[AGENTS.md Modułu 4](./src/modules/col-calculator/AGENTS.md)** | **[README.md Modułu 4](./src/modules/col-calculator/README.md)**.

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
   - `stores`: ustawienia kawiarni (kod 18120, nazwa, floor hours).
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
3. **Tabele Modułu 3**:
   - `training_partners`: kartoteka baristów i partnerów w szkoleniu (program, trener, sanepid, bhp).
   - `training_shifts`: harmonogram Zmian T (kod, godziny Barista/BT/SM, stanowisko, status).
   - `training_skill_checks`: cyfrowe arkusze egzaminacyjne i wyniki weryfikacji praktycznych.
4. **Indeksy Wydajnościowe**:
   - `idx_labor_week_key`, `idx_labor_date`, `idx_labor_year_month`, `idx_calendar_year_month`
   - `idx_mgr_shifts_ym`, `idx_mgr_shifts_emp`, `idx_mgr_events_ym`
   - `idx_train_shifts_partner`, `idx_train_shifts_date`, `idx_train_checks_partner`.

---

## 💻 5. Komendy Deweloperskie

- `npm run dev`: start serwera Vite i okna Electrona z hot-reloadingiem.
- `npm run build`: pełna walidacja typów TypeScript (`tsc`) oraz produkcyjne bundle (`dist/` i `dist-electron/`).
- `npx tsc --noEmit`: szybka weryfikacja statyczna typów.
