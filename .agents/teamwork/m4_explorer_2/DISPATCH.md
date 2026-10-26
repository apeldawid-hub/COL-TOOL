## 2026-10-24T08:36:44Z
From: 53bb484f-c139-4c15-89f6-7d840b96f7e4 (orchestrator_1)
Mission:
Investigate and design a production-grade implementation blueprint for Feature F17: Bi-Directional Cryptographic Parity Verification (`src/services/security/parityVerificationService.ts`):
1. Review existing cryptographic primitives:
   - `canonicalJson` and `canonicalSha256` in `src/services/security/vaultService.ts` and `encryptionService.ts`
   - `unpackageGenericVault` in `src/services/security/vaultService.ts`
2. Design the Parity Verification Engine:
   - Deep structural & cryptographic verification: compares all local SQLite records from `store_${safeId}.db` with decrypted cloud records retrieved from Firestore vaults.
   - Canonical SHA-256 digest calculation: computes canonical JSON hash per record and composite Merkle tree / table digest per table.
   - Row-for-row and field-for-field parity verification across all 19 tables.
   - Detects and reports:
     * Row count discrepancies (extra local records or extra cloud records)
     * Field-level value tampering / bit corruption
     * Missing tables or schema discrepancies
   - Certified Parity Report / Signed Certificate generation:
     `ParityVerificationReport` containing `storeId`, `unitCode`, `timestamp`, `isParityVerified: boolean`, `localTableDigests`, `cloudTableDigests`, `mismatches: ParityMismatch[]`, and `certificate: { signature, certifiedAt, verifiedTablesCount, verifiedRecordsCount }`.
3. Provide complete, drop-in TypeScript class and interface designs.

You are READ-ONLY. DO NOT edit source code files. Write your complete, detailed analysis and blueprints to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_2/handoff.md`. Send a message to orchestrator when complete.
