## 2026-10-24T07:22:37Z
You are M3 Explorer 1 (AES-256-GCM Engine & Key Management — Feature F12).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_1
Project root: /Users/dawidapel/COL Tool

CRITICAL CONSTRAINTS:
- You are a READ-ONLY explorer. DO NOT edit source code or run destructive operations.
- Read ORIGINAL_REQUEST.md at: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
- Read PROJECT.md at: /Users/dawidapel/COL Tool/PROJECT.md

TASK DESCRIPTION:
Investigate and design the Client-Side AES-256-GCM Encryption Engine (`src/services/security/encryptionService.ts`) and Electron main-process key storage integration for Feature F12:
1. Examine existing cryptographic utilities in `src/` and `electron/` (if any), and determine the optimal architecture supporting BOTH Electron desktop execution (using `safeStorage` or OS keychain when available) and headless Node.js test runners (using Node's `crypto` module).
2. Key Derivation Specification:
   - SEK (Store Encryption Key): 256-bit key derived via PBKDF2-HMAC-SHA256 with 600,000 iterations.
   - Salt formula: `SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)`.
   - Master passphrase / master key mechanism with Electron `safeStorage` persistence and fallback.
3. AEAD Specification:
   - Cipher: `aes-256-gcm`.
   - IV: 96-bit (12 bytes) cryptographically secure random bytes generated per encryption operation (`crypto.randomBytes(12)`).
   - Auth Tag: 128-bit (16 bytes) GCM authentication tag.
   - AAD (Additional Authenticated Data) context binding: `${storeId}:${vaultType}:${docId}` to cryptographically prevent document swapping across stores or collections.
4. Envelope Format:
   - Canonical string format: `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>`
   - Object representation:
     ```ts
     export interface EncryptedEnvelope {
       version: 'v1';
       storeId: string;
       keyId: string;
       iv: string; // base64
       tag: string; // base64
       ciphertext: string; // base64
       aadContext?: string;
     }
     ```
5. Interface Signatures:
   - `deriveStoreKey(storeId: string, unitCode: string, passphrase?: string): Promise<Buffer>`
   - `encryptPayload<T>(payload: T, storeId: string, vaultType: string, docId: string): Promise<EncryptedEnvelope>`
   - `decryptPayload<T>(envelope: EncryptedEnvelope | string, storeId: string, vaultType: string, docId: string): Promise<T>`
   - `serializeEnvelope(envelope: EncryptedEnvelope): string`
   - `parseEnvelope(encoded: string): EncryptedEnvelope`
6. Provide a complete, copy-pasteable blueprint for `src/services/security/encryptionService.ts`.

Write your report to:
`/Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_1/handoff.md`
When done, send a message to orchestrator with your findings summary.
