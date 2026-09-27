import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  CalendarDays,
  BarChart3,
  Sparkles,
  Search,
  Filter,
  Trash2,
  CheckCheck,
  ArrowRight,
  ExternalLink,
  Laptop,
  Store,
  Info,
  ChevronRight,
  RefreshCw,
  Plus,
  Send,
} from 'lucide-react';
import {
  desktopNotificationService,
  DesktopNotification,
  NotificationCategory,
  NotificationSeverity,
} from '../services/desktopNotificationService';
import { AppModule } from '../types';

interface NotificationsViewProps {
  onNavigate: (module: AppModule) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<DesktopNotification[]>(() =>
    desktopNotificationService.getNotifications()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyUnread, setOnlyUnread] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [nativeNoticeMsg, setNativeNoticeMsg] = useState<string | null>(null);

  // Subskrypcja na zmiany powiadomień w czasie rzeczywistym
  useEffect(() => {
    const unsubscribe = desktopNotificationService.subscribe(() => {
      setNotifications(desktopNotificationService.getNotifications());
    });
    return () => unsubscribe();
  }, []);

  const unreadCount = desktopNotificationService.getUnreadCount();
  const urgentCount = desktopNotificationService.getUrgentCount();
  const isNativeAllowed = desktopNotificationService.isNativeEnabled();

  // Filtrowanie powiadomień
  const filteredNotifications = notifications.filter((notif) => {
    if (onlyUnread && notif.isRead) return false;
    if (selectedCategory !== 'ALL' && notif.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        notif.title.toLowerCase().includes(q) ||
        notif.message.toLowerCase().includes(q) ||
        (notif.employeeName && notif.employeeName.toLowerCase().includes(q)) ||
        (notif.articleRef && notif.articleRef.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleMarkAsRead = (id: string) => {
    desktopNotificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    desktopNotificationService.markAllAsRead();
  };

  const handleDelete = (id: string) => {
    desktopNotificationService.deleteNotification(id);
  };

  const handleClearAll = () => {
    if (window.confirm('Czy na pewno chcesz wyczyścić wszystkie powiadomienia?')) {
      desktopNotificationService.clearAll();
    }
  };

  const handleTestNativeNotification = async () => {
    const success = await desktopNotificationService.testNativeNotification();
    if (success) {
      setNativeNoticeMsg('Wysłano natywne powiadomienie na pulpit macOS! ✓');
    } else {
      setNativeNoticeMsg('Włącz zezwolenie na powiadomienia w ustawieniach przeglądarki/systemu macOS.');
    }
    setTimeout(() => setNativeNoticeMsg(null), 5000);
  };

  const handleAddSampleAlert = () => {
    desktopNotificationService.addNotification({
      title: 'Alert dobowy: Ochrona Floor Hours',
      message: 'Zalecana weryfikacja obsady w najbliższy piątek — upewnij się, że zachowano min. 32h bazy dobowej.',
      category: 'tplh',
      severity: 'warning',
      actionModule: 'labor_forecast',
      actionLabel: 'Sprawdź Floor Hours',
      details: 'Floor Hours to nienaruszalna baza bezpieczeństwa kawiarni (1 MGR + 1 Barista rano i wieczorem).',
    });
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'urgent':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          border: 'border-l-rose-500',
          icon: ShieldAlert,
          iconColor: 'text-rose-600',
          label: 'Pilne / Naruszenie',
        };
      case 'warning':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          border: 'border-l-amber-500',
          icon: AlertCircle,
          iconColor: 'text-amber-600',
          label: 'Wymaga Uwagi',
        };
      case 'success':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          border: 'border-l-emerald-500',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600',
          label: 'Sukces',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          border: 'border-l-[#006241]',
          icon: Info,
          iconColor: 'text-[#006241]',
          label: 'Informacja',
        };
    }
  };

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'labor_law':
        return ShieldAlert;
      case 'schedule':
        return CalendarDays;
      case 'tplh':
        return BarChart3;
      case 'trainings':
        return Sparkles;
      case 'system':
      default:
        return Laptop;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 select-none">
      {/* GÓRNY BANER GŁÓWNY: CENTRUM POWIADOMIEŃ DESKTOP */}
      <div className="bg-gradient-to-r from-[#1E3932] via-[#006241] to-[#004d33] text-white p-6 rounded-3xl shadow-sm border border-emerald-600/30 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 flex items-center justify-center text-[#CBA258] shadow-inner shrink-0">
            <Bell className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black tracking-tight">Centrum Powiadomień Desktop</h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#CBA258] text-[#1E3932] font-black uppercase tracking-wider">
                108120 Janki
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-1">
              Bieżące alerty Kodeksu Pracy, terminy publikacji grafików, bilans robocizny TPLH i powiadomienia natywne macOS
            </p>
          </div>
        </div>

        {/* Szybkie Akcje macOS & Test */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTestNativeNotification}
            className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer backdrop-blur-md border border-white/15 flex items-center gap-2 shadow-xs"
          >
            <Laptop className="w-4 h-4 text-[#CBA258]" />
            <span>Test Dymka macOS</span>
          </button>

          <button
            onClick={handleAddSampleAlert}
            className="px-3.5 py-2 rounded-2xl bg-[#CBA258] hover:bg-[#b88f47] text-[#1E3932] text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nowy Alert Testowy</span>
          </button>
        </div>
      </div>

      {/* Komunikat o statusie testu macOS */}
      {nativeNoticeMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{nativeNoticeMsg}</span>
        </div>
      )}

      {/* KAFLOWE WSKAŹNIKI KPI (4 KARTY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Karta 1: Nieprzeczytane */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Nieprzeczytane</div>
            <div className="text-2xl font-black text-stone-900">{unreadCount}</div>
            <div className="text-[10px] text-stone-400">z {notifications.length} wszystkich</div>
          </div>
          <div className={`p-3 rounded-2xl ${unreadCount > 0 ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-400'}`}>
            <Bell className="w-5 h-5" />
          </div>
        </div>

        {/* Karta 2: Pilne / Naruszenia */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Alerty & Naruszenia</div>
            <div className="text-2xl font-black text-rose-600">{urgentCount}</div>
            <div className="text-[10px] text-stone-400">wymagające reakcji SM</div>
          </div>
          <div className={`p-3 rounded-2xl ${urgentCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Karta 3: Tarcza Kodeksu Pracy */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#006241]">Tarcza Kodeksu Pracy</div>
            <div className="text-sm font-black text-stone-900">4 Normy KP Aktywne</div>
            <div className="text-[10px] text-emerald-700 font-bold">11h odpoczynku, 35h tydz, 12h max</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-[#006241]">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Karta 4: Dymki Desktop macOS */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Powiadomienia macOS</div>
            <div className="text-sm font-black text-stone-900">
              {isNativeAllowed ? 'Włączone ✓' : 'Wyłączone'}
            </div>
            <div className="text-[10px] text-stone-400">Natywne banery systemowe</div>
          </div>
          <div className="p-3 rounded-2xl bg-stone-100 text-stone-700">
            <Laptop className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* PASEK FILTROWANIA I WYSZUKIWANIA */}
      <div className="bg-white p-4 rounded-3xl border border-stone-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Wyszukiwarka */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj w powiadomieniach (np. 11h, pracownik, AOP, termin)..."
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#006241] focus:bg-white"
            />
          </div>

          {/* Przełączniki filtrów & Akcje masowe */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                onlyUnread
                  ? 'bg-[#006241] text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Tylko nieprzeczytane</span>
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Oznacz wszystkie jako przeczytane"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Przeczytane</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 rounded-2xl bg-stone-100 hover:bg-rose-100 text-stone-500 hover:text-rose-700 transition-colors cursor-pointer"
                title="Wyczyść wszystkie powiadomienia"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Pigułki Kategorii */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs font-bold">
          {[
            { id: 'ALL', label: 'Wszystkie Powiadomienia' },
            { id: 'labor_law', label: '⚖️ Kodeks Pracy' },
            { id: 'schedule', label: '🗓️ Grafik Managerski' },
            { id: 'tplh', label: '📊 TPLH & Robocizna' },
            { id: 'system', label: '🚀 System & MAPAL' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-[#1E3932] text-white shadow-2xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* GŁÓWNA LISTA POWIADOMIEŃ */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-stone-300 space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006241] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-stone-900">Brak powiadomień w wybranej kategorii</h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Wszystkie grafiki menedżerskie, normy Kodeksu Pracy i budżety TPLH są aktualne i zbalansowane.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const sev = getSeverityBadge(notif.severity);
            const CatIcon = getCategoryIcon(notif.category);
            const SevIcon = sev.icon;

            return (
              <div
                key={notif.id}
                className={`bg-white rounded-3xl border border-stone-200 border-l-4 ${sev.border} p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  notif.isRead ? 'opacity-85' : 'ring-1 ring-stone-900/5'
                }`}
              >
                {/* Treść Powiadomienia */}
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-2.5 rounded-2xl ${sev.bg} border shrink-0 mt-0.5`}>
                    <SevIcon className={`w-5 h-5 ${sev.iconColor}`} />
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-stone-900">{notif.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${sev.bg}`}>
                        {sev.label}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed">{notif.message}</p>

                    {/* Szczegóły prawne / operacyjne */}
                    {(notif.articleRef || notif.details) && (
                      <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 space-y-0.5">
                        {notif.articleRef && (
                          <div className="font-mono font-bold text-stone-800 flex items-center gap-1.5">
                            <span className="text-emerald-700">⚖️</span>
                            <span>Podstawa: {notif.articleRef}</span>
                          </div>
                        )}
                        {notif.details && <div className="text-stone-500">{notif.details}</div>}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-stone-400 font-medium pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {notif.timestamp}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-stone-500">
                        <CatIcon className="w-3 h-3" />
                        {notif.category === 'labor_law' ? 'Kodeks Pracy' :
                         notif.category === 'schedule' ? 'Grafik' :
                         notif.category === 'tplh' ? 'TPLH Forecast' : 'System'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prawa strona: Przyciski Akcji */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {notif.actionModule && (
                    <button
                      onClick={() => {
                        handleMarkAsRead(notif.id);
                        onNavigate(notif.actionModule as AppModule);
                      }}
                      className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{notif.actionLabel || 'Przejdź do Modułu'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Oznacz jako przeczytane"
                      className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(notif.id)}
                    title="Usuń powiadomienie"
                    className="p-2 rounded-xl bg-stone-50 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
