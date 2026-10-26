# Handoff Report — Milestone 1 Iteration 2 Fix Strategy

**Agent**: `m1_retry_explorer_3`  
**Milestone**: Milestone 1 Iteration 2 (Audit, Mock Purge & Onboarding Hardening)  
**Parent**: `53bb484f-c139-4c15-89f6-7d840b96f7e4`  
**Scope**: Exact fix strategy for `App.tsx` `hasConfiguredStore` gating, `mapalParser.ts` deletion overreach & status string, and test suite execution pass.

---

## 1. Observation

### 1.1 `App.tsx` hasConfiguredStore Gating Inspection
1. **Initial State Declaration (`src/App.tsx:60-67`)**:
   ```tsx
   60:   const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(() => {
   61:     try {
   62:       if (localStorage.getItem('sbx_onboarding_completed') === 'true') {
   63:         return true;
   64:       }
   65:     } catch {}
   66:     return null;
   67:   });
   ```
   Directly inspects `sbx_onboarding_completed === 'true'` on mount, bypassing onboarding even if no store metadata is present in `localStorage`.

2. **Database Settings Sync (`src/App.tsx:77-101`)**:
   ```tsx
   77:           if (res && isMounted) {
   78:             const { settings, hasCompletedOnboarding: isCompleted, hasExistingData } = res;
   79:             if (isCompleted) {
   80:               setHasCompletedOnboarding(true);
   81:               try {
   82:                 localStorage.setItem('sbx_onboarding_completed', 'true');
   83:                 if (settings?.store_name) localStorage.setItem('sbx_store_name', settings.store_name);
   84:                 if (settings?.unit_code) localStorage.setItem('sbx_unit_code', settings.unit_code);
   ...
   ```
   Immediately sets `setHasCompletedOnboarding(true)` without verifying if a store is actually configured in the active environment via `StoreService.hasConfiguredStore()`.

3. **Fallback Evaluation (`src/App.tsx:107-113`)**:
   ```tsx
   107:       if (isMounted) {
   108:         try {
   109:           setHasCompletedOnboarding(localStorage.getItem('sbx_onboarding_completed') === 'true');
   110:         } catch {
   111:           setHasCompletedOnboarding(false);
   112:         }
   113:       }
   ```
   `StoreService.hasConfiguredStore()` was never invoked here. If `localStorage` retains `sbx_onboarding_completed: 'true'` without store identification, onboarding is completely bypassed.

4. **Implementation of `StoreService.hasConfiguredStore()` (`src/services/storeService.ts:41-50`)**:
   ```ts
   41:   public static hasConfiguredStore(): boolean {
   42:     try {
   43:       const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY);
   44:       const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY);
   45:       const isOnboarded = localStorage.getItem('sbx_onboarding_completed') === 'true';
   46:       return Boolean((savedName || savedUnitCode) && isOnboarded);
   47:     } catch {
   48:       return false;
   49:     }
   50:   }
   ```
   Lacks `.trim()` handling: if a key is stored as whitespace (e.g. `'   '`), `Boolean('   ')` evaluates to `true`.

---

### 1.2 `mapalParser.ts` & `universalReportParser.ts` Deletion Overreach & Status String
1. **Count & Deletion Overreach in `electron/importer/mapalParser.ts:277-299`**:
   ```ts
   277:         const countStmt = db.prepare(`
   278:           SELECT COUNT(*) as cnt FROM labor_actuals_log 
   279:           WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
   280:             AND date >= ? AND date <= ?
   281:         `);
   ...
   293:       const deleteStmt = db.prepare(`
   294:         DELETE FROM labor_actuals_log 
   295:         WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
   296:           AND date >= ? AND date <= ?
   297:       `);
   ```
   The predicate `OR unit_code IS NULL OR unit_code = ''` matches untagged or global actual records, resulting in wiping records across stores whenever any store imports MAPAL data.

2. **Deletion Overreach in `electron/importer/universalReportParser.ts:876-890`**:
   ```ts
   877:           DELETE FROM labor_actuals_log 
   878:           WHERE date >= ? AND date <= ?
   879:             AND (
   880:               unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = ''
   881:               OR employee IN (${employeePlaceholders})
   882:             )
   ...
   886:           DELETE FROM labor_actuals_log 
   887:           WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
   888:             AND date >= ? AND date <= ?
   ```
   Contains the identical dangerous predicate `OR unit_code IS NULL OR unit_code = ''`.

3. **Hardcoded Store Status String in `electron/importer/mapalParser.ts:348-351`**:
   ```ts
   348:       const message = previousCount > 0
   349:         ? `Pomyślnie zaktualizowano logowania: zastąpiono ${previousCount} dotychczasowych wpisów i zapisano ${validRecords.length} aktualnych rekordów dla kawiarni Janki (zakres: ${minDate} – ${maxDate}).`
   350:         : `Pomyślnie zaimportowano ${validRecords.length} nowych logowań dla kawiarni Janki w zakresie od ${minDate} do ${maxDate}.`;
   ```
   When importing actuals for Store 108144 (Złote Tarasy) or Store 108150 (Bonarka), the success message hardcodes `"dla kawiarni Janki"`.

---

### 1.3 Test Suite Execution & Inverted Adversarial Tests
1. **Current Test Run**:
   Command: `npx tsx --test "tests/e2e/**/*.test.ts"`
   Result: 266 pass, 3 fail (in `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts`):
   - `test_b19_col_calculator_empty_crew_zero_division_vulnerability` fails with `whatIfColSavings: NaN`.
   - `test_b19_col_bonus_sheet_no_hardcoded_financial_defaults` fails with hardcoded `310000`.
   - Suite `B19` fails due to its child failures.

2. **Inverted Defect Tests in `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts`**:
   Challenger 2 introduced tests asserting that the bugs exist:
   - Lines 335–340:
     ```ts
     const hasJankiHardcode = content.includes('dla kawiarni Janki');
     assert.equal(hasJankiHardcode, true, 'CRITICAL DEFECT CONFIRMED: ...');
     ```
   - Lines 455–460:
     ```ts
     const isDefective = Number.isNaN(res.whatIfColSavings) || !Number.isFinite(res.whatIfColSavings);
     assert.equal(isDefective, true, 'CONFIRMED DEFECT: ...');
     ```
   - Lines 467–472:
     ```ts
     const hasMockSalesAop = source.includes('useState<number>(310000)');
     assert.equal(hasMockSalesAop, true, 'CONFIRMED DEFECT: ...');
     ```
   When worker fixes `mapalParser.ts:349`, `colEngine.ts:302`, and `ColBonusSheet.tsx:5-8`, `b19` will pass, but `m1_stress_challenge.test.ts` will fail unless its assertions are updated to assert the fixed (resolved) state.

---

## 2. Logic Chain

1. **Gating Logic Chain**:
   - Observation 1.1.1 and 1.1.3 show `App.tsx` evaluates `localStorage.getItem('sbx_onboarding_completed') === 'true'`.
   - If a browser or test environment has the flag set without store data (`sbx_store_name` or `sbx_unit_code`), onboarding is skipped and the app boots with an empty store context (`{ name: '', unitCode: '' }`).
   - Using `StoreService.hasConfiguredStore()` at lines 62, 80, and 109 guarantees that onboarding is only treated as complete when both the completion flag AND valid store identity exist.
   - Adding `.trim()` in `StoreService.hasConfiguredStore()` (Observation 1.1.4) prevents whitespace-only bypasses.

2. **Deletion Query Isolation Chain**:
   - Observation 1.2.1 and 1.2.2 show that delete statements include `OR unit_code IS NULL OR unit_code = ''`.
   - In a multi-tenant / multi-store architecture, unassigned rows or generic records imported by one unit must never be deleted by another unit importing its data.
   - Removing `OR unit_code IS NULL OR unit_code = ''` scopes the delete statement strictly to `(unit_code = ? OR unit_code = ? OR unit_name LIKE ?)`, preserving database multi-store isolation.

3. **Status String Dynamic Binding Chain**:
   - Observation 1.2.3 shows `mapalParser.ts` hardcodes `"dla kawiarni Janki"`.
   - `dbManager.getActiveStoreIdentifiers()` provides `activeStoreName`.
   - Binding the message to `${activeStoreName || 'aktywnej kawiarni'}` ensures dynamic branding for all 100+ stores.

4. **Test Suite Pass Chain**:
   - Observation 1.3.1 and 1.3.2 show that fixing the code defects will fix B19, but will trigger assertion failures in `m1_stress_challenge.test.ts` because it explicitly asserts `hasJankiHardcode === true`, `isDefective === true`, and `hasMockSalesAop === true`.
   - Inverting those 3 assertions to expect `false` turns them into permanent regression tests and guarantees all 269 tests pass with exit code 0.

---

## 3. Caveats

- `StoreService.hasConfiguredStore()` relies on `localStorage`. In Electron production, `App.tsx` first queries `apiObj.getAppSettings()` which reads SQLite `app_settings` and writes them into `localStorage`. Therefore, `StoreService.hasConfiguredStore()` works seamlessly in both Electron and web preview modes.
- `universalReportParser.ts` also contains the `OR unit_code IS NULL OR unit_code = ''` deletion query at lines 880 and 887; it must be cleaned up in tandem with `mapalParser.ts`.

---

## 4. Conclusion & Concrete Fix Strategy

The implementer must apply the following exact modifications:

### A. `src/App.tsx` & `src/services/storeService.ts` (`hasConfiguredStore` Gating)

#### File: `src/App.tsx`
1. **Lines 60–67**:
   ```tsx
   <<<< PREVIOUS:
     const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(() => {
       try {
         if (localStorage.getItem('sbx_onboarding_completed') === 'true') {
           return true;
         }
       } catch {}
       return null;
     });
   ==== REPLACEMENT:
     const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(() => {
       try {
         if (StoreService.hasConfiguredStore()) {
           return true;
         }
       } catch {}
       return null;
     });
   >>>>
   ```

2. **Lines 78–101**:
   ```tsx
   <<<< PREVIOUS:
               const { settings, hasCompletedOnboarding: isCompleted, hasExistingData } = res;
               if (isCompleted) {
                 setHasCompletedOnboarding(true);
                 try {
                   localStorage.setItem('sbx_onboarding_completed', 'true');
                   if (settings?.store_name) localStorage.setItem('sbx_store_name', settings.store_name);
                   if (settings?.unit_code) localStorage.setItem('sbx_unit_code', settings.unit_code);
                   if (settings?.user_name) localStorage.setItem('sbx_user_name', settings.user_name);
                   if (settings?.user_role) localStorage.setItem('sbx_user_role', settings.user_role);
                   if (settings?.user_email) localStorage.setItem('sbx_user_email', settings.user_email);
                   if (settings?.sbx_tutorial_mode !== undefined) localStorage.setItem('sbx_tutorial_mode', settings.sbx_tutorial_mode);
                 } catch {}

                 if (settings?.user_name && settings?.user_role) {
                   setLoggedInUser(`${settings.user_name} (${settings.user_role.replace(/[^A-Z]/g, '')})`);
                 } else if (settings?.user_role) {
                   setLoggedInUser(settings.user_role);
                 }
                 return;
               } else {
                 setHasCompletedOnboarding(false);
                 return;
               }
   ==== REPLACEMENT:
               const { settings, hasCompletedOnboarding: isCompleted, hasExistingData } = res;
               if (isCompleted) {
                 try {
                   localStorage.setItem('sbx_onboarding_completed', 'true');
                   if (settings?.store_name) localStorage.setItem('sbx_store_name', settings.store_name);
                   if (settings?.unit_code) localStorage.setItem('sbx_unit_code', settings.unit_code);
                   if (settings?.user_name) localStorage.setItem('sbx_user_name', settings.user_name);
                   if (settings?.user_role) localStorage.setItem('sbx_user_role', settings.user_role);
                   if (settings?.user_email) localStorage.setItem('sbx_user_email', settings.user_email);
                   if (settings?.sbx_tutorial_mode !== undefined) localStorage.setItem('sbx_tutorial_mode', settings.sbx_tutorial_mode);
                 } catch {}

                 const isStoreConfigured = StoreService.hasConfiguredStore();
                 setHasCompletedOnboarding(isStoreConfigured);

                 if (isStoreConfigured) {
                   if (settings?.user_name && settings?.user_role) {
                     setLoggedInUser(`${settings.user_name} (${settings.user_role.replace(/[^A-Z]/g, '')})`);
                   } else if (settings?.user_role) {
                     setLoggedInUser(settings.user_role);
                   }
                 }
                 return;
               } else {
                 setHasCompletedOnboarding(false);
                 return;
               }
   >>>>
   ```

3. **Lines 107–113**:
   ```tsx
   <<<< PREVIOUS:
         if (isMounted) {
           try {
             setHasCompletedOnboarding(localStorage.getItem('sbx_onboarding_completed') === 'true');
           } catch {
             setHasCompletedOnboarding(false);
           }
         }
   ==== REPLACEMENT:
         if (isMounted) {
           try {
             setHasCompletedOnboarding(StoreService.hasConfiguredStore());
           } catch {
             setHasCompletedOnboarding(false);
           }
         }
   >>>>
   ```

#### File: `src/services/storeService.ts`
1. **Lines 41–50**:
   ```ts
   <<<< PREVIOUS:
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
   ==== REPLACEMENT:
     public static hasConfiguredStore(): boolean {
       try {
         const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY)?.trim();
         const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY)?.trim();
         const isOnboarded = localStorage.getItem('sbx_onboarding_completed') === 'true';
         return Boolean((savedName || savedUnitCode) && isOnboarded);
       } catch {
         return false;
       }
     }
   >>>>
   ```

---

### B. `electron/importer/mapalParser.ts` & `universalReportParser.ts` (Deletion Overreach & Status String)

#### File: `electron/importer/mapalParser.ts`
1. **Lines 277–282 (Count Query)**:
   ```ts
   <<<< PREVIOUS:
           const countStmt = db.prepare(`
             SELECT COUNT(*) as cnt FROM labor_actuals_log 
             WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
               AND date >= ? AND date <= ?
           `);
   ==== REPLACEMENT:
           const countStmt = db.prepare(`
             SELECT COUNT(*) as cnt FROM labor_actuals_log 
             WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ?)
               AND date >= ? AND date <= ?
           `);
   >>>>
   ```

2. **Lines 293–298 (Delete Query)**:
   ```ts
   <<<< PREVIOUS:
         const deleteStmt = db.prepare(`
           DELETE FROM labor_actuals_log 
           WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
             AND date >= ? AND date <= ?
         `);
   ==== REPLACEMENT:
         const deleteStmt = db.prepare(`
           DELETE FROM labor_actuals_log 
           WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ?)
             AND date >= ? AND date <= ?
         `);
   >>>>
   ```

3. **Lines 348–351 (Success Status Message)**:
   ```ts
   <<<< PREVIOUS:
         const message = previousCount > 0
           ? `Pomyślnie zaktualizowano logowania: zastąpiono ${previousCount} dotychczasowych wpisów i zapisano ${validRecords.length} aktualnych rekordów dla kawiarni Janki (zakres: ${minDate} – ${maxDate}).`
           : `Pomyślnie zaimportowano ${validRecords.length} nowych logowań dla kawiarni Janki w zakresie od ${minDate} do ${maxDate}.`;
   ==== REPLACEMENT:
         const targetStoreName = activeStoreName || 'aktywnej kawiarni';
         const message = previousCount > 0
           ? `Pomyślnie zaktualizowano logowania: zastąpiono ${previousCount} dotychczasowych wpisów i zapisano ${validRecords.length} aktualnych rekordów dla kawiarni ${targetStoreName} (zakres: ${minDate} – ${maxDate}).`
           : `Pomyślnie zaimportowano ${validRecords.length} nowych logowań dla kawiarni ${targetStoreName} w zakresie od ${minDate} do ${maxDate}.`;
   >>>>
   ```

#### File: `electron/importer/universalReportParser.ts`
1. **Lines 876–890 (Delete Query in commitMapalData)**:
   ```ts
   <<<< PREVIOUS:
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
   ==== REPLACEMENT:
         if (managerNames.length > 0) {
           db.run(`
             DELETE FROM labor_actuals_log 
             WHERE date >= ? AND date <= ?
               AND (
                 unit_code = ? OR unit_code = ? OR unit_name LIKE ?
                 OR employee IN (${employeePlaceholders})
               )
           `, [minDate, maxDate, activeUnitCode, activeMpk, storeFilter, ...managerNames]);
         } else {
           db.run(`
             DELETE FROM labor_actuals_log 
             WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ?)
               AND date >= ? AND date <= ?
           `, [activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
         }
   >>>>
   ```

---

### C. `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts` (Adversarial Regression Alignment)

1. **Lines 330–341 (Mapal Janki Hardcode Check)**:
   ```ts
   <<<< PREVIOUS:
       await t.test('test_legacy_mapal_parser_contains_janki_hardcode_in_success_message', () => {
         // Direct source inspection of electron/importer/mapalParser.ts lines 348-351
         const mapalParserPath = path.resolve(process.cwd(), 'electron/importer/mapalParser.ts');
         const content = fs.readFileSync(mapalParserPath, 'utf8');

         const hasJankiHardcode = content.includes('dla kawiarni Janki');
         assert.equal(
           hasJankiHardcode,
           true,
           'CRITICAL DEFECT CONFIRMED: electron/importer/mapalParser.ts contains hardcoded "dla kawiarni Janki" in lines 349-350'
         );
       });
   ==== REPLACEMENT:
       await t.test('test_legacy_mapal_parser_no_janki_hardcode_in_success_message', () => {
         // Direct source inspection of electron/importer/mapalParser.ts lines 348-351
         const mapalParserPath = path.resolve(process.cwd(), 'electron/importer/mapalParser.ts');
         const content = fs.readFileSync(mapalParserPath, 'utf8');

         const hasJankiHardcode = content.includes('dla kawiarni Janki');
         assert.equal(
           hasJankiHardcode,
           false,
           'RESOLVED: electron/importer/mapalParser.ts must not contain hardcoded "dla kawiarni Janki"'
         );
       });
   >>>>
   ```

2. **Lines 444–461 (ColEngine Zero Division Check)**:
   ```ts
   <<<< PREVIOUS:
         const isDefective = Number.isNaN(res.whatIfColSavings) || !Number.isFinite(res.whatIfColSavings);
         assert.equal(
           isDefective,
           true,
           'CONFIRMED DEFECT: ColEngine produces NaN on crewHoursPlan=0 when managers are scheduled'
         );
   ==== REPLACEMENT:
         const isDefective = Number.isNaN(res.whatIfColSavings) || !Number.isFinite(res.whatIfColSavings);
         assert.equal(
           isDefective,
           false,
           'RESOLVED: ColEngine must produce finite numbers on crewHoursPlan=0 when managers are scheduled'
         );
   >>>>
   ```

3. **Lines 463–474 (ColBonusSheet Mock Numbers Check)**:
   ```ts
   <<<< PREVIOUS:
         const hasMockSalesAop = source.includes('useState<number>(310000)');
         assert.equal(
           hasMockSalesAop,
           true,
           'CONFIRMED DEFECT: ColBonusSheet.tsx contains hardcoded 310000 salesAop mock default'
         );
   ==== REPLACEMENT:
         const hasMockSalesAop = source.includes('useState<number>(310000)');
         assert.equal(
           hasMockSalesAop,
           false,
           'RESOLVED: ColBonusSheet.tsx must not contain hardcoded 310000 salesAop mock default'
         );
   >>>>
   ```

#### File: `tests/e2e/tier1-feature-coverage/f04_onboarding_wizard.test.ts`
Add an authentic test verifying `StoreService.hasConfiguredStore()` gating:
```ts
  await t.test('test_f04_has_configured_store_requires_both_store_identity_and_flag', () => {
    const vStorage = new VirtualLocalStorage();
    (globalThis as any).localStorage = vStorage;

    // Case 1: Flag true, but no store
    vStorage.setItem('sbx_onboarding_completed', 'true');
    assert.equal(StoreService.hasConfiguredStore(), false, 'Flag alone without store metadata must not pass');

    // Case 2: Store present, but flag false
    vStorage.clear();
    vStorage.setItem('sbx_store_name', '108160 SBX Wrocław Wroclavia');
    vStorage.setItem('sbx_unit_code', '18160');
    vStorage.setItem('sbx_onboarding_completed', 'false');
    assert.equal(StoreService.hasConfiguredStore(), false, 'Store alone without onboarding completion must not pass');

    // Case 3: Both present
    vStorage.setItem('sbx_onboarding_completed', 'true');
    assert.equal(StoreService.hasConfiguredStore(), true, 'Both store and completion flag must pass');
  });
```

---

## 5. Verification Method

To independently verify this strategy after implementation:

1. **Test Suite Execution**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   **Expected Outcome**: All 269 tests pass with 0 failures (`ℹ tests 269`, `ℹ fail 0`, exit code 0).

2. **TypeScript & Vite Compilation**:
   ```bash
   npm run build
   ```
   **Expected Outcome**: Clean build with exit code 0.

3. **Grep Audits**:
   - Verify zero occurrences of `"dla kawiarni Janki"` in `electron/importer/`:
     ```bash
     grep -rn "dla kawiarni Janki" electron/importer/
     ```
     (Must return 0 matches).
   - Verify zero occurrences of `unit_code IS NULL` in `electron/importer/`:
     ```bash
     grep -rn "unit_code IS NULL" electron/importer/
     ```
     (Must return 0 matches).
   - Verify `hasConfiguredStore` is used in `src/App.tsx`:
     ```bash
     grep -rn "hasConfiguredStore" src/App.tsx
     ```
     (Must return matches at lines 62, 91, and 109).
