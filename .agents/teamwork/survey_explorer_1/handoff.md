# Handoff Report: Deep Codebase Audit & Data Hygiene Exploration (Requirement R1)

**Agent ID**: `survey_explorer_1`  
**Role**: `teamwork_preview_explorer`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1`  
**Date**: 2026-10-24  
**Target Milestone**: Survey & Audit Phase — Requirement R1  

---

## 1. Observation

A full automated and semantic scan of the codebase (`src/`, `electron/`, and `firebase/`) was conducted. Below are the verbatim observations, grouped into the three requirement dimensions.

### 1.1 Enumeration of Hardcoded Store Codes (`18120`, `108120`, `384`, `Janki`)

| File Path | Line(s) | Verbatim Code / Snippet | Issue Type |
| :--- | :--- | :--- | :--- |
| `src/constants/starbucksStores.ts` | 16 | `export const DEFAULT_STORE_ID = '108120';` | Global default store fallback |
| `src/constants/starbucksStores.ts` | 20–30 | Hardcoded item in catalog: `id: '108120'`, `name: '108120 SBX Warszawa Janki'`, `unitCode: '18120'`, `mpk: '108120'` | Static store catalog entry |
| `src/services/storeService.ts` | 70–74 | Fallback object construction: `name: savedName \|\| '108120 SBX Warszawa Janki'`, `unitCode: savedUnitCode \|\| '18120'`, `mpk: savedMpk \|\| '108120'` | Incomplete profile fallback |
| `src/services/storeService.ts` | 87 | `STARBUCKS_STORES_CATALOG.find((s) => s.id === DEFAULT_STORE_ID) \|\| STARBUCKS_STORES_CATALOG[0]` | Hardcoded fallback store |
| `electron/database/db.ts` | 79 | `private currentStoreId: string = '108120_janki';` | DatabaseManager default store ID |
| `electron/database/db.ts` | 130–131 | `store_name: currentSettings['store_name'] \|\| '108120 SBX Warszawa Janki'`, `unit_code: currentSettings['unit_code'] \|\| '18120'` | Startup settings fallback |
| `electron/database/db.ts` | 179–182 | `const isJanki = storeId === '108120_janki' \|\| storeInfo?.mpk === '108120' \|\| storeInfo?.unitCode === '18120'; if (isJanki) return path.join(this.storageDir, 'tplh_forecast.db');` | Asymmetric DB file routing |
| `electron/database/db.ts` | 1072–1073 | `INSERT OR IGNORE INTO stores (store_code, store_name, weekly_floor_hours) VALUES ('18120', '108120 SBX Warszawa Janki', 272.0);` | Hardcoded store table seed |
| `electron/database/db.ts` | 1459–1460 | `String(a.unit_code \|\| '18120')`, `a.unit_name \|\| '108120 SBX Warszawa Janki'` | Actuals log importer seed |
| `electron/database/db.ts` | 1807–1808 | In `exportHistoricalDataPackage`: `storeCode: '18120'`, `storeName: '108120 SBX Warszawa Janki'` | Hardcoded backup manifest |
| `electron/main.ts` | 530 | `WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')` | Hardcoded SQL query filter |
| `electron/main.ts` | 602 | In `db:get-daily-actual-hours-for-month`: identical hardcoded SQL filter | Hardcoded SQL query filter |
| `electron/main.ts` | 799 | `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18120' OR store_code = '384'` | Hardcoded SQL update filter |
| `electron/main.ts` | 860 | In `db:get-day-of-week-stats`: identical hardcoded SQL filter | Hardcoded SQL query filter |
| `electron/importer/mapalParser.ts` | 169–173 | `const isJanki = unitName.includes('108120') \|\| unitName.includes('Janki') \|\| unitName.includes('18120') \|\| unitCode.includes('18120') \|\| unitCode.includes('384');` | Hardcoded parser heuristic |
| `electron/importer/mapalParser.ts` | 254–255 | `unit_code: unitCode \|\| '18120'`, `unit_name: unitName \|\| '108120 SBX Warszawa Janki'` | Default row assignment |
| `electron/importer/mapalParser.ts` | 263 | Error message: `'W wybranym raporcie nie znaleziono żadnych wpisów dla kawiarni 108120 SBX Warszawa Janki (kod: 18120).'` | Hardcoded UI error message |
| `electron/importer/mapalParser.ts` | 276, 292 | `WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%')` | Hardcoded SQL delete/clean |
| `electron/importer/mapalParser.ts` | 301 | `WHERE unit_code != '18120' AND unit_code != '384' AND date >= ? AND date <= ?` | Hardcoded SQL support filter |
| `electron/importer/universalReportParser.ts` | 563–567 | Identical `isJanki` hardcoded matching | Hardcoded parser heuristic |
| `electron/importer/universalReportParser.ts` | 648–649 | `unit_code: unitCode \|\| '18120'`, `unit_name: unitName \|\| '108120 SBX Warszawa Janki'` | Fallback values |
| `electron/importer/universalReportParser.ts` | 662–664 | Error messages referencing `lokalu Janki (18120)` | Hardcoded error message |
| `electron/importer/universalReportParser.ts` | 876, 883 | Identical hardcoded SQL filters with `18120` and `384` | Hardcoded SQL query filter |
| `electron/importer/universalReportParser.ts` | 1312 | `let detectedStoreName = '108120 SBX Warszawa Janki';` | Fallback detected store name |
| `src/App.tsx` | 817 | `<AdminConsoleModal ... storeUnitCode={currentStore?.unitCode \|\| '18120'} />` | Component prop fallback |
| `src/components/DashboardView.tsx` | 59–61 | Static JSX: `108120 SBX Warszawa Janki`, `Kod jednostki: 18120` | Bypassed StoreContext |
| `src/components/DashboardView.tsx` | 255 | `Podsumowanie Operacyjne Kawiarni 108120 Janki` | Hardcoded view header |
| `src/components/DashboardView.tsx` | 278 | `alerty operacyjne kawiarni Janki.` | Hardcoded card copy |
| `src/components/UnifiedSettingsModal.tsx` | 514 | Badge: `108120 Janki (18120)` | Hardcoded modal badge |
| `src/components/UnifiedSettingsModal.tsx` | 774 | Sidebar footer: `108120 Warszawa Janki` | Hardcoded sidebar label |
| `src/components/UnifiedSettingsModal.tsx` | 1047 | `Kawiarnia 108120 Janki posiada nienaruszalną bazę Floor: 32.0h na dobę...` | Hardcoded policy text |
| `src/components/UnifiedSettingsModal.tsx` | 1706 | Badge: `Pilotaż Janki` | Hardcoded testing badge |
| `src/components/UnifiedSettingsModal.tsx` | 2116, 2119 | `localStorage.getItem('sbx_store_name') \|\| '108120 SBX Warszawa Janki'`, `\|\| '18120'` | Static localStorage fallbacks |
| `src/modules/labor-forecast/components/SettingsModal.tsx` | 232 | Badge: `108120 Janki (18120)` | Hardcoded modal badge |
| `src/modules/labor-forecast/components/AopManagerModal.tsx` | 156 | Badge: `Lokal 18120` | Hardcoded modal badge |
| `src/modules/labor-forecast/components/FloorHoursModal.tsx` | 115 | Badge: `Lokal 18120` | Hardcoded modal badge |
| `src/modules/labor-forecast/components/ManagerLaborBridgeModal.tsx` | 516 | Text: `Godziny dyżurów kierowniczych w lokalu Janki (18120) pokrywają część zapotrzebowania tygodniowego.` | Static explanation copy |
| `src/modules/labor-forecast/components/ImportModal.tsx` | 259 | `const isJanki = r.unit_code === '18120' \|\| (r.unit_name && r.unit_name.includes('Janki'));` | Hardcoded filter check |
| `src/modules/labor-forecast/components/ImportModal.tsx` | 729 | `${dailyKpiData?.storeName \|\| '108120 Janki'}` | Fallback store name |
| `src/modules/labor-forecast/components/ImportModal.tsx` | 821 | `...dla lokalu 108120 Janki.` | Hardcoded banner text |
| `src/modules/labor-forecast/components/ImportModal.tsx` | 1129 | Option dropdown: `<option value="JANKI_ONLY">💚 Tylko 108120 Janki</option>` | Hardcoded UI dropdown |
| `src/modules/labor-forecast/components/ImportModal.tsx` | 1353–1354 | Badge: `{rec.unit_code === '18120' \|\| ... ? <span>108120 Janki</span> : ...}` | Hardcoded badge conditional |
| `src/modules/managers-schedule/components/AutoScheduleModal.tsx` | 259 | `Starbucks 108120 Janki • {data.monthName} {data.year}` | Hardcoded modal subtitle |
| `src/modules/managers-schedule/components/ManagerScheduleGrid.tsx` | 957–960 | `if (empRcp.unitCode && empRcp.unitCode !== '384' && empRcp.unitCode !== '18120') ... else cellTitle += '\n\n📍 Zalogowano w MAPAL: ' + empRcp.hours + 'h (108120 Janki)';` | Hardcoded tooltip logic |
| `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx` | 118 | `{c.unitName} ({c.unitCode \|\| '384'})` | Hardcoded unitCode fallback |
| `src/modules/managers-schedule/services/managerExcelExport.ts` | 24 | Header row: `Kawiarnia: 108120 SBX Warszawa Janki (Unit: 384)` | Hardcoded Excel export |
| `src/modules/managers-schedule/services/managerExcelExport.ts` | 121 | Header row: `Kawiarnia 108120 SBX Warszawa Janki (Unit 18120)` | Hardcoded Excel export |
| `src/modules/col-calculator/components/ColCalculatorView.tsx` | 60–61 | `storeCode: '18120', storeName: 'SBX Warszawa Janki'` | State default |
| `src/modules/col-calculator/components/ColCalculatorView.tsx` | 107–108 | In `loadBridgeData`: `storeCode: '18120', storeName: 'SBX Warszawa Janki'` | Overwrites store on reload |
| `src/modules/col-calculator/components/ColCalculatorView.tsx` | 430 | `COL Calculator — Starbucks 18120 Janki` | Hardcoded view title |
| `src/modules/col-calculator/services/colDefaultData.ts` | 11–12 | `storeCode: '108120', storeName: 'SBX Warszawa Janki'` | Default store object |
| `src/modules/col-calculator/components/ColUserGuideSheet.tsx` | 43 | `(108120 Janki)` | User guide example |
| `src/components/OnboardingWizardView.tsx` | 137–138 | `name: currentStore.name \|\| '108120 SBX Warszawa Janki'`, `unitCode: currentStore.unitCode \|\| '18120'` | Step 2 pre-fill fallback |
| `src/components/AppUpdateModal.tsx` | 271 | `Starbucks Operations Suite • 108120 Janki` | Hardcoded header subtitle |
| `src/components/NotificationsSettingsTab.tsx` | 273–274, 359–360 | `localStorage.getItem('sbx_store_name') \|\| '108120 SBX Warszawa Janki'`, `\|\| '18120'` | Notification test fallbacks |
| `src/services/admin/adminService.ts` | 87, 100, 113, 132 | `storeUnitCode: '18120'` across mock users and access requests | Hardcoded store binding |
| `src/services/auth/authService.ts` | 100, 155 | Method signatures: `quickLoginStoreManager(storeUnitCode: string = '18120')`, `request2FaOtp(..., storeUnitCode = '18120')` | Parameter defaults |
| `src/services/desktopNotificationService.ts` | 250 | `body: 'Natywne powiadomienia desktopowe działają prawidłowo dla lokalu 108120 Janki!'` | Hardcoded test notification |
| `src/services/firebaseTelemetryService.ts` | 118–119, 195–196, 310 | Hardcoded store name `'108120 SBX Warszawa Janki'` and `'18120'` | Telemetry defaults |
| `src/services/cloudNotificationService.ts` | 381, 577, 622, 648, 676, 697–698 | Email footers, subjects, and data fields hardcoded with `108120 Janki` / `18120` | Cloud email templates |
| `src/components/admin/AdminConsoleModal.tsx` | 44 | Default prop: `storeUnitCode = '18120'` | Prop default |

---

### 1.2 Enumeration of Mock Employee Records, Dummy Sales & AI Filler Texts

#### A. Mock Employee Records
1. **`electron/database/db.ts` (lines 1151–1159)**:
   - Method `seedDemoManagerTeamAndShifts()` hardcodes 7 managers:
     - Dawid Szeluga (SM, FULL, rate 42.0)
     - Dawid Apel (ASM, FULL, rate 36.0)
     - Kamil Kamiński (SSV, FULL, rate 32.5)
     - Zuzanna Makowska (SSV, 0.75, rate 32.5)
     - Weronika Bieńkowska (SSV, 0.5, rate 32.5)
     - Gabi Znojek (SSV, FULL, rate 32.5)
     - Aleksandra Płużyńska (SSV, FULL, rate 32.5)
   - Lines 1190–1198 seed a complete mock schedule of shifts for all 30 days of September 2026.
2. **`electron/database/db.ts` (lines 1283–1335)**:
   - Method `seedMonthlyRosters()` hardcodes rosters for July (8 managers), August (8 managers), and September 2026 (7 managers), inserting Hanna Domachowska (SSV, 0.5).
3. **`electron/database/db.ts` (lines 1498–1521)**:
   - Method `getTrainingPartners()` automatically injects two mock baristas into SQLite whenever the table is empty:
     - Kacper Wiśniewski (hire_date: '2026-09-01', program: 'first_30', trainer: 'Weronika Łukasiak', SM: 'Dawid Apel')
     - Maja Zielińska (hire_date: '2026-06-15', program: 'barista_90', trainer: 'Gabriela Szymańska', SM: 'Dawid Apel')
4. **`src/services/admin/adminService.ts` (lines 84–160)**:
   - Method `initDefaults()` injects 3 mock managed users into `localStorage` (`sbx_admin_managed_users`): Dawid Apel, Kamil Kamiński, Zuzanna Makowska with fake device names and session versions.
   - Lines 129–144 inject a mock pending access request for `Piotr Wiśniewski` with IP `192.168.1.112 (CH Janki Wi-Fi)`.
   - Lines 148–160 inject a mock security audit log (`LOGIN_2FA` by Dawid Apel from IP `192.168.1.10`).
5. **`src/services/auth/authService.ts` (lines 100–118)**:
   - `quickLoginStoreManager()` automatically creates an active session for `usr_sm_dawid_apel` (`Dawid Apel`, `dawid.apel@amrest.eu`).
6. **`src/modules/col-calculator/services/colDefaultData.ts`**:
   - Lines 37–139: `DEFAULT_COL_MANAGERS` containing 6 named managers with base salaries (7,200 PLN, 6,300 PLN, 3,510 PLN, etc.) and special payroll rows (`mgr-maternity`, `mgr-bench`, `mgr-dm`, `mgr-dos`, `mgr-holiday-accrual`).
   - Lines 233–264: `DEFAULT_COL_CREW_UOP` containing 2 baristas (Hanna Domachowska, Gabriela Znojek) with hourly rates (31.40 PLN, 30.75 PLN).
   - Lines 266–287: `DEFAULT_COL_CREW_UZ` containing 20 baristas (Wiktoria Lenart, Wiktoria Walczak, Marysia Szulczyk, Zuzanna Dworak, etc.) with hourly rates (30.40–31.40 PLN) and mock hours.
7. **`src/services/firebaseTelemetryService.ts` (lines 110–155)**:
   - `getDefaultLocalData()` returns fake installations: `SBX-MAC-JANKI-01` (Dawid Apel), `SBX-MAC-ARKADIA-02`, etc.

#### B. Fake Sales & Financial Metrics
1. **`src/App.tsx` (lines 302–384)**:
   - Browser fallback contains hardcoded `mockPlan`: `plan_trx: 10830`, `target_tplh: 6.70`, `labor_budget: 1616.4`, `mockWeeks` with dates 01.09–30.09 and floor hours 272.0/80.0, `actualHoursMap` (333.9h, 43.4h), and `weeklyTrxMap` (2050).
2. **`src/modules/labor-forecast/components/AopManagerModal.tsx` (lines 57–68)**:
   - Fallback `mock` plan generating 12 months with static `plan_trx: 10800`, `target_tplh: 6.70`, `labor_budget: 1611.9`.
3. **`src/modules/col-calculator/services/colDefaultData.ts` (lines 19–35 & 289–300)**:
   - `DEFAULT_COL_KPIS`: `salesTarget: 310000`, `salesEst: 280000`, `trxTarget: 10900`, `trxEst: 9700`, `tplhTarget: 6.6`.
   - `DEFAULT_COL_OTHER_COSTS`: Medical examination 150 PLN, ADP 600 PLN, PPK 250 PLN, Drivers 220 PLN.
4. **`src/components/OnboardingWizardView.tsx` (lines 84–97)**:
   - `INITIAL_AOP_TEMPLATE`: 12 pre-baked months for 2026 with hardcoded sales (645k, 580k, 670k, 665k, 750k, 710k, 760k, 730k, 705k, 720k, 690k, 830k), labor budgets, and COL costs.

#### C. AI Filler Texts & UI Placeholders
1. **`src/components/DashboardView.tsx` (lines 255–279)**:
   - Section header: `Podsumowanie Operacyjne Kawiarni 108120 Janki`
   - Subtitle: `Główny ekran podsumowania przygotowany na integrację widżetów operacyjnych Store Managera`
   - Card title: `Przestrzeń Pulpitu Podsumowania`
   - Filler description: `Tutaj pojawią się skrócone widżety dobowe: status realizacji TPLH za dzisiaj, najbliższe dyżury kierowników oraz kluczowe alerty operacyjne kawiarni Janki.`
2. **`src/components/ModulePlaceholderView.tsx` (lines 20–76)**:
   - `col_calculator`: `...symulacje rentowności grafiku w czasie rzeczywistym dla kawiarni 108120 Janki.`
   - `trainings`: `Matryca kompetencji i certyfikacji partnerów kawiarni Janki`
   - `analytics`: `Moduł 4: Zaawansowane Raportowanie Rentowności i Wskaźników`
   - `ibs_ims`: `Moduł 6: Struktura Kadrowa (Ideal Barista & Manager Structure)`
3. **`src/components/UnifiedSettingsModal.tsx`**:
   - Line 1706: Static badge `Pilotaż Janki`.
   - Lines 2059 & 2072: Dev comments/labels `Przykładowy kafelek AOP`, `Przykładowa zmiana grafiku`.
4. **`src/components/DatabaseBackupModal.tsx` (lines 165, 213, 264)**:
   - UI status strings: `'Tryb demonstracyjny przeglądarki: utworzono kopię wirtualną.'`, `'Wgrano dane demonstracyjne.'`, `'Tryb demonstracyjny: zasymulowano przywrócenie pliku...'`.

---

### 1.3 Store Initialization & App Startup Flow

Inspecting `electron/database/db.ts`, `electron/main.ts`, `src/App.tsx`, and `src/context/StoreContext.tsx` reveals the exact startup sequence:

```
App Launch (Electron)
   │
   ▼
DatabaseManager.getInstance()
   │
   ├─ Checks active_store.json (missing on fresh launch)
   ├─ Defaults currentStoreId = '108120_janki'
   └─ Computes dbFilePath -> 'data/tplh_forecast.db'
   │
   ▼
DatabaseManager.init()
   │
   ├─ File does NOT exist -> Creates in-memory DB -> calls seedInitialData()
   │    ├─ Inserts stores: ('18120', '108120 SBX Warszawa Janki', 272.0)
   │    ├─ Seeds aop_plans from aop_plan_master_seed.json (2021-2036)
   │    ├─ Seeds labor_actuals_log from labor_actuals_2026_seed.json
   │    └─ Calls seedManagerModuleData() -> seedMonthlyRosters() (7-8 managers)
   │
   ├─ Calls hasExistingData()
   │    └─ SELECT COUNT(*) FROM aop_plans -> Count > 0! Returns TRUE!
   │
   └─ Because hasExistingData() === true:
        └─ Automatically sets:
             sbx_onboarding_completed: 'true'
             onboarding_completed: 'true'
             store_name: '108120 SBX Warszawa Janki'
             unit_code: '18120'
   │
   ▼
Frontend Mounts (App.tsx & StoreContext.tsx)
   │
   ├─ StoreContext calls StoreService.initStore()
   │    └─ StoreService.getCurrentStore() returns catalog store '108120'
   │
   └─ App.tsx checkOnboardingState() invokes api.getAppSettings()
        ├─ Backend returns { hasCompletedOnboarding: true, hasExistingData: true }
        └─ App.tsx immediately sets setHasCompletedOnboarding(true)!
   │
   ▼
Result: OnboardingWizardView is completely skipped. User lands on Dashboard for 108120 Janki.
```

---

## 2. Logic Chain

1. **Premise 1**: The application aims to support 100+ autonomous Starbucks stores without assuming or defaulting to any specific store (Requirement R1, R2).
2. **Premise 2**: In `electron/database/db.ts` (line 79, lines 112–142, lines 179–185), on a fresh startup without `active_store.json`, `DatabaseManager` defaults the store to `'108120_janki'` and auto-seeds the legacy `tplh_forecast.db` with Janki's historical AOP plans, manager rosters, and actual hours.
3. **Premise 3**: In `electron/database/db.ts` (lines 124–135) and `electron/main.ts` (lines 170–185), `hasExistingData()` checks if `aop_plans` has rows. Because the database was pre-seeded in Premise 2, `hasExistingData()` always evaluates to `true`.
4. **Premise 4**: When `hasExistingData()` evaluates to `true`, SQLite automatically writes `sbx_onboarding_completed = 'true'`, and the backend IPC handler reports that onboarding is already complete.
5. **Premise 5**: In `src/App.tsx` (lines 78–99), the frontend trusts `hasCompletedOnboarding: true` and `hasExistingData: true`, directly transitioning to `hasCompletedOnboarding = true`.
6. **Inference 1**: Therefore, on any clean installation with an empty profile, the onboarding flow is systematically bypassed, locking the application into store `108120 SBX Warszawa Janki`.
7. **Inference 2**: In addition, over 30 UI components and Electron IPC handlers bypass the active store context by hardcoding string literals `'18120'`, `'108120'`, and `'384'` directly into their views, tooltips, error messages, and SQL queries (e.g. `electron/main.ts:530` and `mapalParser.ts:276`).
8. **Inference 3**: In `electron/main.ts` and `mapalParser.ts`, SQL queries contain `WHERE (unit_code = '18120' OR unit_code = '384' ...)`. If a user selects another store (e.g. `108004 Nowy Świat`, unit `323`), the database queries will completely ignore actual hours and shifts for that store, returning 0 hours or deleting foreign store hours inappropriately.
9. **Inference 4**: The presence of mock managers (Dawid Szeluga, Dawid Apel, Kamil Kamiński, etc.) and mock financial metrics across `colDefaultData.ts`, `db.ts`, and `adminService.ts` pollutes fresh store instances with fake staff and payroll numbers.

---

## 3. Caveats

- **`tplh_forecast.db` backward compatibility**: The existing `tplh_forecast.db` file in `data/` contains real historical records for store 108120 Janki. Purging hardcoded defaults must preserve the ability of existing Janki installations to access their legacy database or migrate it to `store_108120.db` without data loss.
- **Seeds directory (`desktop_app_blueprint/data_schemas_and_seeds/`)**: The JSON seed files contains historical data for Janki. These seed files should remain as optional demonstration/reference seeds or import templates, but MUST NOT be automatically loaded into every newly initialized store database.
- **Changelog and documentation**: Historical release notes in `src/constants/changelog.ts` and `VERSION_HISTORY.md` mention past updates for Janki (e.g. "Pilotaż Janki"). These are historical audit logs and do not impact runtime application logic, but UI headers displaying "Pilotaż Janki" or "108120 Janki" must be bound dynamically to `currentStore`.

---

## 4. Conclusion & Architectural Recommendations

### 4.1 Summary Assessment
The codebase contains deep, pervasive coupling to store `108120 SBX Warszawa Janki` across three layers:
1. **Database Layer**: `DatabaseManager` auto-seeds Janki data on clean launch, artificially setting `sbx_onboarding_completed = true` and suppressing onboarding. SQL queries in Electron explicitly filter by hardcoded unit codes `18120` and `384`.
2. **Mock Data Layer**: Hardcoded manager rosters (7–8 managers with salaries), barista rosters (20 UZ, 2 UoP), training partners, and AOP financial metrics are auto-seeded in `db.ts`, `colDefaultData.ts`, and `adminService.ts`.
3. **UI / Presentation Layer**: Hardcoded store badges, tooltips, error messages, and AI placeholder text exist across more than 20 views and modals (e.g. `DashboardView`, `ColCalculatorView`, `UnifiedSettingsModal`, `ImportModal`).

### 4.2 Architectural Recommendations for Implementation

#### Recommendation 1: Decouple DatabaseManager & Fix Clean Launch Onboarding Flow
- In `electron/database/db.ts`:
  - Eliminate the default `currentStoreId = '108120_janki'`.
  - When `active_store.json` does not exist:
    - Do NOT create `tplh_forecast.db` or seed Janki data.
    - Set `hasExistingData() = false` and `hasCompletedOnboarding = false`.
    - Allow `DatabaseManager` to initialize in an unconfigured state or create a lightweight system database (`system.db`) for app metadata.
  - In `seedNewStoreData()`:
    - Seed ONLY store-agnostic catalogs: calendar weeks (`calendar_weeks`), standard shift definitions (`shift_definitions`), and Kodeks Pracy norms (`manager_monthly_norms`).
    - Keep `aop_plans`, `manager_employees`, `manager_monthly_roster`, `training_partners`, and `labor_actuals_log` completely clean (0 records).
  - Modify `computeDbFilePath()`:
    - Store all databases consistently as `store_${safeId}.db`. For backward compatibility, if `store_108120.db` does not exist but `tplh_forecast.db` exists, alias or seamlessly rename it.

#### Recommendation 2: Parameterize All Electron SQL Queries & Importers
- Replace all hardcoded SQL query filters:
  - In `electron/main.ts` (`db:get-actual-hours-for-month`, `db:get-daily-actual-hours-for-month`, `db:save-floor-rules`, `db:get-day-of-week-stats`):
    - Bind queries to the active store's `unit_code` and `mpk` retrieved dynamically from `app_settings` or passed via IPC arguments.
    - Change `WHERE (unit_code = '18120' OR unit_code = '384' ...)` to `WHERE (unit_code = ? OR mpk = ? OR unit_name LIKE ?)`.
  - In `electron/importer/mapalParser.ts` and `universalReportParser.ts`:
    - Pass active store metadata into the parser. Compare records against the active store's unit code and MPK rather than hardcoded `18120` / `384` / `Janki`.

#### Recommendation 3: Purge Mock Data & Placeholders from UI and Services
- In `src/modules/col-calculator/services/colDefaultData.ts`:
  - Clear `DEFAULT_COL_MANAGERS`, `DEFAULT_COL_CREW_UOP`, and `DEFAULT_COL_CREW_UZ` to empty arrays (`[]`), or load them strictly from the active store's SQLite database.
  - Reset `DEFAULT_COL_KPIS` to zeroed initial states (`salesTarget: 0`, `salesEst: 0`, `trxTarget: 0`, `trxEst: 0`).
  - Derive `ColStoreInfo` directly from `currentStore` in `StoreContext`.
- In `src/services/admin/adminService.ts`:
  - Remove pre-populated mock users (`Dawid Apel`, `Kamil Kamiński`, `Zuzanna Makowska`), pending requests, and audit logs from `initDefaults()`.
  - Let `getUsers()`, `getPendingRequests()`, and `getSecurityLogs()` return empty arrays until actual user interactions occur.
- In `src/services/auth/authService.ts`:
  - Remove hardcoded `'18120'` defaults and hardcoded `usr_sm_dawid_apel` fallback creation from `quickLoginStoreManager()`.
- In `src/components/DashboardView.tsx`, `AppUpdateModal.tsx`, `UnifiedSettingsModal.tsx`, `AopManagerModal.tsx`, `FloorHoursModal.tsx`, `ManagerLaborBridgeModal.tsx`:
  - Replace static store strings (`108120 SBX Warszawa Janki`, `Lokal 18120`) with dynamic bindings from `useStore()` (`currentStore.name`, `currentStore.unitCode`, `currentStore.shortName`).
  - Replace AI filler texts in `DashboardView.tsx` (lines 255–279) with clean, production-grade empty states and actionable quick-start cards.

---

## 5. Verification Method

To independently reproduce and verify every finding in this report:

1. **Verify Hardcoded Store Code Occurrences**:
   ```bash
   # Run grep scans across src and electron
   grep -rn "18120" src/ electron/
   grep -rn "108120" src/ electron/
   grep -rn "384" src/ electron/
   ```
2. **Verify SQL Query Hardcoding in Electron**:
   Inspect line 530, 602, 799, 860 of `electron/main.ts` and lines 276, 292, 301 of `electron/importer/mapalParser.ts`. Confirm verbatim occurrences of `WHERE (unit_code = '18120' OR unit_code = '384' ...)`.
3. **Verify Onboarding Bypass on Clean Profile**:
   Inspect `electron/database/db.ts` lines 112–135. Trace the execution of `hasExistingData()` following `this.seedInitialData()`. Confirm that `sbx_onboarding_completed` is unconditionally forced to `'true'` in SQLite.
4. **Verify Mock Rosters & Salaries**:
   Inspect `electron/database/db.ts` lines 1151–1159 (`seedDemoManagerTeamAndShifts`), lines 1498–1521 (`getTrainingPartners`), and `src/modules/col-calculator/services/colDefaultData.ts` lines 37–287.
5. **Verify TypeScript & Vite Build Parity**:
   ```bash
   npm run build
   ```
   Ensures that any subsequent refactoring or removal of hardcoded constants maintains 100% compilation and bundle integrity.
