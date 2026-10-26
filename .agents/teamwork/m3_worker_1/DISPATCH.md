## 2026-10-24T07:32:24Z

You are M3 Worker 1 (Milestone 3 Implementation Worker).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_worker_1
Project root: /Users/dawidapel/COL Tool

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

READ FIRST:
- ORIGINAL_REQUEST.md: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/dawidapel/COL Tool/PROJECT.md
- Explorer 1 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_1/handoff.md
- Explorer 2 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_2/handoff.md
  (and /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_2/proposed_vaultService.ts)
- Explorer 3 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_3/handoff.md

FILE WRITE OWNERSHIP:
You have exclusive write access to:
- `src/services/security/encryptionService.ts` (create/implement)
- `src/services/security/vaultService.ts` (create/implement)
- `electron/security/vaultKeyManager.ts` (create/implement)
- `electron/main.ts` (register vault IPC handlers)
- `electron/preload.ts` (expose safe vault key APIs in contextBridge)
- `firestore.rules` (harden per-store tenant isolation)
- `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts` (create/implement test suite)

TASK OBJECTIVES:
Implement Features F12, F13, F14, and F15 according to the 3 Explorer blueprints:

1. **Feature F12: Client-Side AES-256-GCM Encryption Engine (`src/services/security/encryptionService.ts`)**:
   - Implement PBKDF2-HMAC-SHA256 with 600,000 iterations for SEK key derivation.
   - Deterministic salt: `SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)`.
   - In-memory `StoreKeyCache` to eliminate UI stutters.
   - AES-256-GCM AEAD encryption: 96-bit random IV, 128-bit auth tag, canonical JSON serialization, strict AAD context binding `${storeId}:${vaultType}:${docId}`.
   - Canonical string envelope format: `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>`.
   - Dual-environment support: works in Node.js test runners (`node:crypto`) and in Electron desktop (with `electron/security/vaultKeyManager.ts` using `safeStorage` when available).

2. **Feature F13: Sensitive Payload Classification & Vault Packaging (`src/services/security/vaultService.ts`)**:
   - Implement classification across Tier 1 (Financial), Tier 2 (HR & GDPR Art. 9 Health), and Tier 3 (Public Routing Metadata).
   - Implement packaging and unpackaging functions across the 5 Firestore vault collections:
     * `vault_financials`
     * `vault_personnel`
     * `vault_schedules`
     * `vault_health_gdpr`
     * `telemetry/status`
   - Ensure sensitive fields are encrypted inside `encryptedPayload` and public metadata remains in document headers.

3. **Feature F14: Hardened Firestore Security Rules (`firestore.rules`)**:
   - Enforce strict per-store tenant isolation: `isStoreAuthorized(storeId)` requiring `request.auth.token.storeId == storeId`.
   - Block cross-store reads and writes.
   - Eliminate aggregate workstation leaks.
   - Secure rules for `/stores/{storeId}/vault_*` and `/stores/{storeId}/telemetry`.

4. **Feature F15: Cryptographic Unit Test Suite (`tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`)**:
   - Implement the comprehensive 7-scenario test suite designed by Explorer 3 covering round-trip, invalid keys, ciphertext corruption, auth tag corruption, tampered AAD, key derivation uniqueness, string serialization, and < 200ms performance benchmark.

5. **Build & Test Verification**:
   - Run `npm run build` — must exit 0 cleanly with zero TypeScript errors.
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` — all tests must pass 100%!
   - Document commands, exit codes, and test outputs in your handoff report.
