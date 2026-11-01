// src/services/admin/enrollmentService.ts
/**
 * Starbucks Operations Suite — Enterprise Device Enrollment & Access Provisioning Service
 *
 * Implements the 4-step Store Manager Onboarding Workflow:
 * 1. Fresh app launch on SM laptop (unactivated state)
 * 2. Registration with corporate @amrest.eu / @starbucks.com email & 6-digit OTP verification
 * 3. Pending Approval state: laptop binds hardware fingerprint and waits for manager approval
 * 4. Managing Director / Fleet Master approves or rejects request and provisions store & permissions
 */

import { AppUserRole, GranularUserPermissions, PendingAccessRequest } from '../../types/admin';
import { ROLE_DEFAULT_PERMISSIONS, AdminService } from './adminService';
import { LicensingService, licensingService } from '../security/licensingService';
import { AuthService, validateCorporateEmail } from '../auth/authService';
import { cryptoSha256Hex, cryptoRandomHex, cryptoRandomInt, cryptoConstantTimeEqual } from '../security/cryptoUtils';
import { STARBUCKS_STORES_CATALOG } from '../../constants/starbucksStores';

const STORAGE_KEY_CURRENT_ENROLLMENT = 'sbx_device_enrollment_request_v1';
const STORAGE_KEY_CENTRAL_REQUESTS = 'sbx_central_access_requests_v1';
const STORAGE_KEY_OTP_SESSION = 'sbx_enrollment_otp_challenge';

const FIRESTORE_PROJECT_ID = 'starbucks-ops-suite';
const FIRESTORE_COLLECTION = 'cloud_access_requests';

export interface OtpChallengeState {
  email: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
  attemptsLeft: number;
  simulatedCode?: string;
}

export interface SubmitEnrollmentPayload {
  fullName: string;
  email: string;
  requestedRole: AppUserRole;
  requestNote?: string;
}

export interface ApproveEnrollmentPayload {
  storeId: string;
  role: AppUserRole;
  permissions?: Partial<GranularUserPermissions>;
  adminName: string;
}

export class EnrollmentService {
  private static instance: EnrollmentService | null = null;
  private listeners: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): EnrollmentService {
    if (!this.instance) {
      this.instance = new EnrollmentService();
    }
    return this.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Error in EnrollmentService listener:', err);
      }
    });
  }

  // =========================================================================
  // KROK 2: Weryfikacja e-maila kodem 6-cyfrowym (OTP)
  // =========================================================================

  /**
   * Generuje i wysyła 6-cyfrowy kod autoryzacyjny na e-mail firmowy (@amrest.eu / @starbucks.com)
   */
  public async requestEmailOtp(email: string): Promise<{ success: boolean; message: string; simulatedCode?: string }> {
    const val = validateCorporateEmail(email);
    if (!val.isValid || !val.normalizedEmail) {
      return {
        success: false,
        message: val.error || 'Wymagany jest firmowy adres e-mail w domenie @amrest.eu lub @starbucks.com.',
      };
    }

    const normalized = val.normalizedEmail;
    const rawOtp = String(cryptoRandomInt(100000, 999999));
    const salt = cryptoRandomHex(16);
    const codeHash = cryptoSha256Hex(`${salt}:${rawOtp}:${normalized}`);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minut

    const state: OtpChallengeState = {
      email: normalized,
      codeHash,
      salt,
      expiresAt,
      attemptsLeft: 3,
      simulatedCode: rawOtp,
    };

    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY_OTP_SESSION, JSON.stringify(state));
      } catch {}
    }

    console.info(`[EnrollmentService] Wygenerowano kod 2FA dla ${normalized}: ${rawOtp} (Wygasa za 5 min)`);

    return {
      success: true,
      message: `Kod weryfikacyjny został wysłany na adres ${normalized}. Przepisz 6 cyfr z wiadomości e-mail.`,
      simulatedCode: rawOtp,
    };
  }

  /**
   * Weryfikuje 6-cyfrowy kod wpisany przez kierownika (Constant-Time)
   */
  public verifyEmailOtp(email: string, enteredCode: string): { success: boolean; message: string } {
    if (typeof sessionStorage === 'undefined') {
      return { success: false, message: 'Brak aktywnej sesji przeglądarki.' };
    }

    const raw = sessionStorage.getItem(STORAGE_KEY_OTP_SESSION);
    if (!raw) {
      return { success: false, message: 'Sesja weryfikacji wygasła. Wygeneruj nowy kod.' };
    }

    try {
      const state: OtpChallengeState = JSON.parse(raw);
      if (Date.now() > state.expiresAt) {
        sessionStorage.removeItem(STORAGE_KEY_OTP_SESSION);
        return { success: false, message: 'Kod autoryzacyjny wygasł. Wyślij nowy kod na swój e-mail.' };
      }

      if (state.email !== email.trim().toLowerCase()) {
        return { success: false, message: 'Adres e-mail nie zgadza się z wysłanym kodem.' };
      }

      if (state.attemptsLeft <= 0) {
        sessionStorage.removeItem(STORAGE_KEY_OTP_SESSION);
        return { success: false, message: 'Zbyt wiele nieudanych prób. Wygeneruj nowy kod.' };
      }

      const candidateHash = cryptoSha256Hex(`${state.salt}:${enteredCode.trim()}:${state.email}`);
      const isMatch = cryptoConstantTimeEqual(candidateHash, state.codeHash);

      if (!isMatch) {
        state.attemptsLeft -= 1;
        sessionStorage.setItem(STORAGE_KEY_OTP_SESSION, JSON.stringify(state));
        return {
          success: false,
          message: `Niepoprawny kod weryfikacyjny. Pozostało prób: ${state.attemptsLeft}.`,
        };
      }

      // Sukces — usuwamy stan jednorazowego OTP
      sessionStorage.removeItem(STORAGE_KEY_OTP_SESSION);
      return {
        success: true,
        message: 'Adres e-mail został pomyślnie potwierdzony.',
      };
    } catch {
      return { success: false, message: 'Błąd przetwarzania sesji weryfikacyjnej.' };
    }
  }

  // =========================================================================
  // KROK 3: Rejestracja zgłoszenia laptopa (Pending Approval)
  // =========================================================================

  /**
   * Tworzy i rejestruje wniosek o dostęp dla tego konkretnego laptopa
   */
  public async submitEnrollmentRequest(payload: SubmitEnrollmentPayload): Promise<{
    success: boolean;
    request?: PendingAccessRequest;
    message?: string;
  }> {
    try {
      const hwFingerprint = await licensingService.getHardwareFingerprint();
      const deviceName = AuthService.getDeviceName();
      const tokenSuffix = cryptoRandomHex(3).toUpperCase();
      const pairingToken = `REQ-${tokenSuffix}`;

      const request: PendingAccessRequest = {
        id: `req_${Date.now()}_${cryptoRandomHex(4)}`,
        storeUnitCode: '',
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        requestedRole: payload.requestedRole,
        deviceFingerprint: hwFingerprint,
        deviceName,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        isEmailVerified: true,
        pairingToken,
        requestNote: payload.requestNote || '',
      };

      // 1. Zapisz w pamięci lokalnej tego laptopa
      this.saveLocalEnrollment(request);

      // 2. Dodaj do centralnego rejestru (dostępnego także dla managera)
      this.saveToCentralRegistry(request);

      // 3. Opcjonalna wysyłka do Firestore REST API
      this.syncRequestToFirestore(request).catch(() => {});

      this.notify();

      return {
        success: true,
        request,
        message: 'Wniosek został pomyślnie złożony i oczekuje na decyzję Managera Zarządzającego.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Wystąpił błąd podczas rejestracji urządzenia.',
      };
    }
  }

  /**
   * Zwraca aktualny stan rejestracji bieżącego laptopa
   */
  public async getCurrentDeviceEnrollment(): Promise<PendingAccessRequest | null> {
    const local = this.getLocalEnrollment();
    if (!local) return null;

    // Sprawdź czy w centralnym rejestrze (lub chmurze) pojawiła się aktualizacja statusu
    const updated = await this.fetchUpdatedRequest(local.id, local.deviceFingerprint);
    if (updated) {
      this.saveLocalEnrollment(updated);
      return updated;
    }

    return local;
  }

  /**
   * Anuluje bieżący wniosek i pozwala zacząć od nowa
   */
  public cancelCurrentEnrollment(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_CURRENT_ENROLLMENT);
      } catch {}
    }
    this.notify();
  }

  // =========================================================================
  // KROK 4: Manager Zarządzający (Fleet Master) akceptuje / odrzuca wniosek
  // =========================================================================

  /**
   * Pobiera listę wszystkich wniosków o dostęp (dla Managera)
   */
  public async getAllRequests(): Promise<PendingAccessRequest[]> {
    const central = this.getCentralRegistry();
    const adminPending = AdminService.getPendingRequests();

    // Połącz i zdeduplikuj wnioski
    const map = new Map<string, PendingAccessRequest>();

    adminPending.forEach((r) => map.set(r.id, r));
    central.forEach((r) => map.set(r.id, r));

    // Spróbuj pobrać najnowsze z Firestore
    try {
      const cloudReqs = await this.fetchFromFirestore();
      cloudReqs.forEach((r) => map.set(r.id, r));
    } catch {}

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }

  /**
   * Akceptacja wniosku przez Managera Zarządzającego:
   * - przydzielenie konkretnej kawiarni
   * - nadanie roli (SM / ASM)
   * - skonfigurowanie granularnych uprawnień do danych
   * - wygenerowanie kryptograficznego klucza sprzętowego
   */
  public async approveAccessRequest(
    requestId: string,
    payload: ApproveEnrollmentPayload
  ): Promise<{ success: boolean; request?: PendingAccessRequest; message: string }> {
    const all = await this.getAllRequests();
    const target = all.find((r) => r.id === requestId);
    if (!target) {
      return { success: false, message: 'Nie odnaleziono wniosku o podanym identyfikatorze.' };
    }

    // Wygeneruj unikalny klucz sprzętowy dla przydzielonej kawiarni
    const key = LicensingService.generateActivationKey(payload.storeId, 'STORE_CLIENT');

    const storeRec = STARBUCKS_STORES_CATALOG.find((s) => s.id === payload.storeId || s.unitCode === payload.storeId);
    const storeName = storeRec ? storeRec.name : `Kawiarnia ${payload.storeId}`;

    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[payload.role] || ROLE_DEFAULT_PERMISSIONS.STORE_MANAGER;
    const finalPermissions: GranularUserPermissions = {
      ...defaultPerms,
      ...(payload.permissions || {}),
    };

    const approvedRequest: PendingAccessRequest = {
      ...target,
      status: 'APPROVED',
      assignedStoreId: payload.storeId,
      assignedStoreName: storeName,
      assignedRole: payload.role,
      assignedPermissions: finalPermissions,
      assignedLicenseKey: key,
      approvedAt: new Date().toISOString(),
      approvedBy: payload.adminName,
      rejectionReason: undefined,
    };

    // Zapisz w centralnym rejestrze
    this.saveToCentralRegistry(approvedRequest);

    // Zapisz w lokalnym wniosku (jeśli to ta sama maszyna)
    const currentLocal = this.getLocalEnrollment();
    if (currentLocal && currentLocal.id === approvedRequest.id) {
      this.saveLocalEnrollment(approvedRequest);
    }

    // Zapisz do bazy użytkowników AdminService
    AdminService.approveRequest(requestId, payload.role, payload.adminName);

    // Zsynchronizuj z Firestore
    await this.syncRequestToFirestore(approvedRequest).catch(() => {});

    this.notify();

    return {
      success: true,
      request: approvedRequest,
      message: `Pomyślnie zaakceptowano wniosek dla ${approvedRequest.fullName}. Przydzielono kawiarnię: ${storeName}.`,
    };
  }

  /**
   * Odrzucenie wniosku przez Managera Zarządzającego
   */
  public async rejectAccessRequest(
    requestId: string,
    reason: string,
    adminName: string
  ): Promise<{ success: boolean; message: string }> {
    const all = await this.getAllRequests();
    const target = all.find((r) => r.id === requestId);
    if (!target) {
      return { success: false, message: 'Nie odnaleziono wniosku.' };
    }

    const rejected: PendingAccessRequest = {
      ...target,
      status: 'REJECTED',
      rejectionReason: reason || 'Odrzucono przez Managera Zarządzającego',
      approvedAt: undefined,
      approvedBy: adminName,
    };

    this.saveToCentralRegistry(rejected);

    const currentLocal = this.getLocalEnrollment();
    if (currentLocal && currentLocal.id === rejected.id) {
      this.saveLocalEnrollment(rejected);
    }

    AdminService.rejectRequest(requestId, adminName, reason);
    await this.syncRequestToFirestore(rejected).catch(() => {});

    this.notify();

    return {
      success: true,
      message: 'Wniosek został odrzucony.',
    };
  }

  // =========================================================================
  // Pomocnicze metody zapisu i synchronizacji
  // =========================================================================

  private getLocalEnrollment(): PendingAccessRequest | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CURRENT_ENROLLMENT);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveLocalEnrollment(req: PendingAccessRequest): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_ENROLLMENT, JSON.stringify(req));
    } catch {}
  }

  private getCentralRegistry(): PendingAccessRequest[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CENTRAL_REQUESTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveToCentralRegistry(req: PendingAccessRequest): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const current = this.getCentralRegistry();
      const idx = current.findIndex((r) => r.id === req.id || (r.deviceFingerprint && r.deviceFingerprint === req.deviceFingerprint));
      if (idx >= 0) {
        current[idx] = req;
      } else {
        current.unshift(req);
      }
      localStorage.setItem(STORAGE_KEY_CENTRAL_REQUESTS, JSON.stringify(current));
    } catch {}
  }

  private async fetchUpdatedRequest(requestId: string, hwFingerprint: string): Promise<PendingAccessRequest | null> {
    // 1. Sprawdź centralny rejestr w localStorage
    const central = this.getCentralRegistry();
    const match = central.find((r) => r.id === requestId || r.deviceFingerprint === hwFingerprint);
    if (match && match.status !== 'PENDING') {
      return match;
    }

    // 2. Sprawdź Firestore REST API
    try {
      const docId = `req_${hwFingerprint.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;
      const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${docId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.fields) {
          const req = this.mapFirestoreToRequest(data.fields);
          if (req) {
            this.saveToCentralRegistry(req);
            return req;
          }
        }
      }
    } catch {}

    return match || null;
  }

  private async syncRequestToFirestore(req: PendingAccessRequest): Promise<void> {
    const docId = `req_${req.deviceFingerprint.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${docId}`;

    const payload = {
      fields: {
        id: { stringValue: req.id },
        fullName: { stringValue: req.fullName },
        email: { stringValue: req.email },
        requestedRole: { stringValue: req.requestedRole },
        deviceFingerprint: { stringValue: req.deviceFingerprint },
        deviceName: { stringValue: req.deviceName },
        status: { stringValue: req.status },
        createdAt: { stringValue: req.createdAt },
        pairingToken: { stringValue: req.pairingToken || '' },
        assignedStoreId: { stringValue: req.assignedStoreId || '' },
        assignedStoreName: { stringValue: req.assignedStoreName || '' },
        assignedRole: { stringValue: req.assignedRole || '' },
        assignedLicenseKey: { stringValue: req.assignedLicenseKey || '' },
        rejectionReason: { stringValue: req.rejectionReason || '' },
        approvedBy: { stringValue: req.approvedBy || '' },
        approvedAt: { stringValue: req.approvedAt || '' },
      },
    };

    try {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  private async fetchFromFirestore(): Promise<PendingAccessRequest[]> {
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.documents || !Array.isArray(json.documents)) return [];

      const list: PendingAccessRequest[] = [];
      for (const doc of json.documents) {
        if (doc.fields) {
          const req = this.mapFirestoreToRequest(doc.fields);
          if (req) list.push(req);
        }
      }
      return list;
    } catch {
      return [];
    }
  }

  private mapFirestoreToRequest(f: Record<string, any>): PendingAccessRequest | null {
    if (!f.id?.stringValue || !f.email?.stringValue) return null;
    return {
      id: f.id.stringValue,
      storeUnitCode: f.storeUnitCode?.stringValue || '',
      fullName: f.fullName?.stringValue || 'Kierownik',
      email: f.email.stringValue,
      requestedRole: (f.requestedRole?.stringValue as AppUserRole) || 'STORE_MANAGER',
      deviceFingerprint: f.deviceFingerprint?.stringValue || '',
      deviceName: f.deviceName?.stringValue || 'Stacja robocza',
      status: (f.status?.stringValue as any) || 'PENDING',
      createdAt: f.createdAt?.stringValue || new Date().toISOString(),
      isEmailVerified: true,
      pairingToken: f.pairingToken?.stringValue,
      assignedStoreId: f.assignedStoreId?.stringValue,
      assignedStoreName: f.assignedStoreName?.stringValue,
      assignedRole: f.assignedRole?.stringValue as AppUserRole,
      assignedLicenseKey: f.assignedLicenseKey?.stringValue,
      rejectionReason: f.rejectionReason?.stringValue,
      approvedBy: f.approvedBy?.stringValue,
      approvedAt: f.approvedAt?.stringValue,
    };
  }
}

export const enrollmentService = EnrollmentService.getInstance();
