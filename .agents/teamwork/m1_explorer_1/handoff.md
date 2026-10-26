# Handoff Report: Exact Implementation Blueprint for Features F1 & F3 (UI Components, Modals & storeService)

**Agent ID**: `m1_explorer_1`  
**Role**: `teamwork_preview_explorer`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1`  
**Date**: 2026-10-24  
**Target Milestone**: Milestone 1 (Features F1 & F3)  
**Recipient**: Parent Agent (`53bb484f-c139-4c15-89f6-7d840b96f7e4`) / Implementation Worker  

---

## 1. Observation

A comprehensive code investigation across `src/` identified all occurrences of static store fallbacks (`'18120'`, `'108120'`, `'384'`, `'Janki'`) and AI filler texts across UI components, modals, and `storeService.ts`.

### 1.1 Verbatim Code Observations: Static Store Codes in UI & storeService

| # | File Path | Line(s) | Verbatim Code Quote | Category / Issue |
|---|---|---|---|---|
| 1 | `src/constants/starbucksStores.ts` | 16 | `export const DEFAULT_STORE_ID = '108120';` | Global default store constant forcing Janki |
| 2 | `src/services/storeService.ts` | 70–74 | `id: savedMpk \|\| savedUnitCode \|\| DEFAULT_STORE_ID,`<br>`name: savedName \|\| '108120 SBX Warszawa Janki',`<br>`shortName: savedName ? ... : 'Janki',`<br>`unitCode: savedUnitCode \|\| '18120',`<br>`mpk: savedMpk \|\| '108120'` | Static fallback object in `getCurrentStore()` |
| 3 | `src/services/storeService.ts` | 86–88 | `return STARBUCKS_STORES_CATALOG.find((s) => s.id === DEFAULT_STORE_ID) \|\| STARBUCKS_STORES_CATALOG[0];` | Hardcoded catalog fallback to Janki |
| 4 | `src/components/DashboardView.tsx` | 59–61 | `<span className="font-bold">108120 SBX Warszawa Janki</span>`<br>`<span>Kod jednostki: <strong>18120</strong></span>` | Static JSX header ignoring active store |
| 5 | `src/components/DashboardView.tsx` | 255 | `<h3 ...>Podsumowanie Operacyjne Kawiarni 108120 Janki</h3>` | Hardcoded store name in section header |
| 6 | `src/components/DashboardView.tsx` | 258 | `Główny ekran podsumowania przygotowany na integrację widżetów operacyjnych Store Managera` | AI placeholder text / subtitle |
| 7 | `src/components/DashboardView.tsx` | 275, 278 | `Przestrzeń Pulpitu Podsumowania`<br>`Tutaj pojawią się skrócone widżety dobowe: status realizacji TPLH za dzisiaj, najbliższe dyżury kierowników oraz kluczowe alerty operacyjne kawiarni Janki.` | AI placeholder text in summary card |
| 8 | `src/components/ModulePlaceholderView.tsx` | 25 | `...symulacje rentowności grafiku w czasie rzeczywistym dla kawiarni 108120 Janki.` | Hardcoded store name in COL description |
| 9 | `src/components/ModulePlaceholderView.tsx` | 41 | `Matryca kompetencji i certyfikacji partnerów kawiarni Janki` | Hardcoded store name in Trainings description |
| 10 | `src/components/ModulePlaceholderView.tsx` | 107 | `<span>W budowie (Scratch)</span>` | AI dev filler artifact |
| 11 | `src/components/ModulePlaceholderView.tsx` | 157 | `<span>Szablon modułu przygotowany do wdrożenia biznesowego w kolejnym kroku.</span>` | AI filler status description |
| 12 | `src/components/UnifiedSettingsModal.tsx` | 514 | `<span ...>108120 Janki (18120)</span>` | Static badge in modal header |
| 13 | `src/components/UnifiedSettingsModal.tsx` | 774 | `<div ...><Store ... />108120 Warszawa Janki</div>` | Static sidebar footer store name |
| 14 | `src/components/UnifiedSettingsModal.tsx` | 1047 | `Kawiarnia 108120 Janki posiada nienaruszalną bazę Floor: <strong>32.0h na dobę</strong>...` | Hardcoded store reference in policy description |
| 15 | `src/components/UnifiedSettingsModal.tsx` | 1706 | `<span ...>Pilotaż Janki</span>` | Static pilot badge |
| 16 | `src/components/UnifiedSettingsModal.tsx` | 2116, 2119 | `localStorage.getItem('sbx_store_name') \|\| '108120 SBX Warszawa Janki'`<br>`localStorage.getItem('sbx_unit_code') \|\| '18120'` | Static localStorage fallbacks in System tab |
| 17 | `src/modules/labor-forecast/components/AopManagerModal.tsx` | 156 | `<span ...>Lokal 18120</span>` | Hardcoded unit code in modal header |
| 18 | `src/modules/labor-forecast/components/FloorHoursModal.tsx` | 115 | `<span ...>Lokal 18120</span>` | Hardcoded unit code in modal header |
| 19 | `src/modules/labor-forecast/components/ManagerLaborBridgeModal.tsx` | 516 | `Godziny dyżurów kierowniczych w lokalu Janki (18120) pokrywają część zapotrzebowania tygodniowego.` | Hardcoded store name and unit code |
| 20 | `src/modules/labor-forecast/components/ImportModal.tsx` | 140 | `const [filterUnit, setFilterUnit] = useState<'ALL' \| 'JANKI_ONLY' \| 'SUPPORT_ONLY'>('ALL');` | Hardcoded filter union type |
| 21 | `src/modules/labor-forecast/components/ImportModal.tsx` | 259 | `const isJanki = r.unit_code === '18120' \|\| (r.unit_name && r.unit_name.includes('Janki'));` | Hardcoded import filter condition |
| 22 | `src/modules/labor-forecast/components/ImportModal.tsx` | 729 | `...dla ${dailyKpiData?.storeName \|\| '108120 Janki'}.` | Fallback store name |
| 23 | `src/modules/labor-forecast/components/ImportModal.tsx` | 821 | `Rzeczywiste logowania baristów i menedżerów (Fichajes) dla lokalu 108120 Janki.` | Hardcoded banner text |
| 24 | `src/modules/labor-forecast/components/ImportModal.tsx` | 1129 | `<option value="JANKI_ONLY">💚 Tylko 108120 Janki</option>` | Hardcoded dropdown option |
| 25 | `src/modules/labor-forecast/components/ImportModal.tsx` | 1353–1354 | `{rec.unit_code === '18120' \|\| (rec.unit_name && rec.unit_name.includes('Janki')) ? (<span>108120 Janki</span>) : ...}` | Hardcoded table row badge |
| 26 | `src/modules/labor-forecast/components/LaborForecastView.tsx` | 203, 243 | `kawiarni 108120 Janki`<br>`lokalu 108120 Janki` | Hardcoded tooltips |
| 27 | `src/modules/labor-forecast/components/SettingsModal.tsx` | 232 | `<span ...>108120 Janki (18120)</span>` | Static modal badge |
| 28 | `src/modules/col-calculator/components/ColCalculatorView.tsx` | 60–61 | `storeCode: '18120', storeName: 'SBX Warszawa Janki'` | State default in useState |
| 29 | `src/modules/col-calculator/components/ColCalculatorView.tsx` | 107–108 | `storeCode: '18120', storeName: 'SBX Warszawa Janki'` | Hardcoded re-assignment in `loadBridgeData` |
| 30 | `src/modules/col-calculator/components/ColCalculatorView.tsx` | 430 | `COL Calculator — Starbucks 18120 Janki` | Hardcoded header title |
| 31 | `src/modules/col-calculator/components/ColUserGuideSheet.tsx` | 43 | `wybierz numer MPK (108120 Janki)` | Hardcoded guide example |
| 32 | `src/modules/col-calculator/services/colDefaultData.ts` | 11–12 | `storeCode: '108120', storeName: 'SBX Warszawa Janki'` | Default store object |
| 33 | `src/modules/managers-schedule/components/AutoScheduleModal.tsx` | 259 | `Starbucks 108120 Janki • <strong>{data.monthName} {data.year}</strong>` | Hardcoded modal subtitle |
| 34 | `src/modules/managers-schedule/components/ManagerScheduleGrid.tsx` | 957–960 | `if (empRcp.unitCode && empRcp.unitCode !== '384' && empRcp.unitCode !== '18120') ... else cellTitle += '\n\n📍 Zalogowano w MAPAL: ' + empRcp.hours + 'h (108120 Janki)';` | Hardcoded grid cell tooltip |
| 35 | `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx` | 118 | `{c.unitName} ({c.unitCode \|\| '384'})` | Hardcoded unitCode fallback |
| 36 | `src/modules/managers-schedule/components/InterStoreSupportModal.tsx` | 172 | `Starbucks 108120 Janki ➔ Oddawanie dyżurów...` | Hardcoded modal description |
| 37 | `src/modules/managers-schedule/services/managerExcelExport.ts` | 24, 121 | `Kawiarnia: 108120 SBX Warszawa Janki (Unit: 384)`<br>`Kawiarnia 108120 SBX Warszawa Janki (Unit 18120)` | Hardcoded Excel export header rows |
| 38 | `src/modules/managers-schedule/services/autoSchedulerEngine.ts` | 1932 | `w celu zabezpieczenia obsady kawiarni 108120 Janki.` | Hardcoded conflict insight explanation |
| 39 | `src/components/OnboardingWizardView.tsx` | 137–138 | `name: currentStore.name \|\| '108120 SBX Warszawa Janki', unitCode: currentStore.unitCode \|\| '18120'` | Step 2 prefill fallback |
| 40 | `src/components/AppUpdateModal.tsx` | 271 | `Starbucks Operations Suite • 108120 Janki` | Header subtitle |
| 41 | `src/components/NotificationsSettingsTab.tsx` | 273–274, 359–360, 882 | `localStorage.getItem('sbx_store_name') \|\| '108120 SBX Warszawa Janki'`<br>`Kawiarnia 108120 Janki` | Test email fallback and badge |
| 42 | `src/components/NotificationsView.tsx` | 180 | `<span ...>108120 Janki</span>` | Desktop banner badge |
| 43 | `src/components/DatabaseBackupModal.tsx` | 300 | `Lokalna persystencja kawiarni 108120 Janki • Automatyczna rotacja ostatnich 15 kopii` | Modal subtitle |
| 44 | `src/components/DatabaseBackupModal.tsx` | 165, 213, 264 | `'Tryb demonstracyjny przeglądarki...'`, `'Wgrano dane demonstracyjne.'` | AI/demo placeholder status messages |
| 45 | `src/components/admin/AdminConsoleModal.tsx` | 44 | `storeUnitCode = '18120', adminName = 'Dawid Apel (Store Manager)'` | Mock prop defaults |
| 46 | `src/App.tsx` | 817 | `<AdminConsoleModal ... storeUnitCode={currentStore?.unitCode \|\| '18120'} />` | Prop fallback |
| 47 | `src/services/desktopNotificationService.ts` | 250 | `body: 'Natywne powiadomienia desktopowe działają prawidłowo dla lokalu 108120 Janki!'` | Test notification body |
| 48 | `src/services/cloudNotificationService.ts` | 381, 577, 622, 648, 676, 697–698 | Email templates with hardcoded `108120 Janki` and `18120` | Cloud email templates |

---

## 2. Logic Chain

1. **Premise 1**: The application is designed to support 100+ autonomous Starbucks stores without defaulting to or assuming any specific store (Requirement R1, R2).
2. **Premise 2**: In `src/constants/starbucksStores.ts` (line 16), `DEFAULT_STORE_ID = '108120'` was imported and used in `src/services/storeService.ts` (lines 70, 87) as an unconditional fallback. Consequently, when `localStorage` has no saved store (clean installation), `getCurrentStore()` immediately returns store `108120 Janki`.
3. **Premise 3**: In `src/components/OnboardingWizardView.tsx` (lines 137–138), if `currentStore.name` or `unitCode` was missing, it defaulted to `'108120 SBX Warszawa Janki'` and `'18120'`, defeating the onboarding selection for unconfigured installs.
4. **Premise 4**: Over 20 UI components bypass the active `StoreContext` and render static strings (`108120 SBX Warszawa Janki`, `Lokal 18120`, `384`). When a Store Manager switches the store to another unit (e.g. `108004 Nowy Świat`, unit `323`), these UI views, modal headers, tooltips, and Excel exports continue to display `108120 Janki` or `18120`, causing cross-store UI confusion and data mislabeling.
5. **Premise 5**: In `src/modules/labor-forecast/components/ImportModal.tsx` (lines 259, 1353) and `src/modules/managers-schedule/components/ManagerScheduleGrid.tsx` (lines 957–960), filtering and tooltip logic checks `rec.unit_code === '18120'` and `!== '384'`. If the user is managing any store other than Janki, the application incorrectly tags the store's own hours as "external support in another store" and fails to display valid local hours.
6. **Premise 6**: In `src/components/DashboardView.tsx` (lines 255–279) and `src/components/ModulePlaceholderView.tsx` (lines 25, 41, 107, 157), temporary development texts ("Tutaj pojawią się skrócone widżety...", "W budowie (Scratch)", "Szablon modułu...") undermine production readiness.
7. **Conclusion**: Eliminating `DEFAULT_STORE_ID`, making `StoreService.getCurrentStore()` return an uninitialized store prior to onboarding, dynamically binding all UI views to `useStore()` (`currentStore`), and replacing AI placeholder copy with clean, production-grade operational cards fully resolves Features F1 and F3.

---

## 3. Caveats

- **Scope Boundary**: This blueprint focuses strictly on the presentation layer, UI components, modals, and `storeService.ts` (Features F1 & F3). Backend Electron SQLite queries, seed files, and server-side parsers (`electron/main.ts`, `electron/database/db.ts`, `mapalParser.ts`) belong to Feature F5 (Parameterized Electron SQL & Importers) and Feature F4 (Clean Launch Store Onboarding).
- **Existing User Data**: Store `108120 SBX Warszawa Janki` remains a legitimate member of `STARBUCKS_STORES_CATALOG` (alongside 23 other stores). Users who legitimately choose or have already chosen Janki will continue to access their store data seamlessly via `localStorage` and `store_108120.db`.
- **Tutorial & Historical Logs**: Historical changelog entries in `src/constants/changelog.ts` and `VERSION_HISTORY.md` describe past releases (e.g. "Pilotaż Janki") and are historical records that should not be altered. The interactive tutorial `InteractiveModelTutorial.tsx` represents an interactive simulation walk-through with illustrative scenarios.

---

## 4. Conclusion: Exact File-by-File Implementation Instructions

Below are the exact implementation instructions for the Worker agent to execute.

### 4.1 `src/constants/starbucksStores.ts`
- **File**: `/Users/dawidapel/COL Tool/src/constants/starbucksStores.ts`
- **Action**: Remove `export const DEFAULT_STORE_ID = '108120';` (line 16).
- **Target Content (Lines 15–17)**:
  ```ts
  export const DEFAULT_STORE_ID = '108120';

  export const STARBUCKS_STORES_CATALOG: StarbucksStore[] = [
  ```
- **Replacement Content**:
  ```ts
  export const STARBUCKS_STORES_CATALOG: StarbucksStore[] = [
  ```

---

### 4.2 `src/services/storeService.ts`
- **File**: `/Users/dawidapel/COL Tool/src/services/storeService.ts`
- **Action 1**: Update imports on line 2 (remove `DEFAULT_STORE_ID`).
  - **Target Content**:
    ```ts
    import { StarbucksStore, STARBUCKS_STORES_CATALOG, DEFAULT_STORE_ID } from '../constants/starbucksStores';
    ```
  - **Replacement Content**:
    ```ts
    import { StarbucksStore, STARBUCKS_STORES_CATALOG } from '../constants/starbucksStores';
    ```
- **Action 2**: Replace static fallback construction and catalog fallback in `getCurrentStore()` (lines 68–88).
  - **Target Content**:
    ```ts
          // Jeśli w localStorage był niestandardowy zapis, skonstruuj z niego obiekt
          if (savedName || savedUnitCode) {
            return {
              id: savedMpk || savedUnitCode || DEFAULT_STORE_ID,
              name: savedName || '108120 SBX Warszawa Janki',
              shortName: savedName ? savedName.replace(/^SBX\s*/, '').replace(/108\d{3}\s*/, '') : 'Janki',
              unitCode: savedUnitCode || '18120',
              mpk: savedMpk || '108120',
              city: localStorage.getItem(STORAGE_STORE_CITY_KEY) || 'Warszawa',
              district: localStorage.getItem(STORAGE_STORE_DISTRICT_KEY) || 'Dystrykt Warszawa',
              address: '',
              type: 'Mall',
            };
          }
        } catch (e) {
          console.warn('Błąd odczytu aktualnej kawiarni z localStorage:', e);
        }

        // Domyślna kawiarnia 108120 Janki
        return (
          STARBUCKS_STORES_CATALOG.find((s) => s.id === DEFAULT_STORE_ID) || STARBUCKS_STORES_CATALOG[0]
        );
      }
    ```
  - **Replacement Content**:
    ```ts
          // Jeśli w localStorage był niestandardowy zapis, skonstruuj z niego obiekt
          if (savedName || savedUnitCode) {
            return {
              id: savedMpk || savedUnitCode || 'custom',
              name: savedName || 'Kawiarnia Starbucks',
              shortName: savedName ? savedName.replace(/^SBX\s*/, '').replace(/108\d{3}\s*/, '') : 'Kawiarnia',
              unitCode: savedUnitCode || '',
              mpk: savedMpk || '',
              city: localStorage.getItem(STORAGE_STORE_CITY_KEY) || '',
              district: localStorage.getItem(STORAGE_STORE_DISTRICT_KEY) || '',
              address: '',
              type: 'Mall',
            };
          }
        } catch (e) {
          console.warn('Błąd odczytu aktualnej kawiarni z localStorage:', e);
        }

        // Gdy brak zapisanej kawiarni (stan początkowy przed ukończeniem kreatora konfiguracji)
        return {
          id: '',
          name: '',
          shortName: '',
          unitCode: '',
          mpk: '',
          city: '',
          district: '',
          address: '',
          type: 'Mall',
        };
      }
    ```
- **Action 3**: Guard `initStore()` against uninitialized store (lines 198–215).
  - **Target Content**:
    ```ts
        // 2. Synchronizacja aktywnej bazy kawiarni przy starcie
        const current = this.getCurrentStore();
        if (apiObj?.switchStoreDatabase) {
          try {
            await apiObj.switchStoreDatabase({
    ```
  - **Replacement Content**:
    ```ts
        // 2. Synchronizacja aktywnej bazy kawiarni przy starcie
        const current = this.getCurrentStore();
        if (current.id && apiObj?.switchStoreDatabase) {
          try {
            await apiObj.switchStoreDatabase({
    ```

---

### 4.3 `src/components/DashboardView.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/components/DashboardView.tsx`
- **Action 1**: Import `useStore` on line 20.
  - **Target Content (Lines 19–21)**:
    ```tsx
      CheckCircle2,
    } from 'lucide-react';

    interface DashboardViewProps {
    ```
  - **Replacement Content**:
    ```tsx
      CheckCircle2,
    } from 'lucide-react';
    import { useStore } from '../context/StoreContext';

    interface DashboardViewProps {
    ```
- **Action 2**: Extract `currentStore` and bind header (lines 31–65).
  - **Target Content (Lines 31–38)**:
    ```tsx
    }) => {
      const currentDateFormatted = new Intl.DateTimeFormat('pl-PL', {
    ```
  - **Replacement Content**:
    ```tsx
    }) => {
      const { currentStore } = useStore();
      const currentDateFormatted = new Intl.DateTimeFormat('pl-PL', {
    ```
  - **Target Content (Lines 57–64)**:
    ```tsx
                <p className="text-emerald-100/80 text-sm mt-1.5 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#CBA258]" />
                  <span className="font-bold">108120 SBX Warszawa Janki</span>
                  <span>•</span>
                  <span>Kod jednostki: <strong>18120</strong></span>
                  <span>•</span>
                  <span className="capitalize">{currentDateFormatted}</span>
                </p>
    ```
  - **Replacement Content**:
    ```tsx
                <p className="text-emerald-100/80 text-sm mt-1.5 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#CBA258]" />
                  <span className="font-bold">{currentStore.name || 'Wybierz kawiarnię'}</span>
                  {currentStore.unitCode && (
                    <>
                      <span>•</span>
                      <span>Kod jednostki: <strong>{currentStore.unitCode}</strong></span>
                    </>
                  )}
                  <span>•</span>
                  <span className="capitalize">{currentDateFormatted}</span>
                </p>
    ```
- **Action 3**: Replace AI filler text and hardcoded header in Summary section (lines 253–280).
  - **Target Content (Lines 253–280)**:
    ```tsx
              <div>
                <h3 className="text-base font-black text-[#1E3932] tracking-tight">
                  Podsumowanie Operacyjne Kawiarni 108120 Janki
                </h3>
                <p className="text-xs text-[#5C6F68] mt-0.5">
                  Główny ekran podsumowania przygotowany na integrację widżetów operacyjnych Store Managera
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0F4F2] text-[#1E3932] border border-[#D0DCD6] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                System Gotowy
              </span>
            </div>

            {/* Pusty stan podsumowania (Clean Empty State) */}
            <div className="py-12 px-4 text-center max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#F0F4F2] border border-[#D0DCD6] flex items-center justify-center text-stone-400 mb-4">
                <Layers className="w-8 h-8 text-stone-400" />
              </div>

              <h4 className="text-sm font-bold text-[#1E3932]">
                Przestrzeń Pulpitu Podsumowania
              </h4>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Tutaj pojawią się skrócone widżety dobowe: status realizacji TPLH za dzisiaj, najbliższe dyżury kierowników oraz kluczowe alerty operacyjne kawiarni Janki.
              </p>
    ```
  - **Replacement Content**:
    ```tsx
              <div>
                <h3 className="text-base font-black text-[#1E3932] tracking-tight">
                  Podsumowanie Operacyjne: {currentStore.shortName || currentStore.name || 'Kawiarnia Starbucks'}
                </h3>
                <p className="text-xs text-[#5C6F68] mt-0.5">
                  Centrum dowodzenia i kluczowe wskaźniki operacyjne wybranego lokalu
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0F4F2] text-[#1E3932] border border-[#D0DCD6] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                System Gotowy
              </span>
            </div>

            {/* Pusty stan podsumowania (Clean Empty State) */}
            <div className="py-12 px-4 text-center max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#F0F4F2] border border-[#D0DCD6] flex items-center justify-center text-stone-400 mb-4">
                <Layers className="w-8 h-8 text-stone-400" />
              </div>

              <h4 className="text-sm font-bold text-[#1E3932]">
                Centrum Operacyjne Lokalu
              </h4>
              <p className="text-xs text-[#5C6F68] mt-1.5 leading-relaxed">
                Wybierz moduł operacyjny poniżej, aby zarządzać planem AOP, barierą Floor Hours (32h/d) lub zweryfikować zgodność grafiku menedżerskiego z Kodeksem Pracy.
              </p>
    ```

---

### 4.4 `src/components/ModulePlaceholderView.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/components/ModulePlaceholderView.tsx`
- **Action 1**: Clean COL description (line 25).
  - **Target Content**:
    ```ts
          'Zaawansowany kalkulator kosztów pracy (Cost of Labor - COL) integrujący stawki godzinowe menedżerów i baristów, narzuty pracodawcy (ZUS, PPK, PFRON), wypracowany budżet AOP oraz symulacje rentowności grafiku w czasie rzeczywistym dla kawiarni 108120 Janki.',
    ```
  - **Replacement Content**:
    ```ts
          'Zaawansowany kalkulator kosztów pracy (Cost of Labor - COL) integrujący stawki godzinowe menedżerów i baristów, narzuty pracodawcy (ZUS, PPK, PFRON), wypracowany budżet AOP oraz symulacje rentowności grafiku w czasie rzeczywistym dla wybranej kawiarni Starbucks.',
    ```
- **Action 2**: Clean Trainings description (line 41).
  - **Target Content**:
    ```ts
          'Matryca kompetencji i certyfikacji partnerów kawiarni Janki',
    ```
  - **Replacement Content**:
    ```ts
          'Matryca kompetencji i certyfikacji partnerów kawiarni',
    ```
- **Action 3**: Clean badge and status text (lines 107, 157).
  - **Target Content (Line 107)**:
    ```tsx
              <span>W budowie (Scratch)</span>
    ```
  - **Replacement Content**:
    ```tsx
              <span>Moduł w przygotowaniu</span>
    ```
  - **Target Content (Line 157)**:
    ```tsx
                <span>Szablon modułu przygotowany do wdrożenia biznesowego w kolejnym kroku.</span>
    ```
  - **Replacement Content**:
    ```tsx
                <span>Moduł w trakcie rozwoju w ramach kolejnych aktualizacji Starbucks Operations Suite.</span>
    ```

---

### 4.5 `src/components/UnifiedSettingsModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/components/UnifiedSettingsModal.tsx`
- **Action 1**: Replace header badge (lines 513–515).
  - **Target Content**:
    ```tsx
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      108120 Janki (18120)
                    </span>
    ```
  - **Replacement Content**:
    ```tsx
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      {currentStore.shortName || currentStore.name || 'Starbucks'} {currentStore.unitCode ? `(${currentStore.unitCode})` : ''}
                    </span>
    ```
- **Action 2**: Replace sidebar store label (lines 772–775).
  - **Target Content**:
    ```tsx
                  <div className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#CBA258]" />
                    108120 Warszawa Janki
                  </div>
    ```
  - **Replacement Content**:
    ```tsx
                  <div className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#CBA258]" />
                    {currentStore.name || 'Kawiarnia Starbucks'}
                  </div>
    ```
- **Action 3**: Replace policy text (lines 1046–1048).
  - **Target Content**:
    ```tsx
                          Kawiarnia 108120 Janki posiada nienaruszalną bazę Floor: <strong>32.0h na dobę</strong> (1 MGR + 1 Barista rano / AM + 1 MGR + 1 Barista wieczorem / PM), co stanowi <strong>224.0h w pełnym tygodniu 7-dniowym</strong>.
    ```
  - **Replacement Content**:
    ```tsx
                          Kawiarnia {currentStore.shortName || currentStore.name || 'Starbucks'} posiada nienaruszalną bazę Floor: <strong>32.0h na dobę</strong> (1 MGR + 1 Barista rano / AM + 1 MGR + 1 Barista wieczorem / PM), co stanowi <strong>224.0h w pełnym tygodniu 7-dniowym</strong>.
    ```
- **Action 4**: Replace pilot badge (lines 1705–1707).
  - **Target Content**:
    ```tsx
                          <span className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-amber-950 rounded-full uppercase">
                            Pilotaż Janki
                          </span>
    ```
  - **Replacement Content**:
    ```tsx
                          <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-[#006241] border border-emerald-300 rounded-full uppercase">
                            Przewodnik
                          </span>
    ```
- **Action 5**: Clean System tab localStorage fallbacks (lines 2115–2120).
  - **Target Content**:
    ```ts
                  const currentStoreName = (() => {
                    try { return localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki'; } catch { return '108120 SBX Warszawa Janki'; }
                  })();
                  const currentUnitCode = (() => {
                    try { return localStorage.getItem('sbx_unit_code') || '18120'; } catch { return '18120'; }
                  })();
    ```
  - **Replacement Content**:
    ```ts
                  const currentStoreName = (() => {
                    try { return localStorage.getItem('sbx_store_name') || currentStore.name || 'Brak skonfigurowanej kawiarni'; } catch { return currentStore.name || 'Brak skonfigurowanej kawiarni'; }
                  })();
                  const currentUnitCode = (() => {
                    try { return localStorage.getItem('sbx_unit_code') || currentStore.unitCode || 'Brak'; } catch { return currentStore.unitCode || 'Brak'; }
                  })();
    ```

---

### 4.6 `src/modules/labor-forecast/components/AopManagerModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/AopManagerModal.tsx`
- **Action 1**: Import `useStore` on line 4.
  - **Target Content (Lines 3–5)**:
    ```ts
    import { AopPlanRecord } from '../../../types';

    interface AopManagerModalProps {
    ```
  - **Replacement Content**:
    ```ts
    import { AopPlanRecord } from '../../../types';
    import { useStore } from '../../../context/StoreContext';

    interface AopManagerModalProps {
    ```
- **Action 2**: Extract `currentStore` and bind badge (lines 22, 155–157).
  - In component body:
    ```tsx
    const { currentStore } = useStore();
    ```
  - **Target Content (Lines 155–157)**:
    ```tsx
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                      Lokal 18120
                    </span>
    ```
  - **Replacement Content**:
    ```tsx
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                      Lokal {currentStore.unitCode || currentStore.shortName || 'Aktywny'}
                    </span>
    ```

---

### 4.7 `src/modules/labor-forecast/components/FloorHoursModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/FloorHoursModal.tsx`
- **Action**: Import `useStore`, extract `currentStore`, and replace badge (line 115).
  - Import `useStore` from `../../../context/StoreContext`
  - In component body: `const { currentStore } = useStore();`
  - **Target Content (Lines 114–116)**:
    ```tsx
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                      Lokal 18120
                    </span>
    ```
  - **Replacement Content**:
    ```tsx
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                      Lokal {currentStore.unitCode || currentStore.shortName || 'Aktywny'}
                    </span>
    ```

---

### 4.8 `src/modules/labor-forecast/components/ManagerLaborBridgeModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/ManagerLaborBridgeModal.tsx`
- **Action**: Extract `currentStore` from `useStore()` (line 25 already imports `useStore`) and update line 516.
  - In component body: `const { currentStore } = useStore();`
  - **Target Content (Lines 515–517)**:
    ```tsx
                  <p>
                    <strong>Zasada podziału robocizny w kawiarni:</strong> Godziny dyżurów kierowniczych w lokalu Janki (18120) pokrywają część zapotrzebowania tygodniowego.
                  </p>
    ```
  - **Replacement Content**:
    ```tsx
                  <p>
                    <strong>Zasada podziału robocizny w kawiarni:</strong> Godziny dyżurów kierowniczych w lokalu {currentStore.shortName || currentStore.name || 'kawiarni'}{currentStore.unitCode ? ` (${currentStore.unitCode})` : ''} pokrywają część zapotrzebowania tygodniowego.
                  </p>
    ```

---

### 4.9 `src/modules/labor-forecast/components/ImportModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/ImportModal.tsx`
- **Action 1**: Import `useStore` from `../../../context/StoreContext` and extract `currentStore`.
- **Action 2**: Replace `filterUnit` state definition (line 140).
  - **Target Content**:
    ```ts
      const [filterUnit, setFilterUnit] = useState<'ALL' | 'JANKI_ONLY' | 'SUPPORT_ONLY'>('ALL');
    ```
  - **Replacement Content**:
    ```ts
      const [filterUnit, setFilterUnit] = useState<'ALL' | 'STORE_ONLY' | 'SUPPORT_ONLY'>('ALL');
    ```
- **Action 3**: Replace filter logic (lines 258–265).
  - **Target Content**:
    ```ts
            // 6. Lokal (Janki vs Wsparcie w innym lokalu)
            const isJanki = r.unit_code === '18120' || (r.unit_name && r.unit_name.includes('Janki'));
            if (filterUnit === 'JANKI_ONLY' && !isJanki) {
              return false;
            }
            if (filterUnit === 'SUPPORT_ONLY' && isJanki) {
              return false;
            }
    ```
  - **Replacement Content**:
    ```ts
            // 6. Lokal (Własny lokal vs Wsparcie w innym lokalu)
            const isCurrentStore = (currentStore.unitCode && r.unit_code === currentStore.unitCode) ||
              (currentStore.mpk && r.unit_code === currentStore.mpk) ||
              (currentStore.shortName && r.unit_name && r.unit_name.toLowerCase().includes(currentStore.shortName.toLowerCase()));
            if (filterUnit === 'STORE_ONLY' && !isCurrentStore) {
              return false;
            }
            if (filterUnit === 'SUPPORT_ONLY' && isCurrentStore) {
              return false;
            }
    ```
- **Action 4**: Update preview string and description (lines 729, 821).
  - **Target Content (Line 729)**:
    ```ts
                    {stage === 'PREVIEW_DAILY_KPI' && `Sprawdź i dostosuj rzeczywiste wykonanie sprzedaży, TRX i godzin dla ${dailyKpiData?.storeName || '108120 Janki'}.`}
    ```
  - **Replacement Content**:
    ```ts
                    {stage === 'PREVIEW_DAILY_KPI' && `Sprawdź i dostosuj rzeczywiste wykonanie sprzedaży, TRX i godzin dla ${dailyKpiData?.storeName || currentStore.shortName || currentStore.name || 'kawiarni'}.`}
    ```
  - **Target Content (Line 821)**:
    ```ts
                          Rzeczywiste logowania baristów i menedżerów (Fichajes) dla lokalu 108120 Janki.
    ```
  - **Replacement Content**:
    ```ts
                          Rzeczywiste logowania baristów i menedżerów (Fichajes) dla wybranego lokalu.
    ```
- **Action 5**: Update dropdown option (line 1129).
  - **Target Content**:
    ```tsx
                          <option value="JANKI_ONLY">💚 Tylko 108120 Janki</option>
    ```
  - **Replacement Content**:
    ```tsx
                          <option value="STORE_ONLY">💚 Tylko {currentStore.shortName || currentStore.name || 'Lokal macierzysty'}</option>
    ```
- **Action 6**: Update table row badge (lines 1353–1355).
  - **Target Content**:
    ```tsx
                                  {rec.unit_code === '18120' || (rec.unit_name && rec.unit_name.includes('Janki')) ? (
                                    <span className="text-[#006241] font-semibold">108120 Janki</span>
                                  ) : (
                                    <span className="text-blue-700 font-semibold">{rec.unit_name}</span>
                                  )}
    ```
  - **Replacement Content**:
    ```tsx
                                  {((currentStore.unitCode && rec.unit_code === currentStore.unitCode) ||
                                    (currentStore.mpk && rec.unit_code === currentStore.mpk) ||
                                    (currentStore.shortName && rec.unit_name && rec.unit_name.toLowerCase().includes(currentStore.shortName.toLowerCase()))) ? (
                                    <span className="text-[#006241] font-semibold">{currentStore.shortName || currentStore.name}</span>
                                  ) : (
                                    <span className="text-blue-700 font-semibold">{rec.unit_name || rec.unit_code}</span>
                                  )}
    ```

---

### 4.10 `src/modules/labor-forecast/components/LaborForecastView.tsx` & `SettingsModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/LaborForecastView.tsx`
  - Line 203: Replace `kawiarni 108120 Janki` with `kawiarni`
  - Line 243: Replace `lokalu 108120 Janki` with `kawiarni`
- **File**: `/Users/dawidapel/COL Tool/src/modules/labor-forecast/components/SettingsModal.tsx`
  - Line 232: Replace `108120 Janki (18120)` with `{currentStore.shortName || currentStore.name || 'Starbucks'} {currentStore.unitCode ? `(${currentStore.unitCode})` : ''}`

---

### 4.11 `src/modules/col-calculator/components/ColCalculatorView.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/col-calculator/components/ColCalculatorView.tsx`
- **Action 1**: Import `useStore` from `../../../context/StoreContext` and extract `currentStore`.
- **Action 2**: Replace initial state for `storeInfo` (lines 59–66).
  - **Target Content**:
    ```ts
      const [storeInfo, setStoreInfo] = useState<ColStoreInfo>({
        storeCode: '18120',
        storeName: 'SBX Warszawa Janki',
        month: activeMonth.toUpperCase(),
        year: activeYear,
        openDays: 30,
        fullContractHours: nominalHours
      });
    ```
  - **Replacement Content**:
    ```ts
      const [storeInfo, setStoreInfo] = useState<ColStoreInfo>({
        storeCode: currentStore.unitCode || currentStore.id || '',
        storeName: currentStore.name || '',
        month: activeMonth.toUpperCase(),
        year: activeYear,
        openDays: 30,
        fullContractHours: nominalHours
      });
    ```
- **Action 3**: Replace re-assignment in `loadBridgeData` (lines 106–113).
  - **Target Content**:
    ```ts
          setStoreInfo({
            storeCode: '18120',
            storeName: 'SBX Warszawa Janki',
            month: activeMonth.toUpperCase(),
            year: activeYear,
            openDays: 30,
            fullContractHours: nominalHours
          });
    ```
  - **Replacement Content**:
    ```ts
          setStoreInfo({
            storeCode: currentStore.unitCode || currentStore.id || '',
            storeName: currentStore.name || '',
            month: activeMonth.toUpperCase(),
            year: activeYear,
            openDays: 30,
            fullContractHours: nominalHours
          });
    ```
- **Action 4**: Replace view title (lines 429–431).
  - **Target Content**:
    ```tsx
                  <h1 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                    COL Calculator — Starbucks 18120 Janki
                  </h1>
    ```
  - **Replacement Content**:
    ```tsx
                  <h1 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                    COL Calculator — {currentStore.shortName || currentStore.name || 'Starbucks'}
                  </h1>
    ```

---

### 4.12 `src/modules/managers-schedule/components/AutoScheduleModal.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/AutoScheduleModal.tsx`
- **Action**: Import `useStore` from `../../../context/StoreContext`, extract `currentStore`, and replace line 259.
  - **Target Content**:
    ```tsx
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    Starbucks 108120 Janki • <strong>{data.monthName} {data.year}</strong> • Norma: {data.fullTimeNominalHours}h (pełny etat)
                  </p>
    ```
  - **Replacement Content**:
    ```tsx
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    Starbucks {currentStore.shortName || currentStore.name || 'Lokal Aktywny'} • <strong>{data.monthName} {data.year}</strong> • Norma: {data.fullTimeNominalHours}h (pełny etat)
                  </p>
    ```

---

### 4.13 `src/modules/managers-schedule/components/ManagerScheduleGrid.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/ManagerScheduleGrid.tsx`
- **Action**: Import `useStore` from `../../../context/StoreContext`, extract `currentStore`, and replace lines 956–962.
  - **Target Content**:
    ```tsx
                        if (empRcp.unitCode && empRcp.unitCode !== '384' && empRcp.unitCode !== '18120') {
                          cellTitle += `\n\n📍 Zalogowano wsparcie MAPAL: ${empRcp.hours}h w ${empRcp.unitName || 'innym lokalu'} (kod: ${empRcp.unitCode})`;
                        } else {
                          cellTitle += `\n\n📍 Zalogowano w MAPAL: ${empRcp.hours}h (108120 Janki)`;
                        }
    ```
  - **Replacement Content**:
    ```tsx
                        const isLocalStore = (currentStore.unitCode && empRcp.unitCode === currentStore.unitCode) ||
                          (currentStore.mpk && empRcp.unitCode === currentStore.mpk) ||
                          (!empRcp.unitCode);
                        if (!isLocalStore) {
                          cellTitle += `\n\n📍 Zalogowano wsparcie MAPAL: ${empRcp.hours}h w ${empRcp.unitName || 'innym lokalu'} (kod: ${empRcp.unitCode})`;
                        } else {
                          cellTitle += `\n\n📍 Zalogowano w MAPAL: ${empRcp.hours}h (${currentStore.shortName || currentStore.name || 'Lokal macierzysty'})`;
                        }
    ```

---

### 4.14 `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx`
- **File**: `/Users/dawidapel/COL Tool/src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx`
- **Action**: Update line 118.
  - **Target Content**:
    ```tsx
                              <span className="text-[11px]">{c.unitName} ({c.unitCode || '384'})</span>
    ```
  - **Replacement Content**:
    ```tsx
                              <span className="text-[11px]">{c.unitName} {c.unitCode ? `(${c.unitCode})` : ''}</span>
    ```

---

### 4.15 Additional UI & Service Fixes for F1
1. **`src/App.tsx` (Line 817)**:
   - Change `storeUnitCode={currentStore?.unitCode || '18120'}` to `storeUnitCode={currentStore?.unitCode || ''}`
2. **`src/components/OnboardingWizardView.tsx` (Lines 137–138)**:
   - Change `name: currentStore.name || '108120 SBX Warszawa Janki'` to `name: currentStore.name || ''`
   - Change `unitCode: currentStore.unitCode || '18120'` to `unitCode: currentStore.unitCode || ''`
3. **`src/components/AppUpdateModal.tsx` (Line 271)**:
   - Change `Starbucks Operations Suite • 108120 Janki` to `Starbucks Operations Suite • {currentStore.shortName || currentStore.name || 'Lokal Aktywny'}`
4. **`src/components/NotificationsSettingsTab.tsx`**:
   - Lines 273–274, 359–360: Change `'108120 SBX Warszawa Janki'` to `'Kawiarnia Starbucks'`, `'18120'` to `''`
   - Line 882: Change `Kawiarnia 108120 Janki` to `Kawiarnia {currentStore.shortName || currentStore.name}`
5. **`src/components/NotificationsView.tsx` (Line 180)**:
   - Change `108120 Janki` to `{currentStore.shortName || currentStore.name}`
6. **`src/components/DatabaseBackupModal.tsx`**:
   - Line 300: Change `kawiarni 108120 Janki` to `kawiarni {currentStore.shortName || currentStore.name}`
   - Lines 165, 213, 264: Change browser fallbacks to clean production messages
7. **`src/modules/managers-schedule/components/InterStoreSupportModal.tsx` (Line 172)**:
   - Change `Starbucks 108120 Janki` to `Starbucks {currentStore.shortName || currentStore.name}`
8. **`src/modules/managers-schedule/services/managerExcelExport.ts` (Lines 24, 121)**:
   - Use `StoreService.getCurrentStore()` to dynamically inject the active store name and unit code into the generated Excel header rows
9. **`src/modules/managers-schedule/services/autoSchedulerEngine.ts` (Line 1932)**:
   - Change `kawiarni 108120 Janki` to `lokalu`
10. **`src/modules/col-calculator/services/colDefaultData.ts` (Lines 11–12)**:
    - Change `storeCode: '108120'` to `storeCode: ''` and `storeName: 'SBX Warszawa Janki'` to `storeName: ''`
11. **`src/services/desktopNotificationService.ts` (Line 250)**:
    - Dynamically read `localStorage.getItem('sbx_store_name')` instead of hardcoding `108120 Janki`

---

## 5. Verification Method

To independently verify the implementation:

1. **Static Scan for Hardcoded Fallback Store Codes**:
   ```bash
   grep -rn "DEFAULT_STORE_ID" src/
   grep -rn "18120" src/components/ src/modules/ src/services/storeService.ts
   grep -rn "108120" src/components/ src/modules/ src/services/storeService.ts
   grep -rn "384" src/components/ src/modules/
   ```
   **Expected**: Zero occurrences in UI components, modal headers, badges, or `storeService.ts` fallbacks.
2. **Scan for AI Filler Texts**:
   ```bash
   grep -rn "Tutaj pojawią się skrócone widżety" src/
   grep -rn "W budowie (Scratch)" src/
   grep -rn "Szablon modułu przygotowany" src/
   ```
   **Expected**: Zero occurrences.
3. **Build & Bundle Integrity**:
   ```bash
   npm run build
   ```
   **Expected**: Exit code 0, TypeScript compiler passes without errors, Vite bundle builds cleanly.
4. **Functional Multi-Store Verification**:
   - In browser or Electron, switch store to `108004 SBX Warszawa Nowy Świat` (Unit `323`).
   - Verify that `DashboardView`, `UnifiedSettingsModal`, `ImportModal`, `AutoScheduleModal`, `ColCalculatorView`, and tooltip badges all display `108004 Nowy Świat (323)` without any mention of `18120` or `Janki`.
