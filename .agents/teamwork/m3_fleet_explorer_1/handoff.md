# Handoff Report: Pre-Login Station Activation Gate Modal (Feature F7)

**Agent Role**: M3 Explorer 1  
**Milestone**: Milestone 3 — Multi-Factor Authentication & Activation Flow  
**Target Feature**: Feature F7 — Pre-Login Station Activation Gate Modal (`src/components/ActivationModal.tsx`)  
**Date**: 2026-10-26T20:30:00Z  

---

## 1. Observation

### 1.1 Existing Hardware Binding & Licensing Engine
- **File**: `src/services/security/licensingService.ts`
  - Canonical key regex (Line 185):
    `public static readonly CANONICAL_KEY_REGEX = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i;`
  - Key validation (Lines 268–307): `validateKeyFormat(key: string): KeyValidationResult` extracts `storeId`, `randomHex`, `checksum`, and decodes `tier` from Byte 0 of `randomHex` (`'01'` for `STORE_CLIENT`, `'FF'` for `FLEET_MASTER`).
  - Cryptographic verification (Lines 316–355): `verifyKeySignature(key, expectedStoreId?, customSecret?): boolean` uses `crypto.createHmac('sha256', secret)` with constant-time comparison `timingSafeStringEqual`.
  - Station activation (Lines 404–452): `activateStation(key: string, expectedStoreId?: string): Promise<ActivationResult>` harvests machine hardware fingerprint via `getHardwareFingerprint()`, constructs `ActiveLicenseRecord`, signs the envelope with HMAC-SHA256, and calls `this.storageProvider.saveLicense(JSON.stringify(license))`.
  - Verification & Lockout (Lines 480–576): `verifyStationHardwareLock(): Promise<LicenseStatusResult>` returns `ACTIVATED`, `UNACTIVATED`, `HARDWARE_LOCKOUT` (with `hardwareMismatch: true` or `revoked: true`), or `TAMPER_DETECTED`.
  - Station activation check (Lines 586–589): `isStationActivated(): Promise<boolean>`.
  - **Naming observation**: In `licensingService.ts`, the methods are named `activateStation(key)` and `isStationActivated()`. The method aliases `activate(key)` and `isActivated()` (referenced in `SCOPE.md`) are currently missing.

- **File**: `electron/security/licenseVaultManager.ts` (Lines 80–135)
  - Manages encrypted license envelope at `userData/security/license.enc` (POSIX `0o600`).
  - Primary encryption uses Electron `safeStorage` (OS Keychain on macOS, DPAPI on Windows).
  - Fallback encryption uses hardware-keyed AES-256-GCM derived via PBKDF2 from host hardware fingerprint.

- **File**: `electron/security/hardwareIdManager.ts` (Lines 59–97)
  - Derives deterministic machine identity from `OS`, `ARCH`, `systemUuid` (`ioreg IOPlatformUUID` / `MachineGuid` / `machine-id`), `CPU`, `primaryMac`, and `hostname`.
  - Hashes payload using HMAC-SHA256 with salt pepper `sbx_hw_anchor_v1_`.

- **File**: `electron/preload.ts` (Lines 288–293) & `electron/main.ts` (Lines 1996–2010)
  - IPC channels exposed to renderer:
    - `system:get-hardware-fingerprint`
    - `licensing:save-license`
    - `licensing:load-license`
    - `licensing:revoke-license`

### 1.2 Boot-Time State Management in `AuthContext.tsx`
- **File**: `src/context/AuthContext.tsx`
  - State variables (Lines 68–70):
    ```typescript
    const [isStationActivated, setIsStationActivated] = useState<boolean>(false);
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
    const [activeLicense, setActiveLicense] = useState<ActiveLicenseRecord | null>(null);
    ```
  - Initialization effect (Lines 97–187): On mount, calls `licensingService.verifyStationHardwareLock()`.
    - If status is `ACTIVATED`: sets `isStationActivated(true)`, `activeLicense(status.license)`, `appMode(tier)`.
    - If status is `HARDWARE_LOCKOUT` or `TAMPER_DETECTED`: sets `isStationActivated(false)`, `appMode('STORE_CLIENT')`, `assignedStoreIds([])`.
    - If status is `UNACTIVATED`: sets `isStationActivated(false)`, `activeLicense(null)`.
  - Exposed activation trigger (Lines 189–215):
    `activateStation(key: string, expectedStoreId?: string): Promise<ActivationResult>`
    Calls `licensingService.activateStation(key, expectedStoreId)`. On success, updates `isStationActivated`, `activeLicense`, `appMode`, and `assignedStoreIds`.
  - Real-time Kill-Switch listener (Lines 168–186): Listens to window event `sbx:license-revoked`, immediately sets `isStationActivated(false)` and logs out.

### 1.3 Critical Gap Observed in `App.tsx`
- **File**: `src/App.tsx`
  - In `App.tsx` (Lines 58–60):
    `const { appMode, isFleetMaster, isStoreClient } = useAuth();`
    `isStationActivated` and `licenseStatus` are **not destructured or inspected anywhere in `App.tsx`**.
  - In `App.tsx` render sequence (Lines 464–571):
    - Line 464: Checks `hasCompletedOnboarding === null` (shows loading splash).
    - Line 480: Checks `!hasCompletedOnboarding` (shows `OnboardingWizardView`).
    - Line 559: Checks `!isLoggedIn` (shows `LoginView`).
    - Line 573+: Shows main application views (`DashboardView`, `StoreClientView`, etc.).
  - **Critical Vulnerability / Architecture Gap**:
    Because `App.tsx` does not check `isStationActivated` or `licenseStatus`:
    1. A freshly installed, unactivated workstation bypasses any activation check and presents `OnboardingWizardView` or `LoginView`.
    2. A workstation with a revoked license or hardware lockout still allows the user to see `LoginView` and perform `quickLoginStoreManager()`.
    3. `src/components/ActivationModal.tsx` does not exist yet.

### 1.4 Test Suite & Build Status
- Running `npm run test:security`:
  - 86/86 security tests pass in 1.23s (`tests/security/licensing_key_engine.test.ts`, `licensing_adversarial_challenge.test.ts`, etc.).
- Running `npm run build`:
  - Builds cleanly with TypeScript and Vite in 3.69s without warnings or errors.

---

## 2. Logic Chain

```
[Observation 1.1: LicensingService & LicenseVaultManager]
  -> Deterministic hardware binding, HMAC-SHA256 signature verification, and OS Keychain encryption are fully operational.
[Observation 1.2: AuthContext tracks isStationActivated & licenseStatus]
  -> AuthContext provides reactive state (isStationActivated, licenseStatus) and activateStation() trigger.
[Observation 1.3: App.tsx lacks activation check & ActivationModal is missing]
  -> In unactivated or locked out state, users can access LoginView / Onboarding because no pre-login gate intercepts the render flow.
  -> Therefore:
     1. Create `src/components/ActivationModal.tsx` as an un-closable, blocking security gate modal.
     2. Connect `App.tsx` to `useAuth()` (`isStationActivated`, `licenseStatus`) so that if `!isStationActivated`, `ActivationModal` intercepts execution before `OnboardingWizardView` or `LoginView`.
     3. Add compatibility aliases `isActivated()` and `activate()` in `LicensingService` to satisfy all callers.
     4. Ensure `ActivationModal` supports manual text input, QR code URLs, email text extraction, and direct JSON license envelopes.
```

---

## 3. Caveats

1. **Hardware Identification in Pure Web Browser**:
   When running in a standard web browser preview (outside Electron), `window.api.getHardwareFingerprint` is unavailable. `DefaultHardwareProvider` in `licensingService.ts` automatically falls back to a deterministic localStorage seed (`sbx_station_hw_fingerprint`), allowing full UI development and testing.
2. **First-Time Boot Latency**:
   On cold launch, Electron's `system:get-hardware-fingerprint` and `safeStorage` decryption takes 15–80ms. `App.tsx` must keep its splash loading state active while `licenseStatus === null` to prevent a visual flash of the activation modal on already-activated machines.
3. **Store Auto-Convergence**:
   When `activateStation` completes, `StoreContext` automatically converges `currentStore` to the activated store ID. `App.tsx` should allow `AuthContext` to update and smoothly render `LoginView` (or `OnboardingWizardView` if first onboarding is required).

---

## 4. Conclusion & Complete Design Specification

### 4.1 Component Blueprint: `src/components/ActivationModal.tsx`

#### File Location
`src/components/ActivationModal.tsx`

#### Interface Contract
```typescript
import React from 'react';
import type { ActiveLicenseRecord, LicenseStatusResult } from '../types/licensing';

export interface ActivationModalProps {
  /** Explicit control over modal visibility (defaults to true if not activated) */
  isOpen?: boolean;
  /** Callback fired immediately after successful hardware binding and persistence */
  onActivationSuccess?: (license: ActiveLicenseRecord) => void;
  /** Optional custom hardware status (falls back to useAuth().licenseStatus) */
  licenseStatus?: LicenseStatusResult | null;
  /** Enforces matching a specific expected store ID if specified */
  expectedStoreId?: string;
  /** Presentation layout: 'blocking_modal' (overlay) or 'fullscreen_gate' (standalone) */
  presentationMode?: 'blocking_modal' | 'fullscreen_gate';
}
```

#### Smart Input Parser Algorithm
The key input must accept multiple common formats effortlessly:
```typescript
export interface ParsedActivationInput {
  cleanKey: string | null;
  formatSource: 'RAW' | 'QR_URL' | 'JSON_ENVELOPE' | 'INSTRUCTION_TEXT' | null;
  storeId?: string;
  tier?: 'STORE_CLIENT' | 'FLEET_MASTER';
  isValidFormat: boolean;
}

export function parseActivationInput(raw: string): ParsedActivationInput {
  if (!raw || !raw.trim()) {
    return { cleanKey: null, formatSource: null, isValidFormat: false };
  }

  const trimmed = raw.trim();

  // 1. JSON Envelope Paste
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate = parsed.key || parsed.activationKey || parsed.fullKey;
      if (typeof candidate === 'string' && LicensingService.CANONICAL_KEY_REGEX.test(candidate.trim())) {
        const clean = candidate.trim().toUpperCase();
        const meta = LicensingService.validateKeyFormat(clean);
        return {
          cleanKey: clean,
          formatSource: 'JSON_ENVELOPE',
          storeId: meta.storeId,
          tier: meta.tier,
          isValidFormat: meta.valid,
        };
      }
    } catch (_) {}
  }

  // 2. QR Code URL / Deep Link Paste (e.g. sbx://activate?key=SBX-... or starbucks://...)
  if (trimmed.includes('://') || trimmed.includes('key=')) {
    const urlMatch = trimmed.match(/key=([A-Z0-9_\-]+)/i) || trimmed.match(/(SBX-[A-Z0-9_]{3,16}-[A-F0-9]{16}-[A-F0-9]{10})/i);
    if (urlMatch && urlMatch[1] && LicensingService.CANONICAL_KEY_REGEX.test(urlMatch[1])) {
      const clean = urlMatch[1].trim().toUpperCase();
      const meta = LicensingService.validateKeyFormat(clean);
      return {
        cleanKey: clean,
        formatSource: 'QR_URL',
        storeId: meta.storeId,
        tier: meta.tier,
        isValidFormat: meta.valid,
      };
    }
  }

  // 3. Instruction Text / Email Paste containing the key
  const textMatch = trimmed.match(/SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})/i);
  if (textMatch) {
    const clean = textMatch[0].trim().toUpperCase();
    const meta = LicensingService.validateKeyFormat(clean);
    return {
      cleanKey: clean,
      formatSource: trimmed.length > 50 ? 'INSTRUCTION_TEXT' : 'RAW',
      storeId: meta.storeId,
      tier: meta.tier,
      isValidFormat: meta.valid,
    };
  }

  return { cleanKey: trimmed.toUpperCase(), formatSource: null, isValidFormat: false };
}
```

#### UI States & Starbucks Emerald Design Specs
1. **Modal Presentation**:
   - `fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#122620]/95 backdrop-blur-md select-none`
   - Un-closable: No close button (`X`), Escape key handler is disabled, backdrop clicks do not dismiss.
   - Container: `max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden`
   - Top accent stripe: `h-2 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#CBA258]`
2. **Dynamic Header & Status Badges**:
   - Logo: Centered Starbucks Siren Shield (`#1E3932` container, `#CBA258` gold star).
   - Title: `STARBUCKS OPERATIONS SUITE`
   - Subtitle: `Aktywacja Stacji Roboczej • Pre-Login Gate`
   - Status Notice based on `licenseStatus?.status`:
     - `UNACTIVATED`: Amber pill (`Wymagana aktywacja stacji roboczej przed logowaniem`).
     - `HARDWARE_LOCKOUT (revoked)`: Crimson pill (`Licencja stacji została wycofana (Kill-Switch)`).
     - `HARDWARE_LOCKOUT (mismatch)`: Orange pill (`Niezgodność sprzętowa: wykryto przeniesienie bazy na inny komputer`).
     - `TAMPER_DETECTED`: Red pill (`Wykryto uszkodzenie lub manipulację w pliku licencji`).
3. **Key Entry Controls**:
   - Primary input:
     - Placeholder: `SBX-18120-01A1B2C3D4E5F678-ABCDEF1234`
     - Styling: `font-mono tracking-wider font-bold text-stone-900 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#006241] focus:bg-white`
     - Action buttons: "Wklej ze schowka" button using `navigator.clipboard.readText()`.
   - Format feedback pill:
     - When valid: Green checkmark `Format poprawny • Lokal: [storeId] • Profil: [STORE_CLIENT / FLEET_MASTER]`
     - Format source badge: `Wykryto z: Koperta JSON ✓` or `Wykryto z: Kod QR ✓`
4. **Hardware Validation & Binding Trigger**:
   - Button: `bg-[#006241] hover:bg-[#00754A] disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2`
   - Loading State: Spinner + "Trwa weryfikacja kryptograficzna i wiązanie ze sprzętem..."
   - Execution:
     ```typescript
     const res = await activateStation(cleanedKey, expectedStoreId);
     ```
   - Success View:
     - Big green checkmark circle with pulse ring.
     - "Stacja pomyślnie aktywowana!"
     - "Przypisany lokal: [storeId] • Powiązano z bezpiecznym magazynem sprzętowym."
     - Automatically transitions to `LoginView` after 900ms.
5. **Hardware Diagnostic Inspector (Footer)**:
   - Expandable panel: "Szczegóły techniczne stacji (Hardware Diagnostics)"
   - Displays:
     - Hostname: machine host name
     - Platform / Arch: macOS / Windows / Linux
     - Fingerprint snippet: `SHA-256: [first 16 hex chars]...`
     - Quick button: "Skopiuj ID sprzętu do zgłoszenia" (Copies hardware ID to clipboard for the Store Manager to email/Slack the District Manager).
6. **Error Boundary Wrapping**:
   - The entire modal content is wrapped in `<ErrorBoundary moduleName="Station Activation Gate" fallbackTitle="Błąd w bramce aktywacyjnej">` to guarantee fault tolerance.

### 4.2 Architecture Changes in Supporting Files

#### In `src/services/security/licensingService.ts`:
Add convenience aliases for SCOPE.md compliance:
```typescript
  /**
   * Alias for isStationActivated()
   */
  public async isActivated(): Promise<boolean> {
    return this.isStationActivated();
  }
  public static async isActivated(): Promise<boolean> {
    return this.getInstance().isActivated();
  }

  /**
   * Alias for activateStation(key)
   */
  public async activate(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    return this.activateStation(key, expectedStoreId);
  }
  public static async activate(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    return this.getInstance().activate(key, expectedStoreId);
  }
```

#### In `src/App.tsx`:
Integrate the Pre-Login Station Activation Gate:
```typescript
  // 1. Destructure activation state from useAuth()
  const { appMode, isFleetMaster, isStoreClient, isStationActivated, licenseStatus } = useAuth();

  // 2. Extend startup loading check to wait for license verification
  if (hasCompletedOnboarding === null || licenseStatus === null) {
    return (
      <div className="h-screen w-screen bg-[#1E3932] flex flex-col items-center justify-center select-none text-white">
        <div className="w-16 h-16 rounded-2xl bg-[#006241] flex items-center justify-center text-3xl shadow-xl animate-pulse mb-4 ring-4 ring-white/10">
          ☕
        </div>
        <h1 className="text-xl font-black tracking-tight text-white">Starbucks Operations Suite</h1>
        <p className="text-xs text-emerald-200/70 mt-1 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Inicjalizacja pulpitu operacyjnego i weryfikacja stacji...
        </p>
      </div>
    );
  }

  // 3. Pre-Login Station Activation Gate (Feature F7)
  // If station is not activated, revoke-locked, or tampered, intercept with ActivationModal
  if (!isStationActivated) {
    return (
      <ActivationModal
        isOpen={true}
        licenseStatus={licenseStatus}
        onActivationSuccess={() => {
          // AuthContext automatically updates isStationActivated = true,
          // triggering clean re-render to Onboarding or LoginView.
        }}
      />
    );
  }

  // 4. Existing Onboarding and Login flows proceed safely once station is verified
  if (!hasCompletedOnboarding) {
    return ( ... OnboardingWizardView ... );
  }

  if (!isLoggedIn) {
    return ( ... LoginView ... );
  }
```

---

## 5. Verification Method

To independently verify the implementation:

1. **Static Analysis & TypeScript Compilation**:
   ```bash
   npm run build
   ```
   *Expected result*: Clean compilation without TypeScript errors (`tsc && vite build`).

2. **Security & Cryptographic Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected result*: All 86 existing security tests pass without regressions.

3. **New Automated Unit Test (`tests/security/activation_modal_gate.test.ts`)**:
   Verify:
   - `parseActivationInput` correctly handles:
     - Canonical key: `SBX-18120-01A1B2C3D4E5F678-ABCDEF1234` -> `valid: true, source: RAW`
     - JSON envelope: `{"key": "SBX-18120-01A1B2C3D4E5F678-ABCDEF1234"}` -> `valid: true, source: JSON_ENVELOPE`
     - QR URL: `sbx://activate?key=SBX-18120-01A1B2C3D4E5F678-ABCDEF1234` -> `valid: true, source: QR_URL`
     - Instruction email: `Klucz: SBX-18120-01A1B2C3D4E5F678-ABCDEF1234 wklej w programie` -> `valid: true, source: INSTRUCTION_TEXT`
     - Invalid / tampered keys -> `valid: false`
   - `LicensingService.getInstance().isActivated()` alias returns expected boolean.
   - `LicensingService.getInstance().activate(key)` alias completes hardware binding round-trip.

4. **Integration Invalidation Conditions**:
   - If an unactivated station can view `LoginView` or `OnboardingWizardView` without activating, verification fails.
   - If pressing `ESC` or clicking the backdrop can close `ActivationModal` on an unactivated station, verification fails.
   - If entering a valid key fails to transition smoothly to `LoginView`, verification fails.
