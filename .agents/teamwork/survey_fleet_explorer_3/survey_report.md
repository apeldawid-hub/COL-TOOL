# Survey Report: Master Fleet HQ vs Store Client Architecture & Enterprise Security Model

**Agent:** Survey Explorer 3  
**Date:** 2026-10-26  
**Target:** Starbucks Operations Suite (`COL Tool`)  
**Scope:** Multi-Factor Authentication & Activation Flow (R3) & Verification, Testing & Build Pipeline (R5)  
**Parent Orchestrator:** `bc820f6a-3865-4f82-8517-3240379a0b72`

---

## 1. Executive Summary

This investigation surveys the architecture, runtime gating, security mechanics, and test infrastructure required to implement:
1. **Station Licensing & Hardware-Bound Activation Engine (R1/R3)**
2. **Dual-Profile Runtime Architecture (`FLEET_MASTER` vs `STORE_CLIENT`) (R2)**
3. **Multi-Factor Corporate Authentication & Session Inactivity Auto-Lock (R3)**
4. **Master Hardening, BIP-39 Disaster Recovery & Key Zeroization (R4)**
5. **Quality Assurance, Native Testing, Build & OTA Pipeline (R5)**

### Core Discoveries
- **Authentication (`src/components/LoginView.tsx` & `src/services/auth/authService.ts`)**: Currently supports Store Manager quick-login (`quickLoginStoreManager`) and 2FA OTP (`request2FaOtp` / `verify2FaOtp`), enforcing corporate domains (`@amrest.eu`, `@starbucks.com`). However, **no station activation gate currently exists** — any unactivated client station can immediately access the login interface without licensing or hardware verification.
- **Station Activation (`ActivationModal.tsx`)**: Missing from the codebase. Must be introduced as a pre-login / pre-dashboard barrier requiring cryptographic keys (`SBX-<storeId>-<randomHex>-<checksum>`), binding to an OS/hardware fingerprint, and preventing clone attacks.
- **Inactivity Auto-Lock**: Currently absent across the entire codebase. There are no global user activity listeners or inactivity timers. An auto-lock system must be established to reset session state, close sensitive modals, and invoke RAM zeroization (`StoreKeyCache.clear()`, filling derived Buffer keys with zeros).
- **Dual-Profile Runtime**: The application currently runs in a single unified mode where all 132 stores in Poland are visible in `StoreSwitcherModal.tsx`. In `STORE_CLIENT` mode, store selection must be locked to assigned units, developer tools/raw database controls stripped, and telemetry abstracted behind a friendly cloud sync indicator.
- **Disaster Recovery (`masterRecoveryService.ts`)**: No BIP-39 mnemonic implementation exists. Needs a self-contained 24-word generator/validator (256-bit entropy + 8-bit checksum) using the standard 2048-word dictionary, with PBKDF2 seed derivation and Electron IPC bridge.
- **Test Infrastructure (`TEST_INFRA.md` & `tests/`)**: Built on Node's native test runner (`node:test` + `node:assert/strict`) executed with TypeScript via `tsx` (`node --import tsx --test`). However, `package.json` **lacks a `"test"` script**. Running `npm test` currently errors out.
- **Build & OTA Pipeline**: `npm run build` (`tsc && vite build`) executes cleanly in ~1.2s. `npm run patch` (`scripts/publish-patch.js`) packages `app.asar` with `sql.js` and `xlsx` into a lightweight ~1.15 MB zip and publishes directly to GitHub Releases in 3–5 seconds.

---

## 2. Multi-Factor Authentication & Activation Flow (R3)

### 2.1 Current Authentication State & Audit

#### Code Citations & File Paths
- **`src/components/LoginView.tsx`** (Lines 1–546):
  - Renders 3 tabs: `store_manager` (Lines 275–326), `partner_2fa` (Lines 328–411), and `register_partner` (Lines 413–524).
  - Top bar features a `StoreSwitcherModal` trigger (`Lines 180–190`), allowing any user on the login screen to switch between all 132 Starbucks locations in Poland before authenticating.
  - Quick-login for Store Manager (Lines 66–78):
    ```typescript
    const handleStoreManagerLogin = () => {
      setIsSubmitting(true);
      const session = AuthService.quickLoginStoreManager(currentStore.unitCode);
      setTimeout(() => {
        onLogin(`${session.fullName} (SM)`, session);
      }, 200);
    };
    ```
- **`src/services/auth/authService.ts`** (Lines 1–358):
  - Corporate email validation (Lines 45–49):
    ```typescript
    public static isCorporateEmail(email: string): boolean {
      if (!email || !email.includes('@')) return false;
      const domain = email.trim().toLowerCase().split('@')[1];
      return domain === 'amrest.eu' || domain === 'starbucks.com';
    }
    ```
  - Device identification (Lines 54–61):
    ```typescript
    public static getDeviceFingerprint(): string {
      let uuid = localStorage.getItem(STORAGE_DEVICE_UUID_KEY);
      if (!uuid) {
        uuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(STORAGE_DEVICE_UUID_KEY, uuid);
      }
      return uuid;
    }
    ```
    *Vulnerability Notice*: This is a random string generated in `localStorage`, NOT a deterministic hardware fingerprint. If localStorage is cleared or copied to another machine, the fingerprint changes or migrates.
  - Session verification & Kill-Switch (Lines 78–95):
    Validates `user.isActive` and `user.sessionVersion <= session.sessionVersion` against `AdminService.getUserByEmail(session.email)`. If revoked, logs out.

- **`src/App.tsx`** (Lines 55–136, 452–560):
  - Checks onboarding state (`hasCompletedOnboarding`). If `false`, renders `OnboardingWizardView`.
  - Checks `isLoggedIn`. If `false`, renders `LoginView`.
  - **No check for station license / station activation exists between Onboarding and Login.**

---

### 2.2 Licensing & Hardware-Bound Activation Flow

#### Activation Architecture
To enforce station licensing before access is granted, the app startup sequence must be updated:
```
[App Launch]
    │
    ▼
[Check Station Activation Status] (Electron IPC: 'licensing:get-status')
    ├── NOT ACTIVATED ──────────────────────► Renders [ActivationModal.tsx] (Blocking)
    │                                              │ Validates key: SBX-<storeId>-<hex>-<checksum>
    │                                              │ Binds to deterministic hardware fingerprint
    │                                              ▼
    │                                         [Save License & Persist]
    │                                              │
    ├── ACTIVATED BUT HARDWARE MISMATCH ────► Renders [HardwareTamperAlert] / Lock
    │
    ▼ (Valid License & Matched Hardware)
[Check Onboarding / Store Selection]
    │
    ▼
[LoginView.tsx] (Restricted to activated store in STORE_CLIENT mode)
```

#### Key Format Specification: `SBX-<storeId>-<randomHex>-<checksum>`
1. **`SBX`**: Fixed static brand prefix.
2. **`<storeId>`**: Alphanumeric store ID / MPK (e.g. `108120`, `108150`).
3. **`<randomHex>`**: 8 to 12 uppercase hex characters generated via `crypto.randomBytes(4)` or `crypto.randomBytes(6)`.
4. **`<checksum>`**: 4 or 8 uppercase hex characters computed from HMAC-SHA256:
   $$\text{Checksum} = \text{HMAC-SHA256}(\text{MasterSecret}, \text{"SBX:"} + \text{storeId} + \text{":"} + \text{randomHex})[0..4]$$
   This guarantees that an activation key cannot be manufactured without the master secret managed by Fleet Master HQ.

#### Deterministic Hardware Fingerprint Algorithm
In `src/services/security/licensingService.ts` and `electron/main.ts`:
- Elements incorporated into hardware profile:
  1. `os.platform()` (e.g. `'darwin'`, `'win32'`, `'linux'`)
  2. `os.arch()` (e.g. `'arm64'`, `'x64'`)
  3. `os.cpus()[0]?.model` (e.g. `'Apple M2'`, `'Intel(R) Core(TM) i7-10750H'`)
  4. `os.cpus().length` (logical core count)
  5. Primary machine identifier: `os.hostname()` and OS machine-id (`/etc/machine-id` or Windows registry machine GUID via node helper or safeStorage device salt).
- Canonical Fingerprint Hash:
  ```typescript
  export function computeHardwareFingerprint(): string {
    const raw = [
      process.platform,
      process.arch,
      os.cpus()[0]?.model || 'unknown_cpu',
      os.cpus().length,
      os.hostname()
    ].join('::');
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }
  ```
- Anti-Cloning Enforcement:
  When a station is activated, `{ licenseKey, storeId, hardwareFingerprint, activatedAt }` is persisted to `master_seed.enc` via `safeStorage` (or `app_settings` in SQLite). On every launch and every login attempt:
  ```typescript
  const currentFp = await window.api.getHardwareFingerprint();
  if (license.hardwareFingerprint !== currentFp) {
    throw new SecurityException('HARDWARE_MISMATCH', 'Station configuration cloned or altered.');
  }
  ```

#### Component Design: `src/components/ActivationModal.tsx`
- **Visual Presentation**:
  - Fullscreen blocking modal / portal with Starbucks Reserve / Operations dark green aesthetic (`#1E3932`).
  - Station Hardware Identifier badge displayed to Store Manager (e.g. `STATION-ID: HW-B871-F902`), useful for calling District Manager or HQ IT support.
  - Store selection dropdown or detected store code input.
  - License Key input with auto-formatting: uppercase enforcement, auto-dash insertion (`SBX-XXXXXX-XXXX-XXXX`), and clipboard paste sanitization.
- **Action Buttons**:
  - `Aktywuj Stację Operacyjną` (triggers validation and hardware binding).
  - `Sprawdź Status w Chmurze` (queries Firestore `/fleet/licenses/{key}` for remote activation/unbinding).
- **Error States**:
  - Invalid format (`Niepoprawny format klucza aktywacyjnego`).
  - Store mismatch (`Klucz wystawiony dla innej kawiarni (np. 108150 zamiast 108120)`).
  - Key revoked (`Klucz został zdalnie unieważniony przez Centralę Fleet Master`).
  - Hardware locked (`Klucz jest już aktywowany na innej stacji roboczej`).

---

### 2.3 Corporate 2FA Authentication Enforcing `@amrest.eu` / `@starbucks.com`

#### Architecture & Rules
1. **Domain Enforcement**:
   - Strictly enforces that only employees with `@amrest.eu` or `@starbucks.com` email addresses can initiate login or registration.
   - Any attempt to submit public domains (`@gmail.com`, `@wp.pl`, `@onet.pl`, `@yahoo.com`) fails immediately at validation.
2. **Two-Factor Flow**:
   - **Step 1 (Request OTP)**:
     - User enters email.
     - System checks `AdminService.getUserByEmail(email)` for active account.
     - System verifies station license allows users of that store.
     - Generates 6-digit numeric OTP with 5-minute TTL (`Date.now() + 300000`).
     - Emits notification via `cloudNotificationService.ts` (Resend API / SMTP). In offline or development mode, simulated OTP is presented in test UI.
   - **Step 2 (Verify OTP)**:
     - User inputs 6 digits.
     - System validates against pending OTP record.
     - Enforces max 3 failed attempts before locking the email for 15 minutes.
     - On success: generates `AuthUserSession` with `sessionToken`, `sessionVersion`, permissions, and audit log.

---

### 2.4 Session Inactivity Auto-Lock

#### Technical Implementation Plan
1. **Activity Monitor Hook (`src/hooks/useInactivityAutoLock.ts`)**:
   - Listens to DOM events:
     `['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel']`.
   - **Throttling**: To prevent high CPU usage on continuous mouse movements, the activity listener throttles state updates to once every 2,000 ms.
   - **Timestamp-Delta Heartbeat**: Instead of relying solely on `setTimeout` (which can drift or fail to trigger when a laptop sleeps), use a 10-second `setInterval` comparing `Date.now() - lastActivityTimestamp > TIMEOUT_MS`.
     * Default timeout: 15 minutes (900,000 ms).
     * Configurable in Settings (5 min, 10 min, 15 min, 30 min).

2. **Actions Triggered on Auto-Lock**:
   ```typescript
   export const triggerSessionAutoLock = () => {
     // 1. In-Memory Key Zeroization (R4 requirement)
     StoreKeyCache.clear(); // Wipes and zeroizes all derived 256-bit AES keys (key.fill(0))

     // 2. Clear sensitive tokens from sessionStorage / memory
     sessionStorage.removeItem('sbx_auth_pending_otp');
     sessionStorage.removeItem('sbx_active_session_token');

     // 3. Reset App state
     setIsLoggedIn(false);
     setIsAdminConsoleOpen(false);
     setIsSettingsOpen(false);
     setIsBackupModalOpen(false);
     setIsImportModalOpen(false);

     // 4. Record Audit Log
     AdminService.addAuditLog({
       actorName: loggedInUser,
       actorRole: 'STORE_MANAGER',
       actionType: 'KILL_SWITCH_REVOKE',
       targetResource: 'session:auto_lock',
       details: 'Automatyczna blokada stacji roboczej z powodu 15 minut bezczynności (Inactivity Auto-Lock)',
       deviceName: AuthService.getDeviceName(),
     });
   };
   ```

3. **User Feedback**:
   - `LoginView.tsx` receives a `lockReason="inactivity"` prop and renders a security warning:
     *"Sesja została automatycznie zablokowana z powodu 15 minut braku aktywności w trosce o ochronę danych osobowych (RODO/GDPR) i tajemnicy przedsiębiorstwa. Zaloguj się ponownie."*

---

## 3. Dual-Profile Runtime Architecture (R2 Integration)

### 3.1 Profile Differentiation (`FLEET_MASTER` vs `STORE_CLIENT`)

```typescript
export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';
```

| Feature / Capability | `FLEET_MASTER` (Central HQ) | `STORE_CLIENT` (Kawiarnia Zaplecze) |
| :--- | :---: | :---: |
| **Target Audience** | District Manager / IT Admin / Operations Director | Store Manager / Shift Supervisor / Barista |
| **Assigned Stores** | All 100+ Stores (National Fleet Catalog) | Strictly Assigned Store(s) (1 store default) |
| **Store Switcher** | Full 132-store selector with search & custom add | Disabled or locked to assigned store only |
| **Licensing Control** | Generate activation keys, revoke licenses, Kill-Switch | Displays station license status, no generation |
| **Database Tools** | Raw SQLite backup, schema inspection, PRAGMA health | Friendly automatic backup, no raw SQL/DB path |
| **Telemetry & Sync** | Full fleet telemetry dashboard, error rates | One-click simple sync with status indicator |
| **Disaster Recovery** | Master 24-word recovery seed management | Hidden / blocked |

### 3.2 View Architecture
- **`src/components/admin/FleetMasterDashboard.tsx`**:
  - Fleet catalog overview: list of 100+ stores with online/offline health, sync status, and last heartbeat.
  - License generator modal: provisions new stores by generating signed `SBX-<storeId>-<hex>-<checksum>` keys.
  - Remote Kill-Switch: revokes store licenses or drops rogue stations into lock mode.
  - Fleet audit trail: centralized audit log viewer.
- **`src/components/StoreClientView.tsx` / Restricted App Navigation**:
  - Replaces global store switcher modal with a locked badge: `108120 SBX Warszawa Janki (Unit 18120)`.
  - Hides developer and technical telemetry buttons from Header and Sidebar.
  - Simple Cloud Sync Pill: Green (Synced), Amber (Syncing / Changes Pending), Red (Offline / Retry).

---

## 4. Master Hardening & Disaster Recovery (R4 Integration)

### 4.1 BIP-39 24-Word Mnemonic Service (`src/services/security/masterRecoveryService.ts`)

#### Mathematical & Cryptographic Specifications
1. **Entropy**:
   - 256 bits of cryptographically secure random entropy ($\text{ENT} = 256$).
   - Generated via Node's `crypto.randomBytes(32)`.
2. **Checksum**:
   - Checksum length: $\text{CS} = \text{ENT} / 32 = 256 / 32 = 8\text{ bits}$ (1 byte).
   - First 8 bits of $\text{SHA-256}(\text{Entropy})$.
3. **Total Bits & Word Split**:
   - $\text{Total} = \text{ENT} + \text{CS} = 256 + 8 = 264\text{ bits}$.
   - Divided into 24 chunks of 11 bits each ($264 / 11 = 24$).
   - Each 11-bit integer ($0 \le i \le 2047$) maps directly to a word in the standard 2048-word BIP-39 English dictionary.
4. **Validation Logic**:
   - Verifies exactly 24 words.
   - Verifies all words exist in BIP-39 wordlist.
   - Reconstructs the 264 bits, re-computes SHA-256 of the 256 entropy bits, and asserts that the final 8 bits match the checksum byte.
5. **Seed Derivation**:
   - Root seed derived via PBKDF2:
     $$\text{Seed} = \text{PBKDF2-HMAC-SHA512}(\text{Mnemonic}, \text{"mnemonic"} + \text{Passphrase}, 2048, 64)$$
6. **In-Memory Zeroization**:
   - Any Buffer containing the derived seed or plaintext mnemonic must be explicitly wiped:
     ```typescript
     public zeroize(): void {
       if (this.cachedSeedBuffer) {
         this.cachedSeedBuffer.fill(0);
         this.cachedSeedBuffer = null;
       }
     }
     ```

---

## 5. Verification, Testing & Build Pipeline (R5)

### 5.1 Test Runner & Infrastructure Audit

#### Existing Test Setup
- **Runner**: Node.js Native Test Runner (`node:test`, `node:assert/strict`).
- **Transpiler**: `tsx` (`--import tsx`).
- **Invocation Command**:
  ```bash
  node --import tsx --test "tests/e2e/**/*.test.ts"
  ```
- **Test File Organization**:
  - `tests/e2e/helpers/`: `testHarness.ts`, `cryptoSpec.ts`, `firestoreRulesSpec.ts`.
  - `tests/e2e/tier1-feature-coverage/`: 18 feature test files (`f01` to `f18`).
  - `tests/e2e/tier2-boundary-corner/`: 19 boundary test files (`b01` to `b19`).
  - `tests/e2e/tier3-pairwise-interactions/`: Cross-feature combinatorial tests.
  - `tests/e2e/tier4-real-world-scenarios/`: Multi-module end-to-end flows.
  - `tests/e2e/tier5-adversarial/`: Concurrency, corruption, and challenger stress tests.
  - `tests/adversarial_concurrency_stress.test.ts`: Multi-threaded worker thread stress tests.

#### Critical Gap Identified: Missing `"test"` Script in `package.json`
`package.json` currently defines:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "icons": "node scripts/generate-icons.js",
  "dist:mac": "npm run build && electron-builder --mac",
  "patch": "node scripts/publish-patch.js",
  ...
}
```
**Notice that `"test"` is missing!** Calling `npm test` fails with:
`npm error Missing script: "test"`.

**Required Script Addition in `package.json`**:
```json
"test": "node --import tsx --test \"tests/**/*.test.ts\""
```
Or for fast sub-suites:
```json
"test:unit": "node --import tsx --test \"tests/unit/**/*.test.ts\"",
"test:security": "node --import tsx --test \"tests/security/**/*.test.ts\""
```

---

### 5.2 Build Script & Compilation Verification

- **Command**: `npm run build` (`tsc && vite build`).
- **Verification Result**: Verified live via `run_command`:
  - `tsc` completed with zero TypeScript type errors.
  - Vite v8.3.0 built client environment into `dist/` in 1.13s.
  - Vite built Electron main process into `dist-electron/main.js` (440 kB) in 79ms.
  - Vite built Electron preload into `dist-electron/preload.js` (7.34 kB) in 12ms.
  - Total build time: ~1.2s.

---

### 5.3 OTA Hot-Patch Pipeline Audit (`scripts/publish-patch.js`)

- **Execution Command**: `npm run patch` or `node scripts/publish-patch.js`.
- **Workflow**:
  1. Validates `GH_TOKEN` from `.env` or process environment.
  2. Bumps patch version in `package.json` (e.g. `2.8.70` $\rightarrow$ `2.8.71`).
  3. Executes `npm run build` (`tsc && vite build`).
  4. Bundles `dist/`, `dist-electron/`, `package.json`, and runtime native modules `sql.js` & `xlsx` into `app.asar` using `@electron/asar`.
  5. Compresses into `release/sos-patch-<version>.zip` (~1.15 MB).
  6. Computes SHA-256 checksum and uploads directly to GitHub Releases under `apeldawid-hub/COL-TOOL`.
  7. Entire automated OTA publication takes **3 to 5 seconds**.

---

### 5.4 VERSION_HISTORY.md Structure & Conventions

- **File Path**: `/Users/dawidapel/COL Tool/VERSION_HISTORY.md`.
- **Governance**: Single Source of Truth maintained by `.agents/skills/version-tracker/`.
- **Structure**:
  1. Summary Table of Releases at the top:
     `| Wersja | Data | Tytuł Wydania | Typ | Status |`
  2. Detailed Release Sections in descending chronological order:
     ```markdown
     ### [v2.8.71] — 2026-10-26
     **Tytuł:** Master Fleet HQ vs Store Client Architecture & Enterprise Security Model
     **Autorzy:** Dawid Apel & Antigravity Agent Squad

     #### 🌟 Co Wprowadziliśmy:
     1. **Licencjonowanie i Aktywacja Stacji (R1/R3):**
        - Generowanie i walidacja kluczy `SBX-<storeId>-<randomHex>-<checksum>`.
        - Deterministyczny odcisk sprzętowy (Hardware Fingerprint) blokujący klonowanie stacji.
     2. **Architektura Dwóch Profili (Master HQ vs Store Client - R2):**
        - Separacja widoków: Fleet Master Control Center vs Zabezpieczony Store Client.
     3. **Autoryzacja 2FA i Auto-Lock Sesji (R3):**
        - Egzekwowanie domen korporacyjnych `@amrest.eu` / `@starbucks.com`.
        - Automatyczna blokada stacji po 15 min bezczynności z zerowaniem kluczy w RAM.
     4. **Plan Awaryjny & BIP-39 (R4):**
        - Generator 24 słów mnemonicznych i Electron IPC bridge.
     5. **Weryfikacja Jakości i Testy Regresyjne (R5):**
        - Automatyczny zestaw testów bezpieczeństwa i certyfikacja kompilacji.
     ```

---

### 5.5 Comprehensive Test Requirements Specification

To guarantee 100% test coverage for the enterprise security model, four specialized test suites must be created under `tests/security/`:

#### Suite 1: Activation Key Generation & Validation (`tests/security/licensing_keys.test.ts`)
1. **Format Conformance**:
   - Validates generated keys match `/^SBX-[a-zA-Z0-9]+-[A-F0-9]{8,12}-[A-F0-9]{4,8}$/`.
   - Validates store ID accurately embedded in segment 2.
2. **Entropy & Collision Resistance**:
   - 1,000 generated keys produce 1,000 distinct random segments.
3. **Checksum Verification**:
   - Tampering with a single character in the random hex or store ID segment causes immediate checksum rejection.
4. **Mismatched Store ID**:
   - Attempting to activate Store `108120` using a valid key issued for Store `108150` fails with `STORE_MISMATCH`.
5. **Brute-Force & Rate-Limiting**:
   - 5 consecutive invalid key attempts trigger a temporary 10-minute lockout.

#### Suite 2: Hardware Fingerprint Matching & Anti-Cloning (`tests/security/hardware_fingerprint.test.ts`)
1. **Determinism (Idempotence)**:
   - Repeated calls on identical hardware return bit-for-bit identical 64-character SHA-256 hashes.
2. **Signal Sensitivity**:
   - Mutating CPU model, core count, or hostname changes the fingerprint hash.
3. **Anti-Cloning Enforcement**:
   - Given an active license bound to `Fingerprint_A`, running validation on a system reporting `Fingerprint_B` returns `{ valid: false, error: 'HARDWARE_MISMATCH' }`.
   - App state transitions into unactivated/locked mode.

#### Suite 3: Profile Isolation & Role Boundaries (`tests/security/profile_isolation.test.ts`)
1. **Store Client Restricted Store List**:
   - In `STORE_CLIENT` mode, `StoreContext.availableStores` returns only the assigned store(s).
   - Calling `switchStore('108150')` from an unassigned store throws `UnauthorizedStoreSwitchException`.
2. **UI Component Guarding**:
   - In `STORE_CLIENT` mode, developer tabs, raw database backup triggers, and license generators throw or refuse rendering.
3. **Fleet Master Access Control**:
   - Only sessions with `role: 'FLEET_MASTER'` or DM permissions can access `FleetMasterDashboard`.

#### Suite 4: Recovery Seed Validation & Key Zeroization (`tests/security/recovery_seed_bip39.test.ts`)
1. **24-Word Generation & Length**:
   - Generates exactly 24 words separated by single spaces.
2. **Dictionary Conformance**:
   - All 24 words exist in the standard 2048-word BIP-39 dictionary.
3. **Checksum Validity**:
   - First 256 bits of entropy correctly yield the 8-bit checksum byte; modifying any word invalidates the checksum.
4. **Normalization**:
   - Accepts uppercase, mixed case, and extra whitespace, normalizing cleanly to lowercase trimmed tokens.
5. **In-Memory Zeroization**:
   - Verifies that calling `zeroize()` fills underlying Buffers with `0x00`.

#### Suite 5: Inactivity Auto-Lock & Key Purging (`tests/security/inactivity_autolock.test.ts`)
1. **Timer Expiration**:
   - Simulating 15 minutes of inactivity triggers `triggerSessionAutoLock()`.
2. **Activity Interruption**:
   - Simulating user activity at minute 14 resets the countdown.
3. **StoreKeyCache Zeroization**:
   - Asserts `StoreKeyCache.size() === 0` after lock and that previously cached `Buffer` memory has been zeroed (`key.fill(0)`).

---

## 6. Actionable Implementation & Verification Plan

```
Phase 1: Security Services & Primitives
├── src/services/security/licensingService.ts (Key gen, validation, hardware fingerprint)
├── src/services/security/masterRecoveryService.ts (BIP-39 24-words, zeroization)
└── tests/security/licensing_keys.test.ts & recovery_seed_bip39.test.ts

Phase 2: Electron IPC & Hardware Binding
├── electron/security/licensingManager.ts (OS machine ID, hardware hash, safeStorage binding)
├── electron/preload.ts & main.ts (IPC channels: licensing:*, crypto:*)
└── tests/security/hardware_fingerprint.test.ts

Phase 3: UI Components & Runtime Profile Gating
├── src/components/ActivationModal.tsx (Blocking station activation modal)
├── src/components/admin/FleetMasterDashboard.tsx (Fleet overview & license generator)
├── src/components/StoreClientView.tsx (Restricted client view & sync indicator)
├── src/hooks/useInactivityAutoLock.ts (Global event listener & 15-min timer)
└── src/App.tsx (Mode switching: 'FLEET_MASTER' vs 'STORE_CLIENT', activation gating)

Phase 4: Quality Assurance, Build & OTA Release
├── package.json (Add "test" script)
├── npm test (Execute full test suite)
├── npm run build (Validate clean TypeScript & Vite compilation)
├── VERSION_HISTORY.md (Register release notes)
└── npm run patch (Publish OTA hot-patch to GitHub Releases)
```

---

## 7. Conclusion

The application possesses a solid cryptographic foundation (`encryptionService.ts` AES-256-GCM, `vaultKeyManager.ts` safeStorage, `cloudMigrationService.ts`). Implementing the Master Fleet HQ vs Store Client architecture and Enterprise Security Model requires adding the **missing station licensing and hardware binding layers**, **enforcing profile isolation**, **adding the session inactivity auto-lock with key zeroization**, **adding BIP-39 disaster recovery**, and **formalizing the `"test"` script in `package.json`**.
