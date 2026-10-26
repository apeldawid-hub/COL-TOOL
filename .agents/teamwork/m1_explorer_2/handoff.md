# Handoff Report: Feature F2 (Mock Data & Fake Rosters Purge) Implementation Blueprint

**Agent ID**: `m1_explorer_2`  
**Role**: `teamwork_preview_explorer` (Investigation & Synthesis)  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2`  
**Milestone**: Milestone 1  
**Target Feature**: Feature F2 (Mock Data & Fake Rosters Purge)  
**Date**: 2026-10-24  

---

## 1. Observation

A targeted source-level analysis of mock data, fake rosters, hardcoded employee compensation figures, and AI placeholder records was performed across the codebase. Below are verbatim citations and exact line boundaries for each target.

### 1.1 `electron/database/db.ts`
1. **`seedDemoManagerTeamAndShifts()` (Lines 1144–1220)**:
   - Verbatim lines 1151–1159:
     ```ts
     const defaultTeam = [
       ['Dawid Szeluga', 'SM', 'FULL', 1.0, 42.0, 1],
       ['Dawid Apel', 'ASM', 'FULL', 1.0, 36.0, 2],
       ['Kamil Kamiński', 'SSV', 'FULL', 1.0, 32.5, 3],
       ['Zuzanna Makowska', 'SSV', '0.75', 0.75, 32.5, 4],
       ['Weronika Bieńkowska', 'SSV', '0.5', 0.5, 32.5, 5],
       ['Gabi Znojek', 'SSV', 'FULL', 1.0, 32.5, 6],
       ['Aleksandra Płużyńska', 'SSV', 'FULL', 1.0, 32.5, 7]
     ];
     ```
   - Verbatim lines 1190–1198: Seeds 30 daily shifts for September 2026 across all 7 named managers.
   - Verbatim line 1218: Calls `this.seedMonthlyRosters()`.
2. **`seedMonthlyRosters()` (Lines 1261–1347)**:
   - Verbatim lines 1268–1271:
     ```ts
     INSERT OR IGNORE INTO manager_employees (id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
     VALUES (8, 'Hanna Domachowska', 'SSV', '0.5', 0.5, 32.5, 8, 1)
     ```
   - Verbatim lines 1283–1335: Inserts July 2026 team (8 managers), August 2026 team (8 managers), and September 2026 team (7 managers) with fixed hourly rates into `manager_monthly_roster`.
3. **`getTrainingPartners()` (Lines 1478–1530)**:
   - Verbatim lines 1496–1527:
     ```ts
     // Auto-seed jeśli tabela jest pusta (2 przykładowych partnerów kawiarni 108120 Janki)
     if (res.length === 0) {
       const seedPartners = [
         {
           name: 'Kacper Wiśniewski',
           hire_date: '2026-09-01',
           current_program: 'first_30',
           assigned_trainer_name: 'Weronika Łukasiak',
           store_manager_name: 'Dawid Apel',
           sanepid_valid_until: '2027-08-31',
           bhp_completed_date: '2026-09-01',
           status: 'in_progress',
           notes: 'Nowy barista na etapie wdrożenia First 30 (AM/PM).'
         },
         {
           name: 'Maja Zielińska',
           hire_date: '2026-06-15',
           current_program: 'barista_90',
           assigned_trainer_name: 'Gabriela Szymańska',
           store_manager_name: 'Dawid Apel',
           sanepid_valid_until: '2027-06-10',
           bhp_completed_date: '2026-06-15',
           status: 'in_progress',
           notes: 'Ukończony First 30 (certyfikowana). Przygotowanie do 90-Dniowego Check-In.'
         }
       ];
       for (const p of seedPartners) {
         this.saveTrainingPartner(p);
       }
       return this.getTrainingPartners();
     }
     ```
4. **`seedInitialData()` (Lines 1438–1471)**:
   - Verbatim lines 1438–1465: Reads `labor_actuals_2026_seed.json` and inserts actual shifts hardcoded with `unit_code: '18120'`, `unit_name: '108120 SBX Warszawa Janki'`.
   - Verbatim lines 1468–1471:
     ```ts
     INSERT OR REPLACE INTO weekly_actual_trx (week_key, actual_trx)
     VALUES ('2026_Wrzesień_W1', 2050);
     ```

---

### 1.2 `src/modules/col-calculator/services/colDefaultData.ts`
1. **`DEFAULT_COL_STORE_INFO` (Lines 10–17)**:
   - Verbatim lines 10–17:
     ```ts
     export const DEFAULT_COL_STORE_INFO: ColStoreInfo = {
       storeCode: '108120',
       storeName: 'SBX Warszawa Janki',
       month: 'WRZESIEŃ',
       year: 2025,
       openDays: 30,
       fullContractHours: 176
     };
     ```
2. **`DEFAULT_COL_KPIS` (Lines 19–35)**:
   - Verbatim lines 19–35: Hardcoded `salesTarget: 310000`, `salesEst: 280000`, `trxTarget: 10900`, `trxEst: 9700`, `nonCoverageSickEst: 4`, `tplhTarget: 6.6`.
3. **`DEFAULT_COL_MANAGERS` (Lines 37–231)**:
   - Verbatim lines 37–139: Contains 6 named managers with base salaries:
     - `Dawid Szeluga`: baseSalary 7,200 PLN
     - `Dawid Apel`: baseSalary 6,300 PLN
     - `Zuzanna Makowska`: baseSalary 3,510 PLN
     - `Weronika Bieńkowska`: baseSalary 5,600 PLN
     - `Nikola Studzińska`: baseSalary 2,300 PLN
     - `Kamil Kamiński`: baseSalary 5,600 PLN, estBonus 300 PLN
   - Lines 141–230: Contains special rows with mock amounts: `mgr-dm` (planBonus 685, estBonus 685), `mgr-holiday-accrual` (baseSalary 3454, estBonus 1819).
4. **`DEFAULT_COL_CREW_UOP` (Lines 233–264)**:
   - Verbatim lines 233–264: Contains 2 named baristas:
     - `Hanna Domachowska`: hourlyRate 31.40 PLN, planWorkHours 88
     - `Gabriela Znojek`: hourlyRate 30.75 PLN, planWorkHours 132
5. **`DEFAULT_COL_CREW_UZ` (Lines 266–287)**:
   - Verbatim lines 266–287: Contains 20 named baristas with hourly rates (30.40–31.40 PLN), mock plan hours, and mock estimated hours.
6. **`DEFAULT_COL_OTHER_COSTS` (Lines 289–300)**:
   - Verbatim lines 289–300: Contains hardcoded arbitrary values: Medical examination (150 PLN), ADP (600 PLN), PPK (250 PLN), Drivers (220 PLN, 206 PLN).
7. **Directly Dependent View: `src/modules/col-calculator/components/ColVacationReserveSheet.tsx` (Lines 18–38)**:
   - Verbatim lines 18–25:
     ```ts
     const initialDaysMap: Record<string, number> = {
       'Dawid Szeluga': 2,
       'Dawid Apel': 4,
       'Zuzanna Makowska': 1,
       'Weronika Bieńkowska': 4,
       'Nikola Studzińska': 4,
       'Kamil Kamiński': 0
     };
     ```
   - Verbatim line 38: `const [prevMonthReserveBrutto, setPrevMonthReserveBrutto] = useState<number>(-127);`

---

### 1.3 `src/services/admin/adminService.ts`
1. **`initDefaults()` (Lines 82–163)**:
   - Verbatim lines 84–124: Injects 3 mock managed users into `localStorage` (`sbx_admin_managed_users`):
     - `Dawid Apel` (`dawid.apel@amrest.eu`, `usr_sm_dawid_apel`, `MacBook Air - Zaplecze Janki`, `storeUnitCode: '18120'`)
     - `Kamil Kamiński` (`kamil.kaminski@amrest.eu`, `usr_ssv_kamil_k`, `iPhone 15 - Partner Mobile`, `storeUnitCode: '18120'`)
     - `Zuzanna Makowska` (`zuzanna.makowska@amrest.eu`, `usr_ssv_zuzanna_m`, `Galaxy S24 - Partner Mobile`, `storeUnitCode: '18120'`)
   - Verbatim lines 128–145: Injects pending access request into `localStorage` (`sbx_admin_pending_requests`):
     - `Piotr Wiśniewski` (`piotr.wisniewski@amrest.eu`, `storeUnitCode: '18120'`, `iPhone 13`, `192.168.1.112 (CH Janki Wi-Fi)`)
   - Verbatim lines 147–162: Injects mock security audit log into `localStorage` (`sbx_admin_security_logs`):
     - `LOGIN_2FA` by `Dawid Apel` from `192.168.1.10 (MacBook Air Zaplecze)`.
2. **`AdminConsoleModal.tsx` (Line 257)**:
   - Verbatim line 257: `<p className="text-xs text-stone-500 mt-1">Wszystkie urządzenia i konta pracowników kawiarni Janki są zweryfikowane.</p>`

---

### 1.4 `src/services/auth/authService.ts`
1. **`quickLoginStoreManager()` (Lines 98–150)**:
   - Verbatim line 100: `public static quickLoginStoreManager(storeUnitCode: string = '18120'): AuthUserSession`
   - Verbatim line 101: `const smEmail = 'dawid.apel@amrest.eu';`
   - Verbatim lines 106–118: Registers fallback user `Dawid Apel` (`usr_sm_dawid_apel`).
   - Verbatim line 145: Details string: `Szybkie uwierzytelnienie Store Managera na zapleczu kawiarni ${storeUnitCode}`
2. **`request2FaOtp()` (Lines 155–181)**:
   - Verbatim line 155: `public static async request2FaOtp(email: string, storeUnitCode: string = '18120')`
   - Verbatim line 180: Message string: `...oczekuje na zatwierdzenie przez Store Managera (Dawid Apel).`
3. **`registerPartner()` (Lines 291–330)**:
   - Verbatim line 327: Message string: `'Wniosek o dostęp został przekazany do Store Managera (Dawid Apel). Po zatwierdzeniu będziesz mógł zalogować się do aplikacji.'`
4. **Directly Dependent View: `src/components/LoginView.tsx` (Lines 276–302)**:
   - Verbatim line 279: Static JSX text `Dawid Apel`
   - Verbatim line 300: Static JSX text `dawid.apel@amrest.eu`

---

### 1.5 `src/services/firebaseTelemetryService.ts`
1. **`getDefaultLocalData()` (Lines 108–160)**:
   - Verbatim lines 110–159: Returns 3 hardcoded mock installations:
     - `SBX-MAC-JANKI-01` (`Dawid Apel`, `108120 SBX Warszawa Janki`, `18120`)
     - `SBX-MAC-ARKADIA-02` (`Katarzyna Nowak`, `108327 SBX Westfield Arkadia`, `18327`)
     - `SBX-MAC-SADYBA-03` (`Michał Wiśniewski`, `108341 SBX Sadyba Best Mall`, `18341`)
2. **`recordOrUpdateHeartbeat()` (Lines 195–199)**:
   - Verbatim lines 195–199:
     ```ts
     const storeName = localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';
     const unitCode = localStorage.getItem('sbx_unit_code') || '18120';
     const userName = localStorage.getItem('sbx_user_name') || 'Dawid Apel';
     const userRole = localStorage.getItem('sbx_user_role') || 'SM';
     const userEmail = localStorage.getItem('sbx_user_email') || 'apeldawid@gmail.com';
     ```
3. **Line 310**:
   - Verbatim line 310: `unitCode: f.unitCode?.stringValue || '18120'`

---

### 1.6 Auxiliary Mock Data Sources
1. **`src/App.tsx` (Lines 302–384)**:
   - Fallback browser mock data setting `mockPlan` (`plan_trx: 10830`, `target_tplh: 6.7`, `labor_budget: 1616.4`), `mockWeeks` with hardcoded floor hours (272.0, 80.0), `actualHoursMap` (333.9, 43.4), and `weeklyTrxMap` (2050).
2. **`src/modules/labor-forecast/components/AopManagerModal.tsx` (Lines 57–68)**:
   - Generates 12 mock months with static `plan_trx: 10800`, `target_tplh: 6.70`, `labor_budget: 1611.9`.
3. **`src/components/OnboardingWizardView.tsx` (Lines 84–97)**:
   - Pre-fills `INITIAL_AOP_TEMPLATE` with pre-baked sales numbers (645k–830k) and TRX numbers (19800–28500).

---

## 2. Logic Chain

1. **Premise 1**: Feature F2 (Mock Data & Fake Rosters Purge) requires the complete removal of fake employee records, mock salaries, and fake financial metrics, replacing them with clean state defaults (empty arrays, dynamic derivation from SQLite/active store).
2. **Premise 2**: In `electron/database/db.ts`, `seedDemoManagerTeamAndShifts()` and `seedMonthlyRosters()` insert 8 managers with specific contract ratios and hourly rates into SQLite, and `getTrainingPartners()` automatically injects 2 fake baristas whenever the table is empty.
3. **Premise 3**: In `src/modules/col-calculator/services/colDefaultData.ts`, `DEFAULT_COL_MANAGERS`, `DEFAULT_COL_CREW_UOP`, and `DEFAULT_COL_CREW_UZ` contain 28 fake employee records with real-world-like Polish names, base salaries (up to 7,200 PLN), and hourly rates. In addition, `ColVacationReserveSheet.tsx` maps those exact manager names to hardcoded vacation days and a hardcoded `-127 PLN` brutto reserve.
4. **Premise 4**: In `src/services/admin/adminService.ts`, `initDefaults()` injects 3 fake active users, 1 fake pending request, and 1 fake 2FA audit log into `localStorage` under `sbx_admin_*` keys on first run.
5. **Premise 5**: In `src/services/auth/authService.ts`, `quickLoginStoreManager()` defaults to unit `18120` and email `dawid.apel@amrest.eu`, while user-facing messages in `request2FaOtp()` and `registerPartner()` explicitly mention `(Dawid Apel)`.
6. **Premise 6**: In `src/services/firebaseTelemetryService.ts`, `getDefaultLocalData()` returns 3 mock device installations for Janki, Arkadia, and Sadyba, while `recordOrUpdateHeartbeat()` falls back to `Dawid Apel`, `apeldawid@gmail.com`, and `18120`.
7. **Inference 1**: Therefore, any new or switched store database is contaminated with fake employee rosters, fake salaries, and artificial historical data, violating tenant isolation and multi-store neutrality (Requirement R1, R2).
8. **Inference 2**: Replacing these sources with clean state representations (`[]` for rosters, `0` for financial baselines, and dynamic derivation from the active session/store context for user identities) completely eliminates mock data while keeping the application fully functional and typesafe.

---

## 3. Caveats

1. **Special Rows in COL Calculator**: In `colDefaultData.ts`, rows with `isSpecialRow: true` (`mgr-maternity`, `mgr-bench`, `mgr-dm`, `mgr-dos`, `mgr-holiday-accrual`) represent structural line items required by Starbucks P&L payroll calculations. They should **NOT** be deleted, but rather have their financial amounts zeroed (`baseSalary: 0, planBonus: 0, estBonus: 0`).
2. **Standard Shift Definitions & Norms**: `ensureShiftDefinitions()` and `seedMonthlyNorms()` in `db.ts` define company-wide Starbucks shift codes (AM, PM, AMN, PMN, MIB, etc.) and Polish Labor Code statutory working hour norms (art. 130 KP) for 2016–2036. These are standard statutory catalogs, **NOT** mock data, and must be preserved.
3. **UI Empty States**: Purging fake training partners and manager rosters will result in `partners.length === 0` and `managers.length === 0` on fresh databases. All consuming UI components (`TrainingsView.tsx`, `AdminConsoleModal.tsx`, `ColSpreadsheetGrid.tsx`) already handle empty arrays gracefully, but adding clean empty-state placeholders enhances usability.

---

## 4. Conclusion & Implementation Blueprint for Worker

Below are the exact, surgical instructions for the Worker agent to implement Feature F2.

### 4.1 Target 1: `electron/database/db.ts`

#### Modification 1.1: Purge `seedDemoManagerTeamAndShifts()` (Lines 1144–1220)
- **Action**: Replace the body of `seedDemoManagerTeamAndShifts()` with a clean no-op method.
- **Replacement Chunk**:
  ```ts
  public seedDemoManagerTeamAndShifts(): void {
    // Purged in F2: No-op. Zero mock manager teams or fake shifts seeded in production.
  }
  ```

#### Modification 1.2: Purge `seedMonthlyRosters()` (Lines 1261–1347)
- **Action**: Replace the body of `seedMonthlyRosters()` with a clean no-op method.
- **Replacement Chunk**:
  ```ts
  private seedMonthlyRosters(): void {
    // Purged in F2: No-op. Zero mock monthly rosters seeded in production.
  }
  ```

#### Modification 1.3: Purge Auto-Seed in `getTrainingPartners()` (Lines 1496–1528)
- **Action**: Remove the `if (res.length === 0)` block that injects `Kacper Wiśniewski` and `Maja Zielińska`.
- **Replacement Chunk**:
  ```ts
  public getTrainingPartners(): any[] {
    if (!this.db) return [];
    const res: any[] = [];
    const stmt = this.db.prepare(`
      SELECT * FROM training_partners ORDER BY hire_date DESC, id DESC
    `);
    while (stmt.step()) {
      res.push(stmt.getAsObject());
    }
    stmt.free();
    return res;
  }
  ```

#### Modification 1.4: Purge Mock Actuals & Weekly TRX in `seedInitialData()` (Lines 1438–1472)
- **Action**: Remove the seeding of `labor_actuals_2026_seed.json` and the hardcoded weekly TRX entry (`2026_Wrzesień_W1: 2050`).
- **Target lines to remove**: Lines 1437–1472.

---

### 4.2 Target 2: `src/modules/col-calculator/services/colDefaultData.ts`

#### Modification 2.1: Purge Hardcoded Defaults in `colDefaultData.ts`
- **Action**: Replace the contents of `colDefaultData.ts` with clean, zeroed state structures.
- **Full Replacement Content**:
  ```ts
  import {
    ColStoreInfo,
    ColKpiTargetEst,
    ColManagerItem,
    ColCrewUopItem,
    ColCrewUzItem,
    ColOtherItem
  } from '../types/colTypes';

  export const DEFAULT_COL_STORE_INFO: ColStoreInfo = {
    storeCode: '',
    storeName: '',
    month: '',
    year: new Date().getFullYear(),
    openDays: 30,
    fullContractHours: 168
  };

  export const DEFAULT_COL_KPIS: ColKpiTargetEst = {
    salesTarget: 0,
    salesEst: 0,
    salesAop: 0,
    trxTarget: 0,
    trxEst: 0,
    trxAop: 0,
    avgDailyOpeningHours: 14,
    nonCoverageHolidayTarget: 0,
    nonCoverageHolidayEst: 0,
    nonCoverageSickTarget: 0,
    nonCoverageSickEst: 0,
    nonCoverageTrainingTarget: 0,
    matrixPlan: 'Plan A',
    tplhTarget: 0,
    whatIfTplhImprovement: 0
  };

  export const DEFAULT_COL_MANAGERS: ColManagerItem[] = [
    {
      id: 'mgr-maternity',
      name: 'Manager Maternity',
      position: 'Manager Maternity',
      contractRatio: 0,
      baseSalary: 0,
      planWorkHours: 0,
      planSickHours: 0,
      planHolidayHours: 0,
      planBonus: 0,
      isDisability: false,
      estWorkHours: 0,
      estSickHours: 0,
      estHolidayHours: 0,
      estBonus: 0,
      storeCostRatio: 1,
      isSpecialRow: true
    },
    {
      id: 'mgr-bench',
      name: 'Manager Bench',
      position: 'Manager Bench',
      contractRatio: 0,
      baseSalary: 0,
      planWorkHours: 0,
      planSickHours: 0,
      planHolidayHours: 0,
      planBonus: 0,
      isDisability: false,
      estWorkHours: 0,
      estSickHours: 0,
      estHolidayHours: 0,
      estBonus: 0,
      storeCostRatio: 1,
      isSpecialRow: true
    },
    {
      id: 'mgr-dm',
      name: 'DM costs',
      position: 'DM costs',
      contractRatio: 0,
      baseSalary: 0,
      planWorkHours: 0,
      planSickHours: 0,
      planHolidayHours: 0,
      planBonus: 0,
      isDisability: false,
      estWorkHours: 0,
      estSickHours: 0,
      estHolidayHours: 0,
      estBonus: 0,
      storeCostRatio: 1,
      isSpecialRow: true
    },
    {
      id: 'mgr-dos',
      name: 'DOS+ accrual',
      position: 'DOS+ accrual',
      contractRatio: 0,
      baseSalary: 0,
      planWorkHours: 0,
      planSickHours: 0,
      planHolidayHours: 0,
      planBonus: 0,
      isDisability: false,
      estWorkHours: 0,
      estSickHours: 0,
      estHolidayHours: 0,
      estBonus: 0,
      storeCostRatio: 1,
      isSpecialRow: true
    },
    {
      id: 'mgr-holiday-accrual',
      name: 'Holiday accrual',
      position: 'Holiday accrual',
      contractRatio: 0,
      baseSalary: 0,
      planWorkHours: 0,
      planSickHours: 0,
      planHolidayHours: 0,
      planBonus: 0,
      isDisability: false,
      estWorkHours: 0,
      estSickHours: 0,
      estHolidayHours: 0,
      estBonus: 0,
      storeCostRatio: 1,
      isSpecialRow: true
    }
  ];

  export const DEFAULT_COL_CREW_UOP: ColCrewUopItem[] = [];

  export const DEFAULT_COL_CREW_UZ: ColCrewUzItem[] = [];

  export const DEFAULT_COL_OTHER_COSTS: ColOtherItem[] = [
    { id: 'oth-1', label: 'Medical examination ryczałt', planVal: 0, estVal: 0 },
    { id: 'oth-2', label: 'Bonus "Recommend a friend" (netto)', planVal: 0, estVal: 0 },
    { id: 'oth-3', label: 'Bonus SSV No Area', planVal: 0, estVal: 0, ratePct: 0.001 },
    { id: 'oth-4', label: 'Bonus CREW', planVal: 0, estVal: 0, ratePct: 0.002 },
    { id: 'oth-5', label: 'Wyksięgowanie PFRON Manager', planVal: 0, estVal: 0 },
    { id: 'oth-6', label: 'Wyksięgowanie PFRON Crew', planVal: 0, estVal: 0 },
    { id: 'oth-7', label: 'ADP', planVal: 0, estVal: 0 },
    { id: 'oth-8', label: 'Other (Koszty HR, corrections from previous month etc.)', planVal: 0, estVal: 0 },
    { id: 'oth-9', label: 'PPK', planVal: 0, estVal: 0, extraMeta: { ppkMgr: 0, ppkCrew: 0 } },
    { id: 'oth-10', label: 'Drivers', planVal: 0, estVal: 0, extraMeta: { costPerDrop: 14 } }
  ];
  ```

#### Modification 2.2: Purge Mock Managers in `ColVacationReserveSheet.tsx` (Lines 18–38)
- **Target File**: `src/modules/col-calculator/components/ColVacationReserveSheet.tsx`
- **Action**: Replace `initialDaysMap` and `-127` brutto reserve with clean zeroed defaults.
- **Replacement Chunk**:
  ```ts
  export const ColVacationReserveSheet: React.FC<ColVacationReserveSheetProps> = ({ managers }) => {
    const [reserveRows, setReserveRows] = useState<VacationReserveRow[]>(() => {
      return managers
        .filter(m => !m.isSpecialRow && m.name)
        .map(m => ({
          id: m.id,
          name: m.name,
          unusedDays: 0,
          monthlySalary: m.baseSalary * m.contractRatio
        }));
    });

    const [prevMonthReserveBrutto, setPrevMonthReserveBrutto] = useState<number>(0);
  ```

---

### 4.3 Target 3: `src/services/admin/adminService.ts`

#### Modification 3.1: Clean `initDefaults()` (Lines 82–163)
- **Action**: Remove hardcoded mock users, requests, and logs. Initialize empty collections in `localStorage`.
- **Replacement Chunk**:
  ```ts
  export class AdminService {
    private static initDefaults(): void {
      if (!localStorage.getItem(STORAGE_USERS_KEY)) {
        localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_REQUESTS_KEY)) {
        localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_LOGS_KEY)) {
        localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify([]));
      }
    }
  ```

#### Modification 3.2: Clean Empty State Copy in `src/components/admin/AdminConsoleModal.tsx` (Line 257)
- **Action**: Replace `kawiarni Janki` with neutral copy.
- **Replacement Chunk**:
  ```tsx
  <p className="text-xs text-stone-500 mt-1">Wszystkie urządzenia i konta pracowników kawiarni są zweryfikowane.</p>
  ```

---

### 4.4 Target 4: `src/services/auth/authService.ts`

#### Modification 4.1: Dynamic Store Manager Login in `quickLoginStoreManager()` (Lines 98–150)
- **Action**: Eliminate default `'18120'` and hardcoded `Dawid Apel`. Derive identity dynamically from `AdminService.getUsers()` or `localStorage`.
- **Replacement Chunk**:
  ```ts
  /**
   * Szybkie logowanie Store Managera na stacji roboczej zaplecza
   */
  public static quickLoginStoreManager(storeUnitCode: string = ''): AuthUserSession {
    const users = AdminService.getUsers();
    let smUser = users.find(u => u.role === 'STORE_MANAGER' && u.isActive);

    const storedName = localStorage.getItem('sbx_user_name') || 'Store Manager';
    const storedEmail = localStorage.getItem('sbx_user_email') || (storeUnitCode ? `manager.${storeUnitCode}@amrest.eu` : 'manager@amrest.eu');

    if (!smUser) {
      smUser = {
        id: `usr_sm_${Date.now()}`,
        storeUnitCode,
        fullName: storedName,
        email: storedEmail,
        role: 'STORE_MANAGER',
        isActive: true,
        permissions: ROLE_DEFAULT_PERMISSIONS.STORE_MANAGER,
        lastLoginAt: new Date().toISOString(),
        deviceName: this.getDeviceName(),
        sessionVersion: 1,
        createdAt: new Date().toISOString(),
      };
      users.push(smUser);
      localStorage.setItem('sbx_admin_managed_users', JSON.stringify(users));
    }

    const session: AuthUserSession = {
      userId: smUser.id,
      storeUnitCode: smUser.storeUnitCode || storeUnitCode,
      fullName: smUser.fullName,
      email: smUser.email,
      role: smUser.role,
      permissions: smUser.permissions,
      sessionToken: `tok_sm_${Date.now()}`,
      sessionVersion: smUser.sessionVersion,
      deviceName: this.getDeviceName(),
      deviceFingerprint: this.getDeviceFingerprint(),
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('sbx_user_name', smUser.fullName);
    localStorage.setItem('sbx_user_email', smUser.email);
    localStorage.setItem('sbx_user_role', 'Store Manager (SM)');

    AdminService.addAuditLog({
      actorName: smUser.fullName,
      actorRole: 'STORE_MANAGER',
      actionType: 'LOGIN_2FA',
      targetResource: 'system:root_admin',
      details: `Uwierzytelnienie Store Managera na zapleczu kawiarni ${storeUnitCode || ''}`,
      deviceName: this.getDeviceName(),
    });

    return session;
  }
  ```

#### Modification 4.2: Dynamic Manager Name in User-Facing Messages (Lines 180 & 327)
- **Action**: Replace static `(Dawid Apel)` in `request2FaOtp()` and `registerPartner()`.
- **Replacement Chunks**:
  - In `request2FaOtp()` (Line 180):
    ```ts
    const smUser = AdminService.getUsers().find(u => u.role === 'STORE_MANAGER' && u.isActive);
    const smName = smUser ? ` (${smUser.fullName})` : '';
    return {
      success: false,
      isPendingApproval: true,
      message: `Twój wniosek z dnia ${new Date(pendingReq.createdAt).toLocaleDateString('pl-PL')} oczekuje na zatwierdzenie przez Store Managera${smName}.`,
    };
    ```
  - In `registerPartner()` (Line 327):
    ```ts
    const smUser = AdminService.getUsers().find(u => u.role === 'STORE_MANAGER' && u.isActive);
    const smName = smUser ? ` (${smUser.fullName})` : '';
    return {
      success: true,
      message: `Wniosek o dostęp został przekazany do Store Managera${smName}. Po zatwierdzeniu będziesz mógł zalogować się do aplikacji.`,
      request,
    };
    ```

#### Modification 4.3: Dynamic Manager Card in `src/components/LoginView.tsx` (Lines 276–302)
- **Action**: Derive the Store Manager name and email dynamically.
- **Replacement Chunk**:
  ```tsx
  {activeTab === 'store_manager' && (() => {
    const smUser = AdminService.getUsers().find(u => u.role === 'STORE_MANAGER' && u.isActive);
    const smDisplayName = smUser?.fullName || localStorage.getItem('sbx_user_name') || 'Store Manager';
    const smDisplayEmail = smUser?.email || localStorage.getItem('sbx_user_email') || (currentStore.unitCode ? `manager.${currentStore.unitCode}@amrest.eu` : 'manager@amrest.eu');

    return (
      <div className="space-y-5 animate-fadeIn">
        <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E2E8E5] space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-stone-500 font-medium">Kierownik Kawiarni:</span>
            <span className="font-bold text-stone-900 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stone-500" />
              {smDisplayName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500 font-medium">Rola systemowa:</span>
            <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-600" />
              Store Manager (SM) • Pełny Dostęp
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500 font-medium">Stacja robocza:</span>
            <span className="font-medium text-stone-700 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-stone-400" />
              {deviceName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500 font-medium">E-mail służbowy:</span>
            <span className="font-mono text-stone-600 text-[11px] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-stone-400" />
              {smDisplayEmail}
            </span>
          </div>
        </div>
  ```

---

### 4.5 Target 5: `src/services/firebaseTelemetryService.ts`

#### Modification 5.1: Purge Mock Installations in `getDefaultLocalData()` (Lines 108–160)
- **Action**: Return empty array `[]`.
- **Replacement Chunk**:
  ```ts
  private getDefaultLocalData(): FirebaseInstallationRecord[] {
    return [];
  }
  ```

#### Modification 5.2: Neutral Fallbacks in `recordOrUpdateHeartbeat()` (Lines 195–199)
- **Action**: Replace hardcoded fallback strings with dynamic empty strings.
- **Replacement Chunk**:
  ```ts
  const storeName = localStorage.getItem('sbx_store_name') || '';
  const unitCode = localStorage.getItem('sbx_unit_code') || '';
  const userName = localStorage.getItem('sbx_user_name') || 'Użytkownik';
  const userRole = localStorage.getItem('sbx_user_role') || 'Partner';
  const userEmail = localStorage.getItem('sbx_user_email') || '';
  ```

#### Modification 5.3: Remove Hardcoded Unit Code (Line 310)
- **Action**: Remove fallback `'18120'`.
- **Replacement Chunk**:
  ```ts
  unitCode: f.unitCode?.stringValue || '',
  ```

---

### 4.6 Target 6: Auxiliary Mock Cleanups
1. **`src/App.tsx` (Lines 375–384)**:
   - In browser fallback, do not set mock numbers:
     ```ts
     setAopPlan(null);
     setWeeks([]);
     setActualHoursMap({});
     setWeeklyTrxMap({});
     ```
2. **`src/modules/labor-forecast/components/AopManagerModal.tsx` (Lines 57–68)**:
   - Set initial fallback plans to 0: `plan_trx: 0, target_tplh: 0, labor_budget: 0, avg_weekly_hours: 0`.
3. **`src/components/OnboardingWizardView.tsx` (Lines 84–97)**:
   - Set `INITIAL_AOP_TEMPLATE` values to 0: `plan_trx: 0, target_tplh: 0, labor_budget: 0, avg_weekly_hours: 0, plan_sales: 0, plan_col_pln: 0, plan_col_percent: 0`.

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Complete Absence of Mock Manager & Barista Names**:
   ```bash
   grep -rn "Dawid Szeluga" src/ electron/
   grep -rn "Hanna Domachowska" src/ electron/
   grep -rn "Wiktoria Lenart" src/ electron/
   grep -rn "Kacper Wiśniewski" src/ electron/
   grep -rn "Maja Zielińska" src/ electron/
   ```
   *Expected outcome*: 0 occurrences outside historical changelog records.

2. **Verify Clean SQLite Roster Initialization**:
   Launch app with a fresh profile or query a newly generated database (`sqlite3 data/store_*.db`):
   ```sql
   SELECT COUNT(*) FROM manager_employees;       -- Must be 0
   SELECT COUNT(*) FROM manager_monthly_roster;  -- Must be 0
   SELECT COUNT(*) FROM training_partners;       -- Must be 0
   SELECT COUNT(*) FROM labor_actuals_log;       -- Must be 0
   ```

3. **Verify Clean Admin & User State**:
   Open browser devtools on a clean local storage session:
   ```js
   localStorage.getItem('sbx_admin_managed_users');   // Must be '[]' or null
   localStorage.getItem('sbx_admin_pending_requests'); // Must be '[]' or null
   localStorage.getItem('sbx_admin_security_logs');    // Must be '[]' or null
   ```

4. **Verify TypeScript & Vite Build Parity**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Exit code 0, 0 compiler errors.
