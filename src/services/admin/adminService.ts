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

import { StoreStorage } from '../storeStorage';

const PROTOTYPE_MOCK_EMAILS = new Set([
  'kamil.kaminski@amrest.eu',
  'zuzanna.makowska@amrest.eu',
  'piotr.wisniewski@amrest.eu',
  'kacper.wisniewski@amrest.eu',
  'maja.zielinska@amrest.eu',
]);

const PROTOTYPE_MOCK_IDS = new Set([
  'usr_ssv_kamil_k',
  'usr_ssv_zuzanna_m',
  'usr_ssv_piotr_w',
]);

export const TEST_AMREST_USER: ManagedAppUser = {
  id: 'usr_test_amrest',
  storeUnitCode: '108120',
  fullName: 'Tester AmRest (Fleet QA)',
  email: 'test@amrest.eu',
  role: 'STORE_MANAGER',
  isActive: true,
  permissions: {
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
  deviceFingerprint: 'FPR-TEST-AMREST-MACBOOK-PRO-2026',
  deviceName: 'MacBook Pro (AmRest Test Fleet)',
  sessionVersion: 1,
  createdAt: '2026-01-01T08:00:00.000Z',
};

export const TEST_AMREST_REQUEST: PendingAccessRequest = {
  id: 'req_test_amrest_eu',
  storeUnitCode: '108120',
  fullName: 'Tester AmRest (Wniosek Stanowiska)',
  email: 'test@amrest.eu',
  requestedRole: 'STORE_MANAGER',
  deviceFingerprint: 'FPR-TEST-AMREST-MACBOOK-PRO-2026',
  deviceName: 'MacBook Pro (AmRest Test Fleet)',
  ipAddress: '10.240.12.84 (VPN Starbucks)',
  requestNote: 'Stanowisko testowe do audytu floty, uprawnień i kluczy licencyjnych',
  createdAt: new Date().toISOString(),
  status: 'PENDING',
  isEmailVerified: true,
  pairingToken: 'REQ-TST01',
};

export class AdminService {
  private static purgePrototypeData(): void {
    if (typeof localStorage === 'undefined') return;

    const isMock = (u: any) => {
      if (!u || typeof u !== 'object') return false;
      if (u.id && PROTOTYPE_MOCK_IDS.has(u.id)) return true;
      if (typeof u.email === 'string' && PROTOTYPE_MOCK_EMAILS.has(u.email.toLowerCase())) return true;
      return false;
    };

    // 1. Oczyszczenie partycji StoreStorage dla aktywnej kawiarni
    try {
      const users = StoreStorage.getItem<ManagedAppUser[]>('admin_managed_users');
      if (Array.isArray(users)) {
        const cleaned = users.filter((u) => !isMock(u));
        if (cleaned.length !== users.length) {
          StoreStorage.setItem('admin_managed_users', cleaned);
        }
      }

      const reqs = StoreStorage.getItem<PendingAccessRequest[]>('admin_pending_requests');
      if (Array.isArray(reqs)) {
        const cleaned = reqs.filter((r) => !isMock(r));
        if (cleaned.length !== reqs.length) {
          StoreStorage.setItem('admin_pending_requests', cleaned);
        }
      }
    } catch {}

    // 2. Oczyszczenie wszystkich partycji kawiarni i kluczy globalnych w localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('admin_managed_users') || key.includes('admin_pending_requests'))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw && raw.startsWith('[')) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const cleaned = parsed.filter((item) => !isMock(item));
                if (cleaned.length !== parsed.length) {
                  localStorage.setItem(key, JSON.stringify(cleaned));
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  private static initDefaults(): void {
    if (StoreStorage.getItem('admin_managed_users') === null) {
      StoreStorage.setItem('admin_managed_users', [TEST_AMREST_USER]);
    }
    if (StoreStorage.getItem('admin_pending_requests') === null) {
      StoreStorage.setItem('admin_pending_requests', [TEST_AMREST_REQUEST]);
    }
    if (StoreStorage.getItem('admin_security_logs') === null) {
      StoreStorage.setItem('admin_security_logs', []);
    }
    this.purgePrototypeData();
  }

  public static getUsers(): ManagedAppUser[] {
    this.initDefaults();
    try {
      const users = StoreStorage.getItem<ManagedAppUser[]>('admin_managed_users') || [];
      const filtered = users.filter(u => !PROTOTYPE_MOCK_IDS.has(u.id) && !PROTOTYPE_MOCK_EMAILS.has(u.email?.toLowerCase()));
      if (!filtered.some(u => u.email?.toLowerCase() === 'test@amrest.eu')) {
        filtered.push(TEST_AMREST_USER);
        StoreStorage.setItem('admin_managed_users', filtered);
      }
      return filtered;
    } catch {
      return [TEST_AMREST_USER];
    }
  }

  public static deleteUser(userId: string, adminName: string): boolean {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return false;

    const removed = users.splice(index, 1)[0];
    StoreStorage.setItem('admin_managed_users', users);

    // Oczyszczenie w pamięci lokalnej
    try {
      const rawUsers = localStorage.getItem('sbx_admin_managed_users');
      if (rawUsers) {
        const parsed: ManagedAppUser[] = JSON.parse(rawUsers);
        const filtered = parsed.filter(u => u.id !== userId);
        localStorage.setItem('sbx_admin_managed_users', JSON.stringify(filtered));
      }
    } catch {}

    this.addAuditLog({
      actorName: adminName,
      actorRole: 'STORE_MANAGER',
      actionType: 'KILL_SWITCH_REVOKE',
      targetResource: `user:${removed.email}`,
      details: `Trwale usunięto profil pracownika: ${removed.fullName} (${removed.email})`,
      deviceName: removed.deviceName,
    });

    return true;
  }

  public static getPendingRequests(): PendingAccessRequest[] {
    this.initDefaults();
    try {
      const list = StoreStorage.getItem<PendingAccessRequest[]>('admin_pending_requests') || [];
      if (!list.some(r => r.email?.toLowerCase() === 'test@amrest.eu')) {
        list.push(TEST_AMREST_REQUEST);
        StoreStorage.setItem('admin_pending_requests', list);
      }
      return list;
    } catch {
      return [TEST_AMREST_REQUEST];
    }
  }

  public static getSecurityLogs(): SecurityAuditLog[] {
    this.initDefaults();
    try {
      return StoreStorage.getItem<SecurityAuditLog[]>('admin_security_logs') || [];
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
    StoreStorage.setItem('admin_pending_requests', requests);

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
    const existingIdx = users.findIndex(u => u.email?.toLowerCase() === newUser.email?.toLowerCase());
    if (existingIdx >= 0) {
      users[existingIdx] = { ...users[existingIdx], ...newUser, id: users[existingIdx].id };
    } else {
      users.push(newUser);
    }
    StoreStorage.setItem('admin_managed_users', users);

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
    StoreStorage.setItem('admin_pending_requests', requests);

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
    StoreStorage.setItem('admin_managed_users', users);

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
    StoreStorage.setItem('admin_managed_users', users);

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
    StoreStorage.setItem('admin_managed_users', users);

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
    StoreStorage.setItem('admin_security_logs', logs);
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
      isEmailVerified: true,
      pairingToken: `REQ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    };

    if (existingIndex >= 0) {
      requests[existingIndex] = newRequest;
    } else {
      requests.unshift(newRequest);
    }

    StoreStorage.setItem('admin_pending_requests', requests);

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
