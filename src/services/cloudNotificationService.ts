// src/services/cloudNotificationService.ts
import { APP_VERSION } from '../version';

export interface UserRegistrationData {
  userName: string;
  userEmail: string;
  userRole: string;
  storeName: string;
  unitCode: string;
  appVersion?: string;
  registeredAt?: string;
}

export interface SchedulePublishedData {
  userName: string;
  userEmail: string;
  month: string;
  year: number;
  managersCount: number;
  totalHours: number;
  publishedBy: string;
  versionTag?: string;
}

export interface LaborLawAlertData {
  userName: string;
  userEmail: string;
  employeeName: string;
  violationType: string;
  article: string;
  date: string;
  description: string;
}

export interface TplhWeeklyReportData {
  userName: string;
  userEmail: string;
  storeName: string;
  weekNumber: string;
  month: string;
  year: number;
  actualTrx: number;
  actualTplh: number;
  targetTplh: number;
  actualHours: number;
  budgetHours: number;
  earnedLaborHours: number;
  varianceHours: number;
}

export interface AppInstallNotificationData {
  installId: string;
  appVersion: string;
  installedAt: string;
  platform: string;
  userAgent?: string;
  storeName?: string;
  unitCode?: string;
  userName?: string;
  userEmail?: string;
}

export interface NotificationLogItem {
  id: string;
  timestamp: string;
  type: 'welcome' | 'schedule_published' | 'labor_law_alert' | 'tplh_weekly' | 'test' | 'install_ping' | 'custom';
  subject: string;
  recipient: string;
  status: 'success' | 'error';
  errorMessage?: string;
  resendId?: string;
  preview?: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  schedulePublishedEmail: boolean;
  laborLawAlertEmail: boolean;
  tplhWeeklyEmail: boolean;
  systemUpdateEmail: boolean;
  appInstallPingEmail: boolean;
  inAppAlerts: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  schedulePublishedEmail: true,
  laborLawAlertEmail: true,
  tplhWeeklyEmail: true,
  systemUpdateEmail: true,
  appInstallPingEmail: true,
  inAppAlerts: true,
  soundEnabled: false,
};

// Domyślny / konfigurowalny klucz Resend API
const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_SENDER = 'Starbucks Operations Suite <onboarding@resend.dev>';
const DEFAULT_RESEND_API_KEY = 're_2XBwm1nx_JxDSrfAnweY3aiqBkJDpiG8W';

class CloudNotificationService {
  private apiKey: string = DEFAULT_RESEND_API_KEY;
  private logs: NotificationLogItem[] = [];
  private preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;

  constructor() {
    this.loadApiKey();
    this.loadLogs();
    this.loadPreferences();
  }

  public loadApiKey(): string {
    try {
      const stored = localStorage.getItem('sbx_resend_api_key');
      if (stored) {
        this.apiKey = stored.trim();
      } else {
        this.apiKey = DEFAULT_RESEND_API_KEY;
      }
    } catch {
      this.apiKey = DEFAULT_RESEND_API_KEY;
    }
    return this.apiKey;
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim() || DEFAULT_RESEND_API_KEY;
    try {
      localStorage.setItem('sbx_resend_api_key', this.apiKey);
    } catch {
      // Ignoruj
    }
  }

  public getApiKey(): string {
    return this.apiKey || this.loadApiKey() || DEFAULT_RESEND_API_KEY;
  }

  public hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  public loadPreferences(): NotificationPreferences {
    try {
      const stored = localStorage.getItem('sbx_notification_preferences');
      if (stored) {
        this.preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch {
      this.preferences = DEFAULT_NOTIFICATION_PREFERENCES;
    }
    return this.preferences;
  }

  public getPreferences(): NotificationPreferences {
    return this.preferences;
  }

  public savePreferences(prefs: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    try {
      localStorage.setItem('sbx_notification_preferences', JSON.stringify(this.preferences));
    } catch {}
  }

  public loadLogs(): NotificationLogItem[] {
    try {
      const stored = localStorage.getItem('sbx_notification_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      this.logs = [];
    }
    return this.logs;
  }

  public getLogs(): NotificationLogItem[] {
    return [...this.logs];
  }

  public addLog(item: Omit<NotificationLogItem, 'id' | 'timestamp'>) {
    const newLog: NotificationLogItem = {
      ...item,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    this.logs = [newLog, ...this.logs].slice(0, 50); // trzymamy 50 ostatnich
    try {
      localStorage.setItem('sbx_notification_logs', JSON.stringify(this.logs));
    } catch {}
    return newLog;
  }

  public clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('sbx_notification_logs');
    } catch {}
  }

  /**
   * Główna funkcja wysyłki zapytania do Resend API
   */
  public async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
    type?: NotificationLogItem['type'];
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    const key = this.getApiKey();

    if (!key) {
      console.warn('⚠️ [CloudNotifications] Brak skonfigurowanego klucza Resend API.');
      this.addLog({
        type: params.type || 'custom',
        subject: params.subject,
        recipient: params.to,
        status: 'error',
        errorMessage: 'Brak klucza Resend API.',
      });
      return {
        success: false,
        error: 'Brak klucza Resend API. Wprowadź klucz w Ustawieniach systemu.',
      };
    }

    try {
      const response = await fetch(DEFAULT_RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: params.from || DEFAULT_SENDER,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });

      const data = await response.json();

      // Sandbox Fallback
      if (
        !response.ok &&
        data?.message &&
        data.message.includes('You can only send testing emails to your own email address')
      ) {
        console.warn('⚠️ [CloudNotifications] Ograniczenie darmowego konta Resend (Sandbox). Fallback...');
        const fallbackRes = await fetch(DEFAULT_RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: params.from || DEFAULT_SENDER,
            to: ['apeldawid@gmail.com'],
            subject: `[Do: ${params.to}] ${params.subject}`,
            html: params.html,
          }),
        });

        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok) {
          this.addLog({
            type: params.type || 'custom',
            subject: params.subject,
            recipient: params.to,
            status: 'success',
            resendId: fallbackData.id,
            errorMessage: 'Wysłano w trybie Sandbox (apeldawid@gmail.com)',
          });
          return {
            success: true,
            id: fallbackData.id,
            error: `Wysłano na apeldawid@gmail.com (Resend Sandbox). Aby wysyłać bezpośrednio na ${params.to}, dodaj domenę w resend.com/domains.`,
          };
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Błąd HTTP ${response.status}`);
      }

      this.addLog({
        type: params.type || 'custom',
        subject: params.subject,
        recipient: params.to,
        status: 'success',
        resendId: data.id,
      });

      console.log('📧 [CloudNotifications] E-mail wysłany pomyślnie:', data);
      return { success: true, id: data.id };
    } catch (err: any) {
      console.error('❌ [CloudNotifications] Błąd wysyłki e-mail:', err);
      this.addLog({
        type: params.type || 'custom',
        subject: params.subject,
        recipient: params.to,
        status: 'error',
        errorMessage: err.message || 'Nieznany błąd połączenia z Resend API',
      });
      return { success: false, error: err.message || 'Nieznany błąd połączenia z Resend API' };
    }
  }

  // =========================================================================
  // GENERATORY SZABLONÓW HTML (DO PODGLĄDU I WYSYŁKI)
  // =========================================================================

  public getWelcomeHtml(user: UserRegistrationData): string {
    const version = user.appVersion || APP_VERSION;
    const dateStr = user.registeredAt || new Date().toLocaleString('pl-PL');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8e5; }
    .header { background: linear-gradient(135deg, #1E3932 0%, #006241 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .logo { font-size: 38px; margin-bottom: 8px; }
    .title { font-size: 20px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: #d1fae5; margin-top: 6px; }
    .content { padding: 32px 28px; }
    .welcome-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #dcfce7; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #166534; font-weight: 600; }
    .info-value { color: #0f172a; font-weight: 700; font-family: monospace; }
    .features-list { list-style: none; padding: 0; margin: 0 0 24px 0; }
    .features-list li { padding: 8px 0; font-size: 13px; color: #475569; display: flex; align-items: center; }
    .features-list li::before { content: "✓"; color: #006241; font-weight: 900; margin-right: 10px; }
    .badge { display: inline-block; background: #CBA258; color: #1E3932; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .footer { background: #fafaf9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">☕</div>
      <h1 class="title">Starbucks Operations Suite</h1>
      <p class="subtitle">Platforma Operacyjna Store Managera & District Managera</p>
    </div>
    <div class="content">
      <p class="welcome-text">
        Cześć <strong>${user.userName}</strong>! 👋<br>
        Twój profil operacyjny został pomyślnie zarejestrowany w systemie <strong>Starbucks Operations Suite</strong> dla kawiarni <strong>${user.storeName}</strong>.
      </p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Kawiarnia:</span><span class="info-value">${user.storeName} (Kod: ${user.unitCode})</span></div>
        <div class="info-row"><span class="info-label">Rola Operacyjna:</span><span class="info-value">${user.userRole === 'SM' ? 'Store Manager (SM)' : user.userRole === 'DM' ? 'District Manager (DM)' : 'Assistant Store Manager (ASM)'}</span></div>
        <div class="info-row"><span class="info-label">E-mail Powiadomień:</span><span class="info-value">${user.userEmail}</span></div>
        <div class="info-row"><span class="info-label">Wersja Systemu:</span><span class="info-value">v${version} (macOS Native)</span></div>
        <div class="info-row"><span class="info-label">Data Aktywacji:</span><span class="info-value">${dateStr}</span></div>
      </div>
      <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">🔔 Jakie powiadomienia będziesz otrzymywać na ten adres?</h3>
      <ul class="features-list">
        <li><strong>Publikacja Grafiku:</strong> Potwierdzenie publikacji grafiku menedżerów 7 dni przed okresem (art. 129 § 3 KP).</li>
        <li><strong>Tarcza Kodeksu Pracy:</strong> Ostrzeżenia o wykrytych kolizjach 11h odpoczynku, absencji L4/H lub przekroczeniu norm.</li>
        <li><strong>Podsumowania TPLH:</strong> Tygodniowe raporty wypracowanej robocizny (Earned Labor) i realizacji celów AOP.</li>
        <li><strong>Aktualizacje Systemowe:</strong> Informacje o wdrożeniu nowych mikropatchy OTA.</li>
      </ul>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">🛡️ <em>Baza danych SQLite (grafiki, normy, logowania MAPAL) pozostaje w 100% lokalna na Twoim komputerze.</em></p>
    </div>
    <div class="footer">Starbucks Operations Suite © 2026 • Lokal 108120 SBX Warszawa Janki<br>System Operacyjny Zarządzania Robocizną & Grafikiem</div>
  </div>
</body>
</html>`;
  }

  public getSchedulePublishedHtml(data: SchedulePublishedData): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8e5; }
    .header { background: #006241; padding: 26px 24px; text-align: center; color: #ffffff; }
    .content { padding: 28px; }
    .box { background: #f8fafc; border: 1px solid #e2e8e0; border-radius: 12px; padding: 18px; margin: 18px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: none; }
    .footer { background: #fafaf9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size:18px;">🗓️ Publikacja Grafiku Menedżerskiego</h2>
      <p style="margin:4px 0 0 0; font-size:12px; opacity:0.9;">Okres: ${data.month} ${data.year} (art. 129 § 3 Kodeksu Pracy)</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.5;">
        Cześć <strong>${data.userName}</strong>,<br>
        Grafik menedżerski na miesiąc <strong>${data.month} ${data.year}</strong> został oficjalnie opublikowany i zamrożony w systemie.
      </p>
      <div class="box">
        <div class="row"><span>Miesiąc / Okres:</span><strong>${data.month} ${data.year}</strong></div>
        <div class="row"><span>Zespół Menedżerski:</span><strong>${data.managersCount} kierowników</strong></div>
        <div class="row"><span>Zaplanowane Godziny:</span><strong style="color:#006241;">${data.totalHours.toFixed(1)} h</strong></div>
        <div class="row"><span>Opublikował:</span><strong>${data.publishedBy}</strong></div>
        <div class="row"><span>Wersja w Rejestrze:</span><strong>${data.versionTag || 'v1.0 (Official)'}</strong></div>
      </div>
      <p style="font-size: 12px; color: #475569;">✓ Wszelkie dalsze zmiany w grafiku będą rejestrowane w automatycznym dzienniku modyfikacji po publikacji.</p>
    </div>
    <div class="footer">Starbucks Operations Suite • Powiadomienia Operacyjne</div>
  </div>
</body>
</html>`;
  }

  public getLaborLawAlertHtml(data: LaborLawAlertData): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fef2f2; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #fecaca; }
    .header { background: #991b1b; padding: 24px; text-align: center; color: #ffffff; }
    .content { padding: 28px; }
    .box { background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 12px; padding: 18px; margin: 18px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #fee2e2; }
    .row:last-child { border-bottom: none; }
    .footer { background: #fafaf9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size:18px;">⚠️ Alert Tarczy Kodeksu Pracy</h2>
      <p style="margin:4px 0 0 0; font-size:12px; opacity:0.9;">Wykryto kolizję w grafiku pracy</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.5;">
        Cześć <strong>${data.userName}</strong>,<br>
        System wykrył naruszenie reguły Kodeksu Pracy dla pracownika <strong>${data.employeeName}</strong>.
      </p>
      <div class="box">
        <div class="row"><span>Pracownik:</span><strong>${data.employeeName}</strong></div>
        <div class="row"><span>Typ naruszenia:</span><strong style="color:#991b1b;">${data.violationType}</strong></div>
        <div class="row"><span>Podstawa prawna:</span><strong>${data.article}</strong></div>
        <div class="row"><span>Data zdarzenia:</span><strong>${data.date}</strong></div>
        <div class="row"><span>Opis:</span><span>${data.description}</span></div>
      </div>
      <p style="font-size: 12px; color: #475569;">Zalecana jest natychmiastowa korekta grafiku w module Managers Schedule.</p>
    </div>
    <div class="footer">Starbucks Operations Suite • Tarcza Kodeksu Pracy</div>
  </div>
</body>
</html>`;
  }

  public getTplhWeeklyReportHtml(data: TplhWeeklyReportData): string {
    const isVariancePositive = data.varianceHours >= 0;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8e5; }
    .header { background: #1E3932; padding: 24px; text-align: center; color: #ffffff; }
    .content { padding: 28px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: 800; color: #006241; margin-top: 4px; }
    .stat-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .footer { background: #fafaf9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size:18px;">📊 Raport Tygodniowy TPLH & Robocizny</h2>
      <p style="margin:4px 0 0 0; font-size:12px; color:#d1fae5;">${data.storeName} • Tydzień ${data.weekNumber} (${data.month} ${data.year})</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; line-height: 1.5;">
        Cześć <strong>${data.userName}</strong>,<br>
        Oto podsumowanie efektywności robocizny za miniony tydzień operacyjny:
      </p>
      <div class="grid">
        <div class="stat-card">
          <div class="stat-label">Rzeczywisty TPLH</div>
          <div class="stat-value">${data.actualTplh.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cel AOP TPLH</div>
          <div class="stat-value" style="color: #334155;">${data.targetTplh.toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Godziny Rzeczywiste</div>
          <div class="stat-value">${data.actualHours.toFixed(1)} h</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Wypracowany Budżet (Earned)</div>
          <div class="stat-value" style="color:${isVariancePositive ? '#166534' : '#991b1b'};">${data.earnedLaborHours.toFixed(1)} h</div>
        </div>
      </div>
      <p style="font-size: 12px; color: #475569;">Transakcje TRX: <strong>${data.actualTrx.toLocaleString('pl-PL')}</strong> | Odchylenie: <strong>${data.varianceHours > 0 ? '+' : ''}${data.varianceHours.toFixed(1)} h</strong></p>
    </div>
    <div class="footer">Starbucks Operations Suite • Silnik TPLH Forecast</div>
  </div>
</body>
</html>`;
  }

  public getAppInstalledHtml(data: AppInstallNotificationData): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8e5; }
    .header { background: linear-gradient(135deg, #1E3932 0%, #006241 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .badge-starbucks { display: inline-block; background: #004F34; color: #CBA258; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; border: 1px solid rgba(203, 162, 88, 0.3); }
    .content { padding: 28px 24px; font-size: 13px; line-height: 1.6; }
    .info-box { background: #F7F9F8; border: 1px solid #E2E8E5; border-radius: 14px; padding: 18px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf2ef; font-size: 12px; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .val { color: #1E3932; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, monospace; }
    .status-pill { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 11px; }
    .footer { background: #F7F9F8; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #E2E8E5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge-starbucks">🚀 System Telemetrii Instalacji</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">Nowa Instalacja Aplikacji!</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #A2C5AC;">Starbucks Operations Suite • macOS Desktop</p>
    </div>
    <div class="content">
      <p style="font-size: 14px; margin-top: 0;">
        Wykryto nowe pobranie i pierwsze uruchomienie aplikacji <strong>Starbucks Operations Suite</strong> na urządzeniu Mac.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="label">Wersja Aplikacji:</span>
          <span class="val status-pill">${data.appVersion}</span>
        </div>
        <div class="info-row">
          <span class="label">Czas Pierwszego Uruchomienia:</span>
          <span class="val">${data.installedAt}</span>
        </div>
        <div class="info-row">
          <span class="label">Identyfikator Instalacji:</span>
          <span class="val" style="color: #006241;">${data.installId}</span>
        </div>
        <div class="info-row">
          <span class="label">Platforma & System:</span>
          <span class="val">${data.platform}</span>
        </div>
        <div class="info-row">
          <span class="label">Jednostka / Kawiarnia:</span>
          <span class="val">${data.unitCode || '18120'} ${data.storeName || 'SBX Warszawa Janki'}</span>
        </div>
        <div class="info-row">
          <span class="label">Profil Uruchomieniowy:</span>
          <span class="val">${data.userName || 'Store Manager'} (${data.userEmail || 'Nie podano'})</span>
        </div>
      </div>

      <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
        Powiadomienie generowane jest automatycznie w tle wyłącznie przy pierwszym uruchomieniu nowej instalacji.
      </p>
    </div>
    <div class="footer">
      Starbucks Operations Suite • Dystrybucja GitHub Releases • Resend Cloud Gateway
    </div>
  </div>
</body>
</html>`;
  }

  public getTestHtml(targetEmail: string): string {
    const nowStr = new Date().toLocaleString('pl-PL');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f5; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8e5; }
    .header { background: #1E3932; padding: 24px; text-align: center; color: #ffffff; }
    .content { padding: 24px; font-size: 13px; line-height: 1.6; }
    .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; font-size:18px;">🧪 Test Integracji Powiadomień</h2>
      <p style="margin:4px 0 0 0; font-size:12px; color:#d1fae5;">Resend Cloud Notification Engine</p>
    </div>
    <div class="content">
      <p>Połączenie z chmurą mailingową <strong>Resend API</strong> działa w 100% poprawnie!</p>
      <p>
        Adres docelowy: <span class="badge">${targetEmail}</span><br>
        Czas testu: <strong>${nowStr}</strong><br>
        Lokal: <strong>108120 SBX Warszawa Janki</strong>
      </p>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
        System automatycznie przesyła powiadomienia o publikacji grafików, alertach Kodeksu Pracy i statusie robocizny.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // =========================================================================
  // METODY WYSYŁKI POWIADOMIEŃ
  // =========================================================================

  public async sendWelcomeNotification(user: UserRegistrationData) {
    if (!this.preferences.emailEnabled) return { success: false, error: 'Powiadomienia e-mail wyłączone' };
    const subject = `☕ Witamy w Starbucks Operations Suite — Kawiarnia ${user.unitCode} ${user.storeName}`;
    const html = this.getWelcomeHtml(user);
    return this.sendEmail({ to: user.userEmail, subject, html, type: 'welcome' });
  }

  public async sendSchedulePublishedNotification(data: SchedulePublishedData) {
    if (!this.preferences.emailEnabled || !this.preferences.schedulePublishedEmail) {
      return { success: false, error: 'Powiadomienia o publikacji grafiku są wyłączone' };
    }
    const subject = `🗓️ Opublikowano Grafik Menedżerski na ${data.month} ${data.year} — Kawiarnia 108120 Janki`;
    const html = this.getSchedulePublishedHtml(data);
    return this.sendEmail({ to: data.userEmail, subject, html, type: 'schedule_published' });
  }

  public async sendLaborLawAlertNotification(data: LaborLawAlertData) {
    if (!this.preferences.emailEnabled || !this.preferences.laborLawAlertEmail) {
      return { success: false, error: 'Powiadomienia o alertach Kodeksu Pracy są wyłączone' };
    }
    const subject = `⚠️ Alert Kodeksu Pracy — ${data.employeeName} (${data.violationType})`;
    const html = this.getLaborLawAlertHtml(data);
    return this.sendEmail({ to: data.userEmail, subject, html, type: 'labor_law_alert' });
  }

  public async sendTplhWeeklyReportNotification(data: TplhWeeklyReportData) {
    if (!this.preferences.emailEnabled || !this.preferences.tplhWeeklyEmail) {
      return { success: false, error: 'Tygodniowe raporty TPLH są wyłączone' };
    }
    const subject = `📊 Raport TPLH Tydzień ${data.weekNumber} (${data.month} ${data.year}) — ${data.storeName}`;
    const html = this.getTplhWeeklyReportHtml(data);
    return this.sendEmail({ to: data.userEmail, subject, html, type: 'tplh_weekly' });
  }

  public async sendAppInstalledNotification(data: AppInstallNotificationData) {
    if (!this.preferences.emailEnabled || !this.preferences.appInstallPingEmail) {
      return { success: false, error: 'Powiadomienia o nowych instalacjach są wyłączone w preferencjach' };
    }
    const adminEmail = 'apeldawid@gmail.com';
    const subject = `🎉 Nowa Instalacja Starbucks Operations Suite [${data.appVersion}] — ${data.unitCode || '18120'} Janki`;
    const html = this.getAppInstalledHtml(data);
    return this.sendEmail({ to: adminEmail, subject, html, type: 'install_ping' });
  }

  /**
   * Sprawdza i wysyła jednorazowy ping przy pierwszym uruchomieniu programu na danym urządzeniu
   */
  public async checkAndSendFirstLaunchPing(): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    try {
      const alreadySent = localStorage.getItem('sbx_install_ping_sent');
      if (alreadySent) {
        return { success: true, skipped: true };
      }

      let installId = localStorage.getItem('sbx_installation_id');
      if (!installId) {
        installId = `SBX-MAC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        localStorage.setItem('sbx_installation_id', installId);
      }

      const storeName = localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';
      const unitCode = localStorage.getItem('sbx_unit_code') || '18120';
      const userName = localStorage.getItem('sbx_user_name') || 'Store Manager';
      const userEmail = localStorage.getItem('sbx_user_email') || 'apeldawid@gmail.com';
      const platform = typeof navigator !== 'undefined'
        ? `${navigator.platform || 'macOS'} (${navigator.userAgent.includes('Macintosh') ? 'Apple Mac' : 'Desktop'})`
        : 'macOS Desktop';

      const data: AppInstallNotificationData = {
        installId,
        appVersion: APP_VERSION,
        installedAt: new Date().toLocaleString('pl-PL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        platform,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        storeName,
        unitCode,
        userName,
        userEmail,
      };

      const res = await this.sendAppInstalledNotification(data);
      if (res.success) {
        localStorage.setItem('sbx_install_ping_sent', new Date().toISOString());
      }
      return res;
    } catch (err: any) {
      console.warn('⚠️ [CloudNotificationService] Błąd first-launch ping:', err);
      return { success: false, error: err.message || String(err) };
    }
  }

  public async sendTestNotification(targetEmail: string) {
    const subject = `🧪 Test Powiadomień Chmurowych — Starbucks Operations Suite`;
    const html = this.getTestHtml(targetEmail);
    return this.sendEmail({ to: targetEmail, subject, html, type: 'test' });
  }
}

export const cloudNotificationService = new CloudNotificationService();
