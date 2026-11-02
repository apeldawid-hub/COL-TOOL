# AGENTS.md — Główny Rejestr Architektoniczny (Root Orchestrator)

Dokument stanowi **główny rejestr architektoniczny (Root Orchestrator)** platformy **Starbucks Operations Suite** (architektura uniwersalna Multi-Store Fleet dla wszystkich kawiarni sieci Starbucks).

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
> 3. **Architektura Chmurowa Multi-Tenant Silo i Profile Użytkowników:**
>    - Przed wszelkimi pracami nad chmurą, synchronizacją lub wielodostępnością agent **ma bezwzględny obowiązek** zapoznać się z dokumentem:
>      [docs/CLOUD_AND_FLEET_ARCHITECTURE.md](./docs/CLOUD_AND_FLEET_ARCHITECTURE.md)
>    - Każda kawiarnia to odseparowany obszar `stores/{storeId}/...`. Obowiązuje zakaz stosowania płaskich kolekcji.
>    - Po modyfikacji logiki chmurowej agent **musi zaktualizować historię zmian** w tym dokumencie.

---

## ⚡ 0.1. Zasady Green AI i Oszczędzania Tokenów (Token Optimization)

> [!IMPORTANT]
> Obowiązuje każdego agenta AI i subagenta we wszystkich sesjach w repozytorium:
> 1. **Zero lania wody:** Brak powitań, wstępów ("Chętnie pomogę"), podsumowań i parafrazowania pytań użytkownika.
> 2. **Maksymalna zwięzłość:** Odpowiedzi w punktach, wysoka gęstość informacji, brak zbędnych wyjaśnień teorii przy pytaniach o kod.
> 3. **Higiena narzędzi (Tool Hygiene):** Zakaz zrzucania całych dużych plików i długich logów do kontekstu (nakaz używania `grep`, `head`/`tail`, zakresów linii).
> 4. **Precyzyjne edycje:** Stosowanie edycji punktowych (`edit_file`) zamiast przepisywania całych plików.
> 5. **Fail Fast:** Po 1 błędzie narzędzia natychmiastowa zmiana podejścia; przy braku kluczowych danych 1 krótkie pytanie zamiast zgadywania "na zapas".
> 
> Szczegółowe wytyczne znajdują się w pliku: [GEMINI.md](./GEMINI.md).

---

## 📝 0.2. Reguła Bezwzględnej Synchronizacji Dokumentacji (Documentation Auto-Sync Rule)

> [!CRITICAL]
> **OBOWIĄZKOWA REGUŁA DLA KAŻDEGO AGENTA I AUTOMATYZACJI:**
> Każdy agent modyfikujący lub dodający kod źródłowy, logikę biznesową, algorytmy, strukturę plików, bazę danych SQLite, integrację chmurową czy interfejs UI w dowolnym module/komponencie platformy **ma bezwzględny obowiązek natychmiastowej aktualizacji dokumentacji technicznej**:
> 1. **Plik `AGENTS.md` modyfikowanego modułu:** Natychmiastowe zaktualizowanie drzewa plików, opisów serwisów, parametrów algorytmów i reguł biznesowych, aby odzwierciedlały stan faktyczny w kodzie (zero rozbieżności).
> 2. **Historia zmian modułu (`src/modules/{modul}/CHANGELOG.md`):** Zarejestrowanie nowej wersji, daty i zwięzłego wykazu wprowadzonych zmian w dedykowanym rejestrze modułu.
> 3. **Plik umiejętności agenta (`.agents/skills/{skill}/SKILL.md`):** Uaktualnienie parametrów domenowych i wytycznych agenta, jeśli zmiana wpływa na jego kompetencje.
> 4. **Główny rejestr wydań (`VERSION_HISTORY.md`):** Przy wydaniach i mikropatchach OTA zarejestrowanie pełnego zakresu zmian.
> Zakaz kończenia zadania z pozostawieniem nieaktualnej dokumentacji lub rozbieżności między kodem a rejestrem agentów.

---

## ☕ 1. Nienaruszalne Standardy Operacyjne Starbucks

1. **Złota reguła Floor Hours**:
   - **Minimum nienaruszalne: 32.0 h/dzień** (1 MGR + 1 Barista AM rano + 1 MGR + 1 Barista PM wieczorem = 4 osoby $\times$ 8h = 32h/dzień).
   - Dla pełnego 7-dniowego tygodnia daje to **224.0 h bazy Floor**. Grafik kawiarni nie może spaść poniżej tej bariery dobowej.
   - Wszystkie godziny ponad bazę Floor tworzą **Pulę Flex**, alokowaną na szczyty popołudniowe (piątek, sobota, niedziele handlowe).
2. **Niedziele Handlowe w centrach handlowych (CH)**:
   - 7 niedziel handlowych w roku (pełny ruch centrum ~250% normy) $\rightarrow$ alokacja szczytowa baristów.
   - Niedziele wolne od handlu (zamknięte CH) $\rightarrow$ obsada ściśle na poziomie bazy Floor (32.0h: 1 AMN + 1 PMN) lub zgodnie z profilem lokalu (High Street / Travel).
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
│   ├── services/            # Silnik Kodeksu Pracy, AutoScheduler AI (2k prób), TOR, RCP Fichajes
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
| 🗄️ **`sqlite-guardian`** | [SKILL.md](file:///.agents/skills/sqlite-guardian/SKILL.md) | Integralność SQLite, defragmentacja VACUUM, rotacja 15 kopii zapasowych, Multi-Store isolation (`store_${id}.db`), nadzór nad architekturą chmurową ([CLOUD_AND_FLEET_ARCHITECTURE.md](./docs/CLOUD_AND_FLEET_ARCHITECTURE.md)). |
| 🚀 **`ota-patch-publisher`** | [SKILL.md](file:///.agents/skills/ota-patch-publisher/SKILL.md) | Pre-flight QA (`npm run build`), podbicie wersji, publikacja mikropatcha OTA (`npm run patch`) w 3-5 sekund. |
| 📜 **`version-tracker`** | [SKILL.md](file:///.agents/skills/version-tracker/SKILL.md) | Prowadzenie centralnego rejestru wydań w [VERSION_HISTORY.md](file:///VERSION_HISTORY.md) oraz `CHANGELOG.md`. |

---

## 🔄 4. Cykl Pracy: Development ➔ Mikropatch OTA

1. **Rozwój i Testy Lokalne**:
   - `npm run dev` z szybkim odświeżaniem Vite Hot-Reload.
2. **Publikacja Mikropoprawki OTA (`npm run patch`) — Błyskawiczna**:
   - Agent weryfikuje kompilację (`npm run build`), podbija wersję w `package.json`, rejestruje zmiany w `VERSION_HISTORY.md` i publikuje patch `.zip` (~1.16 MB) do GitHub Releases w 3-5 sekund.
## 🏷️ 5. Błyskawiczne Prefiksy w Czacie (`/` oraz `?`)

W promptach do agenta możesz używać krótkich prefiksów, które natychmiast zawężają obszar pracy:
- `/m1` lub `[M1]` — TPLH Forecast & Robocizna (`src/modules/labor-forecast/`)
- `/m2` lub `[M2]` — Grafik Managerski & TOR (`src/modules/managers-schedule/`)
- `/m3` lub `[M3]` — Szkolenia Starbucks (`src/modules/trainings/`)
- `/m4` lub `[M4]` — COL Calculator (`src/modules/col-calculator/`)
- `/cloud` lub `[Cloud]` — Firestore & Outbox Queue (`src/services/sync/`)
- `/fleet` lub `[Fleet]` — Flota & Przełącznik Kawiarni (`src/services/storeService.ts`)
- `/auth` lub `[Auth]` — Bezpieczeństwo & Logowanie (`src/context/AuthContext.tsx`)
- `/core` lub `[Core]` — Electron & SQLite (`electron/`)
- `/ota` lub `[OTA]` — Mikropatche i Wydania (`scripts/publish-patch.js`)
- `?m1`, `?m2`... — Tryb inspekcji i audytu (odpowiedź na pytanie bez modyfikacji kodu).
