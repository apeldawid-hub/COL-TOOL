import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreService } from '../../src/services/storeService';
import { FleetService } from '../../src/services/admin/fleetService';
import { StarbucksStore } from '../../src/constants/starbucksStores';

test('Flota Kawiarni: Dodawanie nowej kawiarni i jej persystencja we flocie', async (t) => {
  // Ustawienie profilu Fleet Master
  StoreService.setRuntimeSecurityProfile('FLEET_MASTER', []);

  // Symulacja środowiska przeglądarkowego dla localStorage i CustomEvent
  const originalLocalStorage = global.localStorage;
  const storeMap = new Map<string, string>();
  (global as any).localStorage = {
    getItem: (k: string) => storeMap.get(k) || null,
    setItem: (k: string, v: string) => storeMap.set(k, v),
    removeItem: (k: string) => storeMap.delete(k),
    clear: () => storeMap.clear(),
  };

  const originalWindow = global.window;
  const eventListeners: Record<string, Function[]> = {};
  (global as any).window = {
    addEventListener: (type: string, listener: Function) => {
      eventListeners[type] = eventListeners[type] || [];
      eventListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: Function) => {
      if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter((l) => l !== listener);
      }
    },
    dispatchEvent: (event: any) => {
      const type = event.type || event;
      (eventListeners[type] || []).forEach((fn) => fn(event));
      return true;
    },
  };
  (global as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };

  t.after(() => {
    (global as any).localStorage = originalLocalStorage;
    (global as any).window = originalWindow;
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
    StoreService.invalidateCache();
  });

  const testStore: StarbucksStore = {
    id: '108999',
    mpk: '108999',
    unitCode: '18999',
    name: '108999 SBX Kraków Galeria Krakowska',
    shortName: '108999 Galeria Krakowska',
    city: 'Kraków',
    district: 'Dystrykt Południe',
    address: 'ul. Pawia 5',
    type: 'Mall',
    isCustom: true,
  };

  await t.test('1. Dodanie kawiarni zapisuje ją w StoreService i czyni widoczną w getAllStores()', async () => {
    const addResult = await StoreService.addCustomStore(testStore, false, { appMode: 'FLEET_MASTER' });
    assert.equal(addResult.success, true, 'Dodawanie kawiarni powinno zwrócić sukces');

    const allStores = StoreService.getAllStores();
    const foundInAll = allStores.find((s) => s.id === '108999' || s.mpk === '108999');
    assert.ok(foundInAll, 'Nowa kawiarnia musi być obecna w StoreService.getAllStores()');
    assert.equal(foundInAll.unitCode, '18999');
    assert.equal(foundInAll.city, 'Kraków');
  });

  await t.test('2. Nowa kawiarnia jest natychmiast widoczna w getFleetStores() serwisu floty', () => {
    const fleetService = FleetService.getInstance();
    const fleetStores = fleetService.getFleetStores();
    const foundInFleet = fleetStores.find((s) => s.id === '108999' || s.unitCode === '18999');
    assert.ok(foundInFleet, 'Nowa kawiarnia musi pojawić się w spisie floty getFleetStores()');
    assert.equal(foundInFleet.name, testStore.name);
    assert.equal(foundInFleet.district, 'Dystrykt Południe');
  });

  await t.test('3. Usunięcie własnej kawiarni aktualizuje stan floty', async () => {
    await StoreService.removeCustomStore('108999', { appMode: 'FLEET_MASTER' });
    const allStores = StoreService.getAllStores();
    const foundInAll = allStores.find((s) => s.id === '108999');
    assert.equal(foundInAll, undefined, 'Usunięta kawiarnia nie może być obecna w getAllStores()');

    const fleetService = FleetService.getInstance();
    const fleetStores = fleetService.getFleetStores();
    const foundInFleet = fleetStores.find((s) => s.id === '108999');
    assert.equal(foundInFleet, undefined, 'Usunięta kawiarnia nie może być obecna we flocie');
  });
});
