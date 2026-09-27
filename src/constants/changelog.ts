// src/constants/changelog.ts
/**
 * Starbucks Operations Suite — Dziennik Zmian & Rejestr Historii Wydań
 * Zarządzany automatycznie przez Agenta Dziennika Zmian (scripts/changelog-agent.js)
 */

export type ChangelogCategory = 'feature' | 'enhancement' | 'fix' | 'compliance' | 'database';

export interface ChangelogItem {
  type: ChangelogCategory;
  description: string;
  module?: 'labor_forecast' | 'managers_schedule' | 'trainings' | 'col_calculator' | 'system' | 'database' | 'all';
}

export interface ReleaseEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
  items: ChangelogItem[];
  author?: string;
}

export const APP_CHANGELOG: ReleaseEntry[] = [
  {
    version: '2.8.42',
    date: '2026-09-27',
    title: 'Integracja Finansowa AOP 2026: Sprzedaż (Sales), Średni Paragon (AGC) & Prognoza % COL',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Zasilenie bazy SQLite aop_plans kompletnym oficjalnym rachunkiem P&L AOP 2026 (Sales, TRX, AGC, COL PLN, COL %)',
      'Dwuwymiarowa analiza operacyjno-finansowa w Labor Forecast (TRX & TPLH obok Sprzedaży, AGC i % COL)',
      'Dynamiczna kalkulacja estymowanego obrotu MTD (Sales) i prognozowanego udziału robocizny (% COL) dla kawiarni'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Rozszerzenie bazy aop_plans oraz nasion o planowaną sprzedaż, średni paragon AGC (np. 28,01 zł we wrześniu) oraz budżet COL PLN i % COL'
      },
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Wzbogacenie Hero Bara Modułu 1 o metryki finansowe AOP (Sprzedaż, AGC, COL %) oraz predykcję wyniku finansowego w oparciu o ułożony grafik'
      },
      {
        type: 'database',
        module: 'database',
        description: 'Automatyczna migracja i synchronizacja SQLite dla kolumn plan_agc, actual_agc, plan_col_pln, plan_col_percent'
      }
    ]
  },
  {
    version: '2.8.41',
    date: '2026-09-27',
    title: 'Predykcja Zespołowa (Ensemble AI) & Dekompozycja Niedziel Handlowych',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Wielomodelowy Zespół Predykcji (Ensemble AI): Kotwica AOP (35-65%) + Krótki Run-Rate (30-50%) + Sezonowość YoY (15-35%)',
      'Przedziały ufności prognozy TRX (min … expected … max) oraz wypracowanego budżetu godzin (Floor-Safe, Balanced, Growth)',
      'Operacyjna dekompozycja Niedziel Handlowych vs Niehandlowych w CH Janki (20% puli flex w handlowe vs zamrożenie Floor 32h w niehandlowe)',
      'Samouczące się wagi dni tygodnia (EMA) i dynamiczne badge\'e 🛒 HANDL. / WOLNA na siatce dobowej i mostku menedżerskim'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Nowa karta Wielomodelowego Zespołu Predykcji (Ensemble Multi-Model Forecast) w panelu Inteligencji Predykcyjnej z podziałem wag i przedziałem ufności TRX'
      },
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Dekompozycja Niedziel Handlowych na bazie ustawy o handlu: automatyczna alokacja 20% flex w niedziele handlowe i zamrożenie na Floor 32h w niedziele niehandlowe'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Samouczące się wagi dni tygodnia z wykładniczą średnią kroczącą (EMA) oraz dynamiczne badge\'e 🛒 HANDL. / WOLNA w tabeli i mostku dyżurów'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Eliminacja syndromu zimnego startu na początku miesiąca poprzez dynamiczne łączenie planu AOP z historyczną sezonowością bliźniaczą YoY'
      }
    ]
  },
  {
    version: '2.8.40',
    date: '2026-09-27',
    title: 'Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Precyzyjne skalowanie interfejsu (70% – 135%) w dedykowanej zakładce Skalowanie & Wygląd',
      'Skróty klawiszowe Cmd/Ctrl +/-/0 i presety wyświetlaczy (MacBook 13", 24"-27", 4K)',
      'Autodiagnostyka integralności SQLite PRAGMA integrity_check i defragmentacja VACUUM',
      'Automatyczny nadzór nad kopiami zapasowymi (>7 dni) z alertem w belce głównej'
    ],
    items: [
      {
        type: 'feature',
        module: 'system',
        description: 'Dedykowana zakładka Skalowanie & Wygląd w oknie Ustawień z płynnym suwakiem 70%–135% i sandboxem podglądu na żywo'
      },
      {
        type: 'enhancement',
        module: 'system',
        description: 'Natywna integracja zoomService z webFrame.setZoomFactor w Electronie — idealna ostrość tekstu i ikon SVG bez rozmycia i podwójnego zoomu'
      },
      {
        type: 'feature',
        module: 'database',
        description: 'Inspektor zdrowia bazy SQLite: PRAGMA integrity_check, pomiar stron freelist, licznik 15 tabel i zrzutów Czarnej Skrzynki'
      },
      {
        type: 'feature',
        module: 'database',
        description: '1-klik defragmentacja i kompaktowanie bazy VACUUM + PRAGMA optimize z automatyczną kopią ratunkową pre_vacuum'
      },
      {
        type: 'compliance',
        module: 'system',
        description: 'Ciągły monitoring wieku ostatniej kopii zapasowej — generowanie pilnego zadania To-Do oraz pulsującego ostrzeżenia w Headerze przy braku kopii przez 7 dni'
      }
    ]
  },
  {
    version: '2.8.39',
    date: '2026-09-27',
    title: 'Centrum Powiadomień, Szablony Resend & Samouczek Kawiarni',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Wielokanałowe powiadomienia desktopowe i e-mailowe z chmurą Resend API',
      'Studio Szablonów Powiadomień dla publikacji grafiku, kolizji RCP i norm KP',
      'Interaktywny 6-scenowy samouczek i przewodnik pilotażu operacyjnego lokalu',
      'Panel telemetryczny floty urządzeń Firebase Firestore (widok deweloperski)'
    ],
    items: [
      {
        type: 'feature',
        module: 'system',
        description: 'Centrum Powiadomień z obsługą alertów Kodeksu Pracy, terminu publikacji 7 dni oraz kolizji RCP vs L4/H'
      },
      {
        type: 'feature',
        module: 'system',
        description: 'Wysyłka e-mail powiadomień przez Resend API z podglądem HTML szablonów Starbucks Dark Gold'
      },
      {
        type: 'feature',
        module: 'all',
        description: 'Interaktywny samouczek pilotażu kawiarni z przewodnikiem po TPLH, grafiku menedżerskim i ustawieniach'
      },
      {
        type: 'feature',
        module: 'system',
        description: 'Baza floty urządzeń i instalacji Firebase Firestore dla zdalnego monitoringu stabilności (dostęp Dev/Admin)'
      }
    ]
  },
  {
    version: '2.8.30',
    date: '2026-09-21',
    title: 'Katalog Zmian Starbucks, Poprawki Wynagrodzeń & Elastyczne Godziny',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Elastyczny czas trwania zmian (MID, SUP, SAM, SPM, NC) per zmiana oraz presety katalogu',
      'Dostosowywanie przedziału czasowego (Od – Do) ze sprawdzaniem odpoczynku 11h KP',
      'Pełna obsługa zmian wsparciowych ze wszystkich kawiarni w dystrykcie'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Dostosowywanie godzin zmian elastycznych w popoverze (4h–12h) z wizualizacją w siatce grafiku'
      },
      {
        type: 'enhancement',
        module: 'managers_schedule',
        description: 'Dynamiczny stepper godzin rozpoczęcia i zakończenia zmiany z przeliczaniem wymiaru dobowego'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Weryfikacja odpoczynku 11h Kodeksu Pracy z uwzględnieniem niestandardowych godzin rozpoczęcia i zakończenia'
      },
      {
        type: 'fix',
        module: 'col_calculator',
        description: 'Precyzyjne uwzględnianie indywidualnych stawek godzinowych i etatu w wyliczeniach kosztów pracy menedżerów'
      }
    ]
  },
  {
    version: '2.8.0',
    date: '2026-09-15',
    title: 'AutoScheduling AI, Speed-Dial Hub & Asystent Negocjacji z Zespołem',
    type: 'minor',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Silnik AutoScheduling AI (20 000 symulacji Monte Carlo) generujący kompletny grafik w <150 ms',
      'Asystent kompromisów i negocjacji grafiku z gotowymi szablonami wiadomości WhatsApp/SMS',
      'Pływające menu nawigacyjne Starbucks Speed-Dial Hub i czysty układ panoramiczny',
      'Asystent Wsparcia Międzykawiarnianego dla bezpiecznego oddawania nadwyżek godzin'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'AutoScheduling AI: automatyczne dociążenie etatów do 100% z błędem poniżej 1h na pracownika'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Asystent Negocjacji z Zespołem: detekcja patów obsadowych i generowanie 3 wariantów kompromisowych'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Pływające logo Starbucks z rozwijanym menu Speed-Dial i szybkim przełącznikiem miesięcy'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Asystent Wsparcia Międzykawiarnianego dla lokali 323, 341, 756, 327 z ochroną obsady Janki'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Twarda ochrona limitów niedzielnych i świątecznych: zakaz podwójnych otwarć/zamknięć, transfer godzin na bar'
      }
    ]
  },
  {
    version: '2.7.0',
    date: '2026-09-12',
    title: 'Trzymiesięczny Okres Rozliczeniowy TOR & Integracja RCP MAPAL',
    type: 'minor',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Kwartalne rozliczenie menedżerów TOR Q1–Q4 z podziałem na RCP, H, L4 i Bilans',
      'Automatyczna detekcja kolizji RCP vs L4/H ze specjalnym oznaczeniem ostrzegawczym',
      'Zabezpieczenie przed manipulacją: nieedytowalna kolumna rzeczywistego czasu pracy RCP',
      'Nawigacja klawiaturą po siatce grafiku z pre-flight walidacją Kodeksu Pracy'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Widok kwartalnego rozliczenia czasu pracy menedżerów TOR (Q1–Q4) z saldem i dedykowanym eksportem Excel'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Reguła pierwszeństwa L4 nad urlopem wypoczynkowym H zgodnie z art. 166 Kodeksu Pracy'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Szybkie wprowadzanie zmian z klawiatury (A, P, O, H, L, Delete) z natychmiastową weryfikacją norm'
      },
      {
        type: 'database',
        module: 'managers_schedule',
        description: 'Automatyczne pobieranie logowań MAPAL Fichajes ze wszystkich kawiarni dla menedżerów wspierających'
      }
    ]
  },
  {
    version: '2.6.0',
    date: '2026-09-08',
    title: 'Zintegrowana Platforma Operacyjna (Release v2.0)',
    type: 'major',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Integracja Modułu 1 (TPLH Forecast) z Modułem 2 (Grafik Managerski)',
      'Dwukierunkowy Manager Labor Bridge przenoszący godziny kierowników do budżetu tygodnia',
      'Baza 252 miesięcy oficjalnych norm Kodeksu Pracy (2016–2036)',
      'System automatycznych kopii zapasowych SQLite z rotacją 15 migawek'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Dwukierunkowy most robocizny: import godzin kierowników i wyliczanie puli baristów w każdym tygodniu'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Autonomiczne składy miesięczne menedżerów z auto-dziedziczeniem struktury zespołu z poprzedniego miesiąca'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Tarcza Kodeksu Pracy: 11h odpoczynku dobowego, 35h odpoczynku tygodniowego i max 12h czasu pracy'
      },
      {
        type: 'database',
        module: 'system',
        description: 'Automatyczne backupy SQLite przed publikacją wersji, importem MAPAL i startem programu'
      }
    ]
  }
];

/**
 * Zwraca najnowszy wpis w dzienniku zmian
 */
export function getLatestRelease(): ReleaseEntry {
  return APP_CHANGELOG[0];
}

/**
 * Zwraca historię wydań dla konkretnej wersji
 */
export function getReleaseByVersion(version: string): ReleaseEntry | undefined {
  const cleanVer = version.replace(/^v/, '');
  return APP_CHANGELOG.find((r) => r.version === cleanVer);
}

/**
 * Zwraca sformatowany tekst Markdown dla danej wersji
 */
export function formatReleaseMarkdown(entry: ReleaseEntry): string {
  let md = `## [v${entry.version}] — ${entry.date}: ${entry.title}\n\n`;

  if (entry.highlights && entry.highlights.length > 0) {
    md += `### 🌟 Kluczowe Zmiany:\n`;
    entry.highlights.forEach((h) => {
      md += `- ${h}\n`;
    });
    md += `\n`;
  }

  const features = entry.items.filter((i) => i.type === 'feature');
  const enhancements = entry.items.filter((i) => i.type === 'enhancement');
  const compliance = entry.items.filter((i) => i.type === 'compliance' || i.type === 'database');
  const fixes = entry.items.filter((i) => i.type === 'fix');

  if (features.length > 0) {
    md += `### ✨ Nowe Funkcje:\n`;
    features.forEach((f) => {
      const modPrefix = f.module && f.module !== 'all' && f.module !== 'system' ? `**[${f.module}]** ` : '';
      md += `- ${modPrefix}${f.description}\n`;
    });
    md += `\n`;
  }

  if (enhancements.length > 0) {
    md += `### ⚡ Usprawnienia & Optymalizacje:\n`;
    enhancements.forEach((e) => {
      const modPrefix = e.module && e.module !== 'all' && e.module !== 'system' ? `**[${e.module}]** ` : '';
      md += `- ${modPrefix}${e.description}\n`;
    });
    md += `\n`;
  }

  if (compliance.length > 0) {
    md += `### 🛡️ Kodeks Pracy & Baza SQLite:\n`;
    compliance.forEach((c) => {
      md += `- ${c.description}\n`;
    });
    md += `\n`;
  }

  if (fixes.length > 0) {
    md += `### 🐛 Poprawki Błędów:\n`;
    fixes.forEach((fx) => {
      md += `- ${fx.description}\n`;
    });
    md += `\n`;
  }

  return md;
}
