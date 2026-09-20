# Pakiet Przeniesienia na Aplikację Desktopową: TPLH Forecast

Katalog zawiera kompletny zestaw materiałów, schematów bazodanowych, wyeksportowanych danych seed oraz logiki obliczeniowej, przygotowanych do implementacji **TPLH Forecast** w formie natywnej aplikacji desktopowej (np. Electron, Tauri, PySide/Qt, Flutter).

---

## 📁 Struktura Katalogu

```
desktop_app_blueprint/
├── README.md                               <-- Ten dokument (spis treści i instrukcja wdrożenia)
├── docs/
│   └── ARCHITECTURE_AND_SPECS.md           <-- Pełna specyfikacja inżynieryjna, algorytmy, schematy SQL i UI
├── data_schemas_and_seeds/                 <-- Czyste pliki JSON wyeksportowane z bazy Excela (do seedowania SQL)
│   ├── aop_plan_master_seed.json           <-- 192 miesiące planu AOP (2021–2036) z TRX, TPLH i budżetami
│   ├── weeks_engine_seed.json              <-- 1 152 rekordy tygodniowe (daty, wagi dniowe, floor hours)
│   ├── floor_hours_rules.json              <-- Reguły obsady minimalnej (40h Pn-Sob, 32h Nd = 272.0 h/tydz.)
│   └── labor_actuals_2026_seed.json        <-- 1 687 rzeczywistych logowań pracowników z 2026 r. (Computable Time)
├── logic_and_scripts/                      <-- Kod źródłowy logiki biznesowej i parsowania
│   ├── import_fichajes.py                  <-- Skrypt Python demonstrujący czyszczenie wiersza 7 i import MAPAL
│   └── Module_ImportFichajes.bas           <-- Moduł makr VBA z logiką nawigacji i idempotentnego importu
└── reference_files/                        <-- Wzorcowe pliki Excel
    ├── TPLH_Forecast_v1.0_CleanProduction.xlsx <-- Kompletny skoroszyt referencyjny ze wszystkimi silnikami
    ├── Fichajes_Janki_Cleaned.xlsx         <-- Wyczyszczony raport MAPAL z podziałem na Janki i Wszystkie
    └── amrestpl_Fichajes_Raw_Export.xls    <-- Oryginalny, surowy plik eksportu z systemu MAPAL
```

---

## 🚀 Jak Użyć Tego Pakietu do Budowy Aplikacji Desktopowej?

1. **Baza Danych (SQLite / DuckDB)**:
   - Skorzystaj z gotowych struktur SQL zdefiniowanych w [`docs/ARCHITECTURE_AND_SPECS.md`](./docs/ARCHITECTURE_AND_SPECS.md).
   - Załaduj pliki JSON z katalogu `data_schemas_and_seeds/` bezpośrednio do tabel bazy danych jako dane początkowe.
2. **Logika Matematyczna (Business Logic)**:
   - Zaimplementuj 4 kluczowe algorytmy opisane w specyfikacji:
     - Rozbicie dniowe AOP (`Plan TRX` i `Plan Godziny`).
     - Silnik predykcyjny trendu transakcji (`Trend TRX MTD` i `Forecast Total TRX`).
     - Wypracowane godziny (`Earned Labor Budget`).
     - Limit na kolejny grafik (`HANW`) z twardą barierą `Floor Hours (272.0 h/tydz.)`.
3. **Moduł Importu Plików (File Uploader)**:
   - Zaimplementuj drag-and-drop lub okno wyboru pliku raportu MAPAL.
   - Pamiętaj o regule pomijania pustego wiersza 7 i filtrowaniu po kodzie lokalu `384` (`108120 SBX Warszawa Janki`).
   - Logika w Pythonie znajduje się w [`logic_and_scripts/import_fichajes.py`](./logic_and_scripts/import_fichajes.py).
4. **Interfejs Użytkownika (UI)**:
   - Zbuduj dashboard oparty na makiecie z sekcji 6 w specyfikacji architektonicznej.
