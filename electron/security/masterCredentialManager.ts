/**
 * Starbucks Operations Suite — Master Credential & Sliding-Window Rate Limiter
 * File: electron/security/masterCredentialManager.ts
 *
 * Responsibilities:
 * 1. Constant-time master credential verification using SHA-256 pre-hashing
 *    and crypto.timingSafeEqual to prevent side-channel timing leaks.
 * 2. Sliding-window rate limiter: max 5 attempts per 15 minutes.
 * 3. 15-minute cooldown lockout on 5 consecutive failures.
 * 4. Security audit event logging via CrashLogManager on lockout and failures.
 * 5. Lockout state persistence to disk (userData/security/master_rate_limit.lock)
 *    to prevent bypassing lockout via application restart.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let electronApp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const electron = typeof require === 'function' ? require('electron') : null;
  if (electron && typeof electron === 'object') {
    electronApp = electron.app;
  }
} catch {
  // Running outside Electron runtime (Node test runner)
}

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

export interface RateLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
  lockFilePath?: string;
  nowFn?: () => number;
}

/**
 * Sliding-Window Rate Limiter for Master Credential attempts.
 */
export class MasterRateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private lockoutMs: number;
  private lockFilePath?: string;
  private nowFn: () => number;

  private failureTimestamps: number[] = [];
  private lockedUntil: number | null = null;
  private onLockoutCallbacks: Array<(lockedUntil: number, attemptCount: number) => void> = [];

  public constructor(options?: RateLimiterOptions) {
    this.maxAttempts = options?.maxAttempts ?? 5;
    this.windowMs = options?.windowMs ?? 15 * 60 * 1000;   // 15 minutes
    this.lockoutMs = options?.lockoutMs ?? 15 * 60 * 1000; // 15 minutes cooldown
    this.lockFilePath = options?.lockFilePath;
    this.nowFn = options?.nowFn ?? (() => Date.now());

    this.loadPersistedLock();
  }

  public addLockoutListener(cb: (lockedUntil: number, attemptCount: number) => void): void {
    this.onLockoutCallbacks.push(cb);
  }

  public setOnLockout(cb: (lockedUntil: number, attemptCount: number) => void): void {
    this.addLockoutListener(cb);
  }

  private loadPersistedLock(): void {
    if (!this.lockFilePath) return;
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8'));
        const now = this.nowFn();
        if (data.lockedUntil && typeof data.lockedUntil === 'number' && data.lockedUntil > now) {
          this.lockedUntil = data.lockedUntil;
          this.failureTimestamps = Array.isArray(data.failureTimestamps) ? data.failureTimestamps : [];
        } else {
          // Lock expired
          this.clearPersistedLock();
        }
      }
    } catch {
      // Ignore corrupted lock file
    }
  }

  private persistLock(): void {
    if (!this.lockFilePath) return;
    try {
      const dir = path.dirname(this.lockFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        lockedUntil: this.lockedUntil,
        failureTimestamps: this.failureTimestamps,
        updatedAt: this.nowFn(),
      };
      fs.writeFileSync(this.lockFilePath, JSON.stringify(data), { mode: 0o600 });
    } catch {
      // Best-effort persistence
    }
  }

  private clearPersistedLock(): void {
    if (!this.lockFilePath) return;
    try {
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
    } catch {
      // Best-effort cleanup
    }
  }

  private pruneTimestamps(now: number): void {
    const threshold = now - this.windowMs;
    this.failureTimestamps = this.failureTimestamps.filter((t) => t > threshold);

    if (this.lockedUntil !== null && now >= this.lockedUntil) {
      this.lockedUntil = null;
      this.failureTimestamps = [];
      this.clearPersistedLock();
    }
  }

  public getStatus(currentTime?: number): MasterCredentialStatusResult {
    const now = currentTime ?? this.nowFn();
    this.pruneTimestamps(now);

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

  public isLockedOut(currentTime?: number): boolean {
    return this.getStatus(currentTime).isLocked;
  }

  public recordFailure(currentTime?: number): { locked: boolean; lockedUntil?: number; remainingAttempts: number } {
    const now = currentTime ?? this.nowFn();
    this.pruneTimestamps(now);

    // If already locked out
    if (this.lockedUntil !== null && now < this.lockedUntil) {
      return {
        locked: true,
        lockedUntil: this.lockedUntil,
        remainingAttempts: 0,
      };
    }

    this.failureTimestamps.push(now);

    if (this.failureTimestamps.length >= this.maxAttempts) {
      this.lockedUntil = now + this.lockoutMs;
      this.persistLock();

      for (const cb of this.onLockoutCallbacks) {
        try {
          cb(this.lockedUntil, this.failureTimestamps.length);
        } catch (_) {}
      }

      return {
        locked: true,
        lockedUntil: this.lockedUntil,
        remainingAttempts: 0,
      };
    }

    this.persistLock();
    return {
      locked: false,
      remainingAttempts: Math.max(0, this.maxAttempts - this.failureTimestamps.length),
    };
  }

  public recordSuccess(): void {
    this.failureTimestamps = [];
    this.lockedUntil = null;
    this.clearPersistedLock();
  }

  public reset(): void {
    this.recordSuccess();
  }
}

/**
 * Master Credential Manager (Main Process Singleton)
 */
export class MasterCredentialManager {
  private static instance: MasterCredentialManager | null = null;
  private rateLimiter: MasterRateLimiter;
  private securityDir: string;
  private lockFilePath: string;
  private customMasterSecret: string | null = null;

  public constructor(customSecurityDir?: string, customRateLimiter?: MasterRateLimiter) {
    if (customSecurityDir) {
      this.securityDir = customSecurityDir;
    } else {
      let baseDir = process.env.APPDATA || process.env.HOME || process.cwd();
      try {
        if (electronApp?.getPath) {
          baseDir = electronApp.getPath('userData');
        }
      } catch (_) {}
      this.securityDir = path.join(baseDir, 'security');
    }

    this.lockFilePath = path.join(this.securityDir, 'master_rate_limit.lock');

    if (customRateLimiter) {
      this.rateLimiter = customRateLimiter;
    } else {
      this.rateLimiter = new MasterRateLimiter({
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        lockoutMs: 15 * 60 * 1000,
        lockFilePath: this.lockFilePath,
      });
    }

    this.rateLimiter.setOnLockout((lockedUntil, count) => {
      this.logSecurityAuditEvent(
        'CRITICAL',
        `🚨 CRITICAL SECURITY ALERT: Master credential locked out for 15 minutes until ${new Date(lockedUntil).toISOString()} after ${count} failed attempts.`
      );
    });
  }

  public static getInstance(): MasterCredentialManager {
    if (!this.instance) {
      this.instance = new MasterCredentialManager();
    }
    return this.instance;
  }

  public setCustomMasterSecret(secret: string | null): void {
    this.customMasterSecret = secret;
  }

  public getRateLimiter(): MasterRateLimiter {
    return this.rateLimiter;
  }

  /**
   * Resolves the authoritative master secret against which candidates are verified.
   * Priority:
   * 1. Explicitly configured customMasterSecret (for tests/seed updates)
   * 2. VaultKeyManager.getInstance().getOrCreateMasterPassphrase()
   * 3. Environment variable fallback (SBX_MASTER_PASSPHRASE)
   */
  public async getExpectedMasterSecret(): Promise<string> {
    if (this.customMasterSecret) {
      return this.customMasterSecret;
    }

    try {
      // Dynamic import to avoid circular dependency
      const { VaultKeyManager } = await import('./vaultKeyManager.js').catch(() =>
        import('./vaultKeyManager')
      );
      if (VaultKeyManager && typeof VaultKeyManager.getInstance === 'function') {
        const passphrase = await VaultKeyManager.getInstance().getOrCreateMasterPassphrase();
        if (passphrase && passphrase.length > 0) {
          return passphrase;
        }
      }
    } catch (_) {}

    return process.env.SBX_MASTER_PASSPHRASE || 'sbx_default_master_passphrase';
  }

  /**
   * Timing-Safe verification primitive:
   * 1. Computes SHA-256 digest of candidate and stored secret.
   *    Both digests are guaranteed to be exactly 32 bytes, eliminating input length leaks
   *    and preventing RangeError in crypto.timingSafeEqual.
   * 2. Executes crypto.timingSafeEqual on the two 32-byte buffers.
   * 3. Caps input length at 4096 characters to prevent denial-of-service hashing attacks.
   */
  public static timingSafeVerify(candidate: unknown, expectedSecret: string): boolean {
    if (typeof expectedSecret !== 'string' || expectedSecret.length === 0) {
      return false;
    }

    // Defensive input bounds: reject non-string or oversized candidates safely
    const isString = typeof candidate === 'string';
    const isWithinBounds = isString && candidate.length <= 4096;
    const candidateStr = isWithinBounds ? candidate : '';

    // SHA-256 yields strictly 32-byte Buffers
    const candidateHash = crypto.createHash('sha256').update(candidateStr, 'utf8').digest();
    const secretHash = crypto.createHash('sha256').update(expectedSecret, 'utf8').digest();

    let matches = false;
    if (typeof crypto.timingSafeEqual === 'function') {
      matches = crypto.timingSafeEqual(candidateHash, secretHash);
    } else {
      // Constant-time XOR fallback for legacy runtimes
      let diff = 0;
      for (let i = 0; i < 32; i++) {
        diff |= candidateHash[i] ^ secretHash[i];
      }
      matches = diff === 0;
    }

    return isString && isWithinBounds && matches;
  }

  /**
   * Main verification entrypoint invoked by IPC:
   * - Checks sliding-window lockout
   * - Performs constant-time comparison
   * - Updates rate limiter state
   * - Logs audit events
   */
  public async verifyCredential(
    candidate: string,
    customExpectedSecret?: string
  ): Promise<MasterCredentialVerificationResult> {
    const status = this.rateLimiter.getStatus();

    // 1. Enforce active lockout
    if (status.isLocked) {
      const waitMinutes = Math.ceil((status.cooldownSeconds || 0) / 60);
      return {
        success: false,
        remainingAttempts: 0,
        lockedUntil: status.lockedUntil,
        errorCode: 'LOCKED_OUT',
        error: `Blokada bezpieczeństwa aktywna. Zbyt wiele nieudanych prób (${waitMinutes} min do odblokowania).`,
      };
    }

    // 2. Resolve expected secret
    const expected = customExpectedSecret || (await this.getExpectedMasterSecret());

    // 3. Constant-time check
    const isMatch = MasterCredentialManager.timingSafeVerify(candidate, expected);

    if (isMatch) {
      this.rateLimiter.recordSuccess();
      this.logSecurityAuditEvent('INFO', 'Pomyślna weryfikacja poświadczenia Master HQ.');
      return {
        success: true,
        remainingAttempts: 5,
      };
    }

    // 4. Handle failure
    const failure = this.rateLimiter.recordFailure();
    if (failure.locked) {
      return {
        success: false,
        remainingAttempts: 0,
        lockedUntil: failure.lockedUntil,
        errorCode: 'LOCKED_OUT',
        error: 'Przekroczono limit 5 nieudanych prób. Autoryzacja zablokowana na 15 minut.',
      };
    }

    this.logSecurityAuditEvent(
      'WARN',
      `Nieudana próba autoryzacji Master Credential. Pozostało prób: ${failure.remainingAttempts}`
    );

    return {
      success: false,
      remainingAttempts: failure.remainingAttempts,
      errorCode: 'INVALID_CREDENTIAL',
      error: `Nieprawidłowe poświadczenie master. Pozostało prób: ${failure.remainingAttempts}`,
    };
  }

  public getStatus(): MasterCredentialStatusResult {
    return this.rateLimiter.getStatus();
  }

  public resetRateLimiter(): void {
    this.rateLimiter.reset();
  }

  private logSecurityAuditEvent(level: 'INFO' | 'WARN' | 'CRITICAL', message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] [MasterCredentialSecurity] ${message}`;

    if (level === 'CRITICAL') {
      console.error(logLine);
    } else if (level === 'WARN') {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    // Attempt writing to CrashLogManager if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { CrashLogManager } = require('../crashLogManager');
      if (CrashLogManager && typeof CrashLogManager.getInstance === 'function') {
        const mgrLevel = level === 'CRITICAL' ? 'ERROR' : level;
        CrashLogManager.getInstance().log(mgrLevel, 'MasterCredentialSecurity', message);
      }
    } catch {
      // Ignore if running outside full electron bundle
    }
  }
}

export const masterCredentialManager = MasterCredentialManager.getInstance();
