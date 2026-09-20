# Backup Wersji: Starbucks Operations Suite (Release v2.0 Integrated Suite Stable)

**Data utworzenia kopii**: 2026-09-12 23:05 CEST  
**Jednostka**: `108120 SBX Warszawa Janki` (Kod jednostki: `384`)  
**Status**: Wersja produkcyjna, w pełni zintegrowana, zoptymalizowana i przetestowana.

---

## 🌟 Główne Osiągnięcia Wersji v2.0

1. **Kompletny Moduł 2: Managers Schedule**:
   - Miesięczna matryca grafiku z dedykowanymi stawkami, rolami i etatami.
   - Weryfikator Kodeksu Pracy z 4 normami (11h odpoczynku, 35h tygodniowo, max 12h, max 3 niedziele).
   - Kalendarz świąt państwowych i niedziel handlowych na matrycy.
   - Wersjonowanie i publikacja z blokadą cofania 7 dni przed startem miesiąca (art. 129 § 3 KP).
   - Baza 252 miesięcy oficjalnych norm KP (-10 lat do +10 lat, 2016–2036).
   - Inteligentny import dyspozycyjności z Excela (`Ctrl+V` Smart Paste).
   - Blokada edycji miesięcy przeszłych (`🔒 Miesiąc zamknięty`).

2. **Trzymiesięczny Okres Rozliczeniowy (TOR) z Kwartalnym Rozliczeniem**:
   - Trzy kolumny per miesiąc: **RCP (h)**, **H (h)**, **L4 (h)** oraz **Bilans**.
   - Zależność urlopu (H) i chorobowego (L4) od wymiaru etatu i wyłączenie weekendów/świąt (art. 154² § 1 KP).
   - Reguła pierwszeństwa L4 nad H w trakcie urlopu (art. 166 KP).
   - Automatyczna integracja rzeczywistych logowań RCP z systemu MAPAL Fichajes z zabezpieczeniem przed manipulacją.
   - Detekcja i pre-flight ostrzeżenia przed kolizjami RCP vs absencje L4/H.
   - Eksport do formatu Excel `.xlsx`.

3. **Dwukierunkowa Integracja: Manager Labor Bridge (Moduł 2 ➔ Moduł 1)**:
   - Kalkulator Puli Baristów ($H_{\text{Barista Pool}} = \text{HANW} - H_{\text{MGR}}$).
   - Rozbicie w kolumnie *Grafik (h)* na $H_{\text{MGR}} + H_{\text{BAR}}$ z interaktywnym asystentem dodawania godzin MGR.
   - Dobowy weryfikator Floor Hours (32.0 h/dzień) i obsady otwarć/zamknięć AM/PM (`ManagerLaborBridgeModal`).
   - Monitoring i bilansowanie budżetu Non-Coverage (NC).

4. **Pełny Zaimportowany Kwartał Q3 2026**:
   - Lipiec 2026 (248 zmian, 27 wydarzeń).
   - Sierpień 2026 (248 zmian, 23 wydarzenia).
   - Wrzesień 2026 (210 zmian, 17 wydarzeń).
   - Dołączenie Hanny Domachowskiej i obsługa kodów `PR` i `INV`.
   - Zbilansowanie kwartalne kierownictwa (SM i ASM: 0.0 h bilansu).

5. **Optymalizacje Wydajnościowe**:
   - **Code Splitting Vite**: Rozbicie gigantycznego bundle'a na dedykowane asynchroniczne chunki (`vendor`, `xlsx`, `charts`, `icons`), redukcja głównego pliku JS z 1,259 kB do zaledwie **332 kB** (-74%).
   - **Baza SQLite**: Indeksy złożone `idx_mgr_shifts_ym_emp` oraz `idx_labor_log_date_emp`, pełne `ANALYZE` i `VACUUM` (zerowe naruszenia integralności i FK).

---

## 📦 Zawartość Kopii Zapasowej (`backups/release_v2_integrated_suite_stable/`)

- `managers-schedule/`: Pełny kod źródłowy Modułu 2 (komponenty, serwisy, dokumentacja).
- `labor-forecast/`: Pełny kod źródłowy Modułu 1 z komponentami Bridge'a.
- `electron/`: Proces główny Electrona, preload i menedżer bazy danych SQLite.
- `tplh_forecast.db`: Zoptymalizowana baza danych SQLite (706 zmian grafiku, 67 wydarzeń, 252 normy, 1676 logowań).
- `App.tsx`: Główny kontener aplikacji zarządzający modułami i mostem danych.
- `vite.config.ts`: Zoptymalizowana konfiguracja bundlera z podziałem chunków.

---

## 🔄 Instrukcja Przywrócenia

W przypadku konieczności przywrócenia tego stanu aplikacji:
```bash
cp -r backups/release_v2_integrated_suite_stable/managers-schedule src/modules/
cp -r backups/release_v2_integrated_suite_stable/labor-forecast src/modules/
cp -r backups/release_v2_integrated_suite_stable/electron .
cp backups/release_v2_integrated_suite_stable/tplh_forecast.db data/
cp backups/release_v2_integrated_suite_stable/App.tsx src/
cp backups/release_v2_integrated_suite_stable/vite.config.ts .

npm run build
npm run dev
```
