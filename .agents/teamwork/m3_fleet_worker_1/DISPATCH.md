## 2026-10-26T20:33:04Z
You are the M3 Worker for Milestone 3: Multi-Factor Authentication & Activation Flow.

Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m3_fleet_worker_1
Create your directory and maintain your progress.md and BRIEFING.md.

Mandatory Inputs:
1. Read ORIGINAL_REQUEST.md at /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md.
2. Read SCOPE.md at /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md (Features F7, F8, F9).
3. Read the 3 Explorer handoff reports:
   - `/Users/dawidapel/COL Tool/.agents/teamwork/m3_fleet_explorer_1/handoff.md` (Activation Gate Modal)
   - `/Users/dawidapel/COL Tool/.agents/teamwork/m3_fleet_explorer_2/handoff.md` (Corporate 2FA Flow)
   - `/Users/dawidapel/COL Tool/.agents/teamwork/m3_fleet_explorer_3/handoff.md` (Inactivity Auto-Lock & RAM Zeroization)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Implementation Tasks:

Task 1: Pre-Login Station Activation Gate Modal (Feature F7)
- In `src/services/security/licensingService.ts`: Ensure `isStationActivated()` and `activateStation(key)` are available (and add convenience aliases `isActivated()` and `activate(key)`).
- Create `src/components/ActivationModal.tsx`:
  - Fullscreen blocking modal overlay (`z-[99998]`) preventing access when station is unactivated (`!isStationActivated`).
  - Cannot be dismissed until activated.
  - Inputs: manual canonical key input (`SBX-<storeId>-<randomHex>-<checksum>`), smart paste parser (raw key, JSON envelope, or activation URL).
  - Displays hardware identity summary (fingerprint snippet) with copy button for District Manager provisioning.
  - Submits via `useAuth().activateStation(key)`. Shows clear error feedback and loading state.
- In `src/App.tsx`: Destructure `isStationActivated` from `useAuth()`. If `!isStationActivated` (and not initialLoading), render `<ActivationModal />` blocking access to all views.

Task 2: Corporate 2FA Authentication Flow (Feature F8)
- In `src/services/auth/authService.ts`:
  - Harden email validation: strictly validate syntax and enforce corporate email domains `@amrest.eu` and `@starbucks.com`. Reject consumer/public domains (`@gmail.com`, `@wp.pl`, etc.) and multi-`@` attacks with explicit Polish error messages.
  - Upgrade 2FA OTP Challenge Engine:
    - Use CSPRNG (`crypto.randomInt` or `crypto.getRandomValues`) for 6-digit OTP (100000-999999).
    - Store salted SHA-256 hash in `sessionStorage` (never store plaintext OTP in browser storage).
    - 5-minute expiry.
    - Sliding rate limiting: max 3 attempts per OTP. On 3 failed attempts, enforce 60s cooldown lockout.
    - Resend cooldown throttle: 30 seconds minimum between OTP requests.
    - Constant-time verification to prevent timing side-channel attacks.
- In `src/components/LoginView.tsx`:
  - Update UI to 2-step authentication:
    - Step 1: Corporate email & password input. Validates corporate domain before issuing 2FA challenge.
    - Step 2: 6-digit OTP verification view:
      - 6 separate input boxes with auto-focus progression (typing advances, backspace retreats, paste 6 digits fills all boxes).
      - Countdown timer and "Wyślij kod ponownie" button (with 30s cooldown).
      - "Zmień adres e-mail" button to return to Step 1.

Task 3: Session Inactivity Auto-Lock & Cryptographic Key Zeroization (Feature F9)
- In `src/context/AuthContext.tsx`:
  - Expose `lockSession: () => void` in `AuthContextType`.
  - Implement `lockSession`: sets `isLocked = true` and triggers key zeroization (`StoreKeyCache.clear()`).
  - Implement `unlockSession(credential: string)`: validates PIN/password and resets `isLocked = false`.
- Create `src/hooks/useInactivityAutoLock.ts`:
  - 15-minute default timeout (configurable for testing).
  - Listens to passive events (`mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `wheel`) throttled to 1,000ms.
  - Handles `visibilitychange` (locks or resets).
  - When idle: invokes `lockSession()`, calls `StoreKeyCache.clear()`, and dispatches `sbx:dismiss-modals` custom event to close open modal dialogs.
  - Safe for headless Node (`typeof window !== 'undefined'`).
- Create `src/components/security/SessionLockOverlay.tsx`:
  - High z-index (`z-[99999]`) full-screen lock screen when `isLocked === true`.
  - Shows locked station banner, user email, and unlock form requiring password/PIN to restore session.
- In `src/App.tsx`:
  - Mount `useInactivityAutoLock()` when authenticated.
  - Listen for `sbx:dismiss-modals` event to close all open modals.
  - Render `<SessionLockOverlay />` when `isLocked === true`.

Task 4: Automated Security Test Suite
- Create `tests/security/m3_mfa_activation_autolock.test.ts`:
  - Test 1: ActivationModal key validation, hardware binding, and reject invalid/tampered keys.
  - Test 2: Corporate email domain validation (`@amrest.eu`, `@starbucks.com` pass; `@gmail.com`, `@evil.com@amrest.eu`, malformed fail).
  - Test 3: 2FA OTP CSPRNG randomness, expiry, 3-attempt lockout, 30s resend throttle.
  - Test 4: Inactivity auto-lock timeout, modal dismissal event, and RAM key zeroization (`StoreKeyCache.clear()`).

Task 5: Verification & Build
- Run `npm run test:security` - ensure ALL security tests (M1 + M2 + M3) pass.
- Run `npm run build` - ensure clean TypeScript compilation and Vite build with exit code 0.

## 2026-10-26T20:51:25Z
**Context**: Milestone 3 Implementation Status
**Content**: All security tests (`npm run test:security`) and production build (`npm run build`) succeeded with code 0 (108/108 security tests pass). Please finalize your `handoff.md` and send your completion message.
**Action**: Write `handoff.md` and reply with completion report.
