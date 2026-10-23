# AGENTS.md — Główny Rejestr Architektoniczny (Root Orchestrator)

Dokument stanowi **główny rejestr architektoniczny (Root Orchestrator)** platformy **Starbucks Operations Suite** (`108120 SBX Warszawa Janki`, Kod jednostki: `18120`, kod operacyjny: `384`).

---

## 🔒 0. Żelazna Zasada Bezpieczeństwa: Zero Danych Wrażliwych w Git

> [!CRITICAL]
> **BEZWZGLĘDNA REGUŁA DLA WSZYSTKICH AGENTÓW AI I AUTOMATYZACJI:**
> Repozytorium Git (`apeldawid-hub/COL-TOOL`) oraz pakiety aktualizacji publikowane online zawierają **WYŁĄCZNIE CZYSTY KOD ŹRÓDŁOWY APLIKACJI** (TypeScript, React, Electron, Tailwind CSS, ikony, skrypty budowania oraz dokumentację techniczną).
> 
> 1. **Bezwzględny zakaz śledzenia i commitowania danych operacyjnych:**
>    - Żadne pliki arkuszy Excel (`Grafik/`, `AOP/`, `COL CALC/`, `KPI ACTUAL/`, `IMPORT/`, `*.xlsx`, `*.xlsm`, `*.xls`)
>    - Żadne pliki szkoleń i dokumentów wewnętrznych (`Szkolenia/`, `*.pdf`)
>    - Żadne bazy danych i zrzuty tabel (`data/`, `backups/`, `*.db`, `*.csv`)
>    - Żadne poświadczenia i tokeny dostępowe (`.env`, `GH_TOKEN`)
> 2. **Trwałe odseparowanie bazy danych SQLite użytkownika:**
>    - Baza danych użytkownika na docelowym komputerze jest trwale odseparowana w systemowym folderze:
>      `~/Library/Application Support/Starbucks Operations Suite/`
>    - Aktualizacja programu (zarówno pełna wersja DMG, jak i mikropatch OTA) podmienia **wyłącznie pliki wykonywalne kodu aplikacji**, bez dotykania bazy danych SQLite użytkownika.

---

## ☕ 1. Nienaruszalne Standardy Operacyjne Starbucks

1. **Złota reguła Floor Hours**:
   - **Minimum nienaruszalne: 32.0 h/dzień** (1 MGR + 1 Barista AM rano + 1 MGR + 1 Barista PM wieczorem = 4 osoby $\times$ 8h = 32h/dzień).
   - Dla pełnego 7-dniowego tygodnia daje to **224.0 h bazy Floor**. Grafik kawiarni nie może spaść poniżej tej bariery dobowej.
   - Wszystkie godziny ponad bazę Floor tworzą **Pulę Flex**, alokowaną na szczyty popołudniowe (piątek, sobota, niedziele handlowe).
2. **Niedziele Handlowe w CH Janki**:
   - 7 niedziel handlowych w roku (pełny ruch centrum ~250% normy) $\rightarrow$ alokacja szczytowa baristów.
   - Niedziele wolne od handlu (zamknięte CH) $\rightarrow$ obsada ściśle na poziomie bazy Floor (32.0h: 1 AMN + 1 PMN).
3. **Izolacja Budżetu Szkoleń (Non-Coverage)**:
   - Zmiany szkoleniowe baristów (`T1`–`T10`) są w 100% rozliczane w budżecie **Non-Coverage (NC Training)** i nie pomniejszają bazy Floor Hours (32h).

---

## 🏛️ 2. Architektura 4 Modułów Platformy

Każdy moduł operuje jako autonomiczna jednostka biznesowa z dedykowaną dokumentacją techniczną:

```
src/modules/
├── labor-forecast/          # MODUŁ 1: TPLH Forecast & Labor Balancing (v1.0 Stable)
│   ├── services/            # Silnik AOP, MTD Velocity, Ensemble AI, Split-Week Bridge
│   ├── AGENTS.md            # 👉 Szczegółowe algorytmy Modułu 1 (src/modules/labor-forecast/AGENTS.md)
│   └── README.md            # Przewodnik użytkownika Modułu 1
│
├── managers-schedule/       # MODUŁ 2: Managers Schedule — Grafik Managerski (v1.0 Active)
│   ├── services/            # Silnik Kodeksu Pracy, AutoScheduler AI (20k prób), TOR, RCP Fichajes
│   ├── AGENTS.md            # 👉 Szczegółowe reguły Modułu 2 (src/modules/managers-schedule/AGENTS.md)
│   └── README.md            # Przewodnik użytkownika Modułu 2
│
├── trainings/               # MODUŁ 3: Szkolenia — Starbucks Training Suite (v1.0 Active)
│   ├── services/            # Szablony zmian T1-T10, Skill Check (Espresso, Milk, Cold Bev), Barista Journey
│   ├── AGENTS.md            # 👉 Szczegółowe algorytmy Modułu 3 (src/modules/trainings/AGENTS.md)
│   └── README.md            # Przewodnik użytkownika Modułu 3
│
└── col-calculator/          # MODUŁ 4: COL Calculator — Cost of Labor Suite (v1.0 Active)
    ├── services/            # Model 3 Filarów (AOP, Cel, Estymacja MTD), ZUS 19.48%, What-If P&L
    ├── AGENTS.md            # 👉 Szczegółowe algorytmy Modułu 4 (src/modules/col-calculator/AGENTS.md)
    └── README.md            # Przewodnik użytkownika Modułu 4
```

---

## 🤖 3. Zespół Agentów & Umiejętności (Specialized Agent Squad)

Wsparcie deweloperskie opiera się na wyspecjalizowanych umiejętnościach w `.agents/skills/`:

| Agent / Umiejętność | Plik Konfiguracyjny | Obszar Ekspertyzy |
| :--- | :--- | :--- |
| 🛡️ **`labor-law-sentinel`** | [SKILL.md](file:///.agents/skills/labor-law-sentinel/SKILL.md) | Kodeks Pracy (art. 130, 132, 133, 151, 154 KP), odpoczynek 11h/35h, 4. niedziela, AutoScheduling AI (próba 2k), TOR Q1-Q4. |
| 📊 **`fichajes-pipeline`** | [SKILL.md](file:///.agents/skills/fichajes-pipeline/SKILL.md) | Parsowanie raportów Excel MAPAL Fichajes, AOP P&L, detekcja kolizji RCP vs L4/H, poniedziałkowy Flash Forecast. |
| 💡 **`growth-strategist`** | [SKILL.md](file:///.agents/skills/growth-strategist/SKILL.md) | Analizator możliwości rozwoju: identyfikacja wąskich gardeł w Modułach 1, 2 i kloszu oraz innowacje dla SM. |
| 👁️ **`ux-auditor`** | [SKILL.md](file:///.agents/skills/ux-auditor/SKILL.md) | Audytor UI/UX: ergonomia pracy na laptopie, czytelność tabel, nawigacja klawiaturą, eliminacja tarcia w obsłudze. |
| 📐 **`integrity-sentinel`** | [SKILL.md](file:///.agents/skills/integrity-sentinel/SKILL.md) | Strażnik obliczeń i komunikatów: cykliczna kontrola norm KP, bilansów TOR, formuł TPLH, zaokrągleń i języka alertów. |
| 🧮 **`col-finance`** | [SKILL.md](file:///.agents/skills/col-finance/SKILL.md) | Finanse P&L, Total COL %, TPLH Coverage/Total, narzut ZUS 19.48%, załoga UoP/UZ, symulator What-If. |
| 🗄️ **`sqlite-guardian`** | [SKILL.md](file:///.agents/skills/sqlite-guardian/SKILL.md) | Integralność SQLite, defragmentacja VACUUM, rotacja 15 kopii zapasowych, Multi-Store isolation (`store_${id}.db`). |
| 🚀 **`ota-patch-publisher`** | [SKILL.md](file:///.agents/skills/ota-patch-publisher/SKILL.md) | Pre-flight QA (`npm run build`), podbicie wersji, publikacja mikropatcha OTA (`npm run patch`) w 3-5 sekund. |
| 📜 **`version-tracker`** | [SKILL.md](file:///.agents/skills/version-tracker/SKILL.md) | Prowadzenie centralnego rejestru wydań w [VERSION_HISTORY.md](file:///VERSION_HISTORY.md) oraz `CHANGELOG.md`. |

---

## 🔄 4. Cykl Pracy: Development ➔ Mikropatch OTA

1. **Rozwój i Testy Lokalne**:
   - `npm run dev` z szybkim odświeżaniem Vite Hot-Reload.
2. **Publikacja Mikropoprawki OTA (`npm run patch`) — Błyskawiczna**:
   - Agent weryfikuje kompilację (`npm run build`), podbija wersję w `package.json`, rejestruje zmiany w `VERSION_HISTORY.md` i publikuje patch `.zip` (~1.16 MB) do GitHub Releases w 3-5 sekund.
3. **Pełne Wydania DMG (`npm run publish:mac`)**:
   - Wykonywane **WYŁĄCZNIE na bezpośrednie polecenie Użytkownika** (np. zmiana natywnych bibliotek Electrona lub ikon).
