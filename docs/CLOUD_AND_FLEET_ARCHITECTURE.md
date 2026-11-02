# Architektura Chmurowa Multi-Tenant i Zarządzanie Flotą (Kompendium Operacyjne)

Dokument stanowi **główne kompendium architektoniczne** komunikacji aplikacja – chmura w platformie **Starbucks Operations Suite**.  
Każdy agent AI oraz deweloper pracujący nad modułami synchronizacji, chmury, autoryzacji lub wielodostępności ma bezwzględny obowiązek stosowania poniższych reguł i aktualizowania tego pliku po każdej zmianie.

---

## 🏛️ 1. Architektura Połączenia i Potok Danych (Data Flow Pipeline)

Aplikacja operuje w modelu **Local-First z Sejfami Chmurowymi (Zero-Leak Cloud Vaults)**:
1. **Lokalna Baza Danych (SQLite):**
   - Lokalizacja na stacji użytkownika: `~/Library/Application Support/Starbucks Operations Suite/store_${storeId}.db`.
   - Priorytet zapisu: 0 ms latencji. Cała praca Store Managera odbywa się lokalnie i działa w 100% offline.
2. **Most IPC (Przeglądarka / Renderer ➔ Proces Główny Electron):**
   - Kod w warstwie React/UI **nigdy** nie odczytuje surowych plików SQLite ani nie szyfruje danych w oknie przeglądarki.
   - UI wywołuje metody przez bezpieczny most w `preload.ts` (`executeStoreMigration`, `pullStoreData`).
3. **Szyfrowanie Sejfów (Proces Główny Electron):**
   - Surowe tabele SQLite są pakowane do dedykowanych kontenerów i szyfrowane algorytmem **AES-256-GCM** za pomocą kluczy pochodzących ze skarbca kluczy (`VaultKeyManager` / PBKDF2).
   - Generowana jest suma kontrolna **SHA-256** weryfikująca nienaruszalność przesyłki (Parity Verification).
4. **Transport do Chmury (Google Cloud Firestore REST API v1):**
   - Zaszyfrowane ładunki (payloady) trafiają do bazy `starbucks-ops-suite` przez endpoint HTTPS `https://firestore.googleapis.com/v1/...`.

```
┌────────────────────────────────────────────────────────┐
│               UI / React Renderer                      │
│   (StoreSwitcherModal, AdminConsole, UserSettings)     │
└──────────────────────────┬─────────────────────────────┘
                           │ window.api.executeStoreMigration() / web fetch
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Preload Bridge (IPC)                   │
└──────────────────────────┬─────────────────────────────┘
                           │ ipcMain.handle('migration:execute-store-migration')
                           ▼
┌────────────────────────────────────────────────────────┐
│              Electron Main (Node.js)                   │
│  1. Ekstrakcja danych z SQLite (store_${id}.db)        │
│  2. Podział na domeny (Personnel, Schedule, Finance)   │
│  3. Szyfrowanie AES-256-GCM (VaultService)             │
│  4. Wyliczenie sum kontrolnych SHA-256                 │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS POST / PATCH (Firestore REST API v1)
                           ▼
┌────────────────────────────────────────────────────────┐
│         Google Cloud Firestore (Multi-Tenant Silo)     │
│   stores/{storeId}/...  oraz  users/{userId}/...       │
└────────────────────────────────────────────────────────┘
```

---

## 🔒 2. Model Wielodostępności: Multi-Tenant Silo per Kawiarnia

W chmurze Firestore każda kawiarnia posiada **odseparowany, hermetyczny obszar**:

```text
Google Cloud Firestore: starbucks-ops-suite
├── stores/
│   ├── 108120/                              <-- Instancja Kawiarni 108120 Janki
│   │   ├── meta/profile                     (metadane lokalu, typ, status, data alokacji)
│   │   ├── vault_schedules/{docId}          (zaszyfrowany sejf grafików pracowniczych)
│   │   ├── vault_personnel/{docId}          (zaszyfrowany sejf bazy personelu)
│   │   ├── vault_financials/{docId}         (zaszyfrowany sejf stawek i planów AOP)
│   │   ├── vault_health_gdpr/{docId}        (izolowane zwolnienia L4 / Art. 9 RODO)
│   │   └── telemetry/{docId}                (jawne sumy kontrolne i metryki zdrowia syncu)
│   │
│   ├── 108170/                              <-- Instancja Kawiarni 108170 Kalisz Amber
│   │   ├── meta/profile
│   │   └── ...
│   │
│   └── {futureStoreId}/                     <-- Dynamicznie alokowane kawiarnie
│       └── meta/profile
│
└── users/                                   <-- Profile Użytkowników (Cross-Device)
    └── {safeUserId}/                        (np. dawid_apel_amrest_eu)
        └── settings/preferences            (motyw, zoom, alerty, domyślny lokal)
```

### Żelazne reguły separacji:
1. **Zakaz zapytań cross-store:** Żadne zapytanie z kontekstu kawiarni `108120` nie może zawierać ścieżki do `stores/108170`.
2. **Automatyczna alokacja (`provisionStoreCloudArea`):**
   - Przy utworzeniu nowej kawiarni przez `StoreService.addCustomStore` system natychmiast rejestruje `stores/{storeId}/meta/profile`.
3. **Izolacja danych poufnych (Zero-Leak):**
   - Stawki płacowe, koszty P&L oraz zwolnienia lekarskie L4 są szyfrowane w osobnych sejfach z restrykcyjnymi kluczami.

---

## 👤 3. Ustawienia Systemowe per Użytkownik (Cross-Device Profile)

Ustawienia personalne Store Managera nie są przywiązane do jednego komputera, lecz wędrują za jego kontem:
1. **Ścieżka w chmurze:** `users/{safeUserId}/settings/preferences`.
2. **Model Danych (`UserSystemPreferences`):**
   - `theme` (`'dark' | 'light' | 'system'`)
   - `defaultStoreId` (np. `'108120'`)
   - `zoomLevel` (np. `100`)
   - `notificationsEnabled` & `soundAlerts`
   - `laborLawStrictTolerance` (rygorystyczne alerty Kodeksu Pracy)
   - `scheduleViewDensity` (`'compact' | 'comfortable'`)
3. **Cykl Synchronizacji:**
   - **Logowanie (Hydration):** Przy logowaniu przez 2FA OTP następuje pobranie profilu z chmury i zaaplikowanie do `localStorage`.
   - **Zmiana w UI (Sync):** Każda zmiana preferencji zapisuje się natychmiast lokalnie i asynchronicznie aktualizuje Firestore (metodą `PATCH`).

---

## 📋 4. Domyślny Katalog Floty (Fleet Directory)

Początkowa flota kawiarni została ograniczona do 2 aktywnych lokali:
- **`108120`** — **108120 SBX Warszawa Janki** (Unit: `18120`, MPK: `108120`, Mall)
- **`108170`** — **108170 SBX Kalisz Galeria Amber** (Unit: `18170`, MPK: `108170`, Mall)

Wszelkie dodatkowe lokale dodawane przez użytkownika są oznaczane jako `isCustom: true`, zapisywane lokalnie na dysku w `custom_stores.json` i automatycznie alokowane w chmurze.

---

## 🔄 5. Obowiązkowa Procedura dla Agentów AI (Maintenance Protocol)

> [!CRITICAL]
> Każdy agent modyfikujący mechanizmy chmurowe, API Firestore, strukturę bazy danych lub profile użytkowników ma bezwzględny obowiązek:
> 1. Zapoznać się z niniejszym dokumentem **przed** przystąpieniem do edycji kodu.
> 2. Nie modyfikować płaskich kolekcji – zawsze stosować ścieżki z prefiksem kawiarni `stores/{storeId}/...`.
> 3. Po wprowadzeniu zmian zaktualizować ten plik w sekcji **Historia Zmian Architektury Chmurowej**.

### Historia Zmian Architektury Chmurowej:
- **2026-11-02 (v2.9.6):** 
  - Wdrożenie architektury Multi-Tenant Silo per Kawiarnia (`stores/{storeId}/...`).
  - Redukcja katalogu bazowego floty do 2 lokali (Janki `108120`, Kalisz Amber `108170`).
  - Wprowadzenie automatycznej alokacji `provisionStoreCloudArea`.
  - Wdrożenie profilu użytkownika `UserSettingsService` z synchronizacją cross-device.
