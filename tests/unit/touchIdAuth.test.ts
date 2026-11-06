import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../../src/services/auth/authService';

describe('Biometria Touch ID (macOS) - AuthService', () => {
  const originalWindow = (global as any).window;

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  it('zwraca false dla isTouchIdAvailable gdy brak obiektu window lub api', async () => {
    (global as any).window = undefined;
    const isAvail = await AuthService.isTouchIdAvailable();
    assert.strictEqual(isAvail, false);
  });

  it('poprawnie wykrywa dostępność Touch ID przez window.api.canPromptTouchID', async () => {
    (global as any).window = {
      api: {
        canPromptTouchID: async () => true,
        promptTouchID: async () => ({ success: true }),
      },
    };

    const isAvail = await AuthService.isTouchIdAvailable();
    assert.strictEqual(isAvail, true);
  });

  it('zwraca błąd przy próbie logowania Touch ID gdy sprzęt nie jest dostępny', async () => {
    (global as any).window = {
      api: {
        canPromptTouchID: async () => false,
      },
    };

    const res = await AuthService.loginWithTouchId('1812');
    assert.strictEqual(res.success, false);
    assert.match(res.message || '', /nie jest dostępne/);
  });

  it('pomyślnie uwierzytelnia Store Managera gdy Touch ID zwraca sukces', async () => {
    (global as any).window = {
      api: {
        canPromptTouchID: async () => true,
        promptTouchID: async () => ({ success: true }),
      },
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    };

    const res = await AuthService.loginWithTouchId('1812');
    assert.strictEqual(res.success, true);
    assert.ok(res.session);
    assert.strictEqual(res.session.role, 'STORE_MANAGER');
  });
});
