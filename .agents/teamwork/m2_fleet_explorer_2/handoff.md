# Handoff Report: Fleet Master Control Center Implementation Strategy (`FleetMasterDashboard.tsx`)

**Investigator**: M2 Explorer 2 (`m2_fleet_explorer_2`)  
**Parent Agent**: `bc820f6a-3865-4f82-8517-3240379a0b72`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_2`  
**Date**: 2026-10-26T20:05:00Z  
**Type**: Hard Handoff  

---

## 1. Observation

1. **`STARBUCKS_STORES_CATALOG` (`src/constants/starbucksStores.ts:30–1527`)**:
   - Contains a static array of 104 Starbucks retail stores in Poland across 5 regions (Warszawa, Centralny, Zachodni, Południowy, Północny).
   - Each store has the structure:
     ```typescript
     export interface StarbucksStore {
       id: string;              // MPK lub unikalny kod (np. '108120')
       name: string;            // Pełna oficjalna nazwa lokalu
       shortName: string;       // Krótka nazwa wyświetlana w nagłówku i badge'ach
       unitCode: string;        // Kod jednostki operacyjnej (Unit Code)
       mpk: string;             // Kod MPK do rozliczeń i ewidencji
       city: string;            // Miasto
       district: string;        // Dystrykt operacyjny Starbucks
       address: string;         // Adres lokalu
       type: 'Mall' | 'Street' | 'Drive-Thru' | 'Office' | 'Travel';
       isCustom?: boolean;
     }
     ```
   - Includes helper function `normalizeDiacritics(str: string)` (lines 21–28) removing Polish diacritical characters for search.

2. **Licensing Engine (`src/services/security/licensingService.ts:229–255`)**:
   - Implements `generateActivationKey(storeId: string, tier: LicenseTier = 'STORE_CLIENT', customSecret?: string): string`.
   - Generates canonical format: `SBX-<storeId>-<randomHex>-<checksum>`.
   - Byte 0 of `randomHex` encodes tier: `'01'` for `STORE_CLIENT`, `'FF'` for `FLEET_MASTER`.
   - Checksum is 10 hex characters derived from HMAC-SHA256 of `SBX:<tier>:<storeId>:<randomHex>`.
   - Implements `validateKeyFormat(key)`, `verifyKeySignature(key)`, and `revokeLicense(reason)`.

3. **Current Admin Console (`src/components/admin/AdminConsoleModal.tsx:1–100`)**:
   - Only manages local store users, pending access requests, and basic local audit logs.
   - Does not provide macro overview across 100+ stores, fleet licensing, remote kill-switch, or fleet release management.

4. **Telemetry Service (`src/services/firebaseTelemetryService.ts:4–19`)**:
   - Defines `FirebaseInstallationRecord` with `installId`, `appVersion`, `lastSeenAt`, `unitCode`, `storeName`, `status`.
   - Stores local cache and provides REST API sync to Firestore.

5. **Package Dependencies (`package.json:39–67`)**:
   - Uses `lucide-react` (`^1.45.0`), `react` (`^19.3.0`), `tailwind-merge`, and `@tailwindcss/vite` (`^4.3.3`).
   - Does NOT include any external QR code package (e.g. `qrcode` or `qrcode.react`). Any QR code component must be zero-dependency or use an inline SVG matrix to avoid breaking `npm run build`.

---

## 2. Logic Chain

1. **Macro Store Overview (Observation 1)**:
   - With 104 stores in `STARBUCKS_STORES_CATALOG`, the application has an authoritative store catalog.
   - By creating `FleetService.getFleetStores()`, each catalog store is dynamically enriched with licensing records and telemetry heartbeats.
   - Using `normalizeDiacritics` allows instant, fault-tolerant search matching names, unit codes (e.g. "18120"), MPKs ("108120"), cities ("krakow" -> "Kraków"), and districts.
   - For 104 records, React client-side filtering runs in <5ms, rendering a high-density, sortable table or grid.

2. **License Key Provisioning (Observation 2 & 5)**:
   - The provisioning modal directly invokes `LicensingService.generateActivationKey(storeId, tier)`.
   - Because `package.json` lacks a third-party QR code library, implementing a zero-dependency SVG QR matrix (`QrCodeSvg.tsx`) avoids package installation issues and guarantees that `npm run build` succeeds cleanly.
   - Pairing the generated key with a 1-click clipboard button and formatted email/Teams dispatch template streamlines Store Manager onboarding.

3. **Remote Kill-Switch & Station Management (Observation 2 & 4)**:
   - To guard against stolen hardware or rogue access, the Fleet Master sets `isRevoked: true` on the target store.
   - Accidental clicks are prevented through a 2-step verification challenge requiring explicit input of `REVOKE <storeId>`.
   - On the store client station, the next heartbeat or launch detects revocation, immediately triggers `licensingService.revokeLicense()`, clears all in-memory keys (`StoreKeyCache.clear()`), and displays the blocking lockout screen.

4. **Security Audit Trail & Release Management (Observation 3 & 4)**:
   - Recording all key generations, activations, revocations, and hardware mismatches into `FleetAuditRecord` provides an enterprise-grade audit trail.
   - Adding RFC 4180 CSV export with UTF-8 BOM ensures compliance reporting in Polish Excel without character encoding issues.
   - Tracking station versions against `APP_VERSION` (`2.8.70`) enables visualizing fleet version distribution and triggering push notifications for outdated stations.

---

## 3. Caveats

1. **Cloud Sync Mode**: When the application runs strictly offline (no internet access in retail backroom), Firestore telemetry relies on the local cache until network connectivity is restored.
2. **Third-Party Dependencies**: No external QR library was assumed; a self-contained SVG QR matrix component was designed to preserve zero-dependency build safety.
3. **Store Context Switching**: When District Managers switch stores from the Fleet Master view, `StoreContext.switchStore()` must cleanly reset active caches in Modules 1–4 to prevent cross-store data leakage.

---

## 4. Conclusion

The implementation strategy for `src/components/admin/FleetMasterDashboard.tsx` is completely specified and ready for implementation.
The design comprises:
- `src/types/fleet.ts`: Canonical type system for store telemetry, licensing, audit logs, and filters.
- `src/services/admin/fleetService.ts`: Central business service managing 100+ stores catalog merging, health state derivation, license provisioning, kill-switch challenge validation, and audit export.
- `src/components/admin/FleetMasterDashboard.tsx`: Tabbed master dashboard with executive KPI summary bar.
- Modular subcomponents:
  * `FleetStoreCatalogTable.tsx` & `FleetStoreFilterBar.tsx` (100+ store macro overview).
  * `LicenseGeneratorModal.tsx` & `QrCodeSvg.tsx` (cryptographic provisioning, QR code, one-click dispatch formatting).
  * `KillSwitchModal.tsx` (2-step challenge verification modal).
  * `FleetSecurityAuditTable.tsx` (security event log with CSV/JSON exports).
  * `FleetReleaseManagementPanel.tsx` (version telemetry and OTA patch status).
- Automated test suite: `tests/security/fleet_service.test.ts`.

---

## 5. Verification Method

1. **Inspect Report & Artifacts**:
   - Verify `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_2/report.md` contains the complete specification and code blueprints.
   - Verify zero modifications were made to repository source code (`git status` clean).
2. **Key Generation Verification**:
   - Run `LicensingService.generateActivationKey('108120', 'STORE_CLIENT')` and verify format matches `/^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/`.
3. **Build Integrity Pre-flight**:
   - `npm run build` (`tsc && vite build`).
