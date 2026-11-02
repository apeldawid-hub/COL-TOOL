# Mapa Przepływu Danych i Architektury (DATA_FLOW.md)

Dokument opisuje kompleksowy przepływ danych, podział warstw i zasady synchronizacji w platformie **Starbucks Operations Suite**.

---

## 🏛️ 1. Schemat Warstwowy Architektury (End-to-End)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WARSTWA PREZENTACJI (UI)                       │
│  [M1: Labor]     [M2: Schedule]    [M3: Training]     [M4: COL]        │
│  [Fleet/Admin]   [Auth/OTP]        [Settings/Modal]   [AutoSchedule]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ React Hooks / Domain Services
┌───────────────────────────────────▼────────────────────────────────────┐
│                       WARSTWA SERWISÓW DOMENOWYCH                      │
│  calculationEngine.ts   managerScheduleEngine.ts   trainingEngine.ts   │
│  colEngine.ts           torEngine.ts               autoSchedulerEngine │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ window.electronAPI (ContextBridge IPC)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    WARSTWA GŁÓWNA ELECTRON (MAIN / IPC)                │
│  electron/main.ts       electron/database/db.ts    backupManager.ts    │
│  ipcHandlers: 'db:query', 'db:run', 'backup:create', 'sync:push'       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Queries (sql.js / better-sqlite3)
┌───────────────────────────────────▼────────────────────────────────────┐
│                     LOKALNA BAZA DANYCH SQLITE (Per-Store)             │
│  ~/Library/Application Support/Starbucks Operations Suite/             │
│  ├── store_18120_janki.db         (Autonomiczna baza kawiarni)         │
│  ├── store_18125_mokotow.db       (Dedykowana baza innej kawiarni)     │
│  └── fleet_master.db              (Rejestr kawiarni i kont floty)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Transakcyjny zapis w tabeli `sync_outbox`
┌───────────────────────────────────▼────────────────────────────────────┐
│               KOLEJKA OUTBOX & SYNCHRONIZACJA LOCAL-FIRST              │
│  Tabela: sync_outbox (operation, table_name, record_id, payload, sync) │
│  Mechanizm: Offline-first retry, wykrywanie konfliktów po timestampach │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Szyfrowanie AES-256 + REST API Firestore
┌───────────────────────────────────▼────────────────────────────────────┐
│                   CHMURA GOOGLE CLOUD FIRESTORE                        │
│  Projekt: starbucks-ops-suite                                          │
│  Kolekcje Silo:                                                        │
│  stores/{storeId}/aop_plans/...                                        │
│  stores/{storeId}/manager_schedule_shifts/...                          │
│  stores/{storeId}/training_partners/...                                │
│  stores/{storeId}/col_records/...                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 2. Cykl Zapisu Danych (Write Pipeline)

1. **Użytkownik modyfikuje stan w UI** (np. zmiana w grafiku MGR lub edycja planu AOP).
2. **Serwis domenowy weryfikuje reguły**:
   - Kodeks Pracy (art. 132/133 KP: odpoczynek 11h/35h, 4. niedziela),
   - Złota reguła Floor Hours (minimum 32.0h/dzień = 224.0h/tydzień).
3. **Wywołanie IPC do procesu głównego Electrona**:
   - `window.electronAPI.saveManagerShift(...)` lub uniwersalne `db.run(...)`.
4. **Zapis do lokalnej bazy SQLite**:
   - Zapytanie wykonywane jest w ramach bazy aktywnej kawiarni (`store_${safeId}.db`).
   - W tej samej transakcji do tabeli `sync_outbox` trafia rekord operacji (`INSERT`/`UPDATE`/`DELETE`).
5. **Asynchroniczny proces Outbox Sync (`cloudSyncService`)**:
   - Sprawdza stan sieci i token autoryzacyjny `@amrest.eu`.
   - Wysyła zmienione rekordy do podkolekcji `stores/{storeId}/...` w Firestore.
   - Po potwierdzeniu z chmury rekord w `sync_outbox` oznaczany jest jako `synced = 1`.

---

## 📥 3. Cykl Odczytu Danych (Read Pipeline)

1. **Przełączenie kawiarni (Store Switcher)**:
   - System zamyka dotychczasowy uchwyt SQLite i otwiera dedykowany plik `store_${safeId}.db`.
2. **Odczyt lokalny (Instant Render < 5ms)**:
   - UI pobiera dane bezpośrednio z lokalnego SQLite bez oczekiwania na odpowiedź z sieci.
3. **Cicha synchronizacja w tle (Background Hydration)**:
   - Silnik synchronizacji pobiera ewentualne zmiany z Firestore zarejestrowane z innych urządzeń kawiarni.
   - Aplikuje aktualizacje do lokalnej bazy SQLite i emituje zdarzenie reaktywne w React (`useStoreData`).

---

## 🏷️ 4. Etykiety Zadaniowe i Podział Odpowiedzialności (Task Tagging)

Podczas prac deweloperskich i zlecania zadań agentom zaleca się stosowanie oficjalnych prefiksów:

| Etykieta | Moduł / Obszar | Główne Pliki i Zakres |
| :--- | :--- | :--- |
| **`[M1]`** | Moduł 1: TPLH & Robocizna | `src/modules/labor-forecast/`, `calculationEngine.ts`, `trendLearningEngine.ts`, AOP, HANW, Flash Forecast. |
| **`[M2]`** | Moduł 2: Grafik Managerski | `src/modules/managers-schedule/`, `managerScheduleEngine.ts`, `autoSchedulerEngine.ts`, `torEngine.ts`, Kodeks Pracy. |
| **`[M3]`** | Moduł 3: Szkolenia Starbucks | `src/modules/trainings/`, `trainingEngine.ts`, `trainingStandardData.ts`, First 30, Skill Check, Zmiany T. |
| **`[M4]`** | Moduł 4: COL Calculator | `src/modules/col-calculator/`, `colEngine.ts`, `colDefaultData.ts`, arkusze Excel Replica, ZUS 19.48%, P&L. |
| **`[Fleet]`** | Flota & Multilokalowość | `src/components/admin/FleetMasterDashboard.tsx`, `src/services/storeService.ts`, przełącznik lokali, `custom_stores.json`. |
| **`[Admin]`** | Panel Administracyjny | `src/components/admin/AdminConsoleModal.tsx`, uprawnienia RBAC, zatwierdzanie kont Store Managerów. |
| **`[Cloud]`** | Chmura & Synchronizacja | `src/services/sync/cloudSyncService.ts`, `firestore.rules`, Outbox queue, szyfrowanie AES-256. |
| **`[Auth]`** | Bezpieczeństwo & Logowanie | `src/context/AuthContext.tsx`, `authService.ts`, OTP 6 cyfr, Hardware Binding, PIN Auto-Lock, BIP-39. |
| **`[Core]`** | Electron & Baza SQLite | `electron/main.ts`, `electron/database/db.ts`, `backupManager.ts`, VACUUM, integracje systemowe. |
| **`[OTA]`** | Mikropatche i Aktualizacje | `scripts/publish-patch.js`, `VERSION_HISTORY.md`, automatyczne pobieranie w tle. |
