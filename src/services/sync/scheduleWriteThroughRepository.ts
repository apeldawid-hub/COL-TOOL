// src/services/sync/scheduleWriteThroughRepository.ts
/**
 * Starbucks Operations Suite — Schedule Write-Through Repository (Feature F18 / Step 2)
 * Architektura Multi-Store Fleet
 *
 * Implementuje wzorzec Write-Through:
 * 1. Natychmiastowy zapis lokalny do SQLite (0 ms latencji dla Store Managera).
 * 2. Asynchroniczne rozgłoszenie zdarzenia w czasie rzeczywistym do Google Cloud Firestore
 *    za pośrednictwem `CloudRealtimeTransport`.
 * 3. Automatyczny bufor awaryjny (Outbox Fallback) w `SyncEngine` przy braku sieci lub błędzie chmury.
 */

import { CloudRealtimeTransport, StoreRealtimeEvent } from './cloudRealtimeTransport';
import { SyncEngine } from './syncEngine';
import { StoreService } from '../storeService';
import { AuthService } from '../auth/authService';

export interface ManagerShiftRecord {
  year: number;
  month: number;
  day: number;
  date: string;
  employee_id: number;
  shift_code: string;
  hours: number;
  notes?: string | null;
  disposition?: string | null;
  custom_start_time?: string | null;
  custom_end_time?: string | null;
  reason?: string;
}

export interface ManagerDispositionRecord {
  year: number;
  month: number;
  day: number;
  date: string;
  employee_id: number;
  disposition: string;
}

export interface BatchShiftsPayload {
  year: number;
  month: number;
  shifts: ManagerShiftRecord[];
}

export interface BatchDispositionsPayload {
  year: number;
  month: number;
  items: Array<{
    day: number;
    employee_id: number;
    disposition: string;
    date?: string;
  }>;
}

export interface TeamSavePayload {
  year: number;
  month: number;
  employees: any[];
  propagateToFuture: boolean;
}

export class ScheduleWriteThroughRepository {
  /**
   * Zwraca identyfikator aktywnej kawiarni
   */
  private static getStoreId(): string {
    const store = StoreService.getCurrentStore();
    return store?.id || store?.unitCode || '108120';
  }

  /**
   * Zwraca identyfikator bieżącego autora
   */
  private static getAuthor(): string {
    const session = AuthService.getCurrentSession();
    return session?.email || session?.fullName || 'system_manager';
  }

  /**
   * Zapis pojedynczej zmiany menedżerskiej (Write-Through)
   */
  public static async saveShift(shift: ManagerShiftRecord): Promise<boolean> {
    const storeId = this.getStoreId();
    const author = this.getAuthor();
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

    // 1. Zapis lokalny do SQLite (Zero Latency)
    let localSuccess = false;
    if (api?.saveManagerShift) {
      try {
        await api.saveManagerShift(shift);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd zapisu lokalnego zmiany:', err);
      }
    } else {
      // W środowisku headless/testowym
      localSuccess = true;
    }

    // 2. Asynchroniczne rozgłoszenie do Firestore w czasie rzeczywistym
    const entityId = `shift_${shift.year}_${shift.month}_${shift.day}_emp${shift.employee_id}`;
    
    // Uruchomienie wysyłki do chmury bez blokowania interfejsu (fire-and-forget z outbox fallbackiem)
    this.dispatchRealtimeMutation({
      storeId,
      domain: 'schedules',
      action: 'UPSERT',
      entityId,
      payload: shift,
      author,
    }).catch((err) => {
      console.warn('[WriteThrough] Błąd wysyłki zdarzenia, buforuję w Outbox:', err);
      SyncEngine.enqueueOutbox({
        storeUnitCode: storeId,
        vaultType: 'public_schedule',
        entityId,
        action: 'UPSERT',
        payload: shift,
      });
    });

    return localSuccess;
  }

  /**
   * Zbiorczy zapis zmian grafiku (AutoScheduling / Masowe wklejanie)
   */
  public static async saveBatchShifts(payload: BatchShiftsPayload): Promise<boolean> {
    const storeId = this.getStoreId();
    const author = this.getAuthor();
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

    let localSuccess = false;
    if (api?.saveBatchManagerShifts) {
      try {
        await api.saveBatchManagerShifts(payload);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd lokalnego zapisu batch shifts:', err);
      }
    } else if (api?.saveManagerShift) {
      for (const s of payload.shifts) {
        await api.saveManagerShift(s);
      }
      localSuccess = true;
    } else {
      localSuccess = true;
    }

    const entityId = `batch_shifts_${payload.year}_${payload.month}_${Date.now()}`;
    this.dispatchRealtimeMutation({
      storeId,
      domain: 'schedules',
      action: 'UPSERT',
      entityId,
      payload: {
        year: payload.year,
        month: payload.month,
        shiftsCount: payload.shifts.length,
        shifts: payload.shifts,
      },
      author,
    }).catch(() => {
      SyncEngine.enqueueOutbox({
        storeUnitCode: storeId,
        vaultType: 'public_schedule',
        entityId,
        action: 'UPSERT',
        payload,
      });
    });

    return localSuccess;
  }

  /**
   * Zapis dyspozycyjności menedżera
   */
  public static async saveDisposition(payload: ManagerDispositionRecord): Promise<boolean> {
    const storeId = this.getStoreId();
    const author = this.getAuthor();
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

    let localSuccess = false;
    if (api?.saveManagerDisposition) {
      try {
        await api.saveManagerDisposition(payload);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd zapisu dyspozycji:', err);
      }
    } else {
      localSuccess = true;
    }

    const entityId = `dispo_${payload.year}_${payload.month}_${payload.day}_emp${payload.employee_id}`;
    this.dispatchRealtimeMutation({
      storeId,
      domain: 'schedules',
      action: 'UPSERT',
      entityId,
      payload,
      author,
    }).catch(() => {
      SyncEngine.enqueueOutbox({
        storeUnitCode: storeId,
        vaultType: 'public_schedule',
        entityId,
        action: 'UPSERT',
        payload,
      });
    });

    return localSuccess;
  }

  /**
   * Zbiorczy zapis dyspozycji z matrycy
   */
  public static async saveBatchDispositions(payload: BatchDispositionsPayload): Promise<boolean> {
    const storeId = this.getStoreId();
    const author = this.getAuthor();
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

    let localSuccess = false;
    if (api?.saveBatchManagerDispositions) {
      try {
        await api.saveBatchManagerDispositions(payload);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd zapisu batch dispo:', err);
      }
    } else {
      localSuccess = true;
    }

    const entityId = `batch_dispo_${payload.year}_${payload.month}_${Date.now()}`;
    this.dispatchRealtimeMutation({
      storeId,
      domain: 'schedules',
      action: 'UPSERT',
      entityId,
      payload,
      author,
    }).catch(() => {
      SyncEngine.enqueueOutbox({
        storeUnitCode: storeId,
        vaultType: 'public_schedule',
        entityId,
        action: 'UPSERT',
        payload,
      });
    });

    return localSuccess;
  }

  /**
   * Zapis składu zespołu menedżerskiego
   */
  public static async saveTeam(payload: TeamSavePayload): Promise<boolean> {
    const storeId = this.getStoreId();
    const author = this.getAuthor();
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

    let localSuccess = false;
    if (api?.saveManagerEmployees) {
      try {
        await api.saveManagerEmployees(payload);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd zapisu zespołu:', err);
      }
    } else if (api?.manageEmployees) {
      try {
        await api.manageEmployees(payload);
        localSuccess = true;
      } catch (err) {
        console.error('[WriteThrough] Błąd zapisu manageEmployees:', err);
      }
    } else {
      localSuccess = true;
    }

    const entityId = `team_roster_${payload.year}_${payload.month}`;
    this.dispatchRealtimeMutation({
      storeId,
      domain: 'personnel',
      action: 'UPSERT',
      entityId,
      payload,
      author,
    }).catch(() => {
      SyncEngine.enqueueOutbox({
        storeUnitCode: storeId,
        vaultType: 'executive_financial_vault',
        entityId,
        action: 'UPSERT',
        payload,
      });
    });

    return localSuccess;
  }

  /**
   * Pomocnicza metoda wysyłająca mutację przez CloudRealtimeTransport z fallbackiem do Outbox
   */
  private static async dispatchRealtimeMutation(params: {
    storeId: string;
    domain: 'schedules' | 'personnel' | 'financials' | 'trainings';
    action: 'UPSERT' | 'DELETE';
    entityId: string;
    payload: any;
    author: string;
  }): Promise<void> {
    // Sprawdź czy jesteśmy offline (z uwzględnieniem Node.js, gdzie navigator.onLine może być undefined)
    const isOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
    if (isOffline) {
      SyncEngine.enqueueOutbox({
        storeUnitCode: params.storeId,
        vaultType: params.domain === 'personnel' ? 'executive_financial_vault' : 'public_schedule',
        entityId: params.entityId,
        action: params.action,
        payload: params.payload,
      });
      return;
    }

    const res = await CloudRealtimeTransport.publishEvent({
      storeId: params.storeId,
      domain: params.domain,
      action: params.action,
      entityId: params.entityId,
      payload: params.payload,
      author: params.author,
    });

    if (!res.success) {
      SyncEngine.enqueueOutbox({
        storeUnitCode: params.storeId,
        vaultType: params.domain === 'personnel' ? 'executive_financial_vault' : 'public_schedule',
        entityId: params.entityId,
        action: params.action,
        payload: params.payload,
      });
    }
  }
}
