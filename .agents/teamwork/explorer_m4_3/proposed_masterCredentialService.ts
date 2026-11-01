/**
 * Starbucks Operations Suite — Master Credential Renderer Client
 * File: src/services/security/masterCredentialService.ts
 *
 * Responsibilities:
 * 1. Communicate with Electron Main via IPC bridge:
 *    - window.electronAPI.verifyMasterCredential(credential)
 *    - window.electronAPI.getMasterCredentialStatus()
 * 2. Provide a clean, robust fallback for headless testing, non-Electron web browsers,
 *    and CI/CD pipelines without crashing.
 * 3. Enforce client-side rate limit tracking and friendly Polish feedback messages.
 */

export interface MasterCredentialVerificationResult {
  success: boolean;
  remainingAttempts: number;
  lockedUntil?: number;
  error?: string;
  errorCode?: 'LOCKED_OUT' | 'INVALID_CREDENTIAL' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
}

export interface MasterCredentialStatusResult {
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil?: number;
  cooldownSeconds?: number;
}

export interface IMasterCredentialProvider {
  verifyCredential(candidate: string): Promise<MasterCredentialVerificationResult>;
  getStatus(): Promise<MasterCredentialStatusResult>;
}

/**
 * Headless / Web Browser in-memory fallback provider.
 */
class BrowserFallbackMasterCredentialProvider implements IMasterCredentialProvider {
  private static fallbackSecret = 'sbx_default_master_passphrase';
  private failureTimestamps: number[] = [];
  private lockedUntil: number | null = null;
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000;
  private readonly lockoutMs = 15 * 60 * 1000;

  public static setFallbackSecret(secret: string): void {
    this.fallbackSecret = secret;
  }

  public async getStatus(): Promise<MasterCredentialStatusResult> {
    const now = Date.now();
    this.prune(now);

    const isLocked = this.lockedUntil !== null && now < this.lockedUntil;
    const remainingAttempts = isLocked
      ? 0
      : Math.max(0, this.maxAttempts - this.failureTimestamps.length);
    const cooldownSeconds = isLocked ? Math.ceil((this.lockedUntil! - now) / 1000) : undefined;

    return {
      isLocked,
      remainingAttempts,
      lockedUntil: isLocked ? this.lockedUntil! : undefined,
      cooldownSeconds,
    };
  }

  public async verifyCredential(candidate: string): Promise<MasterCredentialVerificationResult> {
    const now = Date.now();
    this.prune(now);

    if (this.lockedUntil !== null && now < this.lockedUntil) {
      const waitMinutes = Math.ceil((this.lockedUntil - now) / 60000);
      return {
        success: false,
        remainingAttempts: 0,
        lockedUntil: this.lockedUntil,
        errorCode: 'LOCKED_OUT',
        error: `Blokada bezpieczeństwa aktywna. Zbyt wiele nieudanych prób (${waitMinutes} min do odblokowania).`,
      };
    }

    const isMatch = candidate === BrowserFallbackMasterCredentialProvider.fallbackSecret;

    if (isMatch) {
      this.failureTimestamps = [];
      this.lockedUntil = null;
      return {
        success: true,
        remainingAttempts: 5,
      };
    }

    this.failureTimestamps.push(now);

    if (this.failureTimestamps.length >= this.maxAttempts) {
      this.lockedUntil = now + this.lockoutMs;
      return {
        success: false,
        remainingAttempts: 0,
        lockedUntil: this.lockedUntil,
        errorCode: 'LOCKED_OUT',
        error: 'Przekroczono limit 5 nieudanych prób. Autoryzacja zablokowana na 15 minut.',
      };
    }

    const remaining = this.maxAttempts - this.failureTimestamps.length;
    return {
      success: false,
      remainingAttempts: remaining,
      errorCode: 'INVALID_CREDENTIAL',
      error: `Nieprawidłowe poświadczenie master. Pozostało prób: ${remaining}`,
    };
  }

  private prune(now: number): void {
    const threshold = now - this.windowMs;
    this.failureTimestamps = this.failureTimestamps.filter((t) => t > threshold);

    if (this.lockedUntil !== null && now >= this.lockedUntil) {
      this.lockedUntil = null;
      this.failureTimestamps = [];
    }
  }

  public reset(): void {
    this.failureTimestamps = [];
    this.lockedUntil = null;
  }
}

/**
 * Universal Master Credential Service
 */
export class MasterCredentialService {
  private static instance: MasterCredentialService | null = null;
  private fallbackProvider: BrowserFallbackMasterCredentialProvider;

  public constructor() {
    this.fallbackProvider = new BrowserFallbackMasterCredentialProvider();
  }

  public static getInstance(): MasterCredentialService {
    if (!this.instance) {
      this.instance = new MasterCredentialService();
    }
    return this.instance;
  }

  private getElectronBridge(): any {
    if (typeof window === 'undefined') return null;
    return (window as any).electronAPI || (window as any).api || null;
  }

  public isElectronAvailable(): boolean {
    const bridge = this.getElectronBridge();
    return typeof bridge?.verifyMasterCredential === 'function';
  }

  /**
   * Verifies master credential via Electron IPC, falling back to local provider if in browser/tests.
   */
  public async verifyMasterCredential(candidate: string): Promise<MasterCredentialVerificationResult> {
    const bridge = this.getElectronBridge();

    if (bridge && typeof bridge.verifyMasterCredential === 'function') {
      try {
        return await bridge.verifyMasterCredential(candidate);
      } catch (err: any) {
        console.error('[MasterCredentialService] Błąd IPC verifyMasterCredential:', err);
        return {
          success: false,
          remainingAttempts: 0,
          errorCode: 'INTERNAL_ERROR',
          error: err.message || 'Błąd komunikacji z procesem głównym Electron.',
        };
      }
    }

    // Headless / Browser Fallback
    return this.fallbackProvider.verifyCredential(candidate);
  }

  /**
   * Retrieves current rate-limiting and lockout status.
   */
  public async getStatus(): Promise<MasterCredentialStatusResult> {
    const bridge = this.getElectronBridge();

    if (bridge && typeof bridge.getMasterCredentialStatus === 'function') {
      try {
        return await bridge.getMasterCredentialStatus();
      } catch (err) {
        console.error('[MasterCredentialService] Błąd IPC getMasterCredentialStatus:', err);
      }
    }

    return this.fallbackProvider.getStatus();
  }

  public static async verifyMasterCredential(candidate: string): Promise<MasterCredentialVerificationResult> {
    return this.getInstance().verifyMasterCredential(candidate);
  }

  public static async getStatus(): Promise<MasterCredentialStatusResult> {
    return this.getInstance().getStatus();
  }

  public getFallbackProvider(): BrowserFallbackMasterCredentialProvider {
    return this.fallbackProvider;
  }
}

export const masterCredentialService = MasterCredentialService.getInstance();
