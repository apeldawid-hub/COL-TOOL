// tests/security/enrollment_provisioning_flow.test.ts
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { enrollmentService } from '../../src/services/admin/enrollmentService';
import { LicensingService } from '../../src/services/security/licensingService';
import { ROLE_DEFAULT_PERMISSIONS, AdminService } from '../../src/services/admin/adminService';

// Mock storage for headless Node test environment
const mockLocalStorage: Record<string, string> = {};
const mockSessionStorage: Record<string, string> = {};

(global as any).localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, val: string) => { mockLocalStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; },
};

(global as any).sessionStorage = {
  getItem: (key: string) => mockSessionStorage[key] || null,
  setItem: (key: string, val: string) => { mockSessionStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockSessionStorage[key]; },
  clear: () => { for (const k in mockSessionStorage) delete mockSessionStorage[k]; },
};

(global as any).process.env.SBX_TEST_HARDWARE_FINGERPRINT = 'TEST-HARDWARE-MAC-UUID-18120';

describe('Store Manager Laptop Onboarding & Provisioning Flow', () => {
  beforeEach(() => {
    (global as any).localStorage.clear();
    (global as any).sessionStorage.clear();
  });

  test('Krok 2: Weryfikacja e-maila firmowego @amrest.eu i generowanie OTP', async () => {
    // 1. Odrzucenie maila prywatnego
    const badRes = await enrollmentService.requestEmailOtp('jan.kowalski@gmail.com');
    assert.strictEqual(badRes.success, false);
    assert.match(badRes.message, /@amrest.eu lub @starbucks.com/);

    // 2. Akceptacja firmowego @amrest.eu
    const goodRes = await enrollmentService.requestEmailOtp('jan.kowalski@amrest.eu');
    assert.strictEqual(goodRes.success, true);
    assert.ok(goodRes.simulatedCode, 'Powinien wygenerować 6-cyfrowy kod');
    assert.strictEqual(goodRes.simulatedCode!.length, 6);

    // 3. Weryfikacja błędnego kodu
    const badVerify = enrollmentService.verifyEmailOtp('jan.kowalski@amrest.eu', '000000');
    assert.strictEqual(badVerify.success, false);
    assert.match(badVerify.message, /Niepoprawny kod/);

    // 4. Weryfikacja poprawnego kodu
    const goodVerify = enrollmentService.verifyEmailOtp('jan.kowalski@amrest.eu', goodRes.simulatedCode!);
    assert.strictEqual(goodVerify.success, true);
    assert.match(goodVerify.message, /potwierdzony/);
  });

  test('Krok 3: Rejestracja zgłoszenia urządzenia i stan PENDING_APPROVAL', async () => {
    const submitRes = await enrollmentService.submitEnrollmentRequest({
      fullName: 'Jan Kowalski',
      email: 'jan.kowalski@amrest.eu',
      requestedRole: 'STORE_MANAGER',
      requestNote: 'Laptop służbowy MacBook Pro',
    });

    assert.strictEqual(submitRes.success, true);
    assert.ok(submitRes.request);
    assert.strictEqual(submitRes.request!.fullName, 'Jan Kowalski');
    assert.strictEqual(submitRes.request!.email, 'jan.kowalski@amrest.eu');
    assert.strictEqual(submitRes.request!.status, 'PENDING');
    assert.ok(submitRes.request!.pairingToken?.startsWith('REQ-'));
    assert.strictEqual(submitRes.request!.deviceFingerprint, 'test-hardware-mac-uuid-18120');

    // Sprawdzenie czy lokalny laptop widzi to zgłoszenie
    const active = await enrollmentService.getCurrentDeviceEnrollment();
    assert.ok(active);
    assert.strictEqual(active!.id, submitRes.request!.id);
    assert.strictEqual(active!.status, 'PENDING');
  });

  test('Krok 4: Manager Zarządzający (Fleet Master) zatwierdza wniosek i przydziela uprawnienia', async () => {
    // 1. Złożenie wniosku przez kierownika
    const submitRes = await enrollmentService.submitEnrollmentRequest({
      fullName: 'Anna Nowak',
      email: 'anna.nowak@amrest.eu',
      requestedRole: 'STORE_MANAGER',
    });
    const reqId = submitRes.request!.id;

    // 2. Manager widzi wniosek w panelu
    const all = await enrollmentService.getAllRequests();
    const found = all.find((r) => r.id === reqId);
    assert.ok(found);
    assert.strictEqual(found!.status, 'PENDING');

    // 3. Manager akceptuje i przydziela lokal 108120 Janki z uprawnieniami
    const approvalRes = await enrollmentService.approveAccessRequest(reqId, {
      storeId: '108120',
      role: 'STORE_MANAGER',
      permissions: {
        ...ROLE_DEFAULT_PERMISSIONS.STORE_MANAGER,
        canViewWageRates: true,
        canViewColPnl: true,
      },
      adminName: 'Dawid Apel (Fleet Master)',
    });

    assert.strictEqual(approvalRes.success, true);
    assert.ok(approvalRes.request);
    assert.strictEqual(approvalRes.request!.status, 'APPROVED');
    assert.strictEqual(approvalRes.request!.assignedStoreId, '108120');
    assert.ok(approvalRes.request!.assignedLicenseKey);

    // 4. Weryfikacja wygenerowanego klucza sprzętowego
    const key = approvalRes.request!.assignedLicenseKey!;
    const keyValidation = LicensingService.validateKeyFormat(key);
    assert.strictEqual(keyValidation.valid, true);
    assert.strictEqual(keyValidation.storeId, '108120');
    assert.strictEqual(keyValidation.tier, 'STORE_CLIENT');

    // 5. Laptop kierownika sprawdza status i wykrywa autoryzację
    const clientEnrollment = await enrollmentService.getCurrentDeviceEnrollment();
    assert.ok(clientEnrollment);
    assert.strictEqual(clientEnrollment!.status, 'APPROVED');
    assert.strictEqual(clientEnrollment!.assignedLicenseKey, key);
  });

  test('Krok 4 (Wariant B): Manager Zarządzający odrzuca nieautoryzowany wniosek', async () => {
    const submitRes = await enrollmentService.submitEnrollmentRequest({
      fullName: 'Nieznany Użytkownik',
      email: 'nieznany@amrest.eu',
      requestedRole: 'BARISTA',
    });
    const reqId = submitRes.request!.id;

    const rejectRes = await enrollmentService.rejectAccessRequest(
      reqId,
      'Brak uprawnień do korzystania z aplikacji',
      'Dawid Apel (Fleet Master)'
    );

    assert.strictEqual(rejectRes.success, true);

    const clientEnrollment = await enrollmentService.getCurrentDeviceEnrollment();
    assert.ok(clientEnrollment);
    assert.strictEqual(clientEnrollment!.status, 'REJECTED');
    assert.strictEqual(clientEnrollment!.rejectionReason, 'Brak uprawnień do korzystania z aplikacji');
  });

  test('Purge: Automatyczne oczyszczenie wszelkich starych danych prototypowych/mocków', () => {
    // Symulacja obecności starych danych z wersji v2.8.65 w localStorage
    const legacyMockUsers = [
      { id: 'usr_sm_dawid', fullName: 'Dawid Apel', email: 'dawid.apel@amrest.eu', role: 'STORE_MANAGER' },
      { id: 'usr_ssv_kamil_k', fullName: 'Kamil Kamiński', email: 'kamil.kaminski@amrest.eu', role: 'SHIFT_SUPERVISOR' },
      { id: 'usr_ssv_zuzanna_m', fullName: 'Zuzanna Makowska', email: 'zuzanna.makowska@amrest.eu', role: 'SHIFT_SUPERVISOR' },
    ];
    (global as any).localStorage.setItem('sbx_store_108120_admin_managed_users', JSON.stringify(legacyMockUsers));
    (global as any).localStorage.setItem('sbx_admin_managed_users', JSON.stringify(legacyMockUsers));

    const users = AdminService.getUsers();

    // Żaden z mockowych użytkowników nie może się pojawić w wynikach
    assert.strictEqual(users.some((u: any) => u.id === 'usr_ssv_kamil_k'), false);
    assert.strictEqual(users.some((u: any) => u.id === 'usr_ssv_zuzanna_m'), false);
    assert.strictEqual(users.some((u: any) => u.email === 'kamil.kaminski@amrest.eu'), false);
    assert.strictEqual(users.some((u: any) => u.email === 'zuzanna.makowska@amrest.eu'), false);
  });
});
