import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  CalendarDays,
  BarChart3,
  Sparkles,
  Key,
  RotateCcw,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Sliders,
  Volume2,
  VolumeX,
  Store,
  UserCheck,
  FileText,
  Laptop,
  CheckSquare,
  Square,
  Zap,
  Flame,
  Info,
  Plus,
  Monitor,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  Filter,
  CheckCheck,
} from 'lucide-react';
import {
  cloudNotificationService,
  NotificationLogItem,
  NotificationPreferences,
  UserRegistrationData,
  SchedulePublishedData,
  LaborLawAlertData,
  TplhWeeklyReportData,
} from '../services/cloudNotificationService';
import {
  desktopNotificationService,
  DesktopNotification,
} from '../services/desktopNotificationService';
import { APP_VERSION } from '../version';

export type NotificationCategoryMode = 'desktop' | 'email';
type TemplateType = 'welcome' | 'schedule_published' | 'labor_law_alert' | 'tplh_weekly' | 'install_ping' | 'test';

interface NotificationsSettingsTabProps {
  initialMode?: NotificationCategoryMode;
  onRefreshData?: () => void;
}

export const NotificationsSettingsTab: React.FC<NotificationsSettingsTabProps> = ({
  initialMode = 'desktop',
  onRefreshData,
}) => {
  // GŁÓWNY PODZIAŁ: POWIADOMIENIA W APLIKACJI VS POWIADOMIENIA EMAIL
  const [activeCategory, setActiveCategory] = useState<NotificationCategoryMode>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setActiveCategory(initialMode);
    }
  }, [initialMode]);

  // ==========================================
  // STAN 1: POWIADOMIENIA W APLIKACJI (DESKTOP / MACOS)
  // ==========================================
  const [desktopNotifications, setDesktopNotifications] = useState<DesktopNotification[]>(() =>
    desktopNotificationService.getNotifications()
  );
  const [isNativeEnabled, setIsNativeEnabled] = useState<boolean>(() =>
    desktopNotificationService.isNativeEnabled()
  );
  const [inAppBadgesEnabled, setInAppBadgesEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbx_inapp_badges') !== 'false';
    } catch {
      return true;
    }
  });
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sbx_sound_alerts') === 'true';
    } catch {
      return false;
    }
  });
  const [desktopFilter, setDesktopFilter] = useState<'ALL' | 'UNREAD' | 'KP' | 'TPLH'>('ALL');

  // Subskrypcja na powiadomienia desktopowe
  useEffect(() => {
    const unsubscribe = desktopNotificationService.subscribe(() => {
      setDesktopNotifications(desktopNotificationService.getNotifications());
      setIsNativeEnabled(desktopNotificationService.isNativeEnabled());
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // STAN 2: POWIADOMIENIA E-MAIL (RESEND CLOUD)
  // ==========================================
  const [apiKey, setApiKey] = useState<string>(() => cloudNotificationService.getApiKey());
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [targetEmail, setTargetEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('sbx_user_email') || 'apeldawid@gmail.com';
    } catch {
      return 'apeldawid@gmail.com';
    }
  });
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('sbx_user_name') || 'Dawid Apel';
    } catch {
      return 'Dawid Apel';
    }
  });
  const [userRole, setUserRole] = useState<string>(() => {
    try {
      return localStorage.getItem('sbx_user_role') || 'SM';
    } catch {
      return 'SM';
    }
  });

  // Preferencje e-mail
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => cloudNotificationService.getPreferences());

  // Historia wysyłek e-mail
  const [emailLogs, setEmailLogs] = useState<NotificationLogItem[]>(() => cloudNotificationService.getLogs());

  // Sub-zakładka dla widoku E-mail
  const [emailSubTab, setEmailSubTab] = useState<'rules' | 'templates' | 'logs' | 'api'>('rules');

  // Stan wybranego szablonu do podglądu
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('welcome');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{ success: boolean; message: string } | null>(null);

  const showNotice = (success: boolean, message: string) => {
    setFeedbackStatus({ success, message });
    setTimeout(() => setFeedbackStatus(null), 5000);
  };

  const refreshEmailLogs = () => {
    setEmailLogs(cloudNotificationService.getLogs());
  };

  const handleSaveApiKey = () => {
    cloudNotificationService.setApiKey(apiKey);
    showNotice(true, 'Klucz Resend API został zaktualizowany.');
  };

  const handleResetApiKey = () => {
    const defaultKey = '';
    setApiKey(defaultKey);
    cloudNotificationService.setApiKey(defaultKey);
    showNotice(true, 'Wyczyszczono klucz chmurowy Resend.');
  };

  const handleSaveEmailProfile = () => {
    try {
      localStorage.setItem('sbx_user_email', targetEmail.trim());
      localStorage.setItem('sbx_user_name', userName.trim());
      localStorage.setItem('sbx_user_role', userRole.trim());
      showNotice(true, 'Zapisano profil odbiorcy i adres e-mail powiadomień.');
      if (onRefreshData) onRefreshData();
    } catch {
      showNotice(false, 'Błąd zapisu danych w pamięci lokalnej.');
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    cloudNotificationService.savePreferences(updated);
  };

  const handleToggleNative = async () => {
    if (!isNativeEnabled) {
      const granted = await desktopNotificationService.requestNativePermission();
      if (granted) {
        setIsNativeEnabled(true);
        showNotice(true, 'Włączono natywne powiadomienia systemowe macOS! ✓');
      } else {
        showNotice(false, 'Zezwolenie na powiadomienia zostało odrzucone w systemie macOS.');
      }
    } else {
      desktopNotificationService.setNativeEnabled(false);
      setIsNativeEnabled(false);
      showNotice(true, 'Wyłączono natywne powiadomienia desktopowe.');
    }
  };

  const handleTestNativeNotification = async () => {
    const success = await desktopNotificationService.testNativeNotification();
    if (success) {
      showNotice(true, 'Wysłano testowy dymek do Centrum Powiadomień macOS! ✓');
    } else {
      showNotice(false, 'Włącz zezwolenie na powiadomienia desktopowe w systemie.');
    }
  };

  const handleToggleBadges = () => {
    const newVal = !inAppBadgesEnabled;
    setInAppBadgesEnabled(newVal);
    try {
      localStorage.setItem('sbx_inapp_badges', String(newVal));
    } catch {}
    showNotice(true, newVal ? 'Włączono wskaźniki i liczniki w nagłówku.' : 'Ukryto wskaźniki w belce górnej.');
  };

  const handleToggleSound = () => {
    const newVal = !soundAlertsEnabled;
    setSoundAlertsEnabled(newVal);
    try {
      localStorage.setItem('sbx_sound_alerts', String(newVal));
    } catch {}
    showNotice(true, newVal ? 'Włączono dźwięki alertów w programie.' : 'Wyciszono dźwięki alertów.');
  };

  const handleAddSampleAlert = (type: 'kp' | 'freeze' | 'tplh') => {
    if (type === 'kp') {
      desktopNotificationService.addNotification({
        title: 'Tarcza KP: Kolizja 11h odpoczynku',
        message: 'Wykryto przejście ze zmiany wieczornej PM (koniec 22:30) na poranną AM (start 06:30) — naruszenie art. 132 § 1 KP.',
        category: 'labor_law',
        severity: 'urgent',
        actionModule: 'managers_schedule',
        actionLabel: 'Sprawdź Grafik',
        details: 'Wymagany minimalny nieprzerwany odpoczynek dobowy wynosi 11 godzin.',
      });
      showNotice(true, 'Wygenerowano alert Kodeksu Pracy w aplikacji!');
    } else if (type === 'freeze') {
      desktopNotificationService.addNotification({
        title: 'Termin KP: Publikacja Grafiku (7 Dni)',
        message: 'Zbliża się termin oficjalnej publikacji grafiku menedżerów na kolejny miesiąc (art. 129 § 3 Kodeksu Pracy).',
        category: 'schedule',
        severity: 'warning',
        actionModule: 'managers_schedule',
        actionLabel: 'Opublikuj Wersję',
        details: 'Grafik musi być zamrożony i podany do wiadomości na min. 7 dni przed rozpoczęciem okresu rozliczeniowego.',
      });
      showNotice(true, 'Wygenerowano alert publikacji grafiku!');
    } else {
      desktopNotificationService.addNotification({
        title: 'Alert TPLH: Ochrona Floor Hours (32h/dzień)',
        message: 'Zalecana inspekcja obsady w piątek — upewnij się, że zachowano min. 32.0h nienaruszalnej bazy Floor.',
        category: 'tplh',
        severity: 'info',
        actionModule: 'labor_forecast',
        actionLabel: 'Inspekcja Floor Hours',
        details: 'Floor Hours to baza bezpieczeństwa kawiarni (1 MGR + 1 Barista rano i wieczorem).',
      });
      showNotice(true, 'Wygenerowano alert TPLH w aplikacji!');
    }
  };

  // Generowanie HTML dla wybranego szablonu e-mail
  const getPreviewHtml = (): string => {
    const storeName = localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';
    const unitCode = localStorage.getItem('sbx_unit_code') || '18120';

    switch (selectedTemplate) {
      case 'welcome': {
        const data: UserRegistrationData = {
          userName,
          userEmail: targetEmail,
          userRole,
          storeName,
          unitCode,
          appVersion: APP_VERSION,
          registeredAt: new Date().toLocaleString('pl-PL'),
        };
        return cloudNotificationService.getWelcomeHtml(data);
      }
      case 'schedule_published': {
        const data: SchedulePublishedData = {
          userName,
          userEmail: targetEmail,
          month: 'Październik',
          year: 2026,
          managersCount: 7,
          totalHours: 1184.0,
          publishedBy: `${userName} (${userRole})`,
          versionTag: 'v1.0 (Official Freeze)',
        };
        return cloudNotificationService.getSchedulePublishedHtml(data);
      }
      case 'labor_law_alert': {
        const data: LaborLawAlertData = {
          userName,
          userEmail: targetEmail,
          employeeName: 'Dawid Apel',
          violationType: 'Naruszenie 11h odpoczynku dobowego',
          article: 'art. 132 § 1 Kodeksu Pracy',
          date: '2026-10-14',
          description: 'Przejście ze zmiany wieczornej PM (koniec 22:30) na poranną AM (start 06:30).',
        };
        return cloudNotificationService.getLaborLawAlertHtml(data);
      }
      case 'tplh_weekly': {
        const data: TplhWeeklyReportData = {
          userName,
          userEmail: targetEmail,
          storeName,
          weekNumber: 'W3',
          month: 'Wrzesień',
          year: 2026,
          actualTrx: 2430,
          actualTplh: 6.94,
          targetTplh: 6.70,
          actualHours: 350.2,
          budgetHours: 362.7,
          earnedLaborHours: 362.7,
          varianceHours: 12.5,
        };
        return cloudNotificationService.getTplhWeeklyReportHtml(data);
      }
      case 'install_ping': {
        return cloudNotificationService.getAppInstalledHtml({
          installId: 'SBX-MAC-K7X9-DEV',
          appVersion: APP_VERSION,
          installedAt: new Date().toLocaleString('pl-PL'),
          platform: 'macOS (Apple Mac Silicon)',
          storeName,
          unitCode,
          userName,
          userEmail: targetEmail,
        });
      }
      case 'test':
      default:
        return cloudNotificationService.getTestHtml(targetEmail);
    }
  };

  // Wysyłka testowa aktywnego szablonu e-mail
  const handleSendActiveTemplate = async () => {
    if (!targetEmail || !targetEmail.includes('@')) {
      showNotice(false, 'Wprowadź prawidłowy adres e-mail docelowy.');
      return;
    }

    setIsSendingTest(true);
    try {
      const storeName = localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';
      const unitCode = localStorage.getItem('sbx_unit_code') || '18120';
      let res: { success: boolean; id?: string; error?: string };

      switch (selectedTemplate) {
        case 'welcome':
          res = await cloudNotificationService.sendWelcomeNotification({
            userName,
            userEmail: targetEmail,
            userRole,
            storeName,
            unitCode,
          });
          break;
        case 'schedule_published':
          res = await cloudNotificationService.sendSchedulePublishedNotification({
            userName,
            userEmail: targetEmail,
            month: 'Październik',
            year: 2026,
            managersCount: 7,
            totalHours: 1184.0,
            publishedBy: `${userName} (${userRole})`,
            versionTag: 'v1.0 (Official Freeze)',
          });
          break;
        case 'labor_law_alert':
          res = await cloudNotificationService.sendLaborLawAlertNotification({
            userName,
            userEmail: targetEmail,
            employeeName: 'Dawid Apel',
            violationType: 'Naruszenie 11h odpoczynku dobowego',
            article: 'art. 132 § 1 Kodeksu Pracy',
            date: '2026-10-14',
            description: 'Przejście ze zmiany wieczornej PM na poranną AM.',
          });
          break;
        case 'tplh_weekly':
          res = await cloudNotificationService.sendTplhWeeklyReportNotification({
            userName,
            userEmail: targetEmail,
            storeName,
            weekNumber: 'W3',
            month: 'Wrzesień',
            year: 2026,
            actualTrx: 2430,
            actualTplh: 6.94,
            targetTplh: 6.70,
            actualHours: 350.2,
            budgetHours: 362.7,
            earnedLaborHours: 362.7,
            varianceHours: 12.5,
          });
          break;
        case 'install_ping':
          res = await cloudNotificationService.sendAppInstalledNotification({
            installId: 'SBX-MAC-TEST-PING',
            appVersion: APP_VERSION,
            installedAt: new Date().toLocaleString('pl-PL'),
            platform: 'macOS (Apple Mac)',
            storeName,
            unitCode,
            userName,
            userEmail: targetEmail,
          });
          break;
        case 'test':
        default:
          res = await cloudNotificationService.sendTestNotification(targetEmail);
          break;
      }

      refreshEmailLogs();
      if (res.success) {
        showNotice(true, `E-mail został pomyślnie wysłany na adres ${targetEmail}! ${res.error || ''}`);
      } else {
        showNotice(false, `Błąd wysyłki e-mail: ${res.error || 'Nieznany błąd'}`);
      }
    } catch (err: any) {
      showNotice(false, `Błąd połączenia: ${err.message || err}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredDesktopNotifications = desktopNotifications.filter((n) => {
    if (desktopFilter === 'UNREAD') return !n.isRead;
    if (desktopFilter === 'KP') return n.category === 'labor_law';
    if (desktopFilter === 'TPLH') return n.category === 'tplh';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* GŁÓWNY PRZEŁĄCZNIK 2 KATEGORII: W APLIKACJI VS E-MAIL */}
      <div className="bg-stone-100/90 p-2 rounded-3xl border border-stone-200/80 shadow-xs">
        <div className="grid grid-cols-2 gap-2">
          {/* PRZEŁĄCZNIK 1: POWIADOMIENIA W APLIKACJI (DESKTOP & macOS) */}
          <button
            onClick={() => setActiveCategory('desktop')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-3 cursor-pointer ${
              activeCategory === 'desktop'
                ? 'bg-[#1E3932] text-white shadow-md ring-2 ring-[#006241]/40'
                : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/70'
            }`}
          >
            <div
              className={`p-2 rounded-xl transition-colors ${
                activeCategory === 'desktop' ? 'bg-[#006241] text-[#CBA258]' : 'bg-stone-100 text-stone-600'
              }`}
            >
              <Laptop className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <span>Powiadomienia w Aplikacji</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 font-mono">
                  Desktop
                </span>
              </div>
              <div
                className={`text-[10px] font-bold mt-0.5 ${
                  activeCategory === 'desktop' ? 'text-emerald-200' : 'text-stone-400'
                }`}
              >
                Dymki macOS • Alerty na żywo • Tarcza KP • To-Do
              </div>
            </div>
          </button>

          {/* PRZEŁĄCZNIK 2: POWIADOMIENIA E-MAIL (RESEND CLOUD GATEWAY) */}
          <button
            onClick={() => setActiveCategory('email')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-3 cursor-pointer ${
              activeCategory === 'email'
                ? 'bg-[#006241] text-white shadow-md ring-2 ring-emerald-400/40'
                : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200/70'
            }`}
          >
            <div
              className={`p-2 rounded-xl transition-colors ${
                activeCategory === 'email' ? 'bg-[#1E3932] text-[#CBA258]' : 'bg-stone-100 text-stone-600'
              }`}
            >
              <Mail className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <span>Powiadomienia E-mail</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 font-mono">
                  Chmura
                </span>
              </div>
              <div
                className={`text-[10px] font-bold mt-0.5 ${
                  activeCategory === 'email' ? 'text-emerald-200' : 'text-stone-400'
                }`}
              >
                Bramka Resend • Szablony HTML • Raporty SM
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Komunikat zwrotny */}
      {feedbackStatus && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-xs ${
            feedbackStatus.success
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          {feedbackStatus.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackStatus.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEKCJA 1: POWIADOMIENIA W APLIKACJI (IN-APP & DESKTOP macOS) */}
      {/* ========================================================================= */}
      {activeCategory === 'desktop' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Baner informacyjny */}
          <div className="p-5 bg-gradient-to-r from-stone-900 via-stone-800 to-[#1E3932] text-white rounded-3xl border border-stone-700 shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Laptop className="w-5 h-5 text-[#CBA258]" />
                <h4 className="text-sm font-black">Centrum Powiadomień w Aplikacji & macOS Desktop</h4>
              </div>
              <span className="text-[10px] px-2.5 py-1 bg-white/10 text-emerald-300 rounded-full font-bold">
                100% Lokalne & Natywne
              </span>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Steruj bezpośrednimi powiadomieniami wizualnymi w programie (wskaźniki w nagłówku, lista zadań To-Do Store Managera, alerty na żywo w siatkach grafiku i TPLH) oraz natywnymi dymkami systemowymi macOS.
            </p>
          </div>

          {/* Karta 1: Główne przełączniki Desktopowe */}
          <div className="p-5 bg-stone-50 rounded-3xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-stone-600">
                Główne Kanały Powiadomień Lokalnych
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Natywne powiadomienia macOS */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-[#006241]" />
                    <h5 className="text-xs font-black text-stone-900">Dymki Systemowe macOS</h5>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Wyświetla systemowe komunikaty na pulpicie macOS nawet przy zminimalizowanym oknie programu.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={handleTestNativeNotification}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 text-[#CBA258]" />
                      <span>Wyślij testowy dymek macOS</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleToggleNative}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isNativeEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                  }`}
                >
                  {isNativeEnabled ? 'WŁĄCZONE' : 'WYŁĄCZONE'}
                </button>
              </div>

              {/* Wskaźniki i Badges w Aplikacji */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 flex items-start justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#CBA258]" />
                    <h5 className="text-xs font-black text-stone-900">Wskaźniki & Badges w Belce</h5>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    Czerwony licznik nieprzeczytanych zadań i alertów na profilu Store Managera w nagłówku.
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={handleToggleSound}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {soundAlertsEnabled ? (
                        <Volume2 className="w-3 h-3 text-[#006241]" />
                      ) : (
                        <VolumeX className="w-3 h-3 text-stone-400" />
                      )}
                      <span>Dźwięk: {soundAlertsEnabled ? 'Włączony' : 'Wyciszony'}</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleToggleBadges}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    inAppBadgesEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                  }`}
                >
                  {inAppBadgesEnabled ? 'WŁĄCZONE' : 'WYŁĄCZONE'}
                </button>
              </div>
            </div>
          </div>

          {/* Karta 2: Generator i Symulator Alertów */}
          <div className="p-5 bg-white rounded-3xl border border-stone-200 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-stone-600">
                Symulator & Wyzwalacze Alertów w Programie
              </h4>
              <span className="text-[10px] text-stone-400 font-bold">Testuj powiadomienia w locie</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleAddSampleAlert('kp')}
                className="p-3 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 text-rose-900 rounded-2xl text-left transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Alert Kodeksu Pracy</span>
                </div>
                <div className="text-[10px] text-rose-700">Kolizja 11h odpoczynku dobowego (art. 132 KP)</div>
              </button>

              <button
                onClick={() => handleAddSampleAlert('freeze')}
                className="p-3 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-[#1E3932] rounded-2xl text-left transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  <CalendarDays className="w-4 h-4 text-[#006241]" />
                  <span>Publikacja Grafiku 7 Dni</span>
                </div>
                <div className="text-[10px] text-emerald-800">Termin zamrożenia grafiku (art. 129 § 3 KP)</div>
              </button>

              <button
                onClick={() => handleAddSampleAlert('tplh')}
                className="p-3 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-amber-950 rounded-2xl text-left transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  <BarChart3 className="w-4 h-4 text-[#CBA258]" />
                  <span>Ochrona Floor Hours</span>
                </div>
                <div className="text-[10px] text-amber-800">Inspekcja bazy 32h/dobę (1 MGR + 1 Barista)</div>
              </button>
            </div>
          </div>

          {/* Karta 3: Dziennik Aktywnych Powiadomień w Aplikacji */}
          <div className="p-5 bg-white rounded-3xl border border-stone-200 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600">
                  Dziennik Powiadomień w Aplikacji ({desktopNotifications.length})
                </h4>
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg text-[10px] font-bold">
                  {(['ALL', 'UNREAD', 'KP', 'TPLH'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDesktopFilter(f)}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                        desktopFilter === f ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      {f === 'ALL' ? 'Wszystkie' : f === 'UNREAD' ? 'Nieprzeczytane' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    desktopNotificationService.markAllAsRead();
                    showNotice(true, 'Oznaczono wszystkie alerty jako przeczytane.');
                  }}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Odczytaj</span>
                </button>
                <button
                  onClick={() => {
                    desktopNotificationService.clearAll();
                    showNotice(true, 'Wyczyszczono historię alertów w aplikacji.');
                  }}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wyczyść</span>
                </button>
              </div>
            </div>

            {filteredDesktopNotifications.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-xs text-stone-400">
                Brak zarejestrowanych powiadomień w aplikacji dla wybranego filtra.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto rounded-2xl border border-stone-200 bg-stone-50/50">
                {filteredDesktopNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 text-xs flex items-start justify-between gap-3 transition-colors ${
                      n.isRead ? 'bg-white opacity-80' : 'bg-emerald-50/40 font-medium'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                          n.severity === 'urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : n.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-[#006241]'
                        }`}
                      >
                        {n.severity === 'urgent' ? (
                          <ShieldAlert className="w-4 h-4" />
                        ) : n.severity === 'warning' ? (
                          <CalendarDays className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">{n.title}</span>
                          {!n.isRead && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold">
                              Nowy
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-600 leading-relaxed">{n.message}</p>
                        <div className="text-[10px] text-stone-400 pt-0.5">{n.timestamp}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => desktopNotificationService.markAsRead(n.id)}
                        className="p-1 text-stone-400 hover:text-[#006241] transition-colors cursor-pointer"
                        title={n.isRead ? 'Przeczytane' : 'Oznacz jako przeczytane'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => desktopNotificationService.deleteNotification(n.id)}
                        className="p-1 text-stone-300 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Usuń powiadomienie"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEKCJA 2: POWIADOMIENIA E-MAIL (RESEND CLOUD GATEWAY) */}
      {/* ========================================================================= */}
      {activeCategory === 'email' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Sub-nawigacja dla e-maili */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center space-x-1.5 bg-stone-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setEmailSubTab('rules')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  emailSubTab === 'rules'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Reguły & Profil E-mail</span>
              </button>
              <button
                onClick={() => setEmailSubTab('templates')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  emailSubTab === 'templates'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Studio Szablonów HTML</span>
              </button>
              <button
                onClick={() => setEmailSubTab('logs')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  emailSubTab === 'logs'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Historia E-mail ({emailLogs.length})</span>
              </button>
              <button
                onClick={() => setEmailSubTab('api')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  emailSubTab === 'api'
                    ? 'bg-white text-[#006241] shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Klucz Resend API</span>
              </button>
            </div>

            <button
              onClick={() => handleTogglePref('emailEnabled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                prefs.emailEnabled
                  ? 'bg-emerald-100 text-[#006241] border border-emerald-300'
                  : 'bg-stone-200 text-stone-600'
              }`}
            >
              {prefs.emailEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-[#006241]" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{prefs.emailEnabled ? 'Wysyłka E-mail: WŁ' : 'Wysyłka E-mail: WYŁ'}</span>
            </button>
          </div>

          {/* SUB-TAB: REGUŁY & PROFIL */}
          {emailSubTab === 'rules' && (
            <div className="space-y-4">
              {/* Profil Odbiorcy */}
              <div className="p-5 bg-stone-50 rounded-3xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-[#006241]" />
                    <h4 className="text-sm font-black text-stone-900">Profil Odbiorcy E-mail</h4>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 bg-emerald-100 text-[#006241] font-bold rounded-full">
                    Kawiarnia 108120 Janki
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Imię i Nazwisko:</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#006241]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Rola Operacyjna:</label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-[#006241]"
                    >
                      <option value="SM">Store Manager (SM)</option>
                      <option value="ASM">Assistant Store Manager (ASM)</option>
                      <option value="DM">District Manager (DM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Adres E-mail powiadomień:</label>
                    <input
                      type="email"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-[#006241]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleSaveEmailProfile}
                    className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Zapisz Dane E-mail</span>
                  </button>
                </div>
              </div>

              {/* Wyzwalacze e-maili */}
              <div className="p-5 bg-white rounded-3xl border border-stone-200 space-y-3.5 shadow-2xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600">
                  Zdarzenia Wysyłające E-maile do Store Managera
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => handleTogglePref('schedulePublishedEmail')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                      prefs.schedulePublishedEmail
                        ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CalendarDays className="w-4 h-4 text-[#006241] mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-stone-900">Publikacja Grafiku (art. 129 KP)</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5">Podsumowanie godzin 7 dni przed okresem.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.schedulePublishedEmail}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-[#006241] mt-1 cursor-pointer"
                    />
                  </div>

                  <div
                    onClick={() => handleTogglePref('laborLawAlertEmail')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                      prefs.laborLawAlertEmail
                        ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-400/20'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-stone-900">Krytyczne Alerty Kodeksu Pracy</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5">Naruszenia 11h, absencje i kolizje w grafiku.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.laborLawAlertEmail}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-rose-600 mt-1 cursor-pointer"
                    />
                  </div>

                  <div
                    onClick={() => handleTogglePref('tplhWeeklyEmail')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                      prefs.tplhWeeklyEmail
                        ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <BarChart3 className="w-4 h-4 text-[#006241] mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-stone-900">Raport Tygodniowy TPLH</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5">Podsumowanie Earned Labor i celów AOP.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.tplhWeeklyEmail}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-[#006241] mt-1 cursor-pointer"
                    />
                  </div>

                  <div
                    onClick={() => handleTogglePref('systemUpdateEmail')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                      prefs.systemUpdateEmail
                        ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-400/20'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-amber-600 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-stone-900">Aktualizacje & Mikropatche OTA</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5">Nowe wersje aplikacji i algorytmów.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.systemUpdateEmail}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-amber-600 mt-1 cursor-pointer"
                    />
                  </div>

                  <div
                    onClick={() => handleTogglePref('appInstallPingEmail')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between ${
                      prefs.appInstallPingEmail
                        ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/20'
                        : 'bg-stone-50 border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Zap className="w-4 h-4 text-[#006241] mt-0.5" />
                      <div>
                        <h5 className="text-xs font-black text-stone-900">Telemetria Nowej Instalacji</h5>
                        <p className="text-[11px] text-stone-500 mt-0.5">E-mail przy pierwszym uruchomieniu programu.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.appInstallPingEmail}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-[#006241] mt-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB: STUDIO SZABLONÓW */}
          {emailSubTab === 'templates' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {[
                  { id: 'welcome', label: '☕ Powitalny', desc: 'Profil SM' },
                  { id: 'schedule_published', label: '🗓️ Grafik', desc: 'Publikacja 7 dni' },
                  { id: 'labor_law_alert', label: '⚖️ Kodeks Pracy', desc: 'Alert kolizji' },
                  { id: 'tplh_weekly', label: '📊 TPLH', desc: 'Raport tygodnia' },
                  { id: 'install_ping', label: '🚀 Nowa Instalacja', desc: 'First Launch' },
                  { id: 'test', label: '🧪 Test Bramki', desc: 'Test Resend' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id as TemplateType)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedTemplate === tpl.id
                        ? 'bg-[#1E3932] text-white border-[#006241] shadow-xs'
                        : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                    }`}
                  >
                    <div className="text-xs font-black">{tpl.label}</div>
                    <div className={`text-[10px] ${selectedTemplate === tpl.id ? 'text-emerald-200' : 'text-stone-500'}`}>
                      {tpl.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-emerald-950">Docelowy e-mail testu:</span>{' '}
                  <strong className="font-mono text-[#006241]">{targetEmail}</strong>
                </div>

                <button
                  onClick={handleSendActiveTemplate}
                  disabled={isSendingTest}
                  className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Wysyłanie e-maila...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Wyślij ten szablon na e-mail</span>
                    </>
                  )}
                </button>
              </div>

              <div className="w-full h-[400px] bg-stone-100 rounded-3xl border border-stone-300 overflow-hidden shadow-inner flex justify-center p-3">
                <iframe
                  title="Email Preview"
                  srcDoc={getPreviewHtml()}
                  className="w-full max-w-[600px] h-full bg-white rounded-2xl shadow-md border border-stone-200"
                />
              </div>
            </div>
          )}

          {/* SUB-TAB: HISTORIA E-MAIL */}
          {emailSubTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600">
                  Dziennik Wysłanych Wiadomości E-mail
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshEmailLogs}
                    className="p-1.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Odśwież</span>
                  </button>
                  {emailLogs.length > 0 && (
                    <button
                      onClick={() => {
                        cloudNotificationService.clearLogs();
                        refreshEmailLogs();
                        showNotice(true, 'Wyczyszczono historię wysyłek.');
                      }}
                      className="p-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Wyczyść</span>
                    </button>
                  )}
                </div>
              </div>

              {emailLogs.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-3xl border border-dashed border-stone-300 text-xs text-stone-500">
                  Brak zarejestrowanych wysyłek e-mail.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-2xs divide-y divide-stone-100 max-h-80 overflow-y-auto">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-stone-50 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${log.status === 'success' ? 'bg-emerald-100 text-[#006241]' : 'bg-rose-100 text-rose-700'}`}>
                          {log.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="font-bold text-stone-900">{log.subject}</div>
                          <div className="text-[10px] text-stone-500">
                            Do: <strong>{log.recipient}</strong> • {log.timestamp} {log.errorMessage && `• ${log.errorMessage}`}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        log.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status === 'success' ? 'Wysłano' : 'Błąd'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: KLUCZ RESEND API */}
          {emailSubTab === 'api' && (
            <div className="p-5 bg-stone-50 rounded-3xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#006241]" />
                  <h4 className="text-xs font-black text-stone-900">Klucz Resend Cloud API</h4>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-[#006241] font-bold rounded-md">
                  HTTPS / TLS 256-bit
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="re_..."
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 pr-10 text-xs font-mono text-stone-900 focus:outline-none focus:border-[#006241]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Zapisz
                </button>

                <button
                  onClick={handleResetApiKey}
                  title="Przywróć domyślny klucz"
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Domyślny</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
