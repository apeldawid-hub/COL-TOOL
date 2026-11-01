// src/components/admin/FleetMasterDashboard.tsx
/**
 * Starbucks Operations Suite — Fleet Master Control Center Dashboard
 * Central command center for District Managers and Corporate Executives.
 * Manages 100+ stores catalog, cryptographic license provisioning,
 * remote emergency kill-switch controls, and security audit log.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Key,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Copy,
  ExternalLink,
  RefreshCw,
  Building2,
  MapPin,
  Lock,
  Unlock,
  Radio,
  FileText,
  UserCheck,
  Check,
  PlusCircle,
  ChevronRight,
  Database,
  ArrowRight,
  Info,
  Server,
} from 'lucide-react';
import { STARBUCKS_STORES_CATALOG, StarbucksStore, normalizeDiacritics } from '../../constants/starbucksStores';
import { fleetService } from '../../services/admin/fleetService';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../version';
import { QrCodeSvg } from './fleet/QrCodeSvg';
import type {
  FleetStoreRecord,
  FleetSummaryStats,
  FleetAuditRecord,
  FleetStoreHealth,
  FleetFilterState,
  ProvisionLicensePayload,
  KillSwitchPayload,
} from '../../types/fleet';

interface FleetMasterDashboardProps {
  onNavigateToStore?: (storeId: string) => void;
}

export const FleetMasterDashboard: React.FC<FleetMasterDashboardProps> = ({ onNavigateToStore }) => {
  const { switchStore, currentStore } = useStore();
  const { currentSession } = useAuth();

  const [stores, setStores] = useState<FleetStoreRecord[]>(() => fleetService.getFleetStores());
  const [stats, setStats] = useState<FleetSummaryStats>(() => fleetService.getSummaryStats());
  const [auditLogs, setAuditLogs] = useState<FleetAuditRecord[]>(() => fleetService.getAuditLogs());

  // Aktywna zakładka
  const [activeTab, setActiveTab] = useState<'katalog' | 'licencje' | 'killswitch' | 'audyt'>('katalog');

  // Filtrowanie katalogu
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedHealth, setSelectedHealth] = useState<'ALL' | FleetStoreHealth>('ALL');

  // Modale operacyjne
  const [provisionModalStore, setProvisionModalStore] = useState<FleetStoreRecord | null>(null);
  const [killSwitchModalStore, setKillSwitchModalStore] = useState<FleetStoreRecord | null>(null);

  // Formularz generowania licencji
  const [provTier, setProvTier] = useState<'STORE_CLIENT' | 'FLEET_MASTER'>('STORE_CLIENT');
  const [provValidityDays, setProvValidityDays] = useState<number>(365);
  const [provManagerName, setProvManagerName] = useState<string>('Store Manager');
  const [provManagerEmail, setProvManagerEmail] = useState<string>('store.manager@starbucks.com');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedInstructions, setCopiedInstructions] = useState<boolean>(false);

  // Formularz Kill-Switch
  const [ksReason, setKsReason] = useState<string>('Kradzież lub zagubienie laptopa (Stolen / Lost Hardware)');
  const [ksCustomDetails, setKsCustomDetails] = useState<string>('');
  const [ksChallengeInput, setKsChallengeInput] = useState<string>('');
  const [ksError, setKsError] = useState<string | null>(null);

  // Subskrypcja na aktualizacje floty
  useEffect(() => {
    const unsub = fleetService.subscribe(() => {
      setStores(fleetService.getFleetStores());
      setStats(fleetService.getSummaryStats());
      setAuditLogs(fleetService.getAuditLogs());
    });
    return unsub;
  }, []);

  // Lista unikalnych dystryktów do filtra
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    STARBUCKS_STORES_CATALOG.forEach((s) => {
      if (s.district) set.add(s.district);
    });
    return Array.from(set).sort();
  }, []);

  // Filtrowanie wielotokenowe i bez polskich znaków
  const filteredStores = useMemo(() => {
    const tokens = normalizeDiacritics(searchQuery.trim().toLowerCase())
      .split(/\s+/)
      .filter(Boolean);

    return stores.filter((store) => {
      if (tokens.length > 0) {
        const blob = normalizeDiacritics(
          `${store.id} ${store.unitCode} ${store.mpk} ${store.name} ${store.shortName} ${store.city} ${store.district} ${store.address}`
        ).toLowerCase();
        const matchesAll = tokens.every((token) => blob.includes(token));
        if (!matchesAll) return false;
      }

      if (selectedDistrict !== 'ALL' && store.district !== selectedDistrict) {
        return false;
      }

      if (selectedHealth !== 'ALL' && store.health !== selectedHealth) {
        return false;
      }

      return true;
    });
  }, [stores, searchQuery, selectedDistrict, selectedHealth]);

  // Przełączenie do lokalu
  const handleInspectStore = async (storeId: string) => {
    await switchStore(storeId);
    if (onNavigateToStore) {
      onNavigateToStore(storeId);
    }
  };

  // Obsługa generowania licencji
  const handleGenerateKey = () => {
    if (!provisionModalStore) return;
    const payload: ProvisionLicensePayload = {
      storeId: provisionModalStore.id,
      tier: provTier,
      validityDays: provValidityDays,
      requireHardwareLock: true,
      authorizedManagerName: provManagerName.trim() || 'Store Manager',
      authorizedManagerEmail: provManagerEmail.trim() || 'store.manager@starbucks.com',
      notes: `Wygenerowano przez ${currentSession?.fullName || 'District Manager'} z Centrali Floty`,
    };

    const res = fleetService.provisionLicense(payload);
    if (res.success && res.key) {
      setGeneratedKey(res.key);
    }
  };

  // Kopiowanie klucza do schowka
  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Kopiowanie instrukcji wdrożeniowej dla SM
  const handleCopyInstructions = () => {
    if (!generatedKey || !provisionModalStore) return;
    const expiryStr = provValidityDays > 0 ? `Ważny przez ${provValidityDays} dni` : 'Licencja bezterminowa';
    const text = `Cześć ${provManagerName},\n\nOto oficjalny klucz aktywacyjny stacji roboczej Starbucks Operations Suite dla lokalu:\n📍 Lokal: ${provisionModalStore.name} (Unit: ${provisionModalStore.unitCode}, MPK: ${provisionModalStore.mpk})\n🔑 Klucz aktywacyjny: ${generatedKey}\n🛡️ Typ profilu: ${provTier}\n⏳ Ważność: ${expiryStr} (Wymagana blokada sprzętowa laptopa)\n\nINSTRUKCJA AKTYWACJI:\n1. Uruchom aplikację na laptopie zaplecza kawiarni.\n2. W oknie aktywacji wklej powyższy klucz licencyjny.\n3. Kliknij "Zweryfikuj i Aktywuj Stację".\n4. Aplikacja automatycznie powiąże lokalną bazę danych ze sprzętem laptopa.\n\nW razie pytań skontaktuj się z Centralą Floty / District Managerem.`;

    navigator.clipboard.writeText(text);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2500);
  };

  // Obsługa wykonania Kill-Switch
  const handleConfirmKillSwitch = () => {
    if (!killSwitchModalStore) return;
    setKsError(null);

    const payload: KillSwitchPayload = {
      storeId: killSwitchModalStore.id,
      reason: ksReason,
      customDetails: ksCustomDetails.trim() || undefined,
      actorName: currentSession?.fullName || 'District Manager',
      actorEmail: currentSession?.email || 'admin.hq@starbucks.com',
      confirmationChallenge: ksChallengeInput,
    };

    const res = fleetService.applyKillSwitch(payload);
    if (res.success) {
      setKillSwitchModalStore(null);
      setKsChallengeInput('');
      setKsCustomDetails('');
    } else {
      setKsError(res.error || 'Błąd wykonania Kill-Switch');
    }
  };

  // Obsługa przywrócenia stacji
  const handleRestoreStore = (storeId: string) => {
    fleetService.restoreStation(
      storeId,
      currentSession?.fullName || 'District Manager',
      currentSession?.email || 'admin.hq@starbucks.com'
    );
  };

  // Pobranie pliku CSV z audytem
  const handleDownloadAuditCsv = () => {
    const csv = fleetService.exportAuditLogsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `starbucks_fleet_security_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pobranie katalogu kawiarni
  const handleDownloadCatalogCsv = () => {
    const csv = fleetService.exportStoreCatalogCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `starbucks_stores_fleet_inventory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F7F5] text-stone-800 pb-20 select-none">
      {/* 1. GÓRNY PASEK CENTRALI FLOTY */}
      <header className="bg-[#1E3932] text-white px-5 py-4 shrink-0 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#006241] flex items-center justify-center text-white border border-emerald-400/30 shadow-xs">
              <ShieldCheck className="w-6 h-6 text-[#CBA258]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wide text-white">
                  STARBUCKS FLEET MASTER HQ
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-[#006241] text-emerald-200 text-[10px] font-mono font-bold tracking-wider uppercase border border-emerald-400/30">
                  Profil: FLEET_MASTER
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-stone-200 text-[10px] font-mono font-bold">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Centrala Nadzorcza & Prowizjonowanie Stacji (100+ Kawiarni w Polsce)
              </p>
            </div>
          </div>

          {/* Szybkie akcje i eksport */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadCatalogCsv}
              title="Eksportuj spis inwentarza kawiarni do formatu CSV"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer border border-white/10"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Eksport Floty CSV</span>
            </button>
            <button
              onClick={handleDownloadAuditCsv}
              title="Pobierz dziennik audytu bezpieczeństwa floty"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer border border-white/10"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dziennik Audytu</span>
            </button>
          </div>
        </div>

        {/* BIEŻĄCA INSPEKCJA LOKALU */}
        {currentStore.id && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <span className="text-emerald-300">Podgląd operacyjny kawiarni:</span>
              <strong className="text-white font-bold">{currentStore.name}</strong>
              <span className="font-mono text-emerald-200 bg-black/20 px-1.5 py-0.2 rounded">
                Unit {currentStore.unitCode}
              </span>
            </div>
            <button
              onClick={() => onNavigateToStore && onNavigateToStore(currentStore.id)}
              className="text-[#CBA258] hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <span>Otwórz moduły kawiarni</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* 2. KARTY PODSUMOWANIA KPI FLOTY */}
      <section className="px-5 py-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Wszystkie Kawiarnie */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
            <div className="text-[11px] font-bold text-stone-500 uppercase">Kawiarnie Floty</div>
            <div className="text-2xl font-black text-[#1E3932] mt-1">{stats.totalStores}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">Wszystkie jednostki</div>
          </div>

          {/* Aktywne Licencje */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
              <Key className="w-3 h-3 text-emerald-600" />
              <span>Licencje</span>
            </div>
            <div className="text-2xl font-black text-[#006241] mt-1">{stats.activeLicensedStores}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">Aktywowane stacje</div>
          </div>

          {/* Online Teraz */}
          <div className="bg-white p-3.5 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs">
            <div className="text-[11px] font-bold text-blue-800 uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-blue-600" />
              <span>Online Teraz</span>
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1">{stats.onlineNowStores}</div>
            <div className="text-[10px] text-blue-700 mt-0.5">&lt; 2h łączność</div>
          </div>

          {/* Ostrzeżenia */}
          <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Ostrzeżenia</span>
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">{stats.warningStores}</div>
            <div className="text-[10px] text-amber-700 mt-0.5">Wersja / Parity</div>
          </div>

          {/* Offline */}
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs">
            <div className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-400" />
              <span>Offline</span>
            </div>
            <div className="text-2xl font-black text-stone-700 mt-1">{stats.offlineStores}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">Brak łączności</div>
          </div>

          {/* Revoked Kill-Switch */}
          <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-2xs">
            <div className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-600" />
              <span>Kill-Switch</span>
            </div>
            <div className="text-2xl font-black text-rose-700 mt-1">{stats.revokedStores}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">Zablokowane stacje</div>
          </div>
        </div>
      </section>

      {/* 3. ZAKŁADKI CENTRALI */}
      <section className="px-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-2 border-b border-stone-200 pb-2">
          <button
            onClick={() => setActiveTab('katalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'katalog'
                ? 'bg-[#006241] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Katalog Floty (100+)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {filteredStores.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('licencje')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'licencje'
                ? 'bg-[#006241] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Prowizjonowanie Licencji</span>
          </button>

          <button
            onClick={() => setActiveTab('killswitch')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'killswitch'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Centrum Kill-Switch</span>
            {stats.revokedStores > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {stats.revokedStores}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audyt')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'audyt'
                ? 'bg-[#006241] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Dziennik Bezpieczeństwa</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {auditLogs.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. TREŚĆ WYBRANEJ ZAKŁADKI */}
      <main className="px-5 py-4 max-w-7xl mx-auto w-full flex-1">
        {/* ZAKŁADKA 1: KATALOG FLOTY */}
        {activeTab === 'katalog' && (
          <div className="space-y-4">
            {/* Pasek Wyszukiwania i Filtrów */}
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj kawiarni (np. 'janki', 'nowy swiat', '18120', 'krakow', '108046')..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#006241] focus:bg-white"
                />
              </div>

              {/* Dystrykt */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 font-medium text-stone-700"
                >
                  <option value="ALL">Wszystkie Dystrykty ({stores.length})</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* Stan zdrowia */}
                <select
                  value={selectedHealth}
                  onChange={(e) => setSelectedHealth(e.target.value as any)}
                  className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 font-medium text-stone-700"
                >
                  <option value="ALL">Wszystkie Statusy</option>
                  <option value="healthy">Zdrowa (Healthy)</option>
                  <option value="warning">Ostrzeżenie (Warning)</option>
                  <option value="offline">Offline</option>
                  <option value="revoked">Kill-Switch (Revoked)</option>
                  <option value="unprovisioned">Brak Licencji</option>
                </select>
              </div>
            </div>

            {/* Tabela Kawiarni */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Nazwa Kawiarni</th>
                      <th className="py-2.5 px-3">Miasto / Dystrykt</th>
                      <th className="py-2.5 px-3">Stan Zdrowia</th>
                      <th className="py-2.5 px-3">Status Licencji</th>
                      <th className="py-2.5 px-3">Wersja</th>
                      <th className="py-2.5 px-3 text-right">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredStores.map((store) => (
                      <tr key={store.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-stone-700">
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">
                            {store.unitCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#1E3932]">{store.shortName || store.name}</div>
                          <div className="text-[10px] text-stone-400 font-mono">MPK: {store.mpk}</div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">
                          <div>{store.city}</div>
                          <div className="text-[10px] text-stone-400">{store.district}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {store.health === 'healthy' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              <span>Zdrowa</span>
                            </span>
                          )}
                          {store.health === 'warning' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-amber-200" title={store.healthReason}>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              <span>{store.healthReason || 'Ostrzeżenie'}</span>
                            </span>
                          )}
                          {store.health === 'offline' && (
                            <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full font-bold text-[10px] border border-stone-200" title={store.healthReason}>
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                              <span>Offline</span>
                            </span>
                          )}
                          {store.health === 'revoked' && (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-rose-300" title={store.healthReason}>
                              <Flame className="w-3 h-3 text-rose-600" />
                              <span>REVOKED</span>
                            </span>
                          )}
                          {store.health === 'unprovisioned' && (
                            <span className="inline-flex items-center gap-1 text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full font-medium text-[10px]">
                              Brak klucza
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {store.licenseStatus === 'ACTIVE' && (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Aktywna</span>
                            </span>
                          )}
                          {store.licenseStatus === 'REVOKED' && (
                            <span className="text-rose-700 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Zablokowana</span>
                            </span>
                          )}
                          {store.licenseStatus === 'UNPROVISIONED' && (
                            <span className="text-stone-400">Nieprzypisana</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-stone-600">
                          {store.appVersion ? `v${store.appVersion}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Przełącz na ten lokal */}
                            <button
                              onClick={() => handleInspectStore(store.id)}
                              title="Przełącz aktywny lokal i otwórz moduły operacyjne"
                              className="p-1.5 rounded-lg text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            {/* Prowizjonuj klucz */}
                            <button
                              onClick={() => {
                                setProvisionModalStore(store);
                                setGeneratedKey(null);
                              }}
                              title="Wygeneruj lub odnów klucz licencyjny"
                              className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {/* Kill-Switch / Przywróć */}
                            {store.isKillSwitchRevoked ? (
                              <button
                                onClick={() => handleRestoreStore(store.id)}
                                title="Przywróć autoryzację stacji po zablokowaniu"
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                Przywróć
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setKillSwitchModalStore(store);
                                  setKsChallengeInput('');
                                  setKsError(null);
                                }}
                                title="Zastosuj awaryjny Kill-Switch"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Flame className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA 2: PROWIZJONOWANIE LICENCJI */}
        {activeTab === 'licencje' && (
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs max-w-2xl mx-auto space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-stone-200">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#006241]">
                <Key className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1E3932]">Generator Kluczy Aktywacyjnych Stacji</h3>
                <p className="text-xs text-stone-500">
                  Generuje oficjalne, kryptograficznie podpisane klucze licencyjne Starbucks HMAC-SHA256.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 font-bold mb-1">Wybierz Kawiarnię Docelową:</label>
                <select
                  value={provisionModalStore?.id || ''}
                  onChange={(e) => {
                    const found = stores.find((s) => s.id === e.target.value);
                    setProvisionModalStore(found || null);
                    setGeneratedKey(null);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800"
                >
                  <option value="">-- Wybierz lokal z listy (100+) --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      Unit {s.unitCode} • {s.shortName || s.name} ({s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 font-bold mb-1">Typ Profilu:</label>
                  <select
                    value={provTier}
                    onChange={(e) => setProvTier(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="STORE_CLIENT">STORE_CLIENT (Stacja Zaplecza)</option>
                    <option value="FLEET_MASTER">FLEET_MASTER (Centrala HQ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-600 font-bold mb-1">Okres Ważności:</label>
                  <select
                    value={provValidityDays}
                    onChange={(e) => setProvValidityDays(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value={30}>30 dni (Okres Próbny / Pilotaż)</option>
                    <option value={90}>90 dni (Kwartalny)</option>
                    <option value={365}>365 dni (Roczny)</option>
                    <option value={0}>Bezterminowo (Stała Stacja)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 font-bold mb-1">Imię i Nazwisko SM:</label>
                  <input
                    type="text"
                    value={provManagerName}
                    onChange={(e) => setProvManagerName(e.target.value)}
                    placeholder="np. Dawid Apel"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-stone-600 font-bold mb-1">Firmowy Adres E-mail:</label>
                  <input
                    type="email"
                    value={provManagerEmail}
                    onChange={(e) => setProvManagerEmail(e.target.value)}
                    placeholder="np. dawid.apel@amrest.eu"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateKey}
                disabled={!provisionModalStore}
                className="w-full py-2.5 rounded-xl bg-[#006241] hover:bg-[#004f34] disabled:bg-stone-300 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <Key className="w-4 h-4 text-[#CBA258]" />
                <span>Wygeneruj Oficjalny Klucz Aktywacyjny</span>
              </button>

              {/* WYNIK GENEROWANIA KLUCZA */}
              {generatedKey && (
                <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase">
                      Wygenerowany Klucz Aktywacyjny:
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">HMAC-SHA256 Podpisany ✓</span>
                  </div>

                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-emerald-200 font-mono text-xs font-bold text-[#1E3932]">
                    <span className="break-all">{generatedKey}</span>
                    <button
                      onClick={handleCopyKey}
                      className="ml-2 p-1.5 rounded-lg text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                      title="Skopiuj sam klucz"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* KOD QR SVG */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-emerald-200">
                    <QrCodeSvg value={generatedKey} size={110} />
                    <div className="text-xs text-stone-600 space-y-1">
                      <div className="font-bold text-[#1E3932]">Klucz powiązany z lokalem:</div>
                      <div>Unit {provisionModalStore?.unitCode} • {provisionModalStore?.name}</div>
                      <div className="text-[11px] text-stone-500">
                        Zeskanuj kod aparatem lub skopiuj instrukcję do wiadomości e-mail/Teams dla Store Managera.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyInstructions}
                    className="w-full py-2 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-[#006241] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {copiedInstructions ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Skopiowano instrukcję wdrożeniową!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Kopiuj Gotową Instrukcję Wdrożeniową dla SM</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ZAKŁADKA 3: CENTRUM KILL-SWITCH */}
        {activeTab === 'killswitch' && (
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-2xs max-w-2xl mx-auto space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-rose-200">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">Centrum Awaryjnego Odcięcia (Kill-Switch)</h3>
                <p className="text-xs text-stone-500">
                  Permanentna lub tymczasowa blokada stacji roboczej na zapleczu kawiarni.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-stone-600">
                Aktywacja procedury Kill-Switch powoduje natychmiastowe unieważnienie licencji,
                wyczyszczenie kluczy szyfrujących w pamięci RAM (<code className="bg-stone-100 px-1 rounded">StoreKeyCache.clear()</code>)
                oraz zablokowanie interfejsu stacji roboczej przy najbliższej synchronizacji lub restarcie.
              </p>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Wybierz Stację do Zablokowania:</label>
                <select
                  value={killSwitchModalStore?.id || ''}
                  onChange={(e) => {
                    const found = stores.find((s) => s.id === e.target.value);
                    setKillSwitchModalStore(found || null);
                    setKsChallengeInput('');
                    setKsError(null);
                  }}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800"
                >
                  <option value="">-- Wybierz lokal z listy --</option>
                  {stores
                    .filter((s) => !s.isKillSwitchRevoked)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Unit {s.unitCode} • {s.shortName || s.name} ({s.city})
                      </option>
                    ))}
                </select>
              </div>

              {killSwitchModalStore && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Konfiguracja blokady dla: {killSwitchModalStore.name}</span>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-bold mb-1">Klasyfikacja Powodu:</label>
                    <select
                      value={ksReason}
                      onChange={(e) => setKsReason(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="Kradzież lub zagubienie laptopa (Stolen / Lost Hardware)">
                        Kradzież lub zagubienie laptopa (Stolen / Lost Hardware)
                      </option>
                      <option value="Wypowiedzenie pracownika / Podejrzenie naruszenia (Security Incident)">
                        Wypowiedzenie pracownika / Podejrzenie naruszenia (Security Incident)
                      </option>
                      <option value="Audyt bezpieczeństwa / Planowe wycofanie stacji (Audit Decommission)">
                        Audyt bezpieczeństwa / Planowe wycofanie stacji (Audit Decommission)
                      </option>
                      <option value="Likwidacja lub remont generalny kawiarni (Store Closure)">
                        Likwidacja lub remont generalny kawiarni (Store Closure)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-bold mb-1">Dodatkowe Szczegóły (Opcjonalnie):</label>
                    <input
                      type="text"
                      value={ksCustomDetails}
                      onChange={(e) => setKsCustomDetails(e.target.value)}
                      placeholder="np. Zgłoszono na policję, zgłoszenie SM nr 412"
                      className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  {/* 2-KROKOWA WERYFIKACJA WYZWANIA (CHALLENGE) */}
                  <div className="pt-2 border-t border-rose-200">
                    <label className="block text-rose-900 font-bold mb-1">
                      Wyzwanie Potwierdzające: Wpisz dokładnie <code className="bg-rose-200 px-1 py-0.5 rounded text-rose-950 font-mono">REVOKE {killSwitchModalStore.id.toUpperCase()}</code>
                    </label>
                    <input
                      type="text"
                      value={ksChallengeInput}
                      onChange={(e) => setKsChallengeInput(e.target.value)}
                      placeholder={`REVOKE ${killSwitchModalStore.id.toUpperCase()}`}
                      className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-950"
                    />
                  </div>

                  {ksError && (
                    <div className="text-xs text-rose-700 font-bold bg-rose-100 p-2 rounded-lg">
                      {ksError}
                    </div>
                  )}

                  <button
                    onClick={handleConfirmKillSwitch}
                    disabled={
                      ksChallengeInput.trim().toUpperCase() !==
                      `REVOKE ${killSwitchModalStore.id.toUpperCase()}`
                    }
                    className="w-full py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:bg-stone-300 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Flame className="w-4 h-4" />
                    <span>ZASTOSUJ KILL-SWITCH (ZABLOKUJ STACJĘ)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ZAKŁADKA 4: DZIENNIK BEZPIECZEŃSTWA (AUDYT) */}
        {activeTab === 'audyt' && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <div>
                <h3 className="text-sm font-bold text-[#1E3932]">Centralny Dziennik Zdarzeń Bezpieczeństwa</h3>
                <p className="text-xs text-stone-500">Rejestr generowania kluczy, aktywacji, logowań 2FA i Kill-Switch.</p>
              </div>
              <button
                onClick={handleDownloadAuditCsv}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pobierz CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Data i Czas</th>
                    <th className="py-2.5 px-3">Zdarzenie</th>
                    <th className="py-2.5 px-3">Waga</th>
                    <th className="py-2.5 px-3">Lokal</th>
                    <th className="py-2.5 px-3">Aktor</th>
                    <th className="py-2.5 px-3">Szczegóły</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono text-[11px] text-stone-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pl-PL')}
                      </td>
                      <td className="py-2 px-3 font-bold text-stone-800 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-2 px-3">
                        {log.severity === 'CRITICAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            CRITICAL
                          </span>
                        )}
                        {log.severity === 'WARNING' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            WARNING
                          </span>
                        )}
                        {log.severity === 'INFO' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            INFO
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-stone-700 whitespace-nowrap">
                        <span className="font-bold">{log.targetStoreName}</span>
                      </td>
                      <td className="py-2 px-3 text-stone-600 whitespace-nowrap">
                        <div>{log.actorName}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{log.actorEmail}</div>
                      </td>
                      <td className="py-2 px-3 text-stone-600 max-w-md truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
