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

export class AdminService {
  private static initDefaults(): void {
    if (StoreStorage.getItem('admin_managed_users') === null) {
      StoreStorage.setItem('admin_managed_users', []);
    }
    if (StoreStorage.getItem('admin_pending_requests') === null) {
      StoreStorage.setItem('admin_pending_requests', []);
    }
    if (StoreStorage.getItem('admin_security_logs') === null) {
      StoreStorage.setItem('admin_security_logs', []);
    }
  }

  public static getUsers(): ManagedAppUser[] {
    this.initDefaults();
    try {
      return StoreStorage.getItem<ManagedAppUser[]>('admin_managed_users') || [];
    } catch {
      return [];
    }
  }

  public static getPendingRequests(): PendingAccessRequest[] {
    this.initDefaults();
    try {
      return StoreStorage.getItem<PendingAccessRequest[]>('admin_pending_requests') || [];
    } catch {
      return [];
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
    users.push(newUser);
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
