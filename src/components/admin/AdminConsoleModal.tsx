// src/components/admin/AdminConsoleModal.tsx
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  KeyRound,
  History,
  Lock,
  Unlock,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
  Laptop,
  Smartphone,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Building,
  Mail,
  X,
  Info,
} from 'lucide-react';
import { AppUserRole, GranularUserPermissions, ManagedAppUser, PendingAccessRequest, SecurityAuditLog } from '../../types/admin';
import { AdminService } from '../../services/admin/adminService';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminName?: string;
  storeUnitCode?: string;
}

type AdminTab = 'requests' | 'users' | 'vault' | 'audit';

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  adminName = 'Dawid Apel (Store Manager)',
  storeUnitCode = '18120',
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('requests');
  const [users, setUsers] = useState<ManagedAppUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingAccessRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<ManagedAppUser | null>(null);
  const [killSwitchConfirmId, setKillSwitchConfirmId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    setUsers(AdminService.getUsers());
    setPendingRequests(AdminService.getPendingRequests());
    setAuditLogs(AdminService.getSecurityLogs());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (!isOpen) return null;

  const handleApprove = (requestId: string, role: AppUserRole) => {
    AdminService.approveRequest(requestId, role, adminName);
    loadData();
    showToast('✅ Pomyślnie zatwierdzono nowego pracownika i nadano uprawnienia.');
  };

  const handleReject = (requestId: string) => {
    AdminService.rejectRequest(requestId, adminName, 'Odrzucono przez Store Managera');
    loadData();
    showToast('✕ Wniosek o dostęp został odrzucony.');
  };

  const handleKillSwitch = (userId: string) => {
    AdminService.killSwitchRevoke(userId, adminName);
    setKillSwitchConfirmId(null);
    loadData();
    showToast('⚡ ZASTOSOWANO KILL-SWITCH: Dostęp pracownika został natychmiast odcięty!');
  };

  const handleRoleChange = (userId: string, newRole: AppUserRole) => {
    AdminService.updateRole(userId, newRole, adminName);
    loadData();
    showToast(`Zmieniono rolę pracownika na: ${formatRoleLabel(newRole)}`);
  };

  const handleTogglePermission = (userId: string, key: keyof GranularUserPermissions) => {
    AdminService.togglePermission(userId, key, adminName);
    loadData();
  };

  const formatRoleLabel = (role: AppUserRole): string => {
    switch (role) {
      case 'STORE_MANAGER': return 'Store Manager (SM)';
      case 'ASSISTANT_STORE_MANAGER': return 'Assistant Store Manager (ASM)';
      case 'SHIFT_SUPERVISOR': return 'Shift Supervisor (SSV)';
      case 'BARISTA': return 'Barista';
      case 'DISTRICT_MANAGER': return 'District Manager (DM)';
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* NAGŁÓWEK ADMIN CONSOLE */}
        <div className="bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#00754A] p-6 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#CBA258]">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#CBA258] text-stone-900">
                  Panel Administratora Kawiarni
                </span>
                <span className="text-xs text-emerald-200/90 font-semibold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  Jednostka: <strong>{storeUnitCode} SBX Janki</strong>
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Centrum Bezpieczeństwa & Zarządzania Flotą
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {toastMessage && (
              <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-white border border-white/30 animate-in fade-in slide-in-from-top-1">
                {toastMessage}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* PASEK ZAKŁADEK */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#EEF3F0] border-b border-stone-200 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all relative ${
                activeTab === 'requests'
                  ? 'bg-white text-[#006241] shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <Clock className="w-4 h-4 text-[#CBA258]" />
              <span>Wnioski o dostęp</span>
              {pendingRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'users'
                  ? 'bg-white text-[#006241] shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4 text-[#006241]" />
              <span>Personel & Role ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'vault'
                  ? 'bg-white text-[#006241] shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <KeyRound className="w-4 h-4 text-emerald-700" />
              <span>Skarbiec Kluczy & Zero-Leak</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'audit'
                  ? 'bg-white text-[#006241] shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
              }`}
            >
              <History className="w-4 h-4 text-stone-700" />
              <span>Dziennik Audytu</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500 font-bold bg-white/70 px-3 py-1.5 rounded-xl border border-stone-200">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
            <span>Zalogowany: <strong>{adminName}</strong></span>
          </div>
        </div>

        {/* TREŚĆ MODALA */}
        <div className="p-6 overflow-y-auto flex-1 bg-stone-50/50">
          
          {/* ZAKŁADKA 1: WNIOSKI O DOSTĘP */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                      Weryfikacja Tożsamości i Urządzeń Pracowników
                    </h4>
                    <p className="text-xs text-amber-900 mt-0.5">
                      Każde nowe urządzenie lub nowo zatrudniony pracownik po wpisaniu maila firmowego 
                      musi zostać zaakceptowany przez Store Managera przed pobraniem jakichkolwiek danych kawiarni.
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-white text-stone-700 rounded-xl text-xs font-bold border border-amber-300 hover:bg-amber-100/50 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Odśwież
                </button>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2 opacity-80" />
                  <h3 className="text-sm font-black text-stone-800">Brak oczekujących wniosków</h3>
                  <p className="text-xs text-stone-500 mt-1">Wszystkie urządzenia i konta pracowników kawiarni Janki są zweryfikowane.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Oczekuje na akceptację
                          </span>
                          <span className="text-[10px] font-semibold text-stone-400">
                            {new Date(req.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <h4 className="text-base font-black text-stone-900">{req.fullName}</h4>
                        <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-stone-400" />
                          <span className="font-mono">{req.email}</span>
                        </p>

                        <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-100 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-stone-600">
                            <span>Urządzenie:</span>
                            <strong className="text-stone-900 flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-stone-500" />
                              {req.deviceName}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-stone-600">
                            <span>Adres sieci:</span>
                            <span className="font-mono text-stone-700">{req.ipAddress}</span>
                          </div>
                          {req.requestNote && (
                            <div className="pt-1 border-t border-stone-200 text-stone-500 italic">
                              "{req.requestNote}"
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleReject(req.id)}
                          className="px-3 py-2 bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Odrzuć
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(req.id, 'BARISTA')}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Akceptuj jako Barista
                          </button>
                          <button
                            onClick={() => handleApprove(req.id, 'SHIFT_SUPERVISOR')}
                            className="px-3 py-2 bg-[#006241] hover:bg-[#1E3932] text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Akceptuj jako SSV
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ZAKŁADKA 2: PERSONEL, ROLE & SUWAKI UPRAWNIEŃ */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Szukaj pracownika po nazwisku lub emailu..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-hidden focus:border-[#006241] bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
                  <span>Aktywnych kont: <strong>{users.filter(u => u.isActive).length}</strong></span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F9F8] border-b border-stone-200 text-stone-700 font-extrabold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Pracownik</th>
                      <th className="p-3">Email Firmowy</th>
                      <th className="p-3">Rola w Systemie</th>
                      <th className="p-3 text-center">Status Konta</th>
                      <th className="p-3 text-center">Uprawnienia & Finanse</th>
                      <th className="p-3 text-right">Zarządzanie / Kill-Switch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map(user => {
                      const isSelf = user.role === 'STORE_MANAGER';
                      return (
                        <tr key={user.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="p-3 font-bold text-stone-900">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black flex items-center justify-center shrink-0">
                                {user.fullName.split(' ').map(n => n[0]).join('')}
                              </span>
                              <div>
                                <span>{user.fullName}</span>
                                <span className="block text-[10px] text-stone-400 font-normal">
                                  {user.deviceName || 'Brak danych urządzenia'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-3 font-mono text-stone-600">{user.email}</td>

                          <td className="p-3">
                            <select
                              disabled={isSelf}
                              value={user.role}
                              onChange={e => handleRoleChange(user.id, e.target.value as AppUserRole)}
                              className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-xs font-bold text-stone-800 disabled:bg-stone-100 disabled:text-stone-500 cursor-pointer"
                            >
                              <option value="STORE_MANAGER">Store Manager (SM)</option>
                              <option value="ASSISTANT_STORE_MANAGER">Assistant SM (ASM)</option>
                              <option value="SHIFT_SUPERVISOR">Shift Supervisor (SSV)</option>
                              <option value="BARISTA">Barista</option>
                              <option value="DISTRICT_MANAGER">District Manager (DM)</option>
                            </select>
                          </td>

                          <td className="p-3 text-center">
                            {user.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Aktywne
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                Zablokowane
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedUserForEdit(user)}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-800 hover:text-emerald-900 text-xs font-bold border border-stone-200 transition-colors inline-flex items-center gap-1"
                            >
                              {user.permissions.canViewWageRates ? (
                                <Eye className="w-3.5 h-3.5 text-blue-700" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                              )}
                              <span>Suwaki ({Object.values(user.permissions).filter(Boolean).length}/11)</span>
                            </button>
                          </td>

                          <td className="p-3 text-right">
                            {isSelf ? (
                              <span className="text-[10px] text-stone-400 italic">Konto Główne</span>
                            ) : killSwitchConfirmId === user.id ? (
                              <div className="flex items-center justify-end gap-1.5 animate-in fade-in">
                                <button
                                  onClick={() => handleKillSwitch(user.id)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-xs transition-colors"
                                >
                                  Potwierdź Odcięcie!
                                </button>
                                <button
                                  onClick={() => setKillSwitchConfirmId(null)}
                                  className="px-2 py-1 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold"
                                >
                                  Anuluj
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setKillSwitchConfirmId(user.id)}
                                className="px-2.5 py-1 bg-stone-100 hover:bg-rose-100 text-stone-700 hover:text-rose-800 rounded-lg text-xs font-black border border-stone-200 transition-colors inline-flex items-center gap-1"
                                title="Natychmiastowe odcięcie dostępu (Kill-Switch)"
                              >
                                <Zap className="w-3.5 h-3.5 text-rose-600" />
                                <span>Kill-Switch</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ZAKŁADKA 3: SKARBIEC & ARCHITEKTURA ZERO-LEAK */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-900 to-[#006241] p-6 rounded-3xl text-white shadow-md">
                <div className="flex items-center gap-3 mb-2">
                  <KeyRound className="w-6 h-6 text-[#CBA258]" />
                  <h3 className="text-lg font-black tracking-tight">
                    Fizyczna Izolacja Danych (Zero-Leak Architecture)
                  </h3>
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed max-w-3xl">
                  Aplikacja stosuje architekturę 3 niezależnych sejfów chmurowych. Dane finansowe, stawki godzinowe PLN,
                  budżet AOP oraz kody medyczne L4 są fizycznie zablokowane na poziomie serwera Google Firestore. 
                  Żaden pakiet sieciowy zawierający zarobki nigdy nie trafia na telefon ani komputer pracownika z rolą inną niż Store Manager.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#006241] flex items-center justify-center font-bold mb-3">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-black text-stone-900 uppercase">Sejf 1: Public Schedule</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Terminy i kody zmian (AM, PM, OFF). Dostępny dla uwierzytelnionych baristów kawiarni Janki.
                  </p>
                  <span className="inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Szyfrowanie TLS 1.3
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold mb-3">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-black text-stone-900 uppercase">Sejf 2: Staff Vault</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Tożsamości, numery telefonów i urządzenia. Pracownik widzi wyłącznie siebie, a Store Manager całą kawiarnię.
                  </p>
                  <span className="inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Ochrona RODO Art. 6
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold mb-3">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-black text-stone-900 uppercase">Sejf 3: Executive Vault</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Stawki PLN, pensje, budżet AOP, COL %, zwolnienia L4, kwartalny TOR. <strong>Bezwzględnie zablokowany dla nie-SM.</strong>
                  </p>
                  <span className="inline-block mt-3 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    Zero-Payload Leak
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ZAKŁADKA 4: DZIENNIK AUDYTU BEZPIECZEŃSTWA */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                    Niezmienialny Rejestr Zdarzeń Bezpieczeństwa (Audit Trail)
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Historia wszystkich autoryzacji 2FA, zatwierdzeń kont, zmian ról i procedur Kill-Switch w jednostce Janki.
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-white text-stone-700 rounded-xl text-xs font-bold border border-stone-300 hover:bg-stone-50 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Odśwież
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F9F8] border-b border-stone-200 text-stone-700 font-extrabold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Data & Czas</th>
                      <th className="p-3">Osoba Wykonująca</th>
                      <th className="p-3">Zdarzenie Bezpieczeństwa</th>
                      <th className="p-3">Zasób / Cel</th>
                      <th className="p-3">Szczegóły Operacji</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-mono text-[11px]">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="p-3 text-stone-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pl-PL')}
                        </td>
                        <td className="p-3 font-bold text-stone-900 font-sans">
                          {log.actorName} <span className="text-[10px] text-[#006241]">({log.actorRole})</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-black tracking-tight ${
                            log.actionType === 'KILL_SWITCH_REVOKE'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : log.actionType === 'REQUEST_APPROVED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-stone-100 text-stone-800 border border-stone-300'
                          }`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td className="p-3 text-stone-700">{log.targetResource}</td>
                        <td className="p-3 text-stone-600 font-sans">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* MODAL EDYCJI SUWAKÓW UPRAWNIEŃ PRACOWNIKA */}
        {selectedUserForEdit && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h4 className="text-sm font-black text-stone-900">
                    Uprawnienia Kolumnowe: {selectedUserForEdit.fullName}
                  </h4>
                  <p className="text-xs text-stone-500">Rola: {formatRoleLabel(selectedUserForEdit.role)}</p>
                </div>
                <button
                  onClick={() => setSelectedUserForEdit(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {[
                  { key: 'canViewWageRates', label: 'Wgląd w stawki godzinowe PLN/h i pensje', desc: 'Ściśle Store Manager / Tajemnica wynagrodzeń' },
                  { key: 'canViewMedicalLeaves', label: 'Wgląd w zwolnienia lekarskie i kody L4', desc: 'Ochrona danych medycznych personelu' },
                  { key: 'canViewFinancialSales', label: 'Wgląd w sprzedaż netto PLN i budżet AOP', desc: 'Moduł 1 i cele roczne' },
                  { key: 'canViewColPnl', label: 'Wgląd w pełny rachunek P&L i koszty COL %', desc: 'Moduł 4' },
                  { key: 'canViewZusRates', label: 'Wgląd w narzut pracodawcy ZUS 19.48%', desc: 'Koszty pozapłacowe kawiarni' },
                  { key: 'canPublishSchedule', label: 'Prawo do publikacji i mrożenia grafiku', desc: 'Blokada 7 dni przed okresem' },
                  { key: 'canApproveTor', label: 'Prawo do zatwierdzania kwartału TOR', desc: 'Odpowiedzialność za nadgodziny' },
                  { key: 'canImportFichajes', label: 'Prawo do importu plików MAPAL Fichajes', desc: 'Zasilanie kolumny RCP' },
                  { key: 'canExportExcel', label: 'Zezwolenie na eksport danych do arkuszy Excel', desc: 'Ochrona przed wyciekiem bazy' },
                ].map(item => {
                  const permKey = item.key as keyof GranularUserPermissions;
                  const isChecked = selectedUserForEdit.permissions[permKey];
                  return (
                    <div key={item.key} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-stone-900">{item.label}</div>
                        <div className="text-[10px] text-stone-500">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => {
                          handleTogglePermission(selectedUserForEdit.id, permKey);
                          setSelectedUserForEdit({
                            ...selectedUserForEdit,
                            permissions: {
                              ...selectedUserForEdit.permissions,
                              [permKey]: !isChecked,
                            },
                          });
                        }}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          isChecked ? 'bg-[#006241]' : 'bg-stone-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-stone-100 flex justify-end">
                <button
                  onClick={() => setSelectedUserForEdit(null)}
                  className="px-4 py-2 bg-[#006241] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#1E3932] transition-colors"
                >
                  Zamknij i Zastosuj
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
