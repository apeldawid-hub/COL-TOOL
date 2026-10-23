# Reguła Bezpieczeństwa: Zero Danych Wrażliwych w Git (Code-Only Repository)

> [!CRITICAL]
> **ŻELAZNA ZASADA DLA WSZYSTKICH AGENTÓW AI I AUTOMATYZACJI:**
> Repozytorium Git (`apeldawid-hub/COL-TOOL`) oraz pakiety aktualizacji publikowane online zawierają **WYŁĄCZNIE CZYSTY KOD ŹRÓDŁOWY APLIKACJI** (TypeScript, React, Electron, Tailwind CSS, ikony, skrypty budowania oraz dokumentację techniczną).

## 🔒 1. Bezwzględny Zakaz Śledzenia i Commitowania Danych Operacyjnych
1. **Żadne pliki arkuszy Excel:** `Grafik/`, `AOP/`, `COL CALC/`, `KPI ACTUAL/`, `IMPORT/`, `*.xlsx`, `*.xlsm`, `*.xls`.
2. **Żadne pliki szkoleń i dokumentów wewnętrznych:** `Szkolenia/`, `*.pdf`.
3. **Żadne bazy danych i zrzuty tabel:** `data/`, `backups/`, `*.db`, `*.csv`.
4. **Żadne poświadczenia i tokeny dostępowe:** `.env`, `.env.local`, `GH_TOKEN`.

## 🛡️ 2. Trwałe Odseparowanie Bazy Danych Użytkownika
- Każda kolejna wersja programu (np. `v2.8.X`) podmienia wyłącznie kod wykonywalny aplikacji (`dist/`, `dist-electron/`).
- Baza danych SQLite użytkownika na komputerze docelowym jest odseparowana w systemowym folderze:
  `~/Library/Application Support/Starbucks Operations Suite/`
- Instalacja nowej wersji lub mikropatcha OTA nigdy nie narusza, nie resetuje ani nie kasuje wprowadzonych danych kawiarni.
