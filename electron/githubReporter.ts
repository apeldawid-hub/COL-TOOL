import { shell } from 'electron';
import { CrashLogManager, LogEntry } from './crashLogManager';

export interface GitHubIssuePayload {
  category: string;
  moduleName: string;
  userDescription: string;
  errorStack?: string;
  clientInfo?: {
    appVersion: string;
    platform: string;
    arch: string;
    systemTime: string;
  };
  customLogs?: LogEntry[];
  token?: string;
  isAutomatic?: boolean;
}

export class GitHubReporter {
  private static instance: GitHubReporter;
  private readonly REPO_OWNER = 'apeldawid-hub';
  private readonly REPO_NAME = 'COL-TOOL';

  // Cache do deduplikacji i zapobiegania spamowi automatycznych zgłoszeń
  private recentSentSignatures = new Map<string, number>();
  private autoReportCountThisSession = 0;
  private readonly MAX_AUTO_REPORTS_PER_SESSION = 8;
  private readonly DEDUPLICATION_INTERVAL_MS = 60 * 60 * 1000; // 1 godzina

  private constructor() {}

  public static getInstance(): GitHubReporter {
    if (!GitHubReporter.instance) {
      GitHubReporter.instance = new GitHubReporter();
    }
    return GitHubReporter.instance;
  }

  /**
   * Generuje sygnaturę błędu do deduplikacji
   */
  private getErrorSignature(payload: GitHubIssuePayload): string {
    const firstLineOfStack = payload.errorStack ? payload.errorStack.split('\n')[0] : '';
    return `${payload.moduleName}::${payload.category}::${firstLineOfStack || payload.userDescription}`;
  }

  /**
   * Formatuje zawartość zgłoszenia do standardu GitHub Markdown
   */
  public formatIssueContent(payload: GitHubIssuePayload): { title: string; body: string } {
    const timeStr = payload.clientInfo?.systemTime || new Date().toISOString();
    const shortDesc = payload.userDescription 
      ? payload.userDescription.slice(0, 60).replace(/[\r\n]+/g, ' ') 
      : 'Automatyczne zgłoszenie awarii';
    
    const prefix = payload.isAutomatic ? '[AUTO-TELEMETRY]' : '[USER-REPORT]';
    const title = `${prefix} [${payload.moduleName || 'Core'}] ${shortDesc}`;

    const logs = payload.customLogs && payload.customLogs.length > 0
      ? payload.customLogs.slice(-25)
      : CrashLogManager.getInstance().getRecentLogs(25);

    const logsSnippet = logs
      .map((l) => `[${l.timestamp.substring(11, 19)}] [${l.level}] [${l.source}]: ${l.message}`)
      .join('\n');

    let body = `### 📌 Szczegóły Środowiska\n`;
    body += `- **Aplikacja:** Starbucks Operations Suite v${payload.clientInfo?.appVersion || '2.6.0'}\n`;
    body += `- **Platforma:** ${payload.clientInfo?.platform || 'darwin'} (${payload.clientInfo?.arch || 'arm64'})\n`;
    body += `- **Moduł:** \`${payload.moduleName || 'General'}\`\n`;
    body += `- **Kategoria:** \`${payload.category || 'CRASH'}\`\n`;
    body += `- **Typ zgłoszenia:** ${payload.isAutomatic ? '⚡ Automatyczna Cicha Telemetria' : '👤 Zgłoszenie Użytkownika'}\n`;
    body += `- **Data:** ${timeStr}\n\n`;

    body += `### 📝 Opis Zgłoszenia\n`;
    body += `${payload.userDescription || '_Brak opisu użytkownika_'}\n\n`;

    if (payload.errorStack) {
      body += `### 💥 Stack Trace Awarii\n\`\`\`ts\n${payload.errorStack}\n\`\`\`\n\n`;
    }

    if (logsSnippet) {
      body += `### 📜 Czarna Skrzynka (Ostatnie Logi)\n<details><summary>Kliknij, aby rozwinąć logi (${logs.length})</summary>\n\n\`\`\`log\n${logsSnippet}\n\`\`\`\n</details>\n`;
    }

    return { title, body };
  }

  /**
   * Wysyła zgłoszenie przez GitHub REST API (gdy podano token) lub otwiera wstępnie wypełniony formularz w przeglądarce
   */
  public async submitIssue(payload: GitHubIssuePayload): Promise<{
    success: boolean;
    mode: 'api' | 'browser' | 'skipped';
    issueUrl?: string;
    issueNumber?: number;
    message: string;
  }> {
    // 1. Zabezpieczenie przed pętlami i spamem przy automatycznej telemetrii
    if (payload.isAutomatic) {
      if (this.autoReportCountThisSession >= this.MAX_AUTO_REPORTS_PER_SESSION) {
        CrashLogManager.getInstance().log(
          'INFO',
          'GitHubReporter',
          'Pominięto automatyczne zgłoszenie błędu: osiągnięto limit na tę sesję.'
        );
        return {
          success: false,
          mode: 'skipped',
          message: 'Osiągnięto limit automatycznych zgłoszeń na tę sesję.',
        };
      }

      const signature = this.getErrorSignature(payload);
      const lastSentTime = this.recentSentSignatures.get(signature);
      const now = Date.now();

      if (lastSentTime && now - lastSentTime < this.DEDUPLICATION_INTERVAL_MS) {
        CrashLogManager.getInstance().log(
          'INFO',
          'GitHubReporter',
          `Pominięto duplikat błędu: ${signature}`
        );
        return {
          success: false,
          mode: 'skipped',
          message: 'Ten błąd został już niedawno zaraportowany.',
        };
      }

      this.recentSentSignatures.set(signature, now);
      this.autoReportCountThisSession++;
    }

    const { title, body } = this.formatIssueContent(payload);
    const token = payload.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

    // 2. Jeśli mamy token API, wysyłamy ciche zgłoszenie przez GitHub REST API
    if (token) {
      try {
        const url = `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/issues`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Starbucks-Operations-Suite-CrashReporter',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            labels: ['bug', 'crash-report', payload.isAutomatic ? 'automated-telemetry' : 'user-submitted'],
          }),
        });

        if (response.ok) {
          const issueData = await response.json();
          CrashLogManager.getInstance().log(
            'INFO',
            'GitHubReporter',
            `Pomyślnie wysłano Issue #${issueData.number} do GitHuba: ${issueData.html_url}`
          );
          return {
            success: true,
            mode: 'api',
            issueUrl: issueData.html_url,
            issueNumber: issueData.number,
            message: `Pomyślnie utworzono zgłoszenie Issue #${issueData.number} na GitHubie!`,
          };
        } else {
          const errorText = await response.text();
          CrashLogManager.getInstance().log(
            'WARN',
            'GitHubReporter',
            `GitHub API zwróciło błąd ${response.status}: ${errorText}`
          );
        }
      } catch (err: any) {
        CrashLogManager.getInstance().log(
          'ERROR',
          'GitHubReporter',
          'Błąd sieciowy podczas wysyłania do GitHub API',
          err.message
        );
      }
    }

    // 3. Jeśli to była cicha telemetria (isAutomatic: true) i nie ma tokena, nie wyskakujemy z oknem przeglądarki
    if (payload.isAutomatic) {
      CrashLogManager.getInstance().log(
        'INFO',
        'GitHubReporter',
        'Cicha telemetria: zarejestrowano błąd w Czarnej Skrzynce (brak aktywnego tokena GitHub REST API).'
      );
      return {
        success: false,
        mode: 'skipped',
        message: 'Błąd zarejestrowany lokalnie w Czarnej Skrzynce.',
      };
    }

    // 4. Zgłoszenie manualne użytkownika (isAutomatic: false) — Fallback do przeglądarki
    try {
      const encodedTitle = encodeURIComponent(title);
      const encodedBody = encodeURIComponent(body);
      const fallbackUrl = `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/issues/new?title=${encodedTitle}&body=${encodedBody}&labels=bug`;

      await shell.openExternal(fallbackUrl);

      CrashLogManager.getInstance().log(
        'INFO',
        'GitHubReporter',
        'Otwarto formularz zgłoszenia w przeglądarce na GitHubie'
      );

      return {
        success: true,
        mode: 'browser',
        issueUrl: fallbackUrl,
        message: 'Otwarto przygotowane zgłoszenie w przeglądarce na GitHubie. Wystarczy kliknąć Submit Issue!',
      };
    } catch (err: any) {
      return {
        success: false,
        mode: 'browser',
        message: `Nie udało się otworzyć strony GitHuba: ${err.message}`,
      };
    }
  }
}
