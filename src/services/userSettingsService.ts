// src/services/userSettingsService.ts
/**
 * Starbucks Operations Suite — Serwis Ustawień Użytkownika (Cross-Device Cloud Profile)
 *
 * Odpowiada za:
 * 1. Przechowywanie preferencji systemowych per użytkownik (`userId` / `email`).
 * 2. Zapis lokalny (0 ms latencji) w localStorage.
 * 3. Asynchroniczną synchronizację z chmurą Google Cloud Firestore pod ścieżką:
 *    `users/{userId}/settings/preferences`
 * 4. Automatyczne nawadnianie (hydration) ustawień po zalogowaniu na nowym urządzeniu.
 */

import { FIRESTORE_BASE_URL } from './sync/cloudSyncService';
import { AuthService } from './auth/authService';
import { logger } from './logger';

export interface UserSystemPreferences {
  theme: 'dark' | 'light' | 'system';
  defaultStoreId?: string;
  zoomLevel: number;
  notificationsEnabled: boolean;
  soundAlerts: boolean;
  laborLawStrictTolerance: boolean;
  scheduleViewDensity: 'compact' | 'comfortable';
  updatedAt: string;
}

const DEFAULT_PREFERENCES: UserSystemPreferences = {
  theme: 'dark',
  defaultStoreId: '108120',
  zoomLevel: 100,
  notificationsEnabled: true,
  soundAlerts: true,
  laborLawStrictTolerance: true,
  scheduleViewDensity: 'comfortable',
  updatedAt: new Date().toISOString(),
};

export class UserSettingsService {
  private static getStorageKey(userEmail: string): string {
    const safe = userEmail.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return `sbx_user_settings_${safe}`;
  }

  /**
   * Zwraca aktualne ustawienia bieżącego użytkownika z pamięci podręcznej
   */
  public static getPreferences(): UserSystemPreferences {
    const session = AuthService.getCurrentSession();
    if (!session?.email) {
      return DEFAULT_PREFERENCES;
    }

    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;

    try {
      const raw = localStorage.getItem(this.getStorageKey(session.email));
      if (!raw) return DEFAULT_PREFERENCES;
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Zapisuje preferencje lokalnie oraz wysyła do profilu w chmurze
   */
  public static async savePreferences(
    partial: Partial<UserSystemPreferences>
  ): Promise<UserSystemPreferences> {
    const session = AuthService.getCurrentSession();
    const current = this.getPreferences();
    const updated: UserSystemPreferences = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    if (session?.email && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.getStorageKey(session.email), JSON.stringify(updated));
      } catch (err) {
        console.warn('Błąd zapisu preferencji użytkownika w localStorage:', err);
      }
    }

    // Wyślij asynchronicznie do profilu w chmurze (Zero-Leak per użytkownik)
    if (session?.email) {
      this.syncPreferencesToCloud(session.email, updated).catch((err) => {
        logger.warn('SYNC', `[UserSettings] Ostrzeżenie synchronizacji profilu w chmurze: ${err?.message}`);
      });
    }

    return updated;
  }

  /**
   * Wypycha preferencje użytkownika do dokumentu `users/{userId}/settings/preferences`
   */
  private static async syncPreferencesToCloud(
    email: string,
    prefs: UserSystemPreferences
  ): Promise<void> {
    const safeUserId = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const url = `${FIRESTORE_BASE_URL}/users/${safeUserId}/settings/preferences`;

    const body = {
      fields: {
        theme: { stringValue: prefs.theme },
        defaultStoreId: { stringValue: prefs.defaultStoreId || '108120' },
        zoomLevel: { integerValue: String(prefs.zoomLevel) },
        notificationsEnabled: { booleanValue: prefs.notificationsEnabled },
        soundAlerts: { booleanValue: prefs.soundAlerts },
        laborLawStrictTolerance: { booleanValue: prefs.laborLawStrictTolerance },
        scheduleViewDensity: { stringValue: prefs.scheduleViewDensity },
        updatedAt: { stringValue: prefs.updatedAt },
      },
    };

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /**
   * Pobiera preferencje użytkownika z chmury po zalogowaniu na nowym urządzeniu (Cross-Device Hydration)
   */
  public static async hydratePreferencesFromCloud(email: string): Promise<UserSystemPreferences | null> {
    const safeUserId = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const url = `${FIRESTORE_BASE_URL}/users/${safeUserId}/settings/preferences`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.fields) return null;

      const f = data.fields;
      const remotePrefs: UserSystemPreferences = {
        theme: (f.theme?.stringValue as any) || 'dark',
        defaultStoreId: f.defaultStoreId?.stringValue || '108120',
        zoomLevel: f.zoomLevel?.integerValue ? parseInt(f.zoomLevel.integerValue, 10) : 100,
        notificationsEnabled: f.notificationsEnabled?.booleanValue ?? true,
        soundAlerts: f.soundAlerts?.booleanValue ?? true,
        laborLawStrictTolerance: f.laborLawStrictTolerance?.booleanValue ?? true,
        scheduleViewDensity: (f.scheduleViewDensity?.stringValue as any) || 'comfortable',
        updatedAt: f.updatedAt?.stringValue || new Date().toISOString(),
      };

      // Porównaj daty lub zaktualizuj lokalny stan
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getStorageKey(email), JSON.stringify(remotePrefs));
      }

      logger.info('AUTH', `[UserSettings] Pomyślnie zsynchronizowano ustawienia użytkownika [${email}] z chmury.`);
      return remotePrefs;
    } catch (err: any) {
      logger.warn('SYNC', `[UserSettings] Nie udało się pobrać preferencji z chmury: ${err?.message}`);
      return null;
    }
  }
}
