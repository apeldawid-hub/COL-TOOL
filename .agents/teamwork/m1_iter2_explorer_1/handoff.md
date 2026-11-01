# Handoff Report — Milestone 1 Iteration 2: Kill-Switch HMAC Envelope Binding Fix Strategy

**Agent**: M1 Iteration 2 Explorer 1 (`m1_iter2_explorer_1`)  
**Recipient**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Timestamp**: 2026-10-26T18:35:00Z  
**Type**: Hard Handoff (Investigation & Recommendation Complete)  

---

## 1. Observation

1. **Exact Omission in `src/services/security/licensingService.ts`**:
   - Line 389 (in `activateStation`):
     ```typescript
     const envelopePayload = `ACT:v1:${format.data.fullKey}:${format.data.storeId}:${format.data.tier}:${hwFingerprint}:${activatedAt}`;
     ```
   - Line 482 (in `verifyStationHardwareLock`):
     ```typescript
     const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
     ```
   - Line 562 (in `revokeLicense`):
     ```typescript
     const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
     ```
   In all three lines, `license.revoked` (and any revocation status) is completely omitted from `envelopePayload`.

2. **Empirical Confirmation of Flaw**:
   - In `tests/security/licensing_adversarial_challenge.test.ts` lines 501-526 (`challenge_6_adversarial_kill_switch_tampering_vulnerability`):
     ```typescript
     // 2. Station is revoked via Kill-Switch
     await service.revokeLicense('Revoked by Fleet Admin');

     // 3. ATTACK SCENARIO: Adversary edits stored JSON and flips revoked: false
     parsedRevoked.revoked = false;
     delete parsedRevoked.revokeReason;
     savedLicenseStr = JSON.stringify(parsedRevoked);

     // 4. Verify station status
     const statusAfterAttack = await service.verifyStationHardwareLock();
     const killSwitchVulnerabilityConfirmed = statusAfterAttack.status === 'ACTIVATED';
     assert.equal(killSwitchVulnerabilityConfirmed, true, ...);
     ```
     Running `npm run test:security` exits with code 0 because this test specifically asserted that `statusAfterAttack.status === 'ACTIVATED'` (confirming the bypass).

3. **Codebase-Wide Search for Envelope Signing & Verification**:
   - `grep_search` across `src/`, `electron/`, and `tests/` confirmed that `ACT:v1:` is strictly confined to `licensingService.ts` (lines 389, 482, 562) and test suite `licensing_adversarial_challenge.test.ts` (line 517).
   - Storage implementations (`ElectronIpcStorageProvider`, `LicenseVaultManager`) handle encrypted envelope transport transparently via `safeStorage` / AES-256-GCM without parsing internal HMAC digests.

---

## 2. Logic Chain

1. **Identity of HMAC Signatures Across States**:
   - Observation 1 demonstrates that in `activateStation` (`revoked: false`) and in `revokeLicense` (`revoked: true`), the computed `envelopePayload` string is identical:
     `ACT:v1:<key>:<storeId>:<tier>:<hwFingerprint>:<activatedAt>`
   - Therefore, the HMAC signature $S = \text{HMAC}(K_{secret}, \mathbf{Payload})$ generated during revocation is identical to the signature generated during activation.
2. **Subversion of Kill-Switch Enforcement**:
   - Observation 2 demonstrates that if an adversary modifies `"revoked": true` to `"revoked": false` in the stored license file:
     - `verifyStationHardwareLock()` reconstructs the payload from `key`, `storeId`, `tier`, `hardwareFingerprint`, and `activatedAt`.
     - The computed HMAC matches `license.signature`.
     - `if (license.revoked)` evaluates to `false`.
     - The station transitions to `status: 'ACTIVATED'`, nullifying the remote Kill-Switch without triggering `TAMPER_DETECTED`.
3. **Cryptographic Binding Resolution**:
   - If the canonical payload is expanded to 8 segments:
     `ACT:v1:<key>:<storeId>:<tier>:<hwFingerprint>:<activatedAt>:<status>`
     where `<status>` is `'ACTIVE'` when `license.revoked !== true` and `'REVOKED'` when `license.revoked === true`:
     - An active license is signed over `:ACTIVE` ($S_{act}$).
     - A revoked license is signed over `:REVOKED` ($S_{rev}$).
     - By the pseudorandom and collision-resistance properties of HMAC-SHA256, $S_{act} \neq S_{rev}$.
     - When an adversary alters `"revoked": false` on a revoked license, `verifyStationHardwareLock()` constructs the payload ending with `:ACTIVE`, yielding $S_{act}$.
     - Comparing $S_{act}$ with $S_{rev}$ fails constant-time equality check, immediately returning `status: 'TAMPER_DETECTED'`, `isActivated: false`.
4. **Architectural Parity & Maintainability**:
   - Centralizing envelope payload construction into a private helper method `computeEnvelopePayload(...)` prevents string formatting discrepancies between signing and verification sites.

---

## 3. Caveats

- **No Caveats**. The scope of the vulnerability is completely mapped, the cryptographic format is fully specified, all call sites are identified, and the fix requires zero schema changes to the external `ActiveLicenseRecord` TypeScript interface.

---

## 4. Conclusion

The Kill-Switch bypass vulnerability must be resolved by binding the revocation state into the HMAC envelope signature across all three occurrences in `src/services/security/licensingService.ts` using the canonical 8-segment format:
`ACT:v1:${key}:${storeId}:${tier}:${hardwareFingerprint}:${activatedAt}:${license.revoked === true ? 'REVOKED' : 'ACTIVE'}`

### Recommended Action Plan for Worker:
1. In `src/services/security/licensingService.ts`:
   - Add private helper `computeEnvelopePayload(key, storeId, tier, hwFingerprint, activatedAt, revoked): string`.
   - Update `activateStation` (line 389) to seal `false` (`:ACTIVE`).
   - Update `verifyStationHardwareLock` (line 482) to seal `Boolean(license.revoked)`.
   - Update `revokeLicense` (line 562) to seal `true` (`:REVOKED`).
   - Apply Gate 1 sanitization in `verifyKeySignature` (line 321) to reject empty string `expectedStoreId`.
2. In `tests/security/licensing_adversarial_challenge.test.ts`:
   - Update `challenge_6` lines 520-526 to assert `statusAfterAttack.status === 'TAMPER_DETECTED'`.
   - Add verification that un-tampered revoked envelope yields `HARDWARE_LOCKOUT` with `revoked: true`.

Full details, analysis, and drop-in code snippets are documented in:
`/Users/dawidapel/COL Tool/.agents/teamwork/m1_iter2_explorer_1/report.md`.

---

## 5. Verification Method

1. **Verify Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Pass Condition*: 52+ tests passing with exit code 0, and `challenge_6` confirming `status === 'TAMPER_DETECTED'` upon tampering.

2. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Pass Condition*: TypeScript compiler and Vite exit cleanly with code 0.
