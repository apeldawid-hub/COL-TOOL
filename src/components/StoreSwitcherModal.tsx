// src/components/StoreSwitcherModal.tsx
import React, { useState, useMemo } from 'react';
import {
  Store,
  Search,
  CheckCircle2,
  X,
  MapPin,
  Building,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Database,
  Loader2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { StarbucksStore } from '../constants/starbucksStores';

interface StoreSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoreSwitched?: (newStore: StarbucksStore) => void;
}

export const StoreSwitcherModal: React.FC<StoreSwitcherModalProps> = ({
  isOpen,
  onClose,
  onStoreSwitched,
}) => {
  const { currentStore, availableStores, switchStore, addCustomStore, removeCustomStore } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'LIST' | 'ADD_NEW'>('LIST');

  // Formularz dodawania własnej kawiarni
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreMpk, setNewStoreMpk] = useState('');
  const [newStoreUnitCode, setNewStoreUnitCode] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('Warszawa');
  const [newStoreDistrict, setNewStoreDistrict] = useState('Dystrykt Warszawa');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreType, setNewStoreType] = useState<'Mall' | 'Street' | 'Drive-Thru' | 'Office'>('Mall');
  const [formError, setFormError] = useState<string | null>(null);

  // Informacja o sukcesie przełączenia i stanie bazy danych SQLite
  const [switchedStoreId, setSwitchedStoreId] = useState<string | null>(null);
  const [isSwitchingDb, setIsSwitchingDb] = useState<boolean>(false);
  const [dbSwitchStatus, setDbSwitchStatus] = useState<{ isNew?: boolean; storeName?: string } | null>(null);

  // Lista unikalnych miast do filtrów
  const cityFilters = useMemo(() => {
    const cities = new Set<string>();
    availableStores.forEach((s) => {
      const mainCity = s.city.split('/')[0].trim();
      cities.add(mainCity);
    });
    return ['ALL', ...Array.from(cities)];
  }, [availableStores]);

  // Filtrowanie kawiarni
  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableStores.filter((store) => {
      // Filtr miasta
      if (selectedCityFilter === 'CUSTOM') {
        if (!store.isCustom) return false;
      } else if (selectedCityFilter !== 'ALL') {
        if (!store.city.toLowerCase().includes(selectedCityFilter.toLowerCase())) {
          return false;
        }
      }

      // Wyszukiwarka tekstowa
      if (!q) return true;
      return (
        store.name.toLowerCase().includes(q) ||
        store.shortName.toLowerCase().includes(q) ||
        store.mpk.toLowerCase().includes(q) ||
        store.unitCode.toLowerCase().includes(q) ||
        store.city.toLowerCase().includes(q) ||
        store.district.toLowerCase().includes(q) ||
        (store.address && store.address.toLowerCase().includes(q))
      );
    });
  }, [availableStores, searchQuery, selectedCityFilter]);

  if (!isOpen) return null;

  const handleSelectStore = async (store: StarbucksStore) => {
    setIsSwitchingDb(true);
    setSwitchedStoreId(store.id);
    setDbSwitchStatus(null);
    try {
      const result: any = await switchStore(store);
      if (result && typeof result.isNew === 'boolean') {
        setDbSwitchStatus({ isNew: result.isNew, storeName: store.name });
      }
      if (onStoreSwitched) {
        onStoreSwitched(store);
      }
    } catch (e) {
      console.error('Błąd przełączania kawiarni i bazy danych:', e);
    } finally {
      setIsSwitchingDb(false);
      setTimeout(() => {
        setSwitchedStoreId(null);
        setDbSwitchStatus(null);
        onClose();
      }, 550);
    }
  };

  const handleAddNewStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      setFormError('Podaj nazwę kawiarni.');
      return;
    }
    if (!newStoreMpk.trim() && !newStoreUnitCode.trim()) {
      setFormError('Wprowadź kod MPK lub Unit Code kawiarni.');
      return;
    }

    const mpk = newStoreMpk.trim() || newStoreUnitCode.trim();
    const unitCode = newStoreUnitCode.trim() || mpk;
    const name = newStoreName.trim().startsWith('SBX')
      ? newStoreName.trim()
      : `${mpk} SBX ${newStoreName.trim()}`;
    const shortName = `${mpk} ${newStoreName.replace(/^\d+\s*/, '').replace(/^SBX\s*/, '').trim()}`;

    const newStore: StarbucksStore = {
      id: mpk,
      name,
      shortName,
      unitCode,
      mpk,
      city: newStoreCity.trim() || 'Polska',
      district: newStoreDistrict.trim() || 'Dystrykt Starbucks',
      address: newStoreAddress.trim() || 'Kawiarnia Starbucks',
      type: newStoreType,
      isCustom: true,
    };

    addCustomStore(newStore, true);
    if (onStoreSwitched) {
      onStoreSwitched(newStore);
    }

    // Reset formularza
    setNewStoreName('');
    setNewStoreMpk('');
    setNewStoreUnitCode('');
    setNewStoreAddress('');
    setFormError(null);
    setActiveTab('LIST');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#004d33] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#CBA258]/20 border border-[#CBA258]/40 flex items-center justify-center text-[#CBA258] shadow-inner">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                Przełącznik Kawiarni Starbucks
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-600">
                  {availableStores.length} lokali
                </span>
              </h2>
              <p className="text-xs text-emerald-100/80 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Aktualna kawiarnia:</span>
                <strong className="text-white font-bold">{currentStore.name}</strong>
                <span className="text-emerald-300">({currentStore.unitCode})</span>
                {isSwitchingDb && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 text-[10px] animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Przełączanie bazy SQLite...</span>
                  </span>
                )}
                {dbSwitchStatus && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-[10px]">
                    <Database className="w-3 h-3 text-[#CBA258]" />
                    <span>{dbSwitchStatus.isNew ? '✨ Nowa baza danych utworzona!' : '📦 Baza danych załadowana'}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRZEŁĄCZNIK ZAKŁADEK (LISTA vs DODAJ NOWĄ) */}
        <div className="px-6 pt-3 pb-2 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('LIST')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'LIST'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Wszystkie Kawiarnie</span>
            </button>

            <button
              onClick={() => setActiveTab('ADD_NEW')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ADD_NEW'
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Dodaj Nową Kawiarnię</span>
            </button>
          </div>

          <span className="text-[11px] text-stone-500 font-medium hidden sm:inline">
            Wybierz lokal, aby natychmiast zaktualizować kontekst aplikacji
          </span>
        </div>

        {activeTab === 'LIST' ? (
          <>
            {/* WYSZUKIWARKA & FILTRY */}
            <div className="p-4 bg-white border-b border-stone-200 space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Wyszukaj kawiarnię po nazwie, MPK, kodzie (np. 18120), mieście lub ulicy..."
                  autoFocus
                  className="w-full pl-9.5 pr-8 py-2 bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-800 transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Pigułki miast */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-[11px] font-bold text-stone-400 shrink-0 mr-1">Miasto:</span>
                {cityFilters.map((city) => {
                  const isSelected = selectedCityFilter === city;
                  const label = city === 'ALL' ? 'Wszystkie' : city;
                  return (
                    <button
                      key={city}
                      onClick={() => setSelectedCityFilter(city)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E3932] text-white shadow-2xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {availableStores.some((s) => s.isCustom) && (
                  <button
                    onClick={() => setSelectedCityFilter('CUSTOM')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition-all cursor-pointer ${
                      selectedCityFilter === 'CUSTOM'
                        ? 'bg-amber-700 text-white shadow-2xs'
                        : 'bg-amber-100/70 text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    ⭐ Własne
                  </button>
                )}
              </div>
            </div>

            {/* LISTA KAWIARNI */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-stone-50/50">
              {filteredStores.length === 0 ? (
                <div className="py-12 text-center text-stone-500">
                  <Store className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                  <p className="text-sm font-bold text-stone-700">Nie znaleziono kawiarni</p>
                  <p className="text-xs text-stone-500 mt-1">
                    Brak wyników dla zapytania „{searchQuery}”. Możesz dodać tę kawiarnię w zakładce „+ Dodaj Nową”.
                  </p>
                  <button
                    onClick={() => {
                      setNewStoreName(searchQuery);
                      setActiveTab('ADD_NEW');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006241] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#00754A] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Dodaj „{searchQuery}” jako nową kawiarnię
                  </button>
                </div>
              ) : (
                filteredStores.map((store) => {
                  const isActive = currentStore.id === store.id || currentStore.mpk === store.mpk;
                  const isJustSwitched = switchedStoreId === store.id;

                  return (
                    <div
                      key={store.id}
                      onClick={() => handleSelectStore(store)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group flex items-center justify-between ${
                        isActive
                          ? 'bg-emerald-50/90 border-[#006241] ring-2 ring-[#006241]/20 shadow-xs'
                          : 'bg-white hover:bg-stone-50 border-stone-200/90 hover:border-emerald-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0 pr-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isActive
                              ? 'bg-[#006241] text-white shadow-sm'
                              : 'bg-stone-100 text-stone-600 group-hover:bg-emerald-100 group-hover:text-[#006241]'
                          }`}
                        >
                          <Store className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-stone-900 group-hover:text-[#006241] transition-colors truncate">
                              {store.name}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-[#006241] text-white text-[10px] font-black flex items-center gap-1 shadow-2xs">
                                <Check className="w-3 h-3" />
                                Aktywna
                              </span>
                            )}
                            {store.isCustom && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                                Własna
                              </span>
                            )}
                            {store.type && (
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-medium">
                                {store.type}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                            <span>
                              Unit: <strong className="text-stone-800">{store.unitCode}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              MPK: <strong className="text-stone-800">{store.mpk}</strong>
                            </span>
                            <span>•</span>
                            <span className="text-stone-600 font-medium">{store.city}</span>
                            <span>•</span>
                            <span className="text-stone-400 text-[11px] truncate">{store.district}</span>
                          </div>

                          {store.address && (
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-400 truncate">
                              <MapPin className="w-3 h-3 shrink-0 text-stone-400" />
                              <span className="truncate">{store.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {store.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Czy na pewno chcesz usunąć kawiarnię „${store.name}”?`)) {
                                removeCustomStore(store.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Usuń tę kawiarnię"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-100 text-[#006241]'
                              : 'bg-stone-100 group-hover:bg-[#006241] group-hover:text-white text-stone-700'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#006241]" />
                              <span>Wybrana</span>
                            </>
                          ) : (
                            <>
                              <span>Wybierz</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* FORMULARZ DODAWANIA WŁASNEJ KAWIARNI */
          <form onSubmit={handleAddNewStoreSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#006241] shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950">
                <strong className="block font-bold mb-0.5 text-[#006241]">Dodaj nową kawiarnię do bazy programu</strong>
                Wprowadź dane kawiarni Starbucks (MPK, Kod jednostki, miasto i adres). Po zapisaniu kawiarnia pojawi się na stałe na Twojej liście i od razu stanie się aktywna.
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nazwa Kawiarni *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="np. Warszawa Galeria Północna lub 108115 Galeria Północna"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Kod MPK (Kawiarni) *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreMpk}
                  onChange={(e) => setNewStoreMpk(e.target.value)}
                  placeholder="np. 108115"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-mono font-bold text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Kod Jednostki (Unit Code) *
                </label>
                <input
                  type="text"
                  required
                  value={newStoreUnitCode}
                  onChange={(e) => setNewStoreUnitCode(e.target.value)}
                  placeholder="np. 18115 lub 384"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-mono font-bold text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Miasto *
                </label>
                <input
                  type="text"
                  value={newStoreCity}
                  onChange={(e) => setNewStoreCity(e.target.value)}
                  placeholder="np. Warszawa"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Dystrykt Starbucks
                </label>
                <input
                  type="text"
                  value={newStoreDistrict}
                  onChange={(e) => setNewStoreDistrict(e.target.value)}
                  placeholder="np. Dystrykt Warszawa"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Dokładny Adres
                </label>
                <input
                  type="text"
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  placeholder="np. ul. Światowida 17, 03-144 Warszawa"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Typ Lokalu
                </label>
                <select
                  value={newStoreType}
                  onChange={(e: any) => setNewStoreType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#006241] rounded-xl text-xs font-medium text-stone-900 outline-none"
                >
                  <option value="Mall">Centrum Handlowe (Mall)</option>
                  <option value="Street">Lokal Uliczny (Street)</option>
                  <option value="Office">Biurowiec (Office)</option>
                  <option value="Drive-Thru">Drive-Thru</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Zapisz i Przełącz</span>
              </button>
            </div>
          </form>
        )}

        {/* STOPKA MODALA */}
        <div className="px-6 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#006241]" />
            <span className="font-medium">
              Przełączenie kawiarni natychmiast aktualizuje nagłówek, raporty oraz ewidencję MAPAL.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-stone-200/70 border border-stone-300 rounded-xl font-bold text-stone-700 transition-colors cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
