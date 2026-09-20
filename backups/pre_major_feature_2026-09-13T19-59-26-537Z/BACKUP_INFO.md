# Kopia Zapasowa Projektu: Starbucks Operations Suite
- **Data i godzina**: 13.09.2026, 21:59:26
- **Sygnatura znacznika**: 2026-09-13T19-59-26-537Z
- **Powód**: Pre-major feature snapshot (przed wdrożeniem dużej funkcjonalności)
- **Liczba skopiowanych plików**: 70
- **Łączny rozmiar danych**: 6.89 MB
- **Kopia SQLite w rejestrze db_backups**: `tplh_forecast_2026-09-13_21-59-26_pre_major_feature.db`

## Zawartość kopii:
1. `src/` — cały kod frontendu obu modułów (Labor Forecast + Managers Schedule), komponenty, serwisy, algorytmy i typy.
2. `electron/` — kod Electrona, handlery IPC, menedżer bazy danych, menedżer backupów, parser MAPAL Fichajes.
3. `tplh_forecast.db` — pełny zrzut bazy SQLite z wszystkimi 9 miesiącami 2026, składami autorskimi i zmianami.
4. `desktop_app_blueprint/` — schematy bazy danych i seedy.
5. Pliki konfiguracyjne: `package.json`, `tsconfig.json`, `vite.config.ts`, `AGENTS.md`, `README.md`.

## Instrukcja przywrócenia (Rollback):
W razie potrzeby natychmiastowego przywrócenia stanu przed zmianami:
1. Nadpisz katalogi `src/` oraz `electron/` zawartością z tego folderu.
2. Nadpisz `data/tplh_forecast.db` plikiem `tplh_forecast.db` z tego folderu (lub przywróć przez interfejs w DatabaseBackupModal).
