## 2026-10-24T07:22:37Z
Sender: 53bb484f-c139-4c15-89f6-7d840b96f7e4
Priority: MESSAGE_PRIORITY_HIGH
Content:
You are M3 Explorer 2 (Sensitive Payload Classification & Vault Packaging — Feature F13).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_2
Project root: /Users/dawidapel/COL Tool

CRITICAL CONSTRAINTS:
- You are a READ-ONLY explorer. DO NOT edit source code or run destructive operations.
- Read ORIGINAL_REQUEST.md at: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
- Read PROJECT.md at: /Users/dawidapel/COL Tool/PROJECT.md

TASK DESCRIPTION:
Investigate all data schemas, SQLite tables, and cloud sync services (`src/services/syncEngine.ts`, `src/services/firebase.ts`, etc.) to design Feature F13 (Sensitive Payload Classification & Vault Packaging):
1. Catalog all 19 SQLite tables and domain state models. Classify every field into:
   - **TIER 1 (SENSITIVE - FINANCIAL / BUSINESS CONFIDENTIAL)**: Must be AES-256-GCM encrypted.
     - AOP annual/monthly targets, daily sales, projected vs actual revenue, COL ratios, bonus targets & payouts, hourly labor costs.
   - **TIER 2 (SENSITIVE - HR & GDPR ARTICLE 9)**: Must be AES-256-GCM encrypted.
     - Employee salaries, hourly rates, contractual hours, TOR overtime balances, L4 medical absence codes, sick leave health notes.
   - **TIER 3 (PUBLIC TELEMETRY / ROUTING METADATA)**: Stored plaintext in Firestore document headers for query routing and sync auditing.
     - `storeId`, `unitCode`, `vaultType`, `updatedAt`, `clientVersion`, `recordCount`, `checksum`.
2. Design Firestore Vault Document Schema:
   - `stores/{storeId}/vault_financials/{period}` (e.g. `month_2026_03`)
   - `stores/{storeId}/vault_personnel/{staffGroup}` (e.g. `active_roster`)
   - `stores/{storeId}/vault_schedules/{weekKey}` (e.g. `week_2026_W12`)
   - `stores/{storeId}/vault_health_gdpr/{period}`
   - `stores/{storeId}/telemetry/status` (plaintext status)
3. Design the packaging and unpackaging pipeline in `src/services/security/vaultService.ts` (or `syncEngine.ts`):
   - Given a local SQLite snapshot or domain entity, strip/encrypt sensitive fields into the `encryptedPayload` envelope and construct the safe Firestore document.
   - Given a decrypted envelope from the cloud, unpack and restore the local domain entity.
4. Provide a complete, copy-pasteable blueprint for `src/services/security/vaultService.ts`.

Write your report to:
`/Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_2/handoff.md`
When done, send a message to orchestrator with your findings summary.
