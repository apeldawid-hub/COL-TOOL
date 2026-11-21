// src/components/StoreSwitcherModal.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Store,
  Search,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { StarbucksStore, normalizeDiacritics } from '../constants/starbucksStores';

const ITEM_HEIGHT = 76;
const OVERSCAN = 3;
const VIEWPORT_HEIGHT = 440;

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
  const { currentStore, availableStores, switchStore, isStoreClient } = useStore();

  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);

  // Informacja o sukcesie przełączenia i stanie bazy danych SQLite
  const [switchedStoreId, setSwitchedStoreId] = useState<string | null>(null);
  const [isSwitchingDb, setIsSwitchingDb] = useState<boolean>(false);
  const [dbSwitchStatus, setDbSwitchStatus] = useState<{ isNew?: boolean; storeName?: string } | null>(null);

  // Debouncing zapytań wyszukiwarki (120ms dla optymalnej reaktywności i płynności)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
      setSelectedIndex(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        setScrollTop(0);
      }
    }, 120);
    return () => clearTimeout(handler);
  }, [rawQuery]);

  // Lista unikalnych miast do filtrów
  const cityFilters = useMemo(() => {
    const cities = new Set<string>();
    availableStores.forEach((s) => {
      const mainCity = s.city.split('/')[0].trim();
      cities.add(mainCity);
    });
    return ['ALL', 'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Katowice', 'Łódź', 'Szczecin'];
  }, [availableStores]);

  // Filtrowanie kawiarni z normalizacją polskich znaków diakrytycznych
  const filteredStores = useMemo(() => {
    const qNorm = normalizeDiacritics(debouncedQuery);

    return availableStores.filter((store) => {
      // Filtr miasta
      if (selectedCityFilter !== 'ALL') {
        const cityNorm = normalizeDiacritics(store.city);
        const filterNorm = normalizeDiacritics(selectedCityFilter);
        if (!cityNorm.includes(filterNorm)) {
          return false;
        }
      }

      // Wyszukiwarka tekstowa
      if (!qNorm) return true;

      const nameNorm = normalizeDiacritics(store.name);
      const shortNorm = normalizeDiacritics(store.shortName);
      const cityNorm = normalizeDiacritics(store.city);
      const districtNorm = normalizeDiacritics(store.district);
      const addrNorm = normalizeDiacritics(store.address || '');

      return (
        store.mpk.toLowerCase().includes(qNorm) ||
        store.unitCode.toLowerCase().includes(qNorm) ||
        nameNorm.includes(qNorm) ||
        shortNorm.includes(qNorm) ||
        cityNorm.includes(qNorm) ||
        districtNorm.includes(qNorm) ||
        addrNorm.includes(qNorm)
      );
    });
  }, [availableStores, debouncedQuery, selectedCityFilter]);

  // Wirtualizacja listy (Virtual Windowing)
  const totalItems = filteredStores.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalItems - 1, Math.floor((scrollTop + VIEWPORT_HEIGHT) / ITEM_HEIGHT) + OVERSCAN);

  const visibleItems = useMemo(() => {
    const items: Array<{ index: number; store: StarbucksStore }> = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (filteredStores[i]) {
        items.push({ index: i, store: filteredStores[i] });
      }
    }
    return items;
  }, [filteredStores, startIndex, endIndex]);

  const handleSelectStore = useCallback(async (store: StarbucksStore) => {
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
  }, [switchStore, onStoreSwitched, onClose]);

  // Nawigacja klawiaturą (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.min(totalItems - 1, prev + 1);
          if (scrollContainerRef.current) {
            const itemTop = next * ITEM_HEIGHT;
            const itemBottom = itemTop + ITEM_HEIGHT;
            const currentScroll = scrollContainerRef.current.scrollTop;
            if (itemBottom > currentScroll + VIEWPORT_HEIGHT) {
              scrollContainerRef.current.scrollTop = itemBottom - VIEWPORT_HEIGHT;
            }
          }
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = Math.max(0, prev - 1);
          if (scrollContainerRef.current) {
            const itemTop = next * ITEM_HEIGHT;
            const itemBottom = itemTop + ITEM_HEIGHT;
            const currentScroll = scrollContainerRef.current.scrollTop;
            if (itemTop < currentScroll) {
              scrollContainerRef.current.scrollTop = itemTop;
            }
          }
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filteredStores[selectedIndex];
        if (target) {
          handleSelectStore(target);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [totalItems, selectedIndex, filteredStores, handleSelectStore, onClose]
  );

  if (!isOpen || isStoreClient) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#004d33] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
              <Store className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  Przełącznik Kawiarni Starbucks
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-[10px] font-bold border border-emerald-400/30">
                  {availableStores.length} {availableStores.length === 1 ? 'lokal' : 'lokali'}
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5 font-medium">
                Aktualna kawiarnia:{' '}
                <strong className="text-white">
                  {currentStore.name || 'Wybierz kawiarnię'}
                </strong>{' '}
                {currentStore.mpk ? `(${currentStore.mpk})` : ''}
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

        {/* BELKA INFORMACYJNA */}
        <div className="px-6 py-2.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-stone-600 font-medium flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-[#006241]" />
            <span>Katalog Floty Starbucks — wybierz lokal, aby przełączyć kontekst stacji</span>
          </span>
          <span className="text-[11px] text-stone-400 font-mono">
            {filteredStores.length} {filteredStores.length === 1 ? 'lokal' : 'lokali'}
          </span>
        </div>

        {/* WYSZUKIWARKA & FILTRY */}
        <div className="p-4 bg-white border-b border-stone-200 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                  handleKeyDown(e);
                }
              }}
              placeholder="Wyszukaj kawiarnię po nazwie, MPK, kodzie (np. 18120), mieście lub ulicy..."
              autoFocus
              className="w-full pl-9.5 pr-8 py-2 bg-stone-50 focus:bg-white border border-stone-200 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 rounded-xl text-xs font-medium text-stone-800 transition-all outline-none"
            />
            {rawQuery && (
              <button
                onClick={() => setRawQuery('')}
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
          </div>
        </div>

        {/* LISTA KAWIARNI - WIRTUALIZOWANA */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          className="flex-1 overflow-y-auto relative bg-stone-50/50 p-3"
          style={{ minHeight: '360px', maxHeight: `${VIEWPORT_HEIGHT}px` }}
        >
          {totalItems === 0 ? (
            <div className="py-12 text-center text-stone-500">
              <Store className="w-10 h-10 mx-auto text-stone-300 mb-2" />
              <p className="text-sm font-bold text-stone-700">Nie znaleziono kawiarni</p>
              <p className="text-xs text-stone-500 mt-1">
                Brak wyników dla zapytania „{debouncedQuery || rawQuery}”. Sprawdź pisownię lub kod MPK.
              </p>
            </div>
          ) : (
            <div style={{ height: `${totalItems * ITEM_HEIGHT}px`, position: 'relative', width: '100%' }}>
              {visibleItems.map(({ index, store }) => {
                const isActive = currentStore.id === store.id || currentStore.mpk === store.mpk;
                const isSelected = selectedIndex === index;

                return (
                  <div
                    key={store.id}
                    onClick={() => handleSelectStore(store)}
                    style={{
                      position: 'absolute',
                      top: `${index * ITEM_HEIGHT}px`,
                      left: 0,
                      right: 0,
                      height: `${ITEM_HEIGHT - 6}px`,
                    }}
                    className={`px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isActive
                        ? 'bg-emerald-50/90 border-[#006241] ring-2 ring-[#006241]/20 shadow-xs'
                        : isSelected
                        ? 'bg-stone-100 border-emerald-400 shadow-2xs'
                        : 'bg-white hover:bg-stone-50 border-stone-200/90 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5 flex-1 min-w-0 pr-3">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isActive
                            ? 'bg-[#006241] text-white shadow-sm'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Store className="w-4.5 h-4.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-stone-900 truncate">
                            {store.name}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-[#006241] text-white text-[9px] font-black flex items-center gap-1 shadow-2xs">
                              <Check className="w-2.5 h-2.5" />
                              Aktywna
                            </span>
                          )}
                          {store.type && (
                            <span className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[9px] font-medium">
                              {store.type}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500 truncate">
                          <span>Unit: <strong className="text-stone-800">{store.unitCode}</strong></span>
                          <span>•</span>
                          <span>MPK: <strong className="text-stone-800">{store.mpk}</strong></span>
                          <span>•</span>
                          <span className="text-stone-600 font-medium">{store.city}</span>
                          {store.address && (
                            <>
                              <span>•</span>
                              <span className="text-stone-400 truncate">{store.address}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-100 text-[#006241]'
                            : 'bg-stone-100 hover:bg-[#006241] hover:text-white text-stone-700'
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
              })}
            </div>
          )}
        </div>

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
