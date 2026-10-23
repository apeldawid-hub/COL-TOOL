---
name: sqlite-guardian
description: >-
  Opiekun bazy danych SQLite, integralności danych i bezpieczeństwa platformy. Zarządza defragmentacją VACUUM,
  automatycznymi kopiami zapasowymi (rotacja 15 kopii), diagnostyką PRAGMA, migracjami tabel bez utraty danych
  oraz fizyczną separacją baz kawiarni (Multi-Store Isolation).
---

# Opiekun Bazy Danych i Integralności (SQLite Guardian)

Skill odpowiada za bezpieczeństwo, niezawodność, optymalizację oraz bezawaryjność lokalnej bazy danych SQLite platformy Starbucks Operations Suite.

---

## 🛡️ 1. Zasada Nienaruszalności Bazy Danych Użytkownika

1. **Lokalizacja Bazy w Środowisku Produkcyjnym**:
   - `~/Library/Application Support/Starbucks Operations Suite/tplh_forecast.db`
2. **Żelazna Reguła Bezpieczeństwa**:
   - Aktualizacja programu (zarówno pełna wersja DMG, jak i mikropatch OTA) podmienia **wyłącznie kod wykonywalny aplikacji** (`dist/`, `dist-electron/`).
   - Żadna operacja programistyczna, restart ani aktualizacja **nie ma prawa skasować, zresetować ani nadpisać** bazy danych SQLite użytkownika.

---

## 🗄️ 2. Fizyczna Separacja Baz (Multi-Store Independent Databases)

System wspiera niezależne bazy per kawiarnia:
- `tplh_forecast.db`: Kawiarnia domyślna `108120 SBX Warszawa Janki`.
- `store_${storeId}.db`: Dedykowane bazy dla nowo tworzonych lokali.
- Przy przełączeniu kawiarni w `StoreSwitcherModal`:
  1. Bieżąca baza jest bezpiecznie zapisywana na dysk (`persist()`).
  2. Proces SQLite w Electronie przełącza wskaźnik na nowy plik.
  3. Nowa baza jest automatycznie inicjalizowana (czyste szablony, normy KP 2016-2036, uniwersalny kalendarz), bez naruszania danych lokalu Janki.

---

## 🔄 3. Automatyczne Kopie Zapasowe (Rotating Backups)

Menedżer kopii zapasowych (`BackupManager`) utrzymuje rotację ostatnich **15 kopii** w katalogu kopii zapasowych.
- **Triggery automatyczne**:
  - `pre_version_publish`: Przed zatwierdzeniem i zamrożeniem wersji grafiku,
  - `pre_import_mapal`: Przed zaimportowaniem nowego pliku Fichajes z Excela,
  - `auto_startup`: Przy pierwszym uruchomieniu aplikacji danego dnia roboczego,
  - `pre_vacuum`: Przed defragmentacją i kompaktowaniem bazy.
- **Monitoring Wieku Kopii**:
  - Jeśli od ostatniej kopii minęło $\ge 7$ dni, system wyświetla ostrzeżenie w nagłówku aplikacji i dodaje zadanie do listy To-Do Store Managera.

---

## ⚡ 4. Autodiagnostyka i Optymalizacja (Database Health & VACUUM)

1. **Weryfikacja Integralności**:
   - Wykonywanie `PRAGMA integrity_check` oraz `PRAGMA quick_check`.
   - Zliczanie stron pofragmentowanych (`freelist_count`).
2. **Defragmentacja 1-Klik**:
   - Uruchomienie `VACUUM` oraz `PRAGMA optimize`.
   - Odzyskanie miejsca na dysku i przyspieszenie zapytań SQL.
