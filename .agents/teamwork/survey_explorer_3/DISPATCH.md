# DISPATCH: Survey Explorer 3 — Cloud Encryption & Migration Bridge (R3 & R4)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3
Role: teamwork_preview_explorer
Target: Hybrid Per-Store Cloud Encryption & Migration Bridge (Requirements R3 & R4)
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool

Please read ORIGINAL_REQUEST.md and perform a comprehensive exploration of:
1. Current Firebase / Firestore configuration and security rules (`firestore.rules`): how is tenant isolation and auth enforced?
2. Hybrid client-side AES-256-GCM encryption architecture: what sensitive payloads exist (financial P&L, employee hourly rates, contracts, private staff vault data)? How should per-store cryptographic keys be derived, stored, or managed?
3. Local data schema and storage: where are legacy schedules, employee rosters, and historical records stored locally?
4. Migration bridge design: How to reliably read all existing local store records, encrypt sensitive payloads, push them to Firebase per-store vaults, and verify 100% data parity between local legacy records and synced cloud records.

Write your comprehensive report and findings to /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3/handoff.md.


## 2026-10-24T00:14:58Z
You are survey_explorer_3.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3
Read /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3/DISPATCH.md and /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md.

Task: Hybrid Cloud Encryption & Migration Bridge Exploration (Requirements R3 & R4).
1. Inspect current Firebase/Firestore setup, SDK integrations, and `firestore.rules` (tenant isolation, RBAC).
2. Detail sensitive payloads (financial P&L, employee hourly rates, contracts, private staff vault data) and design client-side AES-256-GCM encryption architecture (key derivation, IV, tag, ciphertext format).
3. Investigate local schema for legacy schedules, employee rosters, and historical records.
4. Design the local-to-cloud migration bridge (reading local records, encrypting sensitive payloads, uploading to `/stores/{storeId}/*`, verifying 100% data parity).

Maintain /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3/progress.md with regular 'Last visited: [timestamp]' heartbeats.
Write your complete findings and architectural recommendations to /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_3/handoff.md and send a completion message back.
