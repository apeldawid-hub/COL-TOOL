## 2026-10-26T20:24:32Z
You are M3 Explorer 3 for Milestone 3: Multi-Factor Authentication & Activation Flow.

Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m3_fleet_explorer_3
Create your directory and maintain your progress.md and BRIEFING.md.

Mandatory Inputs:
1. Read ORIGINAL_REQUEST.md at /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md.
2. Review SCOPE.md at /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md (Feature F9: Session Inactivity Auto-Lock & Key Zeroization).
3. Review existing application lifecycle & security state:
   - `src/App.tsx`
   - `src/context/AuthContext.tsx`
   - `src/services/security/licensingService.ts` (specifically `StoreKeyCache` or RAM key caches)
   - Any idle timer hooks or modal managers

Objective:
Investigate and design Session Inactivity Auto-Lock & Cryptographic RAM Key Zeroization:
1. Design `src/hooks/useInactivityAutoLock.ts`:
   - Configurable timeout defaulting to 15 minutes (900,000 ms), with support for test-override (e.g. short timeout for tests).
   - Event listeners: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `wheel`. Debounced event handling to prevent performance degradation.
   - Headless Node environment safety (`typeof window !== 'undefined'`).
2. Design the Lock Action:
   - Transition user session state to `isLocked: true` or logged out in `AuthContext`.
   - Dismiss any open modal dialogs to prevent unauthorized backroom viewing of sensitive financial/schedule data.
   - Render a Lock Screen / Re-Authentication overlay requiring PIN or 2FA to resume.
3. Design Cryptographic In-Memory Key Zeroization:
   - When auto-lock triggers, call `StoreKeyCache.clear()` (or `LicensingService.getInstance().clearDecryptedKeyCache()`) to overwrite/purge sensitive cryptographic keys in memory buffers, ensuring that physical RAM dumps or memory scrapers cannot recover active store keys while unattended.
4. Define test strategy and unit test harness in `tests/security/inactivity_autolock.test.ts`.
5. Produce a detailed investigation report in `handoff.md` with: Observation, Logic Chain, Caveats, Conclusion, and Verification Method. Send a message when finished.
