import { StarbucksStore, STARBUCKS_STORES_CATALOG, normalizeDiacritics } from '../constants/starbucksStores';
import { logger } from './logger';
import { StoreStorage } from './storeStorage';
import type { AppRuntimeMode } from './security/profilePolicyService';

export interface StoreSwitchingDetail {
  fromStore: StarbucksStore;
  toStore: StarbucksStore;
  fromStoreId?: string;
  toStoreId?: string;
  timestamp: number;
}

export interface StoreSwitchedDetail {
  previousStore: StarbucksStore;
  currentStore: StarbucksStore;
  isNewDb: boolean;
  timestamp: number;
}

const STORAGE_CUSTOM_STORES_KEY = 'sbx_custom_stores';
const STORAGE_STORE_NAME_KEY = 'sbx_store_name';
const STORAGE_UNIT_CODE_KEY = 'sbx_unit_code';
const STORAGE_STORE_MPK_KEY = 'sbx_store_mpk';
const STORAGE_STORE_DISTRICT_KEY = 'sbx_store_district';
const STORAGE_STORE_CITY_KEY = 'sbx_store_city';

export class StoreService {
  private static cachedAllStores: StarbucksStore[] | null = null;
  private static storeIndexMap: Map<string, StarbucksStore> | null = null;
  private static runtimeSecurityProfile: {
    appMode: AppRuntimeMode | string;
    assignedStoreIds: string[];
  } = {
    appMode: 'STORE_CLIENT',
    assignedStoreIds: [],
  };

  public static setRuntimeSecurityProfile(
    appMode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): void {
    this.runtimeSecurityProfile = {
      appMode: appMode || 'STORE_CLIENT',
      assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
    };
  }

  public static getRuntimeSecurityProfile(): { appMode: AppRuntimeMode | string; assignedStoreIds: string[] } {
    return this.runtimeSecurityProfile;
  }

  /**
   * Usuwa polskie znaki diakrytyczne dla bezbłędnego wyszukiwania (np. "lodz" -> "lodz", "Łódź" -> "lodz")
   */
  public static normalizeDiacritics(str: string): string {
    return normalizeDiacritics(str);
  }

  /**
   * Zwraca listę własnych kawiarni dodanych przez użytkownika
   */
  public static getCustomStores(): StarbucksStore[] {
    if (typeof localStorage === 'undefined') return [];
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
   * Zwraca pełną listę dostępnych kawiarni (wbudowany katalog + własne) z deduplikacją wielokluczową
   */
  public static getAllStores(): StarbucksStore[] {
    if (this.cachedAllStores) {
      return this.cachedAllStores;
    }

    const customStores = this.getCustomStores();

    // Klucze wykluczające: id, mpk, unitCode
    const customIdSet = new Set<string>();
    const customMpkSet = new Set<string>();
    const customUnitCodeSet = new Set<string>();

    for (const cs of customStores) {
      if (cs.id) customIdSet.add(cs.id.toLowerCase().trim());
      if (cs.mpk) customMpkSet.add(cs.mpk.toLowerCase().trim());
      if (cs.unitCode) customUnitCodeSet.add(cs.unitCode.toLowerCase().trim());
    }

    // Filtruj wbudowane kawiarnie, które zostały nadpisane przez własne
    const filteredDefault = STARBUCKS_STORES_CATALOG.filter((s) => {
      const idMatch = customIdSet.has(s.id.toLowerCase().trim());
      const mpkMatch = s.mpk ? customMpkSet.has(s.mpk.toLowerCase().trim()) : false;
      const unitMatch = s.unitCode ? customUnitCodeSet.has(s.unitCode.toLowerCase().trim()) : false;
      return !idMatch && !mpkMatch && !unitMatch;
    });

    const combined = [...filteredDefault, ...customStores];
    this.cachedAllStores = combined;

    // Przebuduj mapę indeksową O(1)
    const index = new Map<string, StarbucksStore>();
    for (const store of combined) {
      if (store.id) index.set(store.id.toLowerCase(), store);
      if (store.mpk) index.set(store.mpk.toLowerCase(), store);
      if (store.unitCode) index.set(store.unitCode.toLowerCase(), store);
    }
    this.storeIndexMap = index;

    return combined;
  }

  /**
   * Czyści cache pamięci podręcznej rejestru po dodaniu/usunięciu kawiarni
   */
  public static invalidateCache(): void {
    this.cachedAllStores = null;
    this.storeIndexMap = null;
  }

  /**
   * Wyszukiwanie O(1) po dowolnym unikalnym identyfikatorze
   */
  public static findStoreByIdOrCode(idOrCode: string): StarbucksStore | undefined {
    if (!idOrCode) return undefined;
    if (!this.storeIndexMap) {
      this.getAllStores();
    }
    return this.storeIndexMap?.get(idOrCode.toLowerCase().trim());
  }

  /**
   * Sprawdza, czy dana kawiarnia pasuje do listy przypisanych identyfikatorów (id, unitCode, mpk)
   */
  public static isStoreAssigned(store: StarbucksStore, assignedStoreIds: string[]): boolean {
    if (!assignedStoreIds || !Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;
    const normalizedAssigned = assignedStoreIds
      .filter(Boolean)
      .map((id) => String(id).trim().toLowerCase());

    const matches = (candidate?: string) =>
      Boolean(candidate && normalizedAssigned.includes(String(candidate).trim().toLowerCase()));

    return matches(store.id) || matches(store.unitCode) || matches(store.mpk);
  }

  /**
   * Zwraca listę kawiarni dopuszczonych dla danego profilu runtime.
   * - FLEET_MASTER: pełna lista 100+ kawiarni
   * - STORE_CLIENT: ściśle lista przypisanych lokali
   */
  public static getAvailableStoresForProfile(
    mode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): StarbucksStore[] {
    const allStores = this.getAllStores();
    const isFleetMaster = String(mode || '').trim().toUpperCase() === 'FLEET_MASTER';
    if (isFleetMaster) {
      return allStores;
    }

    if (!assignedStoreIds || assignedStoreIds.length === 0) {
      const current = this.getCurrentStore();
      return current.id ? [current] : [];
    }

    const filtered = allStores.filter((store) => this.isStoreAssigned(store, assignedStoreIds));
    if (filtered.length === 0) {
      const current = this.getCurrentStore();
      if (current.id && this.isStoreAssigned(current, assignedStoreIds)) {
        return [current];
      }
    }
    return filtered;
  }

  /**
   * Sprawdza czy użytkownik skonfigurował już kawiarnię (zakończył onboarding)
   */
  public static hasConfiguredStore(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY)?.trim();
      const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY)?.trim();
      const isOnboarded = localStorage.getItem('sbx_onboarding_completed') === 'true';
      return Boolean((savedName || savedUnitCode) && isOnboarded);
    } catch {
      return false;
    }
  }

  /**
   * Zwraca aktualnie aktywną kawiarnię
   */
  public static getCurrentStore(): StarbucksStore {
    if (typeof localStorage !== 'undefined') {
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

  /**
   * Zmienia aktywną kawiarnię, przełączając dedykowaną bazę SQLite w Electronie
   * oraz zapisując wybór w localStorage i emitując zdarzenie systemowe.
   */
  public static async setCurrentStore(
    store: StarbucksStore,
    securityContext?: { appMode: AppRuntimeMode | string; assignedStoreIds?: string[] }
  ): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
    const effectiveAssigned = securityContext?.assignedStoreIds ?? this.runtimeSecurityProfile.assignedStoreIds;

    // Fail-Closed Security Guard: Only explicit FLEET_MASTER can switch to any store.
    // All other modes (STORE_CLIENT, lowercase 'store_client', or tampered values) are restricted.
    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
    if (!isFleetMaster) {
      if (!this.isStoreAssigned(store, effectiveAssigned)) {
        logger.warn('SECURITY', `[Access Denied] Zablokowano próbę zmiany kawiarni na ${store.name} (${store.id}) na stacji klienckiej.`, {
          storeId: store.id,
          assignedStoreIds: effectiveAssigned,
        });
        throw new Error(`UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`);
      }
    }

    try {
      const prevStore = this.getCurrentStore();

      // Faza 1: Rozgłoś zamiar przełączenia kawiarni (pozwala widokom i subskrypcjom na anulowanie timerów i bezpieczne zrzucenie stanu)
      const switchingDetail: StoreSwitchingDetail = {
        fromStore: prevStore,
        toStore: store,
        fromStoreId: prevStore.id,
        toStoreId: store.id,
        timestamp: Date.now(),
      };
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          if (typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('sbx:store-switching', { detail: switchingDetail })
            );
          } else {
            window.dispatchEvent({ type: 'sbx:store-switching', detail: switchingDetail } as any);
          }
        } catch (eventErr) {
          console.warn('[StoreService] Failed to dispatch sbx:store-switching event:', eventErr);
        }
      }

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_STORE_NAME_KEY, store.name);
          localStorage.setItem(STORAGE_UNIT_CODE_KEY, store.unitCode);
          localStorage.setItem(STORAGE_STORE_MPK_KEY, store.mpk);
          localStorage.setItem(STORAGE_STORE_DISTRICT_KEY, store.district);
          localStorage.setItem(STORAGE_STORE_CITY_KEY, store.city);
        } catch (storageErr) {
          console.warn('[StoreService] Failed to persist store to localStorage:', storageErr);
        }
      }

      // Przełączenie pliku bazy SQLite w Electronie na bazę tej kawiarni
      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
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

      // Faza 2: Baza i stan systemowy zostały przełączone — wyemituj sbx:store-switched oraz wstecznie kompatybilne sbx-store-changed
      const switchedDetail: StoreSwitchedDetail = {
        previousStore: prevStore,
        currentStore: store,
        isNewDb: Boolean(switchResult?.isNew),
        timestamp: Date.now(),
      };
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          if (typeof CustomEvent !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('sbx:store-switched', { detail: switchedDetail })
            );
            window.dispatchEvent(
              new CustomEvent('sbx-store-changed', { detail: store })
            );
          } else {
            window.dispatchEvent({ type: 'sbx:store-switched', detail: switchedDetail } as any);
            window.dispatchEvent({ type: 'sbx-store-changed', detail: store } as any);
          }
        } catch (eventErr) {
          console.warn('[StoreService] Failed to dispatch store switched events:', eventErr);
        }
      }

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
    // 0. Migracja kluczy legacy z wersji pojedynczego sklepu dla 108120
    try {
      StoreStorage.migrateLegacyKeys('108120');
    } catch (e) {
      console.warn('Błąd migracji kluczy legacy w StoreStorage:', e);
    }

    const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;

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
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(merged));
            } catch {}
          }
          this.invalidateCache();
          
          // Zapewnij, że plik na dysku zawiera pełny zbiór
          if (apiObj.saveCustomStores) {
            await apiObj.saveCustomStores(merged);
          }

          // Powiadom komponenty o zaktualizowaniu listy kawiarni
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
            } catch {}
          }
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

    // 2. Synchronizacja bazy tylko jeśli użytkownik skonfigurował już kawiarnię (po onboarding)
    if (this.hasConfiguredStore() && apiObj?.switchStoreDatabase) {
      const current = this.getCurrentStore();
      if (current.id) {
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
  }

  /**
   * Dodaje nową, spersonalizowaną kawiarnię do pamięci, localStorage oraz trwałego pliku
   * custom_stores.json na dysku komputera, a następnie opcjonalnie ją aktywuje.
   */
  public static async addCustomStore(
    store: StarbucksStore,
    activate = true,
    securityContext?: { appMode: AppRuntimeMode | string }
  ): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
    if (!isFleetMaster) {
      logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
      throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
    }

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
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
        } catch (storageErr) {
          console.warn('[StoreService] Failed to save custom stores to localStorage:', storageErr);
        }
      }
      this.invalidateCache();

      // 2. Trwały zapis na dysku w Electronie
      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
      if (apiObj?.saveCustomStores) {
        try {
          await apiObj.saveCustomStores(customStores);
        } catch (diskErr) {
          console.warn('Błąd zapisu kawiarni na dysk:', diskErr);
        }
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
        } catch {}
      }

      // 3. Aktywacja nowej kawiarni
      if (activate) {
        return await this.setCurrentStore(storeToSave, { appMode: 'FLEET_MASTER' });
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
  public static async removeCustomStore(
    storeId: string,
    securityContext?: { appMode: AppRuntimeMode | string }
  ): Promise<void> {
    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
    if (!isFleetMaster) {
      logger.warn('SECURITY', `[Access Denied] Usuwanie kawiarni jest zablokowane na stacji klienckiej.`);
      throw new Error('UnauthorizedStoreRemovalError: Niedozwolone w trybie STORE_CLIENT — usuwanie kawiarni zablokowane.');
    }

    try {
      const customStores = this.getCustomStores().filter((s) => s.id !== storeId);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
        } catch (storageErr) {
          console.warn('[StoreService] Failed to update custom stores in localStorage:', storageErr);
        }
      }
      this.invalidateCache();

      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
      if (apiObj?.saveCustomStores) {
        try {
          await apiObj.saveCustomStores(customStores);
        } catch (diskErr) {
          console.warn('Błąd usuwania kawiarni z dysku:', diskErr);
        }
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
        } catch {}
      }
    } catch (e) {
      console.error('Błąd usuwania kawiarni w StoreService:', e);
    }
  }
}
