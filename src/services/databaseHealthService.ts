import { DatabaseHealthStatus, DatabaseOptimizationResult } from '../types';
import { todoService } from './todoService';

class DatabaseHealthService {
  private currentHealth: DatabaseHealthStatus | null = null;
  private isChecking: boolean = false;
  private isOptimizing: boolean = false;
  private listeners: Array<() => void> = [];

  constructor() {
    // Automatyczne sprawdzenie w tle po załadowaniu aplikacji
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.checkHealth().catch(() => {});
      }, 1500);
    }
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
        console.error('Błąd listenera databaseHealthService:', err);
      }
    });
  }

  public getHealth(): DatabaseHealthStatus | null {
    return this.currentHealth;
  }

  public getIsChecking(): boolean {
    return this.isChecking;
  }

  public getIsOptimizing(): boolean {
    return this.isOptimizing;
  }

  public async checkHealth(): Promise<DatabaseHealthStatus> {
    this.isChecking = true;
    this.notify();

    try {
      const api = (window as any).api || (window as any).electronAPI;
      if (api?.checkDatabaseHealth) {
        const res: DatabaseHealthStatus = await api.checkDatabaseHealth();
        this.currentHealth = res;

        // Synchronizacja zadania w To-Do Store Managera
        todoService.syncBackupOverdueTask(res.isBackupOverdue, res.daysSinceLastBackup);

        return res;
      } else {
        // Mock fallback do testów w przeglądarce
        const mockHealth: DatabaseHealthStatus = {
          integrity: 'ok',
          integrityMessage: 'Baza danych SQLite jest w 100% spójna i poprawna (tryb web mock).',
          quickCheck: 'ok',
          dbPath: 'data/tplh_forecast.db',
          sizeBytes: 819200,
          sizeFormatted: '800.0 KB',
          pageSize: 4096,
          pageCount: 200,
          freelistCount: 6,
          wastedBytes: 24576,
          wastedFormatted: '24.0 KB',
          tableStats: [
            { tableName: 'labor_actuals_log', label: 'Ewidencja Fichajes (MAPAL)', rowCount: 1650 },
            { tableName: 'manager_schedule_shifts', label: 'Zmiany Menedżerów', rowCount: 240 },
            { tableName: 'aop_plans', label: 'Plany Roczne & Miesięczne AOP', rowCount: 192 },
            { tableName: 'calendar_weeks', label: 'Tygodnie Biznesowe', rowCount: 1152 },
            { tableName: 'weekly_actual_trx', label: 'Transakcje i Godziny Tygodni', rowCount: 88 },
            { tableName: 'manager_schedule_versions', label: 'Wersje i Migawki Grafiku', rowCount: 12 },
            { tableName: 'manager_employees', label: 'Kierownicy (Baza Zespołu)', rowCount: 7 },
            { tableName: 'manager_monthly_roster', label: 'Autonomiczne Składy Miesięczne', rowCount: 63 },
            { tableName: 'manager_monthly_norms', label: 'Normy Kodeksu Pracy', rowCount: 252 },
            { tableName: 'training_partners', label: 'Szkolenia: Baza Partnerów', rowCount: 5 },
            { tableName: 'training_shifts', label: 'Szkolenia: Zmiany First 30', rowCount: 42 },
            { tableName: 'training_skill_checks', label: 'Szkolenia: Arkusze Egzaminów', rowCount: 8 },
            { tableName: 'floor_rules', label: 'Reguły Obsady Floor Hours', rowCount: 7 },
            { tableName: 'nc_rules', label: 'Reguły Non-Coverage (NC)', rowCount: 5 },
            { tableName: 'app_settings', label: 'Konfiguracja Lokalu & Ustawienia', rowCount: 16 },
          ],
          totalRecordsCount: 3688,
          archivedLogsCount: 4,
          archivedLogsSizeFormatted: '18.4 KB',
          backupsCount: 8,
          lastBackupDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          lastBackupFormatted: '25.09.2026, 14:32',
          daysSinceLastBackup: 2,
          isBackupOverdue: false,
          lastIntegrityCheckTime: new Date().toISOString(),
          recommendations: ['Baza danych działa w 100% optymalnie. Brak uwag dotyczących spójności.'],
        };

        this.currentHealth = mockHealth;
        todoService.syncBackupOverdueTask(mockHealth.isBackupOverdue, mockHealth.daysSinceLastBackup);
        return mockHealth;
      }
    } finally {
      this.isChecking = false;
      this.notify();
    }
  }

  public async optimizeDatabase(): Promise<DatabaseOptimizationResult> {
    this.isOptimizing = true;
    this.notify();

    try {
      const api = (window as any).api || (window as any).electronAPI;
      if (api?.optimizeDatabase) {
        const res: DatabaseOptimizationResult = await api.optimizeDatabase();
        if (res.health) {
          this.currentHealth = res.health;
          todoService.syncBackupOverdueTask(res.health.isBackupOverdue, res.health.daysSinceLastBackup);
        }
        return res;
      } else {
        // Mock fallback
        const mockHealth = await this.checkHealth();
        mockHealth.freelistCount = 0;
        mockHealth.wastedBytes = 0;
        mockHealth.wastedFormatted = '0.0 KB';
        this.currentHealth = mockHealth;

        return {
          success: true,
          message: 'Optymalizacja VACUUM zakończona sukcesem (tryb web mock). Odzyskano 24.0 KB.',
          beforeSizeBytes: 819200,
          afterSizeBytes: 794624,
          reclaimedBytes: 24576,
          reclaimedFormatted: '24.0 KB',
          durationMs: 42,
          health: mockHealth,
        };
      }
    } finally {
      this.isOptimizing = false;
      this.notify();
    }
  }
}

export const databaseHealthService = new DatabaseHealthService();
