# Project: Starbucks Operations Suite Hardening (100+ Stores, AES-256 Cloud Vaults & Migration)

## Architecture
The Starbucks Operations Suite is an Electron + React 19 desktop application supporting 100+ Starbucks retail units. It features:
- **Presentation Layer (Renderer)**: React 19 + Tailwind CSS + Lucide React with 4 core business modules:
  - Module 1: Labor Forecast & TPLH Balancing (`src/modules/labor-forecast/`)
  - Module 2: Managers Schedule & AutoSchedule AI (`src/modules/managers-schedule/`)
  - Module 3: Starbucks Training Suite (`src/modules/trainings/`)
  - Module 4: Cost of Labor (COL) Calculator (`src/modules/col-calculator/`)
- **State & Context Layer**: `StoreContext`, `AuthContext`, partitioned services (`TodoService`, `DesktopNotificationService`, `SyncEngine`, `AdminService`).
- **Main / Database Layer (Electron)**: `DatabaseManager` with `sql.js` (WebAssembly SQLite), LRU Store Connection Pool, Concurrency Mutex, `BackupManager`, file parsers (`mapalParser`, `universalReportParser`).
- **Cloud Security Layer (Firebase/Firestore)**: Client-side AES-256-GCM encryption engine with OS Keychain (`safeStorage`) key derivation, Zero-Leak Firestore Security Rules (`firestore.rules`) enforcing `request.auth.token.storeId == storeId`, and Local-to-Cloud Migration Bridge with SHA-256 parity verification.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Static Store Fallback Elimination | Remove all static store codes ('18120', '108120', '384', 'Janki') hardcoded as logic defaults in `src/` and `electron/` | M1 | Survey |
| 2 | F2: Mock Data & Fake Rosters Purge | Purge fake manager rosters with salaries, mock baristas in colDefaultData, fake training partners, and mock admin users | M1 | Survey |
| 3 | F3: AI Filler Text Elimination | Remove AI placeholder texts and dummy status descriptions from DashboardView, ModulePlaceholderView, and modals | M1 | Survey |
| 4 | F4: Clean Launch Store Onboarding Wizard | Fix DatabaseManager initialization to ensure empty profiles cleanly display OnboardingWizardView instead of bypassing | M1 | Survey |
| 5 | F5: Parameterized Electron SQL & Importers | Parameterize all Electron SQL queries in main.ts and parsers (mapalParser, universalReportParser) with active store metadata | M1 | Survey |
| 6 | F6: Uniform SQLite Store Database File Naming | Unify store databases under `store_${storeId}.db` and provide automatic zero-loss legacy migration of `tplh_forecast.db` | M2 | Survey |
| 7 | F7: Electron LRU Connection Pool & Concurrency Mutex | Implement 8-connection LRU Pool with debounced dirty writes and async switch lock to prevent race conditions across 100+ stores | M2 | Survey |
| 8 | F8: Scalable Store Registry for 100+ Stores | Introduce dynamic central store registry (`stores_registry.json`) and virtualized fast store switcher for 100+ stores | M2 | Survey |
| 9 | F9: React View State Lifecycle Isolation | Key module views by `key={currentStore.id}` and reset state via `sbx:store-switching` events to eliminate cross-store data leakage | M2 | Survey |
| 10 | F10: Service Storage Namespacing | Partition localStorage keys by `sbx_store_${storeId}_*` across Todo, Notification, SyncEngine, and Admin services | M2 | Survey |
| 11 | F11: Store-Partitioned Backup & Restore | Ensure backups are store-isolated (`store_${storeId}_*.db`) and restore validates target store ID | M2 | Survey |
| 12 | F12: Client-Side AES-256-GCM Encryption Engine | Implement PBKDF2 (600,000 iters), safeStorage key management, 96-bit IV, 128-bit tag, and AAD context binding | M3 | Survey |
| 13 | F13: Sensitive Payload Classification & Vault Packaging | Encrypt financial P&L, employee hourly rates/salaries, and GDPR Art. 9 health data (L4) before writing to Firestore | M3 | Survey |
| 14 | F14: Hardened Firestore Security Rules | Enforce strict per-store tenant isolation (`request.auth.token.storeId == storeId`) in firestore.rules and remove aggregate leak | M3 | Survey |
| 15 | F15: Cryptographic Unit Test Suite | Comprehensive unit tests for AES-256-GCM round-trip, invalid keys, tampered ciphertexts, and AAD mismatches | M3 | Survey |
| 16 | F16: Zero-Data-Loss Local-to-Cloud Migration Pipeline | Automated migration bridge: pre-flight backup, SQLite table extraction, encryption, and batch REST upload | M4 | Survey |
| 17 | F17: Bi-Directional Cryptographic Parity Verification | Deep structural & SHA-256 cryptographic parity verification between local SQLite records and decrypted cloud records | M4 | Survey |
| 18 | F18: 100% E2E Acceptance Test Pass & Adversarial Hardening | Pass 100% of E2E test suite (Tiers 1-4) and complete white-box adversarial coverage hardening (Tier 5) | Final | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Deep Codebase Audit, Mock Purge & Onboarding Flow | Features F1, F2, F3, F4, F5: purge hardcoded store fallbacks, mock data, AI fillers; parameterize SQL; restore clean launch onboarding | none | DONE |
| M2 | Scalable Multi-Store Architecture (100+ Stores) | Features F6, F7, F8, F9, F10, F11: uniform `store_${id}.db`, LRU connection pool, async mutex, React state keying, namespaced storage, store-partitioned backups | M1 | DONE |
| M3 | Hybrid Per-Store AES-256-GCM Encryption & Firestore Rules | Features F12, F13, F14, F15: client-side AES-256-GCM encryption engine, sensitive payload packaging, firestore.rules tenant enforcement, crypto tests | M1 | DONE |
| M4 | Local-to-Cloud Migration Bridge & Parity Verification | Features F16, F17: 6-phase migration pipeline, pre-migration backup, batch encrypted upload, bi-directional SHA-256 parity verification | M2, M3 | DONE |
| Final | 100% E2E Test Suite Pass & Adversarial Coverage Hardening | Feature F18: Pass 100% of E2E test suite (Tiers 1-4) + Tier 5 white-box adversarial hardening loop | M1, M2, M3, M4 | DONE |

## Interface Contracts

### StoreContext ↔ Module Views
- Contract: Every module view (`ManagerScheduleView`, `TrainingsView`, `ColCalculatorView`, `LaborForecastView`) MUST receive `key={currentStore.id}` from `App.tsx`.
- Event: `window.dispatchEvent(new CustomEvent('sbx:store-switching', { detail: { fromStoreId, toStoreId } }))` resets in-flight module state.
- Event: `window.dispatchEvent(new CustomEvent('sbx:store-switched', { detail: { currentStore } }))` triggers fresh data loading for the new store.

### Frontend ↔ Electron IPC Database (`api.switchStoreDatabase`)
- Signature: `switchStoreDatabase(storeId: string, storeInfo?: StoreInfo): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>`
- Semantics: Thread-safe serialized switch via async mutex. In-memory LRU pool ensures old database is flushed to disk before new database handle is returned. All subsequent queries target the active store database.

### Client-Side Encryption Engine (`encryptionService`)
- Secret Management: SEK (Store Encryption Key) derived via PBKDF2-HMAC-SHA256 (600,000 iterations, salt = `SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)`). Persisted securely via Electron `safeStorage`.
- Encrypt Signature: `encryptPayload(payload: any, storeId: string, vaultType: string, docId: string): Promise<EncryptedEnvelope>`
- Decrypt Signature: `decryptPayload(envelope: EncryptedEnvelope | string, storeId: string, vaultType: string, docId: string): Promise<any>`
- Format: `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>` with AAD = `${storeId}:${vaultType}:${docId}`.

### Migration Bridge ↔ Verification Parity Engine
- Signature: `executeStoreMigration(storeId: string, options: MigrationOptions): Promise<MigrationResult>`
- Verification Signature: `verifyMigrationParity(storeId: string): Promise<ParityVerificationReport>`
- Parity Criteria: `localRecordsCount === cloudRecordsCount`, `mismatches.length === 0`, `SHA256(canonicalJson(local)) === SHA256(canonicalJson(decryptedCloud))`. Returns signed certificate upon 100% match.

## Code Layout
- `src/services/security/` - Client-side AES-256-GCM encryption service, key derivation, envelope parser.
- `src/services/migration/` - Local-to-cloud migration bridge, parity verification engine, certificate generator.
- `src/services/storeService.ts` - Central store registry, store switching coordinator.
- `electron/database/db.ts` - DatabaseManager, StoreConnectionPool (LRU), schema creation, migration hooks.
- `electron/database/backupManager.ts` - Store-partitioned backup manager.
- `firestore.rules` - Hardened Firestore security rules with tenant isolation.
- `tests/` - Cryptographic unit tests, multi-store isolation tests, migration parity tests, E2E test suite.
