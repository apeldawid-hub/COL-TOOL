// src/types/admin.ts
/**
 * Typy danych dla Panelu Administratora (Admin Console)
 * Starbucks Operations Suite — 108120 SBX Warszawa Janki (Unit 18120)
 */

export type AppUserRole = 'STORE_MANAGER' | 'ASSISTANT_STORE_MANAGER' | 'SHIFT_SUPERVISOR' | 'BARISTA' | 'DISTRICT_MANAGER';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PendingAccessRequest {
  id: string;
  storeUnitCode: string;
  fullName: string;
  email: string;
  requestedRole: AppUserRole;
  deviceFingerprint: string;
  deviceName: string;
  ipAddress: string;
  requestNote?: string;
  createdAt: string;
  status: AccessRequestStatus;
}

export interface GranularUserPermissions {
  // Moduł 1: TPLH & AOP
  canViewFinancialSales: boolean;
  canEditForecastTarget: boolean;
  canModifyNcRules: boolean;
  // Moduł 2: Grafik & TOR & Kadry
  canViewWageRates: boolean;       // Stawki PLN/h (ściśle SM)
  canViewMedicalLeaves: boolean;   // Zwolnienia L4 i kody medyczne
  canPublishSchedule: boolean;    // Publikacja grafiku do zespołu
  canApproveTor: boolean;         // Zatwierdzanie kwartalne TOR
  canImportFichajes: boolean;     // Import plików ewidencji RCP
  // Moduł 4: Finanse & P&L
  canViewColPnl: boolean;         // Pełny rachunek zysków i strat
  canViewZusRates: boolean;       // Narzut ZUS 19.48%
  canSimulateWhatIf: boolean;     // Symulator stawek i premii
  // System
  canExportExcel: boolean;        // Eksport danych do arkuszy
}

export interface ManagedAppUser {
  id: string;
  storeUnitCode: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  isActive: boolean;
  permissions: GranularUserPermissions;
  lastLoginAt?: string;
  deviceFingerprint?: string;
  deviceName?: string;
  sessionVersion: number;
  createdAt: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: AppUserRole;
  actionType: 'LOGIN_2FA' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'ROLE_CHANGED' | 'PERMISSION_TOGGLED' | 'KILL_SWITCH_REVOKE' | 'KEY_ROTATION';
  targetResource: string;
  details: string;
  ipAddress?: string;
  deviceName?: string;
}
