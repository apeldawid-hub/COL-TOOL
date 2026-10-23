// src/services/admin/adminService.ts
import { AppUserRole, GranularUserPermissions, ManagedAppUser, PendingAccessRequest, SecurityAuditLog } from '../../types/admin';

export const ROLE_DEFAULT_PERMISSIONS: Record<AppUserRole, GranularUserPermissions> = {
  STORE_MANAGER: {
    canViewFinancialSales: true,
    canEditForecastTarget: true,
    canModifyNcRules: true,
    canViewWageRates: true,
    canViewMedicalLeaves: true,
    canPublishSchedule: true,
    canApproveTor: true,
    canImportFichajes: true,
    canViewColPnl: true,
    canViewZusRates: true,
    canSimulateWhatIf: true,
    canExportExcel: true,
  },
  ASSISTANT_STORE_MANAGER: {
    canViewFinancialSales: true,
    canEditForecastTarget: true,
    canModifyNcRules: true,
    canViewWageRates: false,
    canViewMedicalLeaves: true,
    canPublishSchedule: true,
    canApproveTor: false,
    canImportFichajes: true,
    canViewColPnl: false,
    canViewZusRates: false,
    canSimulateWhatIf: false,
    canExportExcel: true,
  },
  SHIFT_SUPERVISOR: {
    canViewFinancialSales: false,
    canEditForecastTarget: false,
    canModifyNcRules: false,
    canViewWageRates: false,
    canViewMedicalLeaves: false,
    canPublishSchedule: false,
    canApproveTor: false,
    canImportFichajes: true,
    canViewColPnl: false,
    canViewZusRates: false,
    canSimulateWhatIf: false,
    canExportExcel: false,
  },
  BARISTA: {
    canViewFinancialSales: false,
    canEditForecastTarget: false,
    canModifyNcRules: false,
    canViewWageRates: false,
    canViewMedicalLeaves: false,
    canPublishSchedule: false,
    canApproveTor: false,
    canImportFichajes: false,
    canViewColPnl: false,
    canViewZusRates: false,
    canSimulateWhatIf: false,
    canExportExcel: false,
  },
  DISTRICT_MANAGER: {
    canViewFinancialSales: true,
    canEditForecastTarget: false,
    canModifyNcRules: false,
    canViewWageRates: true,
    canViewMedicalLeaves: false,
    canPublishSchedule: false,
    canApproveTor: true,
    canImportFichajes: false,
    canViewColPnl: true,
    canViewZusRates: true,
    canSimulateWhatIf: true,
    canExportExcel: true,
  },
};

const STORAGE_USERS_KEY = 'sbx_admin_managed_users';
const STORAGE_REQUESTS_KEY = 'sbx_admin_pending_requests';
const STORAGE_LOGS_KEY = 'sbx_admin_security_logs';

export class AdminService {
  private static initDefaults(): void {
    if (!localStorage.getItem(STORAGE_USERS_KEY)) {
      const defaultUsers: ManagedAppUser[] = [
        {
          id: 'usr_sm_dawid_apel',
          storeUnitCode: '18120',
          fullName: 'Dawid Apel',
          email: 'dawid.apel@amrest.eu',
          role: 'STORE_MANAGER',
          isActive: true,
          permissions: ROLE_DEFAULT_PERMISSIONS.STORE_MANAGER,
          lastLoginAt: new Date().toISOString(),
          deviceName: 'MacBook Air - Zaplecze Janki',
          sessionVersion: 1,
          createdAt: '2026-09-01T08:00:00Z',
        },
        {
          id: 'usr_ssv_kamil_k',
          storeUnitCode: '18120',
          fullName: 'Kamil Kamiński',
          email: 'kamil.kaminski@amrest.eu',
          role: 'SHIFT_SUPERVISOR',
          isActive: true,
          permissions: ROLE_DEFAULT_PERMISSIONS.SHIFT_SUPERVISOR,
          lastLoginAt: '2026-10-23T14:30:00Z',
          deviceName: 'iPhone 15 - Partner Mobile',
          sessionVersion: 1,
          createdAt: '2026-09-01T08:00:00Z',
        },
        {
          id: 'usr_ssv_zuzanna_m',
          storeUnitCode: '18120',
          fullName: 'Zuzanna Makowska',
          email: 'zuzanna.makowska@amrest.eu',
          role: 'SHIFT_SUPERVISOR',
          isActive: true,
          permissions: ROLE_DEFAULT_PERMISSIONS.SHIFT_SUPERVISOR,
          lastLoginAt: '2026-10-22T21:45:00Z',
          deviceName: 'Galaxy S24 - Partner Mobile',
          sessionVersion: 1,
          createdAt: '2026-09-01T08:00:00Z',
        },
      ];
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(STORAGE_REQUESTS_KEY)) {
      const defaultRequests: PendingAccessRequest[] = [
        {
          id: 'req_new_01',
          storeUnitCode: '18120',
          fullName: 'Piotr Wiśniewski',
          email: 'piotr.wisniewski@amrest.eu',
          requestedRole: 'BARISTA',
          deviceFingerprint: 'dev_fp_iphone_pw',
          deviceName: 'iPhone 13 - iOS 18.1',
          ipAddress: '192.168.1.112 (CH Janki Wi-Fi)',
          requestNote: 'Nowy partner w trakcie szkolenia First 30 (T1-T10)',
          createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          status: 'PENDING',
        },
      ];
      localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(defaultRequests));
    }

    if (!localStorage.getItem(STORAGE_LOGS_KEY)) {
      const defaultLogs: SecurityAuditLog[] = [
        {
          id: 'log_01',
          timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          actorName: 'Dawid Apel',
          actorRole: 'STORE_MANAGER',
          actionType: 'LOGIN_2FA',
          targetResource: 'system:root_admin',
          details: 'Pomyślne uwierzytelnienie 2FA firmowym adresem dawid.apel@amrest.eu',
          ipAddress: '192.168.1.10 (MacBook Air Zaplecze)',
          deviceName: 'macOS 15.2',
        },
      ];
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(defaultLogs));
    }
  }

  public static getUsers(): ManagedAppUser[] {
    this.initDefaults();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  public static getPendingRequests(): PendingAccessRequest[] {
    this.initDefaults();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_REQUESTS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  public static getSecurityLogs(): SecurityAuditLog[] {
    this.initDefaults();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_LOGS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  public static approveRequest(requestId: string, assignedRole: AppUserRole, adminName: string): ManagedAppUser | null {
    const requests = this.getPendingRequests();
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return null;

    const req = requests[reqIndex];
    req.status = 'APPROVED';
    requests.splice(reqIndex, 1);
    localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests));

    const newUser: ManagedAppUser = {
      id: `usr_${Date.now()}`,
      storeUnitCode: req.storeUnitCode,
      fullName: req.fullName,
      email: req.email,
      role: assignedRole,
      isActive: true,
      permissions: { ...ROLE_DEFAULT_PERMISSIONS[assignedRole] },
      lastLoginAt: undefined,
      deviceFingerprint: req.deviceFingerprint,
      deviceName: req.deviceName,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newUser);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'REQUEST_APPROVED',
      targetResource: `user:${newUser.email}`,
      details: `Zatwierdzono wniosek pracownika ${newUser.fullName} z rolą: ${assignedRole}`,
      deviceName: req.deviceName,
    });

    return newUser;
  }

  public static rejectRequest(requestId: string, adminName: string, reason: string): boolean {
    const requests = this.getPendingRequests();
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return false;

    const req = requests[reqIndex];
    requests.splice(reqIndex, 1);
    localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests));

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'REQUEST_REJECTED',
      targetResource: `request:${req.email}`,
      details: `Odrzucono wniosek pracownika ${req.fullName}. Powód: ${reason}`,
    });

    return true;
  }

  public static killSwitchRevoke(userId: string, adminName: string): boolean {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return false;

    user.isActive = false;
    user.sessionVersion += 1; // Inkrementacja natychmiast odrzuca tokeny sesyjne
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'KILL_SWITCH_REVOKE',
      targetResource: `user:${user.email}`,
      details: `⚡ ZASTOSOWANO KILL-SWITCH: Natychmiastowe unieważnienie sesji i odcięcie dostępu dla ${user.fullName}`,
    });

    return true;
  }

  public static updateRole(userId: string, newRole: AppUserRole, adminName: string): boolean {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return false;

    const oldRole = user.role;
    user.role = newRole;
    user.permissions = { ...ROLE_DEFAULT_PERMISSIONS[newRole] };
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'ROLE_CHANGED',
      targetResource: `user:${user.email}`,
      details: `Zmieniono rolę pracownika ${user.fullName} z ${oldRole} na ${newRole}`,
    });

    return true;
  }

  public static togglePermission(userId: string, key: keyof GranularUserPermissions, adminName: string): boolean {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return false;

    const newValue = !user.permissions[key];
    user.permissions[key] = newValue;
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'PERMISSION_TOGGLED',
      targetResource: `user:${user.email}:${key}`,
      details: `Zmiana uprawnienia ${String(key)} na: ${newValue ? 'AKTYWNE' : 'ZABLOKOWANE'} dla ${user.fullName}`,
    });

    return true;
  }

  public static addAuditLog(entry: Omit<SecurityAuditLog, 'id' | 'timestamp'>): void {
    const logs = this.getSecurityLogs();
    const newLog: SecurityAuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.unshift(newLog);
    if (logs.length > 200) logs.pop();
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
  }

  public static submitAccessRequest(payload: {
    storeUnitCode: string;
    fullName: string;
    email: string;
    requestedRole: AppUserRole;
    deviceFingerprint: string;
    deviceName: string;
    ipAddress?: string;
    requestNote?: string;
  }): PendingAccessRequest {
    const requests = this.getPendingRequests();
    
    // Sprawdź czy już istnieje oczekujący wniosek dla tego e-maila
    const existingIndex = requests.findIndex(r => r.email.toLowerCase() === payload.email.toLowerCase());
    
    const newRequest: PendingAccessRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeUnitCode: payload.storeUnitCode,
      fullName: payload.fullName,
      email: payload.email.toLowerCase(),
      requestedRole: payload.requestedRole,
      deviceFingerprint: payload.deviceFingerprint,
      deviceName: payload.deviceName,
      ipAddress: payload.ipAddress || 'Lokalna sieć kawiarni',
      requestNote: payload.requestNote || 'Nowe zgłoszenie dostępu przez aplikację desktopową',
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    };

    if (existingIndex >= 0) {
      requests[existingIndex] = newRequest;
    } else {
      requests.unshift(newRequest);
    }

    localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests));

    this.addAuditLog({
      actorName: payload.fullName,
      actorRole: payload.requestedRole,
      actionType: 'REQUEST_APPROVED', // log submission
      targetResource: `request:${payload.email}`,
      details: `Wpłynął nowy wniosek o dostęp do kawiarni ${payload.storeUnitCode} z urządzenia ${payload.deviceName}`,
      deviceName: payload.deviceName,
    });

    return newRequest;
  }

  public static getUserByEmail(email: string): ManagedAppUser | null {
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public static getRequestByEmail(email: string): PendingAccessRequest | null {
    const requests = this.getPendingRequests();
    return requests.find(r => r.email.toLowerCase() === email.toLowerCase()) || null;
  }
}
