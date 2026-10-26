# Handoff Report: Implementation Instructions for Features F4 & F5

**Agent ID**: `m1_explorer_3`  
**Role**: `explorer` / `synthesis`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3`  
**Target Milestone**: Milestone 1 (Features F4 & F5)  
**Date**: 2026-10-24  

---

## 1. Observation

Direct code examination of `electron/database/db.ts`, `electron/main.ts`, `src/App.tsx`, `src/components/OnboardingWizardView.tsx`, `src/services/storeService.ts`, `electron/importer/mapalParser.ts`, and `electron/importer/universalReportParser.ts` revealed the following exact observations:

### 1.1 Observations on Feature F4 (Clean Launch Store Onboarding Wizard)

1. **`electron/database/db.ts:79` & constructor (`lines 97–103`)**:
   ```typescript
   private currentStoreId: string = '108120_janki';
   ...
   const meta = this.loadActiveStoreMeta();
   if (meta?.storeId) {
     this.currentStoreId = meta.storeId;
   }
   this.dbFilePath = this.computeDbFilePath(this.currentStoreId, meta?.storeInfo);
   ```
   When `active_store.json` does not exist (clean launch on fresh profile), `currentStoreId` retains default `'108120_janki'`, resolving `dbFilePath` to `data/tplh_forecast.db`.

2. **`electron/database/db.ts:112–142` (`init()` method)**:
   ```typescript
   if (fs.existsSync(this.dbFilePath)) {
     const fileBuffer = fs.readFileSync(this.dbFilePath);
     this.db = new this.SQL.Database(fileBuffer);
     this.createSchema();
     if (this.hasExistingData()) {
       const currentSettings = this.getAppSettings();
       if (currentSettings['sbx_onboarding_completed'] !== 'true') {
         this.setAppSettings({
           sbx_onboarding_completed: 'true',
           onboarding_completed: 'true',
           store_name: currentSettings['store_name'] || '108120 SBX Warszawa Janki',
           unit_code: currentSettings['unit_code'] || '18120',
         });
       }
     }
   } else {
     this.db = new this.SQL.Database();
     this.createSchema();
     this.seedInitialData();
     this.persist();
   }
   ```
   If `tplh_forecast.db` does not exist, `seedInitialData()` seeds Janki AOP plans (2021–2036), Janki labor actuals, and calls `seedManagerModuleData()` inserting store `'18120'` (`108120 SBX Warszawa Janki`). It then exports this to disk as `tplh_forecast.db`. If `tplh_forecast.db` exists, it forces `sbx_onboarding_completed = 'true'` with Janki defaults.

3. **`electron/database/db.ts:335–343` (`seedNewStoreData()` method)**:
   ```typescript
   this.setAppSettings({
     store_name: storeName,
     unit_code: unitCode,
     store_mpk: storeMpk,
     store_city: storeCity,
     store_district: storeDistrict,
     sbx_onboarding_completed: 'true',
     onboarding_completed: 'true',
   });
   ```
   Creating or switching to a new store database unconditionally marks onboarding as completed, preempting the user setup flow.

4. **`electron/database/db.ts:422–453` (`hasExistingData()` method)**:
   Returns `true` if `sbx_onboarding_completed === 'true'` OR if `aop_plans`, `manager_schedule_shifts`, or `manager_monthly_roster` have > 0 rows. Because clean launch auto-seeded Janki AOP plans (180 rows), `hasExistingData()` evaluated to `true`.

5. **`electron/main.ts:168–181` (`app:get-settings` handler)**:
   ```typescript
   ipcMain.handle('app:get-settings', () => {
     const settings = dbManager.getAppSettings();
     const hasData = dbManager.hasExistingData();
     const hasCompletedOnboarding =
       settings['sbx_onboarding_completed'] === 'true' ||
       settings['onboarding_completed'] === 'true' ||
       hasData;

     return {
       settings,
       hasCompletedOnboarding,
       hasExistingData: hasData,
     };
   });
   ```
   Notice line 174: `|| hasData`. Even if onboarding was never completed, if any table had rows (which auto-seed caused), `hasCompletedOnboarding` returned `true`.

6. **`src/App.tsx:78` (`checkOnboardingState()` method)**:
   ```typescript
   const { settings, hasCompletedOnboarding: isCompleted, hasExistingData } = res;
   if (isCompleted || hasExistingData) {
     setHasCompletedOnboarding(true);
   ```
   If either `isCompleted` or `hasExistingData` was true, the frontend immediately locked in `hasCompletedOnboarding = true`, bypassing `OnboardingWizardView`.

7. **`src/App.tsx:486–531` (`OnboardingWizardView.onComplete`)**:
   `onComplete` only saved settings to localStorage and called `api.saveAppSettings`. It never called `StoreService.setCurrentStore` or `api.switchStoreDatabase`. Thus, the selected store from the catalog was never activated in Electron SQLite, leaving the active database uninitialized or detached.

8. **`src/components/OnboardingWizardView.tsx:136–140`**:
   ```typescript
   const [selectedStore, setSelectedStore] = useState({
     name: currentStore.name || '108120 SBX Warszawa Janki',
     unitCode: currentStore.unitCode || '18120',
     district: currentStore.district || 'Dystrykt Warszawa',
   });
   ```
   Pre-filled Step 2 with hardcoded Janki strings instead of checking catalog selection or requiring store validation.

9. **`src/services/storeService.ts:198–214` (`initStore()` method)**:
   ```typescript
   const current = this.getCurrentStore();
   if (apiObj?.switchStoreDatabase) {
     await apiObj.switchStoreDatabase({ storeId: current.id, ... });
   }
   ```
   When `localStorage` was empty, `getCurrentStore()` fell back to `DEFAULT_STORE_ID = '108120'`, immediately triggering a switch to Janki and creating Janki files before onboarding even started.

---

### 1.2 Observations on Feature F5 (Parameterized Electron SQL & Importers)

1. **`electron/main.ts:526–532` (`db:get-actual-hours-for-month`)**:
   ```typescript
   SELECT week_key, SUM(computable_time) as total_hours
   FROM labor_actuals_log
   WHERE week_key LIKE ?
     AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
   GROUP BY week_key
   ```
   Hardcoded filter for unit codes `18120` and `384`. Any other store (e.g. Unit 323 Nowy Świat) returns 0 hours.

2. **`electron/main.ts:597–604` (`db:get-daily-actual-hours-map`)**:
   ```typescript
   SELECT date, SUM(computable_time) as total_hours
   FROM labor_actuals_log
   WHERE (date LIKE ? OR date LIKE ?)
     AND computable_time > 0
     AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
   GROUP BY date
   ```
   Identical hardcoded filter ignoring non-Janki store units.

3. **`electron/main.ts:799` (`db:save-floor-rules`)**:
   ```typescript
   db.run(`UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18120' OR store_code = '384'`, [weeklySum]);
   ```
   Hardcoded update filter that fails to update the active store's floor hours if its store code is not 18120 or 384.

4. **`electron/main.ts:856–862` (`db:get-day-of-week-stats`)**:
   ```typescript
   SELECT day_of_week, SUM(computable_time) as total_hours, COUNT(DISTINCT date) as days_count
   FROM labor_actuals_log
   WHERE computable_time > 0
     AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
   GROUP BY day_of_week
   ```
   Identical hardcoded filter.

5. **`electron/importer/mapalParser.ts:169–178` & `universalReportParser.ts:563–571`**:
   ```typescript
   const isJanki = unitName.includes('108120') || 
                   unitName.includes('18120') ||
                   unitName.toLowerCase().includes('janki') || 
                   unitCode.includes('18120') ||
                   unitCode.includes('384');
   ...
   if (!isJanki && !isManager) continue;
   ```
   Rows from MAPAL are filtered strictly against Janki identifiers. When importing MAPAL files for other stores, all barista rows are dropped (`isJanki === false`).

6. **`electron/importer/mapalParser.ts:254–255` & `universalReportParser.ts:648–649`**:
   Rows without unit code default to `'18120'` and `'108120 SBX Warszawa Janki'`.

7. **`electron/importer/mapalParser.ts:275–302` & `universalReportParser.ts:872–886`**:
   SQL queries for counts, idempotency deletes, and support shift filtering hardcode `WHERE (unit_code = '18120' OR unit_code = '384' ...)`.

8. **`electron/importer/universalReportParser.ts:1312`**:
   ```typescript
   let detectedStoreName = '108120 SBX Warszawa Janki';
   ```
   Fallback store name hardcoded to Janki if sheet cell is missing.

---

## 2. Logic Chain

1. **Premise 1**: On a clean launch (Requirement R1), the app must prompt the user with the onboarding wizard to pick a store from the catalog rather than assuming store 108120 Janki.
2. **Premise 2**: In `db.ts`, when `active_store.json` was missing, `DatabaseManager` defaulted `currentStoreId` to `'108120_janki'`, opened `tplh_forecast.db`, and ran `seedInitialData()`. This populated `aop_plans` with 180 months of Janki data and wrote `sbx_onboarding_completed: 'true'`.
3. **Premise 3**: In `electron/main.ts:174` and `src/App.tsx:78`, `hasCompletedOnboarding` evaluated to `true` whenever `hasData` was `true`. Because of Premise 2, `hasData` was always `true`, completely suppressing `OnboardingWizardView`.
4. **Premise 4**: In `StoreService.ts:198`, on startup, `initStore()` called `switchStoreDatabase` with fallback store `'108120'`, and `seedNewStoreData()` in `db.ts:341` unconditionally marked `sbx_onboarding_completed: 'true'`.
5. **Inference 1**: To restore a clean onboarding flow on fresh launch (Feature F4):
   - `DatabaseManager.currentStoreId` must initialize to `''` when `active_store.json` is missing.
   - `DatabaseManager.init()` must NOT call `seedInitialData()` or set onboarding flags when `currentStoreId` is empty.
   - `hasExistingData()` must return `false` when no store is configured.
   - `app:get-settings` in `main.ts` and `checkOnboardingState()` in `App.tsx` must require `hasStore` and `isCompleted === true`, eliminating `|| hasData`.
   - `seedNewStoreData()` must NOT set `onboarding_completed: 'true'`.
   - `StoreService.initStore()` must NOT switch to a default store unless `hasConfiguredStore()` is true.
   - Completing `OnboardingWizardView` in `App.tsx` must activate the chosen store via `StoreService.setCurrentStore(chosenStore)` and then persist `onboarding_completed: 'true'`.
6. **Premise 5**: In `electron/main.ts` and parser files, four SQL queries and row matchers hardcode `18120` and `384`.
7. **Inference 2**: To parameterize SQL and importers (Feature F5):
   - `DatabaseManager` must expose `getActiveStoreIdentifiers()` returning `{ unitCode, mpk, storeName }`.
   - In `main.ts`, the four SQL queries must bind dynamically to `unitCode`, `mpk`, and `storeLike`.
   - In `mapalParser.ts` and `universalReportParser.ts`, `isJanki` must be replaced with `isStoreMatch` checking row attributes against `activeUnitCode`, `activeMpk`, and `activeStoreName`, and all SQL delete/count queries must bind these parameters.

---

## 3. Caveats

- **Legacy Database Migration**: The existing `tplh_forecast.db` contains real historical records for Store 108120. When an existing installation has `active_store.json` pointing to `108120`, it continues opening `tplh_forecast.db` as expected. In Milestone 2 (Feature F6), uniform renaming to `store_${id}.db` will handle physical file migration.
- **Support Shifts Across Units**: In Starbucks operations, managers from Store A may work support shifts (SAM/SPM) at Store B. The parameterized logic in `main.ts` and importers correctly distinguishes between coverage hours worked at the active store (which count towards floor hours) and foreign support shifts worked by the store's managers elsewhere.
- **AmRest AmEmail Regex**: In `OnboardingWizardView`, the email validation regex `/^[a-zA-Z0-9._%+-]+@amrest\.eu$/i` is maintained as requested by business rules.

---

## 4. Conclusion & Implementation Instructions for Worker

Below are the exact, file-by-file code modification instructions for the Worker to implement Features F4 and F5.

---

### 4.1 Feature F4: Clean Launch Store Onboarding Wizard

#### Modification 1: `electron/database/db.ts`
**Target File**: `/Users/dawidapel/COL Tool/electron/database/db.ts`

1. **Eliminate default `'108120_janki'` in class definition**:
   - *Line 79*:
     ```typescript
     // BEFORE:
     private currentStoreId: string = '108120_janki';

     // AFTER:
     private currentStoreId: string = '';
     ```

2. **Clean constructor initialization**:
   - *Lines 97–103*:
     ```typescript
     // BEFORE:
     // Odczytaj zapisaną aktywną kawiarnię (jeśli istnieje)
     const meta = this.loadActiveStoreMeta();
     if (meta?.storeId) {
       this.currentStoreId = meta.storeId;
     }
     this.dbFilePath = this.computeDbFilePath(this.currentStoreId, meta?.storeInfo);

     // AFTER:
     // Odczytaj zapisaną aktywną kawiarnię (jeśli istnieje)
     const meta = this.loadActiveStoreMeta();
     if (meta?.storeId) {
       this.currentStoreId = meta.storeId;
       this.dbFilePath = this.computeDbFilePath(this.currentStoreId, meta?.storeInfo);
     } else {
       this.currentStoreId = '';
       this.dbFilePath = '';
     }
     ```

3. **Safe, clean `init()` without auto-seeding Janki data or auto-forcing onboarding flag**:
   - *Lines 112–144*:
     ```typescript
     // BEFORE:
     public async init(): Promise<Database> {
       if (this.db) return this.db;

       this.SQL = await initSqlJs();

       if (fs.existsSync(this.dbFilePath)) {
         const fileBuffer = fs.readFileSync(this.dbFilePath);
         this.db = new this.SQL.Database(fileBuffer);
         console.log('📦 Załadowano istniejącą bazę SQLite z pliku:', this.dbFilePath);
         this.createSchema();

         // Jeśli baza zawiera już dane, upewnij się że flaga onboarding_completed jest zapisana w SQLite
         if (this.hasExistingData()) {
           const currentSettings = this.getAppSettings();
           if (currentSettings['sbx_onboarding_completed'] !== 'true') {
             this.setAppSettings({
               sbx_onboarding_completed: 'true',
               onboarding_completed: 'true',
               store_name: currentSettings['store_name'] || '108120 SBX Warszawa Janki',
               unit_code: currentSettings['unit_code'] || '18120',
             });
             console.log('✅ Zabezpieczono flagę onboarding_completed w SQLite na bazie istniejących danych.');
           }
         }
       } else {
         this.db = new this.SQL.Database();
         console.log('🆕 Utworzono nową bazę SQLite w pamięci.');
         this.createSchema();
         this.seedInitialData();
         this.persist();
       }

       return this.db!;
     }

     // AFTER:
     public async init(): Promise<Database> {
       if (this.db) return this.db;

       this.SQL = await initSqlJs();

       // Świeży start bez aktywnej kawiarni (Clean Launch) -> czysta baza w pamięci, oczekiwanie na kreator
       if (!this.currentStoreId || !this.dbFilePath) {
         this.db = new this.SQL.Database();
         this.createSchema();
         console.log('🆕 [Clean Launch] Zainicjalizowano czystą bazę SQLite w pamięci — oczekiwanie na OnboardingWizard.');
         return this.db!;
       }

       if (fs.existsSync(this.dbFilePath)) {
         const fileBuffer = fs.readFileSync(this.dbFilePath);
         this.db = new this.SQL.Database(fileBuffer);
         console.log('📦 Załadowano istniejącą bazę SQLite dla kawiarni [' + this.currentStoreId + '] z:', this.dbFilePath);
         this.createSchema();
       } else {
         this.db = new this.SQL.Database();
         console.log('🆕 Utworzono nową bazę SQLite dla kawiarni:', this.currentStoreId);
         this.createSchema();
         this.seedNewStoreData();
         this.persist();
       }

       return this.db!;
     }
     ```

4. **Do NOT set onboarding flags in `seedNewStoreData()`, but ensure standard catalogs are seeded**:
   - *Lines 335–346*:
     ```typescript
     // BEFORE:
     this.setAppSettings({
       store_name: storeName,
       unit_code: unitCode,
       store_mpk: storeMpk,
       store_city: storeCity,
       store_district: storeDistrict,
       sbx_onboarding_completed: 'true',
       onboarding_completed: 'true',
     });

     console.log(`✅ [Nowa Kawiarnia] Skonfigurowano app_settings dla: ${storeName} (Kod: ${unitCode})`);

     // AFTER:
     this.setAppSettings({
       store_name: storeName,
       unit_code: unitCode,
       store_mpk: storeMpk,
       store_city: storeCity,
       store_district: storeDistrict,
     });

     // Zapewnij uniwersalne definicje zmian i normy KP bez mockowych grafików i pracowników
     this.ensureShiftDefinitions();
     this.seedMonthlyNorms();

     console.log(`✅ [Nowa Kawiarnia] Skonfigurowano app_settings dla: ${storeName} (Kod: ${unitCode})`);
     ```

5. **Accurate `hasExistingData()`, `hasActiveStore()`, and `getActiveStoreIdentifiers()`**:
   - *Lines 422–453*:
     ```typescript
     // BEFORE:
     public hasExistingData(): boolean {
       if (!this.db) return false;
       try {
         const settings = this.getAppSettings();
         if (settings['sbx_onboarding_completed'] === 'true' || settings['onboarding_completed'] === 'true') {
           return true;
         }

         // Sprawdzenie planów AOP
         const aopRes = this.db.exec('SELECT COUNT(*) FROM aop_plans');
         if (aopRes.length > 0 && aopRes[0].values.length > 0) {
           if (Number(aopRes[0].values[0][0]) > 0) return true;
         }

         // Sprawdzenie zmian w grafiku
         const mgrRes = this.db.exec('SELECT COUNT(*) FROM manager_schedule_shifts');
         if (mgrRes.length > 0 && mgrRes[0].values.length > 0) {
           if (Number(mgrRes[0].values[0][0]) > 0) return true;
         }

         // Sprawdzenie składu menedżerskiego
         const rosterRes = this.db.exec('SELECT COUNT(*) FROM manager_monthly_roster');
         if (rosterRes.length > 0 && rosterRes[0].values.length > 0) {
           if (Number(rosterRes[0].values[0][0]) > 0) return true;
         }

         return false;
       } catch (err) {
         console.error('Błąd weryfikacji hasExistingData:', err);
         return false;
       }
     }

     // AFTER:
     public hasActiveStore(): boolean {
       return Boolean(this.currentStoreId && this.currentStoreId.trim().length > 0);
     }

     public getActiveStoreIdentifiers(): { unitCode: string; mpk: string; storeName: string } {
       const meta = this.loadActiveStoreMeta();
       const settings = this.getAppSettings();
       const unitCode = meta?.storeInfo?.unitCode || settings['unit_code'] || '';
       const mpk = meta?.storeInfo?.mpk || settings['store_mpk'] || '';
       const storeName = meta?.storeInfo?.name || settings['store_name'] || '';
       return { unitCode, mpk, storeName };
     }

     public hasExistingData(): boolean {
       if (!this.db || !this.hasActiveStore()) return false;
       try {
         const aopRes = this.db.exec('SELECT COUNT(*) FROM aop_plans');
         if (aopRes.length > 0 && aopRes[0].values.length > 0) {
           if (Number(aopRes[0].values[0][0]) > 0) return true;
         }

         const mgrRes = this.db.exec('SELECT COUNT(*) FROM manager_schedule_shifts');
         if (mgrRes.length > 0 && mgrRes[0].values.length > 0) {
           if (Number(mgrRes[0].values[0][0]) > 0) return true;
         }

         const rosterRes = this.db.exec('SELECT COUNT(*) FROM manager_monthly_roster');
         if (rosterRes.length > 0 && rosterRes[0].values.length > 0) {
           if (Number(rosterRes[0].values[0][0]) > 0) return true;
         }

         return false;
       } catch (err) {
         console.error('Błąd weryfikacji hasExistingData:', err);
         return false;
       }
     }
     ```

---

#### Modification 2: `electron/main.ts`
**Target File**: `/Users/dawidapel/COL Tool/electron/main.ts`

- *Lines 168–181 (`app:get-settings`)*:
  ```typescript
  // BEFORE:
  ipcMain.handle('app:get-settings', () => {
    const settings = dbManager.getAppSettings();
    const hasData = dbManager.hasExistingData();
    const hasCompletedOnboarding =
      settings['sbx_onboarding_completed'] === 'true' ||
      settings['onboarding_completed'] === 'true' ||
      hasData;

    return {
      settings,
      hasCompletedOnboarding,
      hasExistingData: hasData,
    };
  });

  // AFTER:
  ipcMain.handle('app:get-settings', () => {
    const settings = dbManager.getAppSettings();
    const hasStore = dbManager.hasActiveStore();
    const hasData = dbManager.hasExistingData();
    const hasCompletedOnboarding =
      hasStore &&
      (settings['sbx_onboarding_completed'] === 'true' ||
       settings['onboarding_completed'] === 'true');

    return {
      settings,
      hasCompletedOnboarding: Boolean(hasCompletedOnboarding),
      hasExistingData: hasData,
    };
  });
  ```

---

#### Modification 3: `src/App.tsx`
**Target File**: `/Users/dawidapel/COL Tool/src/App.tsx`

1. **Strict onboarding check in `checkOnboardingState()`**:
   - *Line 78*:
     ```typescript
     // BEFORE:
     if (isCompleted || hasExistingData) {
       setHasCompletedOnboarding(true);

     // AFTER:
     if (isCompleted) {
       setHasCompletedOnboarding(true);
     ```

2. **Clean database initialization upon onboarding completion**:
   - *Lines 486–515*:
     ```typescript
     // BEFORE:
     <OnboardingWizardView
       onComplete={(config) => {
         try {
           localStorage.setItem('sbx_onboarding_completed', 'true');
           localStorage.setItem('sbx_store_name', config.storeName);
           localStorage.setItem('sbx_unit_code', config.unitCode);
           localStorage.setItem('sbx_user_name', config.userName);
           localStorage.setItem('sbx_user_role', config.role);
           localStorage.setItem('sbx_user_email', config.userEmail);
         } catch {}

         const apiObj = (window as any).api || (window as any).electronAPI;
         if (apiObj?.saveAppSettings) {
           apiObj.saveAppSettings({
             sbx_onboarding_completed: 'true',
             onboarding_completed: 'true',
             store_name: config.storeName,
             unit_code: config.unitCode,
             user_name: config.userName,
             user_role: config.role,
             user_email: config.userEmail,
           }).catch(console.error);
         }

         setLoggedInUser(config.userName ? `${config.userName} (${config.role.replace(/[^A-Z]/g, '')})` : config.role);
         setHasCompletedOnboarding(true);
         setIsLoggedIn(true);
         setActiveModule('dashboard');
         loadMonthData();

     // AFTER:
     <OnboardingWizardView
       onComplete={async (config) => {
         // 1. Zidentyfikuj i przełącz aktywną kawiarnię (co inicjalizuje dedykowaną bazę store_${id}.db)
         const allStores = StoreService.getAllStores();
         const chosenStore = allStores.find(
           (s) => s.unitCode === config.unitCode || s.name === config.storeName
         ) || {
           id: config.unitCode || 'custom_store',
           name: config.storeName,
           shortName: config.storeName.replace(/^108\d{3}\s*/, '').replace(/^SBX\s*/, ''),
           unitCode: config.unitCode,
           mpk: config.unitCode,
           city: 'Polska',
           district: 'Dystrykt Starbucks',
           address: '',
           type: 'Mall',
         };

         await StoreService.setCurrentStore(chosenStore);

         // 2. Trwale zapisz flagę zakończenia onboardingu i dane użytkownika
         try {
           localStorage.setItem('sbx_onboarding_completed', 'true');
           localStorage.setItem('sbx_store_name', config.storeName);
           localStorage.setItem('sbx_unit_code', config.unitCode);
           localStorage.setItem('sbx_user_name', config.userName);
           localStorage.setItem('sbx_user_role', config.role);
           localStorage.setItem('sbx_user_email', config.userEmail);
         } catch {}

         const apiObj = (window as any).api || (window as any).electronAPI;
         if (apiObj?.saveAppSettings) {
           await apiObj.saveAppSettings({
             sbx_onboarding_completed: 'true',
             onboarding_completed: 'true',
             store_name: config.storeName,
             unit_code: config.unitCode,
             store_mpk: chosenStore.mpk,
             store_city: chosenStore.city,
             store_district: chosenStore.district,
             user_name: config.userName,
             user_role: config.role,
             user_email: config.userEmail,
           }).catch(console.error);
         }

         setLoggedInUser(config.userName ? `${config.userName} (${config.role.replace(/[^A-Z]/g, '')})` : config.role);
         setHasCompletedOnboarding(true);
         setIsLoggedIn(true);
         setActiveModule('dashboard');
         loadMonthData();
     ```

---

#### Modification 4: `src/components/OnboardingWizardView.tsx`
**Target File**: `/Users/dawidapel/COL Tool/src/components/OnboardingWizardView.tsx`

1. **Remove hardcoded Janki fallback**:
   - *Lines 136–140*:
     ```typescript
     // BEFORE:
     const [selectedStore, setSelectedStore] = useState({
       name: currentStore.name || '108120 SBX Warszawa Janki',
       unitCode: currentStore.unitCode || '18120',
       district: currentStore.district || 'Dystrykt Warszawa',
     });

     // AFTER:
     const [selectedStore, setSelectedStore] = useState(() => {
       if (currentStore?.name && currentStore?.unitCode) {
         return {
           name: currentStore.name,
           unitCode: currentStore.unitCode,
           district: currentStore.district || 'Dystrykt Starbucks',
         };
       }
       const initialStore = STARBUCKS_STORES_CATALOG[0];
       return {
         name: initialStore?.name || '',
         unitCode: initialStore?.unitCode || '',
         district: initialStore?.district || '',
       };
     });
     ```

2. **Validate store selection in Step 2**:
   - *Line 149*:
     ```typescript
     // BEFORE:
     const isStep2Valid = isNameValid && isEmailValid;

     // AFTER:
     const isStoreValid = Boolean(selectedStore.name && selectedStore.unitCode);
     const isStep2Valid = isNameValid && isEmailValid && isStoreValid;
     ```

---

#### Modification 5: `src/services/storeService.ts`
**Target File**: `/Users/dawidapel/COL Tool/src/services/storeService.ts`

1. **Add `hasConfiguredStore()`**:
   ```typescript
   public static hasConfiguredStore(): boolean {
     try {
       const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY);
       const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY);
       const isOnboarded = localStorage.getItem('sbx_onboarding_completed') === 'true';
       return Boolean((savedName || savedUnitCode) && isOnboarded);
     } catch {
       return false;
     }
   }
   ```

2. **Prevent premature switch on clean startup**:
   - *Lines 197–214 in `initStore()`*:
     ```typescript
     // BEFORE:
     // 2. Synchronizacja aktywnej bazy kawiarni przy starcie
     const current = this.getCurrentStore();
     if (apiObj?.switchStoreDatabase) {
       try {
         await apiObj.switchStoreDatabase({
           storeId: current.id,
           storeInfo: {
             name: current.name,
             unitCode: current.unitCode,
             mpk: current.mpk,
             city: current.city,
             district: current.district,
           },
         });
       } catch (err) {
         console.warn('Błąd synchronizacji bazy kawiarni przy starcie:', err);
       }
     }

     // AFTER:
     // 2. Synchronizacja bazy tylko jeśli użytkownik skonfigurował już kawiarnię (po onboarding)
     if (this.hasConfiguredStore() && apiObj?.switchStoreDatabase) {
       const current = this.getCurrentStore();
       try {
         await apiObj.switchStoreDatabase({
           storeId: current.id,
           storeInfo: {
             name: current.name,
             unitCode: current.unitCode,
             mpk: current.mpk,
             city: current.city,
             district: current.district,
           },
         });
       } catch (err) {
         console.warn('Błąd synchronizacji bazy kawiarni przy starcie:', err);
       }
     }
     ```

---

### 4.2 Feature F5: Parameterized Electron SQL & Importers

#### Modification 6: `electron/main.ts`
**Target File**: `/Users/dawidapel/COL Tool/electron/main.ts`

1. **`db:get-actual-hours-for-month`**:
   - *Lines 522–541*:
     ```typescript
     // BEFORE:
     ipcMain.handle('db:get-actual-hours-for-month', (_event, year: number, month: string) => {
       const db = dbManager.getDb();
       const pattern = `${year}_${month}_%`;
       const stmt = db.prepare(`
         SELECT week_key, SUM(computable_time) as total_hours
         FROM labor_actuals_log
         WHERE week_key LIKE ?
           AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
         GROUP BY week_key
       `);
       stmt.bind([pattern]);
       const hoursMap: Record<string, number> = {};
       while (stmt.step()) {
         const row = stmt.getAsObject();
         hoursMap[String(row.week_key)] = Number(row.total_hours);
       }
       stmt.free();
       return hoursMap;
     });

     // AFTER:
     ipcMain.handle('db:get-actual-hours-for-month', (_event, year: number, month: string) => {
       const db = dbManager.getDb();
       const pattern = `${year}_${month}_%`;
       const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
       const storeLike = `%${mpk || unitCode}%`;
       const stmt = db.prepare(`
         SELECT week_key, SUM(computable_time) as total_hours
         FROM labor_actuals_log
         WHERE week_key LIKE ?
           AND (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
         GROUP BY week_key
       `);
       stmt.bind([pattern, unitCode, mpk, storeLike]);
       const hoursMap: Record<string, number> = {};
       while (stmt.step()) {
         const row = stmt.getAsObject();
         hoursMap[String(row.week_key)] = Number(row.total_hours);
       }
       stmt.free();
       return hoursMap;
     });
     ```

2. **`db:get-daily-actual-hours-map`**:
   - *Lines 591–613*:
     ```typescript
     // BEFORE:
     ipcMain.handle('db:get-daily-actual-hours-map', (_event, year: number, monthNum: number) => {
       const db = dbManager.getDb();
       const monthPattern = `${year}-${String(monthNum).padStart(2, '0')}-%`;
       const dotPattern = `%.${String(monthNum).padStart(2, '0')}.${year}%`;
       const hoursMap: Record<string, number> = {};
       try {
         const stmt = db.prepare(`
           SELECT date, SUM(computable_time) as total_hours
           FROM labor_actuals_log
           WHERE (date LIKE ? OR date LIKE ?)
             AND computable_time > 0
             AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
           GROUP BY date
         `);
         stmt.bind([monthPattern, dotPattern]);
         while (stmt.step()) {
           const row = stmt.getAsObject();
           hoursMap[String(row.date)] = Number(Number(row.total_hours).toFixed(1));
         }
         stmt.free();
       } catch (_) {}
       return hoursMap;
     });

     // AFTER:
     ipcMain.handle('db:get-daily-actual-hours-map', (_event, year: number, monthNum: number) => {
       const db = dbManager.getDb();
       const monthPattern = `${year}-${String(monthNum).padStart(2, '0')}-%`;
       const dotPattern = `%.${String(monthNum).padStart(2, '0')}.${year}%`;
       const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
       const storeLike = `%${mpk || unitCode}%`;
       const hoursMap: Record<string, number> = {};
       try {
         const stmt = db.prepare(`
           SELECT date, SUM(computable_time) as total_hours
           FROM labor_actuals_log
           WHERE (date LIKE ? OR date LIKE ?)
             AND computable_time > 0
             AND (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
           GROUP BY date
         `);
         stmt.bind([monthPattern, dotPattern, unitCode, mpk, storeLike]);
         while (stmt.step()) {
           const row = stmt.getAsObject();
           hoursMap[String(row.date)] = Number(Number(row.total_hours).toFixed(1));
         }
         stmt.free();
       } catch (_) {}
       return hoursMap;
     });
     ```

3. **`db:save-floor-rules`**:
   - *Line 799*:
     ```typescript
     // BEFORE:
     db.run(`UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18120' OR store_code = '384'`, [weeklySum]);

     // AFTER:
     const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
     db.run(
       `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = ? OR store_code = ? OR store_code IS NULL OR store_code = ''`,
       [weeklySum, unitCode, mpk]
     );
     ```

4. **`db:get-day-of-week-stats`**:
   - *Lines 854–874*:
     ```typescript
     // BEFORE:
     ipcMain.handle('db:get-day-of-week-stats', () => {
       const db = dbManager.getDb();
       const stmt = db.prepare(`
         SELECT day_of_week, SUM(computable_time) as total_hours, COUNT(DISTINCT date) as days_count
         FROM labor_actuals_log
         WHERE computable_time > 0
           AND (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%' OR unit_code IS NULL OR unit_code = '')
         GROUP BY day_of_week
       `);
       const stats: any[] = [];
       while (stmt.step()) {
         const row = stmt.getAsObject();
         stats.push({
           day_of_week: String(row.day_of_week),
           total_hours: Number(row.total_hours),
           days_count: Number(row.days_count),
         });
       }
       stmt.free();
       return stats;
     });

     // AFTER:
     ipcMain.handle('db:get-day-of-week-stats', () => {
       const db = dbManager.getDb();
       const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
       const storeLike = `%${mpk || unitCode}%`;
       const stmt = db.prepare(`
         SELECT day_of_week, SUM(computable_time) as total_hours, COUNT(DISTINCT date) as days_count
         FROM labor_actuals_log
         WHERE computable_time > 0
           AND (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
         GROUP BY day_of_week
       `);
       stmt.bind([unitCode, mpk, storeLike]);
       const stats: any[] = [];
       while (stmt.step()) {
         const row = stmt.getAsObject();
         stats.push({
           day_of_week: String(row.day_of_week),
           total_hours: Number(row.total_hours),
           days_count: Number(row.days_count),
         });
       }
       stmt.free();
       return stats;
     });
     ```

---

#### Modification 7: `electron/importer/mapalParser.ts`
**Target File**: `/Users/dawidapel/COL Tool/electron/importer/mapalParser.ts`

1. **Active store matching & parameterization**:
   - *Lines 165–178*:
     ```typescript
     // BEFORE:
     const unitName = String(row[14] || '');
     const unitCode = String(row[13] || '');
     const empName = String(row[2] || '').trim();

     const isJanki = unitName.includes('108120') || 
                     unitName.includes('18120') ||
                     unitName.toLowerCase().includes('janki') || 
                     unitCode.includes('18120') ||
                     unitCode.includes('384');

     const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

     // Uwzględniamy wszystkie logowania z lokalu Janki ORAZ logowania naszych menedżerów z dowolnych lokali
     if (!isJanki && !isManager) continue;

     // AFTER:
     const { unitCode: activeUnitCode, mpk: activeMpk, storeName: activeStoreName } = dbManager.getActiveStoreIdentifiers();
     const cleanActiveName = activeStoreName ? activeStoreName.toLowerCase().replace(/^108\d{3}\s*/, '').replace(/^sbx\s*/i, '').trim() : '';

     const unitName = String(row[14] || '');
     const unitCode = String(row[13] || '');
     const empName = String(row[2] || '').trim();

     const isStoreMatch = Boolean(
       (activeUnitCode && (unitCode === activeUnitCode || unitCode.includes(activeUnitCode) || activeUnitCode.includes(unitCode))) ||
       (activeMpk && (unitName.includes(activeMpk) || unitCode.includes(activeMpk))) ||
       (cleanActiveName && cleanActiveName.length >= 3 && unitName.toLowerCase().includes(cleanActiveName))
     );

     const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

     if (!isStoreMatch && !isManager) continue;
     ```

2. **Row defaults and error message**:
   - *Lines 254–265*:
     ```typescript
     // BEFORE:
           unit_code: unitCode || '18120',
           unit_name: unitName || '108120 SBX Warszawa Janki'
         });
       }

       if (validRecords.length === 0) {
         return {
           success: false,
           importedCount: 0,
           message: 'W wybranym raporcie nie znaleziono żadnych wpisów dla kawiarni 108120 SBX Warszawa Janki (kod: 18120).'
         };
       }

     // AFTER:
           unit_code: unitCode || activeUnitCode || activeMpk || '',
           unit_name: unitName || activeStoreName || ''
         });
       }

       if (validRecords.length === 0) {
         return {
           success: false,
           importedCount: 0,
           message: `W wybranym raporcie nie znaleziono żadnych wpisów dla kawiarni ${activeStoreName || 'aktywnej'} (kod: ${activeUnitCode || activeMpk || 'brak'}).`
         };
       }
     ```

3. **Parameterized count, delete, and support SQL**:
   - *Lines 274–305*:
     ```typescript
     // BEFORE:
         const countStmt = db.prepare(`
           SELECT COUNT(*) as cnt FROM labor_actuals_log 
           WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%')
             AND date >= ? AND date <= ?
         `);
         countStmt.bind([minDate, maxDate]);
         if (countStmt.step()) {
           const row = countStmt.getAsObject();
           previousCount = Number(row.cnt || 0);
         }
         countStmt.free();
       } catch (e) {
         console.warn('Nie udało się pobrać liczby poprzednich wpisów:', e);
       }

       // Idempotencja: usunięcie wcześniejszych wpisów dla lokalu Janki w danym przedziale dat
       const deleteStmt = db.prepare(`
         DELETE FROM labor_actuals_log 
         WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%')
           AND date >= ? AND date <= ?
       `);
       deleteStmt.run([minDate, maxDate]);
       deleteStmt.free();

       // Usunięcie również wpisów z obcych lokali dla menedżerów w tym przedziale dat
       const existingSupportStmt = db.prepare(`
         SELECT id, employee FROM labor_actuals_log
         WHERE unit_code != '18120' AND unit_code != '384' AND date >= ? AND date <= ?
       `);
       existingSupportStmt.bind([minDate, maxDate]);

     // AFTER:
         const storeFilter = `%${activeMpk || activeUnitCode}%`;
         const countStmt = db.prepare(`
           SELECT COUNT(*) as cnt FROM labor_actuals_log 
           WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
             AND date >= ? AND date <= ?
         `);
         countStmt.bind([activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
         if (countStmt.step()) {
           const row = countStmt.getAsObject();
           previousCount = Number(row.cnt || 0);
         }
         countStmt.free();
       } catch (e) {
         console.warn('Nie udało się pobrać liczby poprzednich wpisów:', e);
       }

       // Idempotencja: usunięcie wcześniejszych wpisów dla kawiarni w danym przedziale dat
       const storeFilter = `%${activeMpk || activeUnitCode}%`;
       const deleteStmt = db.prepare(`
         DELETE FROM labor_actuals_log 
         WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
           AND date >= ? AND date <= ?
       `);
       deleteStmt.run([activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
       deleteStmt.free();

       // Usunięcie również wpisów z obcych lokali dla menedżerów w tym przedziale dat
       const existingSupportStmt = db.prepare(`
         SELECT id, employee FROM labor_actuals_log
         WHERE (unit_code != ? AND unit_code != ? AND unit_name NOT LIKE ?) AND date >= ? AND date <= ?
       `);
       existingSupportStmt.bind([activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
     ```

---

#### Modification 8: `electron/importer/universalReportParser.ts`
**Target File**: `/Users/dawidapel/COL Tool/electron/importer/universalReportParser.ts`

1. **Active store matching**:
   - *Lines 563–572*:
     ```typescript
     // BEFORE:
     const isJanki = unitName.includes('108120') || 
                     unitName.includes('18120') ||
                     unitName.toLowerCase().includes('janki') || 
                     unitCode.includes('18120') ||
                     unitCode.includes('384');

     const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

     if (!isJanki && !isManager) continue;

     // AFTER:
     const dbManager = DatabaseManager.getInstance();
     const { unitCode: activeUnitCode, mpk: activeMpk, storeName: activeStoreName } = dbManager.getActiveStoreIdentifiers();
     const cleanActiveName = activeStoreName ? activeStoreName.toLowerCase().replace(/^108\d{3}\s*/, '').replace(/^sbx\s*/i, '').trim() : '';

     const isStoreMatch = Boolean(
       (activeUnitCode && (unitCode === activeUnitCode || unitCode.includes(activeUnitCode) || activeUnitCode.includes(unitCode))) ||
       (activeMpk && (unitName.includes(activeMpk) || unitCode.includes(activeMpk))) ||
       (cleanActiveName && cleanActiveName.length >= 3 && unitName.toLowerCase().includes(cleanActiveName))
     );

     const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

     if (!isStoreMatch && !isManager) continue;
     ```

2. **Row defaults and error messages**:
   - *Lines 648–665*:
     ```typescript
     // BEFORE:
           unit_code: unitCode || '18120',
           unit_name: unitName || '108120 SBX Warszawa Janki',
           is_manager: isManager
         });
       }

       if (records.length === 0) {
         return {
           success: false,
           reportType: 'MAPAL_FICHAJES',
           reportTypeName: 'Ewidencja MAPAL Fichajes',
           validation: {
             isValid: false,
             warnings: [],
             errors: ['W wybranym raporcie nie znaleziono żadnych wpisów dla lokalu Janki (18120) ani menedżerów.']
           },
           message: 'Nie znaleziono danych logowań dla kawiarni 108120 SBX Warszawa Janki.'
         };
       }

     // AFTER:
           unit_code: unitCode || activeUnitCode || activeMpk || '',
           unit_name: unitName || activeStoreName || '',
           is_manager: isManager
         });
       }

       if (records.length === 0) {
         return {
           success: false,
           reportType: 'MAPAL_FICHAJES',
           reportTypeName: 'Ewidencja MAPAL Fichajes',
           validation: {
             isValid: false,
             warnings: [],
             errors: [`W wybranym raporcie nie znaleziono żadnych wpisów dla lokalu ${activeStoreName || 'aktywnego'} (${activeUnitCode || activeMpk || ''}) ani menedżerów.`]
           },
           message: `Nie znaleziono danych logowań dla kawiarni ${activeStoreName || 'aktywnej'}.`
         };
       }
     ```

3. **Parameterized `commitMapalReport` delete query**:
   - *Lines 872–886*:
     ```typescript
     // BEFORE:
     if (managerNames.length > 0) {
       db.run(`
         DELETE FROM labor_actuals_log 
         WHERE date >= ? AND date <= ?
           AND (
             unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%'
             OR employee IN (${employeePlaceholders})
           )
       `, [minDate, maxDate, ...managerNames]);
     } else {
       db.run(`
         DELETE FROM labor_actuals_log 
         WHERE (unit_code = '18120' OR unit_code = '384' OR unit_name LIKE '%108120%' OR unit_name LIKE '%18120%')
           AND date >= ? AND date <= ?
       `, [minDate, maxDate]);
     }

     // AFTER:
     const storeFilter = `%${activeMpk || activeUnitCode}%`;
     if (managerNames.length > 0) {
       db.run(`
         DELETE FROM labor_actuals_log 
         WHERE date >= ? AND date <= ?
           AND (
             unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = ''
             OR employee IN (${employeePlaceholders})
           )
       `, [minDate, maxDate, activeUnitCode, activeMpk, storeFilter, ...managerNames]);
     } else {
       db.run(`
         DELETE FROM labor_actuals_log 
         WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
           AND date >= ? AND date <= ?
       `, [activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
     }
     ```

4. **Dynamic `detectedStoreName` in KPI report parser**:
   - *Line 1312*:
     ```typescript
     // BEFORE:
     let detectedStoreName = '108120 SBX Warszawa Janki';

     // AFTER:
     const { storeName: activeStoreName } = DatabaseManager.getInstance().getActiveStoreIdentifiers();
     let detectedStoreName = activeStoreName || 'Kawiarnia Starbucks';
     ```

---

## 5. Verification Method

To independently verify these implementation recommendations:

1. **Compiler & Bundler Integrity**:
   Execute:
   ```bash
   npm run build
   ```
   *Expected result*: Exit code 0, 0 TypeScript errors, bundle completes successfully.

2. **Clean Launch Simulation Verification**:
   - Temporarily backup and remove `data/active_store.json` and clear `localStorage` in browser/Electron dev tools.
   - Launch app or call `api.getAppSettings()`.
   - Verify `hasCompletedOnboarding` returns `false` and `hasExistingData` returns `false`.
   - Confirm that the app presents `OnboardingWizardView` instead of defaulting to Janki.

3. **Store Selection & Activation Verification**:
   - Complete the onboarding wizard selecting an arbitrary store from the catalog (e.g. `108004 Nowy Świat`, unit `323`).
   - Verify `StoreService.setCurrentStore` creates and connects to `data/store_108004.db` (or `store_323.db`).
   - Verify `app_settings` contains `store_name: '108004 SBX Warszawa Nowy Świat'`, `unit_code: '323'`, and `sbx_onboarding_completed: 'true'`.
   - Verify `aop_plans` has 0 rows (clean slate) and `manager_schedule_shifts` has 0 rows.

4. **Parameterized Query Verification**:
   - In SQLite for `store_108004.db`, insert sample rows with `unit_code = '323'` and `unit_code = '384'`.
   - Execute IPC `db:get-actual-hours-for-month`.
   - Confirm that only hours for `unit_code = '323'` are aggregated and that `384` rows are excluded.

5. **Importer Matcher Verification**:
   - Parse a MAPAL report containing mixed rows for units `323` and `384`.
   - Confirm that with Store 108004 active, rows for unit `323` are marked valid, while rows for foreign units are skipped unless belonging to active managers.
