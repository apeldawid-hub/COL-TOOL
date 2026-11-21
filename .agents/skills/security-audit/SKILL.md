---
name: security-audit
description: >-
  Audytor bezpieczeństwa architektury, bazy danych, chmury i kodu źródłowego w Starbucks Operations Suite.
  Weryfikuje regułę Zero Danych Wrażliwych w Git, architekturę Multi-Tenant Silo Firestore,
  izolację SQLite, bezpieczeństwo Electron IPC oraz sanityzację importów Excel.
---

# 🔒 Security Audit & Defense-in-Depth (COL Tool)

Ten skill definiuje procedury audytu bezpieczeństwa platformy **Starbucks Operations Suite**.
Celem jest wykrywanie i eliminowanie podatności naruszających granice zaufania (Trust Boundaries) pomiędzy kawiarniami, procesem Electron a systemem operacyjnym oraz repozytorium kodu.

---

## 🎯 5 Nienaruszalnych Wektorów Bezpieczeństwa (Security Checkpoints)

### 1. Żelazna Reguła 0: Zero Danych Wrażliwych w Git
* **Audyt repozytorium i commitów:**
  - Żadne pliki z danymi operacyjnymi: `*.xlsx`, `*.xlsm`, `*.xls`, `Grafik/`, `AOP/`, `COL CALC/`, `KPI ACTUAL/`.
  - Żadne pliki bazy danych: `*.db`, `*.sqlite`, `data/`, `backups/`.
  - Żadne poświadczenia: `.env`, `*token*.json`, `serviceAccountKey.json`.
* **Weryfikacja `.gitignore`:**
  - Upewnienie się, że wzorce wykluczeń blokują przypadkowe zaindeksowanie plików kawiarni.

### 2. Architektura Multi-Tenant Silo w Chmurze (Firestore)
* **Izolacja kawiarni:**
  - Wszystkie dokumenty operacyjne muszą znajdować się w ścieżkach: `/stores/{storeId}/...`.
  - Bezwzględny zakaz stosowania płaskich kolekcji root (np. `/schedules/`, `/employees/`).
* **Reguły `firestore.rules`:**
  - Weryfikacja czy kawiarnia `storeId_A` nie ma możliwości odczytu ani zapisu danych `storeId_B`.
  - Sprawdzenie autoryzacji opartej na tokenie i roli użytkownika.

### 3. Bezpieczeństwo i Izolacja Bazy Danych SQLite
* **Separacja fizyczna:**
  - Bazy użytkownika są trwale ulokowane w systemowym folderze:
    `~/Library/Application Support/Starbucks Operations Suite/stores/store_${safeId}.db`.
  - Brak przechowywania baz danych wewnątrz folderu aplikacji lub repozytorium projektu.
* **Sanityzacja identyfikatorów (`safeId`):**
  - Unikanie ataków Directory Traversal (`../`) przy operacjach na plikach baz danych kawiarni.
* **Szyfrowanie kolejki synchronizacji:**
  - Weryfikacja szyfrowania wrażliwych danych (AES-256) w kolejce `sync_outbox`.

### 4. Bezpieczeństwo Architektury Electron & IPC
* **Izolacja kontekstu:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` w konfiguracji okna.
* **Sanityzacja w `ipcMain`:**
  - Każdy handler IPC musi rygorystycznie walidować typy i rozmiary parametrów wejściowych przed przekazaniem ich do zapytań SQL lub systemu plików.
  - Zakaz bezpośredniego wykonywania surowego kodu SQL przekazanego z warstwy renderera.

### 5. Bezpieczeństwo Parserów Arkuszy (Excel / Fichajes)
* **Sanityzacja plików `.xlsx`:**
  - Ochrona przed bombami dekompresyjnymi (ZIP bombs) i nadmiernym rozmiarem bufora pamięci.
  - Odporność na wstrzykiwanie formuł kalkulacyjnych (CSV/Excel Formula Injection).
  - Weryfikacja struktury nagłówków przed rozpoczęciem parsowania wierszy ewidencji.

---

## 🛠️ Procedura Przeprowadzania Audytu

1. **Skanowanie Statyczne:**
   - Wyszukanie w kodzie słów kluczowych: `dangerouslySetInnerHTML`, `eval`, `shell.openExternal`, surowych zapytań SQL bez bindowania parametrów (`?`).
2. **Weryfikacja Granic Multi-Store:**
   - Sprawdzenie czy w `src/services/storeService.ts` oraz `src/services/sync/` każde zapytanie zawiera właściwy parametr kawiarni.
3. **Pre-flight Check:**
   - Uruchomienie `npm run check` w celu potwierdzenia integralności schematów i typów.
