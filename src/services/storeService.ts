// src/services/storeService.ts
import { StarbucksStore, STARBUCKS_STORES_CATALOG, DEFAULT_STORE_ID } from '../constants/starbucksStores';
import { logger } from './logger';

const STORAGE_CUSTOM_STORES_KEY = 'sbx_custom_stores';
const STORAGE_STORE_NAME_KEY = 'sbx_store_name';
const STORAGE_UNIT_CODE_KEY = 'sbx_unit_code';
const STORAGE_STORE_MPK_KEY = 'sbx_store_mpk';
const STORAGE_STORE_DISTRICT_KEY = 'sbx_store_district';
const STORAGE_STORE_CITY_KEY = 'sbx_store_city';

export class StoreService {
  /**
   * Zwraca listę własnych kawiarni dodanych przez użytkownika
   */
  public static getCustomStores(): StarbucksStore[] {
    try {
      const data = localStorage.getItem(STORAGE_CUSTOM_STORES_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Błąd odczytu sbx_custom_stores:', e);
    }
    return [];
  }

  /**
   * Zwraca pełną listę dostępnych kawiarni (wbudowany katalog + własne)
   */
  public static getAllStores(): StarbucksStore[] {
    const customStores = this.getCustomStores();
    // Połącz wbudowane z własnymi, unikając duplikatów po ID
    const customIds = new Set(customStores.map((s) => s.id));
    const defaultStores = STARBUCKS_STORES_CATALOG.filter((s) => !customIds.has(s.id));
    return [...defaultStores, ...customStores];
  }

  /**
   * Zwraca aktualnie aktywną kawiarnię
   */
  public static getCurrentStore(): StarbucksStore {
    try {
      const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY);
      const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY);
      const savedMpk = localStorage.getItem(STORAGE_STORE_MPK_KEY);

      const allStores = this.getAllStores();

      if (savedMpk) {
        const found = allStores.find((s) => s.mpk === savedMpk || s.id === savedMpk);
        if (found) return found;
      }

      if (savedName) {
        const found = allStores.find(
          (s) => s.name.toLowerCase() === savedName.toLowerCase() || s.shortName.toLowerCase() === savedName.toLowerCase()
        );
        if (found) return found;
      }

      if (savedUnitCode) {
        const found = allStores.find((s) => s.unitCode === savedUnitCode);
        if (found) return found;
      }

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

  /**
   * Zmienia aktywną kawiarnię, przełączając dedykowaną bazę SQLite w Electronie
   * oraz zapisując wybór w localStorage i emitując zdarzenie systemowe.
   */
  public static async setCurrentStore(store: StarbucksStore): Promise<{ success: boolean; isNew?: boolean }> {
    try {
      localStorage.setItem(STORAGE_STORE_NAME_KEY, store.name);
      localStorage.setItem(STORAGE_UNIT_CODE_KEY, store.unitCode);
      localStorage.setItem(STORAGE_STORE_MPK_KEY, store.mpk);
      localStorage.setItem(STORAGE_STORE_DISTRICT_KEY, store.district);
      localStorage.setItem(STORAGE_STORE_CITY_KEY, store.city);

      // Przełączenie pliku bazy SQLite w Electronie na bazę tej kawiarni
      const apiObj = (window as any).api || (window as any).electronAPI;
      let switchResult: any = { success: true };
      if (apiObj?.switchStoreDatabase) {
        try {
          switchResult = await apiObj.switchStoreDatabase({
            storeId: store.id,
            storeInfo: {
              name: store.name,
              unitCode: store.unitCode,
              mpk: store.mpk,
              city: store.city,
              district: store.district,
            },
          });
          console.log(`🏬 [StoreService] Przełączono bazę kawiarni: ${switchResult.dbPath} (nowa: ${switchResult.isNew})`);
        } catch (err) {
          console.error('Błąd przełączania bazy kawiarni w SQLite:', err);
        }
      }

      if (apiObj?.saveAppSettings) {
        apiObj.saveAppSettings({
          store_name: store.name,
          unit_code: store.unitCode,
          store_mpk: store.mpk,
          store_district: store.district,
          store_city: store.city,
        }).catch((err: any) => console.warn('Błąd zapisu kawiarni w SQLite:', err));
      }

      logger.info('STORE', `Przełączono aktywną kawiarnię na: ${store.name} (Kod: ${store.unitCode}, MPK: ${store.mpk})`, {
        storeId: store.id,
        unitCode: store.unitCode,
        mpk: store.mpk,
        isNewDb: switchResult?.isNew,
      });

      // Wyemituj zdarzenie w oknie dla natychmiastowej reakcji innych części aplikacji
      window.dispatchEvent(
        new CustomEvent('sbx-store-changed', {
          detail: store,
        })
      );

      return switchResult;
    } catch (e) {
      console.error('Błąd zmiany kawiarni w StoreService:', e);
      return { success: false };
    }
  }

  /**
   * Inicjalizuje synchronizację aktywnej kawiarni z bazą SQLite oraz wczytuje
   * listę własnych kawiarni z trwałego pliku na dysku (custom_stores.json).
   */
  public static async initStore(): Promise<void> {
    const apiObj = (window as any).api || (window as any).electronAPI;

    // 1. Wczytanie własnych kawiarni z trwałego pliku na dysku w Electronie
    if (apiObj?.getCustomStores) {
      try {
        const diskStores: StarbucksStore[] = await apiObj.getCustomStores();
        if (Array.isArray(diskStores) && diskStores.length > 0) {
          const localStores = this.getCustomStores();
          const localMap = new Map(localStores.map(s => [s.id, s]));
          
          // Scal kawiarnie z dysku i z localStorage (dysk ma pierwszeństwo jako trwałe źródło prawdy)
          for (const ds of diskStores) {
            localMap.set(ds.id, { ...ds, isCustom: true });
          }

          const merged = Array.from(localMap.values());
          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(merged));
          
          // Zapewnij, że plik na dysku zawiera pełny zbiór
          if (apiObj.saveCustomStores) {
            await apiObj.saveCustomStores(merged);
          }

          // Powiadom komponenty o zaktualizowaniu listy kawiarni
          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
        } else {
          // Jeśli na dysku pusto, ale w localStorage są zapisane kawiarnie — zrzuć je na dysk!
          const localStores = this.getCustomStores();
          if (localStores.length > 0 && apiObj.saveCustomStores) {
            await apiObj.saveCustomStores(localStores);
          }
        }
      } catch (err) {
        console.warn('Błąd wczytywania custom_stores z dysku:', err);
      }
    }

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
  }

  /**
   * Dodaje nową, spersonalizowaną kawiarnię do pamięci, localStorage oraz trwałego pliku
   * custom_stores.json na dysku komputera, a następnie opcjonalnie ją aktywuje.
   */
  public static async addCustomStore(store: StarbucksStore, activate = true): Promise<{ success: boolean; isNew?: boolean }> {
    try {
      const customStores = this.getCustomStores();
      const existingIdx = customStores.findIndex((s) => s.id === store.id || s.mpk === store.mpk);

      const storeToSave = { ...store, isCustom: true };

      if (existingIdx >= 0) {
        customStores[existingIdx] = storeToSave;
      } else {
        customStores.push(storeToSave);
      }

      // 1. Zapis w localStorage
      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));

      // 2. Trwały zapis na dysku w Electronie
      const apiObj = (window as any).api || (window as any).electronAPI;
      if (apiObj?.saveCustomStores) {
        try {
          await apiObj.saveCustomStores(customStores);
        } catch (diskErr) {
          console.warn('Błąd zapisu kawiarni na dysk:', diskErr);
        }
      }

      window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));

      // 3. Aktywacja nowej kawiarni
      if (activate) {
        return await this.setCurrentStore(storeToSave);
      }

      return { success: true };
    } catch (e) {
      console.error('Błąd dodawania kawiarni w StoreService:', e);
      return { success: false };
    }
  }

  /**
   * Usuwa własną kawiarnię z listy w localStorage oraz na dysku
   */
  public static async removeCustomStore(storeId: string): Promise<void> {
    try {
      const customStores = this.getCustomStores().filter((s) => s.id !== storeId);
      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));

      const apiObj = (window as any).api || (window as any).electronAPI;
      if (apiObj?.saveCustomStores) {
        try {
          await apiObj.saveCustomStores(customStores);
        } catch (diskErr) {
          console.warn('Błąd usuwania kawiarni z dysku:', diskErr);
        }
      }

      window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
    } catch (e) {
      console.error('Błąd usuwania kawiarni w StoreService:', e);
    }
  }
}
