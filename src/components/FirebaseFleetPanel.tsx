// src/components/FirebaseFleetPanel.tsx
import React, { useState, useEffect } from 'react';
import {
  Flame,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Server,
  Zap,
  Sliders,
  Store,
  Users,
  Check,
  Search,
  Filter,
} from 'lucide-react';
import {
  firebaseTelemetryService,
  FirebaseInstallationRecord,
  FirebaseConfig,
} from '../services/firebaseTelemetryService';
import { APP_VERSION } from '../version';

export const FirebaseFleetPanel: React.FC = () => {
  const [records, setRecords] = useState<FirebaseInstallationRecord[]>(() =>
    firebaseTelemetryService.getCachedInstallations()
  );
  const [config, setConfig] = useState<FirebaseConfig>(() =>
    firebaseTelemetryService.getConfig()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OUTDATED'>('ALL');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Formularz konfiguracji Firebase
  const [projectIdInput, setProjectIdInput] = useState<string>(config.projectId);
  const [collectionInput, setCollectionInput] = useState<string>(config.collectionName);
  const [isEnabledInput, setIsEnabledInput] = useState<boolean>(config.isEnabled);

  // Subskrypcja zmian w serwisie
  useEffect(() => {
    const unsubscribe = firebaseTelemetryService.subscribe(() => {
      setRecords(firebaseTelemetryService.getCachedInstallations());
      setConfig(firebaseTelemetryService.getConfig());
    });
    return () => unsubscribe();
  }, []);

  const showNotice = (success: boolean, message: string) => {
    setFeedback({ success, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await firebaseTelemetryService.fetchInstallations();
      setRecords(data);
      showNotice(true, `Pobrano ${data.length} instalacji z bazy telemetrycznej.`);
    } catch (err: any) {
      showNotice(false, `Błąd pobierania danych: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = () => {
    firebaseTelemetryService.saveConfig({
      projectId: projectIdInput.trim(),
      collectionName: collectionInput.trim(),
      isEnabled: isEnabledInput,
    });
    setShowConfigModal(false);
    showNotice(true, 'Zapisano parametry bazy Firebase Firestore.');
  };

  const handleTriggerLocalHeartbeat = async () => {
    const res = await firebaseTelemetryService.recordOrUpdateHeartbeat();
    if (res.success) {
      showNotice(true, `Zaktualizowano stan bieżącego urządzenia (${res.record.installId})!`);
    }
  };

  const handleDelete = (id: string) => {
    firebaseTelemetryService.deleteInstallation(id);
    showNotice(true, 'Usunięto rekord instalacji.');
  };

  // Obliczenia statystyk
  const totalCount = records.length;
  const upToDateCount = records.filter((r) => r.appVersion === APP_VERSION).length;
  const activeRecentlyCount = records.filter((r) => {
    try {
      const diffDays = (Date.now() - new Date(r.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    } catch {
      return false;
    }
  }).length;
  const outdatedCount = totalCount - upToDateCount;

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.installId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.appVersion.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ACTIVE') return r.status === 'active';
    if (statusFilter === 'OUTDATED') return r.status === 'outdated' || r.appVersion !== APP_VERSION;
    return true;
  });

  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 2) return 'przed chwilą';
      if (diffMins < 60) return `${diffMins} min temu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} godz. temu`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'wczoraj';
      if (diffDays < 30) return `${diffDays} dni temu`;
      return new Date(isoString).toLocaleDateString('pl-PL');
    } catch {
      return 'Niedawno';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* BANER GŁÓWNY */}
      <div className="p-5 bg-gradient-to-r from-stone-900 via-stone-800 to-[#1E3932] text-white rounded-3xl border border-stone-700 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">Baza Instalacji & Flota Kawiarni</h3>
                <span className="text-[10px] px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full font-bold">
                  Firebase Firestore
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Centralna ewidencja urządzeń, zainstalowanych wersji i aktywności kawiarni.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleTriggerLocalHeartbeat}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Wyślij Heartbeat</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Odśwież Bazę</span>
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Konfiguracja Firebase"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FEEDBACK STATUS */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              feedback.success ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/40' : 'bg-rose-950/80 text-rose-200 border border-rose-500/40'
            }`}
          >
            {feedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* METRYKI FLOTY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Wszystkie Urządzenia</div>
          <div className="text-2xl font-black text-stone-900">{totalCount}</div>
          <div className="text-[10px] text-stone-400">Zarejestrowane stanowiska</div>
        </div>

        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Aktywne w 7 dni</div>
          <div className="text-2xl font-black text-[#006241]">{activeRecentlyCount}</div>
          <div className="text-[10px] text-emerald-700">Aktywny Store Manager</div>
        </div>

        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Najnowsza Wersja</div>
          <div className="text-2xl font-black text-[#006241]">{upToDateCount} <span className="text-xs font-bold text-stone-500">/ {totalCount}</span></div>
          <div className="text-[10px] text-emerald-700">Wersja {APP_VERSION} (100% zgodności)</div>
        </div>

        <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-1">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Wymaga Aktualizacji</div>
          <div className="text-2xl font-black text-amber-900">{outdatedCount}</div>
          <div className="text-[10px] text-amber-700">Starsze wersje w użyciu</div>
        </div>
      </div>

      {/* PASEK WYSZUKIWANIA I FILTRY */}
      <div className="p-4 bg-white rounded-3xl border border-stone-200 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Szukaj po kawiarni, kodzie jednostki, nazwisku lub ID instalacji..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:border-[#006241]"
            />
          </div>

          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Wszystkie ({records.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Aktywne ({activeRecentlyCount})
            </button>
            <button
              onClick={() => setStatusFilter('OUTDATED')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'OUTDATED' ? 'bg-white text-amber-800 shadow-2xs' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Do Update ({outdatedCount})
            </button>
          </div>
        </div>

        {/* TABELA INSTALACJI */}
        <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
              <tr>
                <th className="px-3.5 py-2.5">Stanowisko / ID</th>
                <th className="px-3 py-2.5">Kawiarnia & Lokalizacja</th>
                <th className="px-3 py-2.5">Użytkownik & Rola</th>
                <th className="px-3 py-2.5">Wersja</th>
                <th className="px-3 py-2.5">Ostatnia Aktywność</th>
                <th className="px-3 py-2.5 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                    Brak urządzeń spełniających kryteria wyszukiwania.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isCurrentDevice = r.installId === firebaseTelemetryService.getOrCreateInstallId();
                  const isUpToDate = r.appVersion === APP_VERSION;

                  return (
                    <tr key={r.installId} className={`hover:bg-stone-50/80 ${isCurrentDevice ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isUpToDate ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="font-mono font-bold text-stone-900">{r.installId}</span>
                        </div>
                        <div className="text-[10px] text-stone-400 pl-4">{r.platform}</div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-bold text-stone-900">{r.storeName}</div>
                        <div className="text-[10px] text-stone-500">Kod jednostki: {r.unitCode}</div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-bold text-stone-800">{r.userName}</div>
                        <div className="text-[10px] text-stone-500">{r.userRole} • {r.userEmail}</div>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                            isUpToDate
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {r.appVersion}
                        </span>
                        <div className="text-[10px] text-stone-400 mt-0.5">{r.launchCount} uruchomień</div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-bold text-stone-800">{formatRelativeTime(r.lastSeenAt)}</div>
                        <div className="text-[10px] text-stone-400">Instalacja: {new Date(r.installedAt).toLocaleDateString('pl-PL')}</div>
                      </td>

                      <td className="px-3 py-3 text-right">
                        {!isCurrentDevice && (
                          <button
                            onClick={() => handleDelete(r.installId)}
                            className="p-1.5 text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Usuń wpis z bazy"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isCurrentDevice && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            To urządzenie
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KONFIGURACJI FIREBASE */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-black text-stone-900">Ustawienia Bazy Firebase</h4>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Firebase Project ID:</label>
                <input
                  type="text"
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value)}
                  placeholder="np. starbucks-ops-fleet"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 font-mono font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Nazwa Kolekcji Firestore:</label>
                <input
                  type="text"
                  value={collectionInput}
                  onChange={(e) => setCollectionInput(e.target.value)}
                  placeholder="app_installations"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 font-mono font-bold text-stone-900"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                <span className="font-bold text-stone-800">Synchronizacja Telemetrii w Tle:</span>
                <input
                  type="checkbox"
                  checked={isEnabledInput}
                  onChange={(e) => setIsEnabledInput(e.target.checked)}
                  className="w-4 h-4 text-[#006241] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Zapisz Ustawienia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
