import { StoreStorage } from './storeStorage';
import { StoreService } from './storeService';

export type NotificationSeverity = 'urgent' | 'warning' | 'info' | 'success';

export type NotificationCategory = 'labor_law' | 'schedule' | 'tplh' | 'trainings' | 'system';

export interface DesktopNotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  timestamp: string; // ISO string lub formatted
  isRead: boolean;
  isDismissed?: boolean;
  actionModule?: 'managers_schedule' | 'labor_forecast' | 'trainings' | 'col_calculator' | 'dashboard';
  actionLabel?: string;
  details?: string;
  articleRef?: string;
  employeeName?: string;
  dateRef?: string;
}

const PERMISSION_KEY = 'sbx_desktop_native_enabled';

class DesktopNotificationService {
  private notifications: DesktopNotification[] = [];
  private listeners: Array<() => void> = [];
  private currentStoreId: string = '';

  constructor() {
    this.currentStoreId = (typeof window !== 'undefined' ? StoreService.getCurrentStore()?.id : '') || '108120';
    this.loadFromStorage();
    this.initializeDefaultNotificationsIfEmpty();

    if (typeof window !== 'undefined') {
      window.addEventListener('sbx:store-switched', (e: any) => {
        const newStoreId = e?.detail?.currentStore?.id || e?.detail?.id;
        if (newStoreId && newStoreId !== this.currentStoreId) {
          this.switchStore(newStoreId);
        }
      });
      window.addEventListener('sbx-store-changed', (e: any) => {
        const newStoreId = e?.detail?.id;
        if (newStoreId && newStoreId !== this.currentStoreId) {
          this.switchStore(newStoreId);
        }
      });
    }
  }

  public switchStore(newStoreId: string) {
    this.currentStoreId = newStoreId;
    this.loadFromStorage();
    this.initializeDefaultNotificationsIfEmpty();
    this.notifyListeners();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Błąd listenera powiadomień:', err);
      }
    });
  }

  private loadFromStorage() {
    try {
      this.notifications = StoreStorage.getItem<DesktopNotification[]>('notifications', this.currentStoreId) || [];
    } catch {
      this.notifications = [];
    }
  }

  private saveToStorage() {
    try {
      StoreStorage.setItem('notifications', this.notifications, this.currentStoreId);
    } catch {}
    this.notifyListeners();
  }

  /**
   * Generuje inteligentny zestaw powiadomień operacyjnych na start jeśli brak danych
   */
  public initializeDefaultNotificationsIfEmpty() {
    if (this.notifications.length === 0) {
      const now = new Date();
      const formatTime = (minusHours: number = 0) => {
        const d = new Date(now.getTime() - minusHours * 3600 * 1000);
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
      };

      this.notifications = [
        {
          id: 'notif_kp_1',
          title: 'Tarcza KP: Naruszenie 11h odpoczynku dobowego',
          message: 'Wykryto przejście ze zmiany zamknięciowej PM na otwarcie AM dla menedżera Dawid Apel (odpoczynek 8.0h zamiast wymaganych 11.0h).',
          category: 'labor_law',
          severity: 'urgent',
          timestamp: formatTime(1),
          isRead: false,
          actionModule: 'managers_schedule',
          actionLabel: 'Napraw w Grafiku',
          articleRef: 'art. 132 § 1 Kodeksu Pracy',
          employeeName: 'Dawid Apel',
          details: 'Wymagany minimalny nieprzerwany odpoczynek wynosi 11 godzin w każdej dobie pracowniczej.',
        },
        {
          id: 'notif_sched_1',
          title: 'Termin publikacji grafiku na Październik 2026',
          message: 'Przypomnienie: Zgodnie z art. 129 § 3 KP oficjalny grafik na Październik musi zostać opublikowany najpóźniej 24 września (7 dni przed rozpoczęciem okresu).',
          category: 'schedule',
          severity: 'warning',
          timestamp: formatTime(3),
          isRead: false,
          actionModule: 'managers_schedule',
          actionLabel: 'Opublikuj Grafik',
          details: 'Zamrożenie wersji po publikacji rejestruje wszystkie późniejsze zmiany w audycie modyfikacji.',
        },
        {
          id: 'notif_tplh_1',
          title: 'W+2 Target Planning: Poniedziałkowy bilans robocizny',
          message: 'Zalecana optymalizacja puli baristów HANW dla tygodnia docelowego W4. Wykorzystaj rekomendacje uczenia maszynowego Trend Intelligence.',
          category: 'tplh',
          severity: 'info',
          timestamp: formatTime(6),
          isRead: false,
          actionModule: 'labor_forecast',
          actionLabel: 'Otwórz Labor Balancing',
          details: 'Zabezpiecz Floor Hours (32.0 h/dobę) i skieruj godziny flex na szczyty piątkowo-sobotnie.',
        },
        {
          id: 'notif_mapal_1',
          title: 'MAPAL Fichajes: Rzeczywiste godziny zsynchronizowane',
          message: 'Pomyślnie zsynchronizowano ewidencję logowań ze wszystkich kawiarni w Warszawie dla 7 kierowników.',
          category: 'system',
          severity: 'success',
          timestamp: formatTime(12),
          isRead: true,
          actionModule: 'managers_schedule',
          actionLabel: 'Sprawdź Kolumnę RCP',
        },
      ];
      this.saveToStorage();
    }
  }

  public getNotifications(): DesktopNotification[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  public getUrgentCount(): number {
    return this.notifications.filter((n) => !n.isRead && (n.severity === 'urgent' || n.severity === 'warning')).length;
  }

  public addNotification(notif: Omit<DesktopNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string; timestamp?: string }): DesktopNotification {
    const newNotif: DesktopNotification = {
      ...notif,
      id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: notif.timestamp || new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    this.notifications = [newNotif, ...this.notifications.filter((n) => n.id !== newNotif.id)];
    this.saveToStorage();

    // Wyślij także natywne powiadomienie macOS jeśli włączone
    this.sendNativeDesktopNotification(newNotif.title, newNotif.message);

    return newNotif;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    this.saveToStorage();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, isRead: true }));
    this.saveToStorage();
  }

  public deleteNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.saveToStorage();
  }

  public clearAll() {
    this.notifications = [];
    this.saveToStorage();
  }

  // =========================================================================
  // NATYWNE POWIADOMIENIA macOS / DESKTOP (HTML5 Notification API)
  // =========================================================================

  public isNativeSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public isNativeEnabled(): boolean {
    try {
      if (!this.isNativeSupported()) return false;
      return Notification.permission === 'granted' && localStorage.getItem(PERMISSION_KEY) !== 'false';
    } catch {
      return false;
    }
  }

  public async requestNativePermission(): Promise<boolean> {
    if (!this.isNativeSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem(PERMISSION_KEY, 'true');
        return true;
      } else {
        localStorage.setItem(PERMISSION_KEY, 'false');
        return false;
      }
    } catch {
      return false;
    }
  }

  public setNativeEnabled(enabled: boolean) {
    localStorage.setItem(PERMISSION_KEY, enabled ? 'true' : 'false');
    this.notifyListeners();
  }

  public sendNativeDesktopNotification(title: string, body: string) {
    try {
      if (this.isNativeSupported() && Notification.permission === 'granted' && localStorage.getItem(PERMISSION_KEY) !== 'false') {
        new Notification(`☕ Starbucks Operations: ${title}`, {
          body,
          icon: '/favicon.ico',
          silent: false,
        });
      }
    } catch (err) {
      console.warn('Nie udało się wysłać natywnego powiadomienia desktop:', err);
    }
  }

  /**
   * Test natywnego powiadomienia desktop macOS
   */
  public async testNativeNotification(): Promise<boolean> {
    if (!this.isNativeSupported()) return false;
    if (Notification.permission !== 'granted') {
      const granted = await this.requestNativePermission();
      if (!granted) return false;
    }

    try {
      const storeName = typeof localStorage !== 'undefined' ? (localStorage.getItem('sbx_store_name') || 'kawiarni') : 'kawiarni';
      new Notification('☕ Starbucks Operations Suite (macOS)', {
        body: `Natywne powiadomienia desktopowe działają prawidłowo dla ${storeName}!`,
        icon: '/favicon.ico',
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const desktopNotificationService = new DesktopNotificationService();
