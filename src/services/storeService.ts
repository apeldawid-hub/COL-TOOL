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
   * Zmienia aktywną kawiarnię, zapisując wybór w localStorage i bazie SQLite
   */
  public static setCurrentStore(store: StarbucksStore): void {
    try {
      localStorage.setItem(STORAGE_STORE_NAME_KEY, store.name);
      localStorage.setItem(STORAGE_UNIT_CODE_KEY, store.unitCode);
      localStorage.setItem(STORAGE_STORE_MPK_KEY, store.mpk);
      localStorage.setItem(STORAGE_STORE_DISTRICT_KEY, store.district);
      localStorage.setItem(STORAGE_STORE_CITY_KEY, store.city);

      // Zapis w SQLite przez IPC Electrona (jeśli dostępne)
      const apiObj = (window as any).api || (window as any).electronAPI;
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
      });

      // Wyemituj zdarzenie w oknie dla natychmiastowej reakcji innych części aplikacji
      window.dispatchEvent(
        new CustomEvent('sbx-store-changed', {
          detail: store,
        })
      );
    } catch (e) {
      console.error('Błąd zmiany kawiarni w StoreService:', e);
    }
  }

  /**
   * Dodaje nową, spersonalizowaną kawiarnię i opcjonalnie od razu ją aktywuje
   */
  public static addCustomStore(store: StarbucksStore, activate = true): void {
    try {
      const customStores = this.getCustomStores();
      const existingIdx = customStores.findIndex((s) => s.id === store.id || s.mpk === store.mpk);

      const storeToSave = { ...store, isCustom: true };

      if (existingIdx >= 0) {
        customStores[existingIdx] = storeToSave;
      } else {
        customStores.push(storeToSave);
      }

      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));

      if (activate) {
        this.setCurrentStore(storeToSave);
      }
    } catch (e) {
      console.error('Błąd dodawania kawiarni w StoreService:', e);
    }
  }

  /**
   * Usuwa własną kawiarnię z listy
   */
  public static removeCustomStore(storeId: string): void {
    try {
      const customStores = this.getCustomStores().filter((s) => s.id !== storeId);
      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
    } catch (e) {
      console.error('Błąd usuwania kawiarni w StoreService:', e);
    }
  }
}
