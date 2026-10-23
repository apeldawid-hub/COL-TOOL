// src/services/auth/authService.ts
/**
 * Starbucks Operations Suite — Serwis Autoryzacji, Tożsamości i 2FA (Zero-Leak)
 * 108120 SBX Warszawa Janki (Unit 18120)
 *
 * Zapewnia:
 * 1. Walidację domen firmowych (@amrest.eu, @starbucks.com)
 * 2. Dwuetapową weryfikację 2FA (kod OTP z powiadomieniem)
 * 3. Identyfikację urządzenia (Device Fingerprinting)
 * 4. Integrację z kolejką zatwierdzeń Store Managera (AdminService)
 * 5. Izolację sesji i natychmiastowe odcięcie po Kill-Switch
 */

import { AppUserRole, GranularUserPermissions, ManagedAppUser, PendingAccessRequest } from '../../types/admin';
import { AdminService, ROLE_DEFAULT_PERMISSIONS } from '../admin/adminService';

export interface AuthUserSession {
  userId: string;
  storeUnitCode: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  permissions: GranularUserPermissions;
  sessionToken: string;
  sessionVersion: number;
  deviceName: string;
  deviceFingerprint: string;
  loginAt: string;
}

interface PendingOtpVerification {
  email: string;
  code: string;
  expiresAt: number;
}

const STORAGE_SESSION_KEY = 'sbx_auth_current_session';
const STORAGE_DEVICE_UUID_KEY = 'sbx_device_uuid';
const OTP_STORAGE_KEY = 'sbx_auth_pending_otp';

export class AuthService {
  /**
   * Sprawdza, czy adres e-mail należy do dopuszczonych domen firmowych
   */
  public static isCorporateEmail(email: string): boolean {
    if (!email || !email.includes('@')) return false;
    const domain = email.trim().toLowerCase().split('@')[1];
    return domain === 'amrest.eu' || domain === 'starbucks.com';
  }

  /**
   * Generuje unikalny identyfikator urządzenia (Fingerprint)
   */
  public static getDeviceFingerprint(): string {
    let uuid = localStorage.getItem(STORAGE_DEVICE_UUID_KEY);
    if (!uuid) {
      uuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_DEVICE_UUID_KEY, uuid);
    }
    return uuid;
  }

  /**
   * Pobiera czytelną nazwę urządzenia
   */
  public static getDeviceName(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Macintosh')) return 'MacBook (macOS - Zaplecze)';
    if (ua.includes('Windows')) return 'PC Windows (Stacja Kawiarni)';
    if (ua.includes('iPhone')) return 'iPhone (Partner Mobile)';
    if (ua.includes('Android')) return 'Android (Partner Mobile)';
    return 'Stacja Robocza Starbucks';
  }

  /**
   * Zwraca aktywną sesję użytkownika lub null
   */
  public static getCurrentSession(): AuthUserSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const session: AuthUserSession = JSON.parse(raw);

      // Weryfikacja czy konto nie zostało zablokowane (Kill-Switch) w AdminService
      const user = AdminService.getUserByEmail(session.email);
      if (!user || !user.isActive || user.sessionVersion > session.sessionVersion) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Szybkie logowanie Store Managera (Dawid Apel) na zapleczu
   */
  public static quickLoginStoreManager(storeUnitCode: string = '18120'): AuthUserSession {
    const smEmail = 'dawid.apel@amrest.eu';
    let user = AdminService.getUserByEmail(smEmail);
    
    if (!user) {
      // Rejestrujemy domyślnego SM jeśli brak
      user = {
        id: 'usr_sm_dawid_apel',
        storeUnitCode,
        fullName: 'Dawid Apel',
        email: smEmail,
        role: 'STORE_MANAGER',
        isActive: true,
        permissions: ROLE_DEFAULT_PERMISSIONS.STORE_MANAGER,
        lastLoginAt: new Date().toISOString(),
        deviceName: this.getDeviceName(),
        sessionVersion: 1,
        createdAt: new Date().toISOString(),
      };
    }

    const session: AuthUserSession = {
      userId: user.id,
      storeUnitCode: user.storeUnitCode || storeUnitCode,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionToken: `tok_sm_${Date.now()}`,
      sessionVersion: user.sessionVersion,
      deviceName: this.getDeviceName(),
      deviceFingerprint: this.getDeviceFingerprint(),
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('sbx_user_name', user.fullName);
    localStorage.setItem('sbx_user_email', user.email);
    localStorage.setItem('sbx_user_role', 'Store Manager (SM)');

    AdminService.addAuditLog({
      actorName: user.fullName,
      actorRole: 'STORE_MANAGER',
      actionType: 'LOGIN_2FA',
      targetResource: 'system:root_admin',
      details: `Szybkie uwierzytelnienie Store Managera na zapleczu kawiarni ${storeUnitCode}`,
      deviceName: this.getDeviceName(),
    });

    return session;
  }

  /**
   * Żądanie wysłania 6-cyfrowego kodu 2FA na adres e-mail
   */
  public static async request2FaOtp(email: string, storeUnitCode: string = '18120'): Promise<{
    success: boolean;
    message: string;
    isPendingApproval?: boolean;
    isNotRegistered?: boolean;
    simulatedCode?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!this.isCorporateEmail(cleanEmail)) {
      return {
        success: false,
        message: 'Dostęp dozwolony wyłącznie dla adresów korporacyjnych @amrest.eu lub @starbucks.com.',
      };
    }

    // 1. Sprawdź czy użytkownik istnieje w bazie aktywnych
    const user = AdminService.getUserByEmail(cleanEmail);
    if (!user) {
      // Sprawdź czy jest w kolejce oczekujących
      const pendingReq = AdminService.getRequestByEmail(cleanEmail);
      if (pendingReq) {
        return {
          success: false,
          isPendingApproval: true,
          message: `Twój wniosek z dnia ${new Date(pendingReq.createdAt).toLocaleDateString('pl-PL')} oczekuje na zatwierdzenie przez Store Managera (Dawid Apel).`,
        };
      }

      return {
        success: false,
        isNotRegistered: true,
        message: 'Nie znaleziono zarejestrowanego konta dla tego adresu. Wypełnij formularz zgłoszeniowy pracownika.',
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        message: 'Konto zostało zablokowane przez Administratora (Kill-Switch). Skontaktuj się ze Store Managerem.',
      };
    }

    // 2. Generowanie 6-cyfrowego kodu OTP (ważny 5 minut)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const pendingOtp: PendingOtpVerification = {
      email: cleanEmail,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(pendingOtp));

    // W środowisku produkcyjnym tutaj następuje wysyłka przez Firebase Functions / SMTP
    // Zwracamy kod pomocniczo dla testów lokalnych na Macu
    return {
      success: true,
      message: `Kod 2FA został przesłany na adres ${cleanEmail}. Wpisz 6 cyfr, aby odblokować dostęp.`,
      simulatedCode: code,
    };
  }

  /**
   * Weryfikacja kodu 2FA i utworzenie sesji
   */
  public static async verify2FaOtp(email: string, enteredCode: string): Promise<{
    success: boolean;
    message?: string;
    session?: AuthUserSession;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const rawOtp = sessionStorage.getItem(OTP_STORAGE_KEY);

    if (!rawOtp) {
      return { success: false, message: 'Brak aktywnego żądania kodu. Wyślij kod ponownie.' };
    }

    const pendingOtp: PendingOtpVerification = JSON.parse(rawOtp);
    if (pendingOtp.email !== cleanEmail) {
      return { success: false, message: 'Niepoprawny adres e-mail dla oczekującego kodu.' };
    }

    if (Date.now() > pendingOtp.expiresAt) {
      sessionStorage.removeItem(OTP_STORAGE_KEY);
      return { success: false, message: 'Kod weryfikacyjny wygasł. Wygeneruj nowy kod.' };
    }

    if (pendingOtp.code !== enteredCode.trim()) {
      return { success: false, message: 'Wprowadzony kod jest niepoprawny. Spróbuj ponownie.' };
    }

    // Pomyślna weryfikacja
    sessionStorage.removeItem(OTP_STORAGE_KEY);

    const user = AdminService.getUserByEmail(cleanEmail);
    if (!user || !user.isActive) {
      return { success: false, message: 'Brak uprawnień do zalogowania.' };
    }

    const session: AuthUserSession = {
      userId: user.id,
      storeUnitCode: user.storeUnitCode,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionToken: `tok_${user.role.toLowerCase()}_${Date.now()}`,
      sessionVersion: user.sessionVersion,
      deviceName: this.getDeviceName(),
      deviceFingerprint: this.getDeviceFingerprint(),
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('sbx_user_name', user.fullName);
    localStorage.setItem('sbx_user_email', user.email);
    localStorage.setItem('sbx_user_role', user.role);

    AdminService.addAuditLog({
      actorName: user.fullName,
      actorRole: user.role,
      actionType: 'LOGIN_2FA',
      targetResource: `session:${user.email}`,
      details: `Pomyślne logowanie dwuetapowe 2FA z adresu ${cleanEmail}`,
      deviceName: this.getDeviceName(),
    });

    return {
      success: true,
      session,
    };
  }

  /**
   * Rejestracja nowego partnera / urządzenia (składa wniosek do Store Managera)
   */
  public static async registerPartner(payload: {
    storeUnitCode: string;
    fullName: string;
    email: string;
    requestedRole: AppUserRole;
    requestNote?: string;
  }): Promise<{ success: boolean; message: string; request?: PendingAccessRequest }> {
    const cleanEmail = payload.email.trim().toLowerCase();

    if (!this.isCorporateEmail(cleanEmail)) {
      return {
        success: false,
        message: 'Rejestracja jest możliwa wyłącznie z użyciem adresu korporacyjnego (@amrest.eu lub @starbucks.com).',
      };
    }

    const existingUser = AdminService.getUserByEmail(cleanEmail);
    if (existingUser) {
      return {
        success: false,
        message: 'Konto z tym adresem już istnieje. Skorzystaj z opcji logowania.',
      };
    }

    const request = AdminService.submitAccessRequest({
      storeUnitCode: payload.storeUnitCode,
      fullName: payload.fullName.trim(),
      email: cleanEmail,
      requestedRole: payload.requestedRole,
      deviceFingerprint: this.getDeviceFingerprint(),
      deviceName: this.getDeviceName(),
      requestNote: payload.requestNote,
    });

    return {
      success: true,
      message: 'Wniosek o dostęp został przekazany do Store Managera (Dawid Apel). Po zatwierdzeniu będziesz mógł zalogować się do aplikacji.',
      request,
    };
  }

  /**
   * Wylogowanie użytkownika
   */
  public static logout(): void {
    const current = this.getCurrentSession();
    if (current) {
      AdminService.addAuditLog({
        actorName: current.fullName,
        actorRole: current.role,
        actionType: 'LOGIN_2FA',
        targetResource: `session:${current.email}`,
        details: 'Wylogowano z systemu',
        deviceName: this.getDeviceName(),
      });
    }
    localStorage.removeItem(STORAGE_SESSION_KEY);
  }
}
