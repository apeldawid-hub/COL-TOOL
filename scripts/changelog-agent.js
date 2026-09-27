#!/usr/bin/env node

/**
 * Starbucks Operations Suite — Agent Dziennika Zmian & Historii Wydań
 * (Changelog & Release Notes Agent)
 * 
 * Odpowiada za:
 * 1. Automatyczne spisywanie i katalogowanie zmian wprowadzanych przez każdą aktualizację.
 * 2. Synchronizację między kodem aplikacji (src/constants/changelog.ts) a plikiem CHANGELOG.md.
 * 3. Dostarczanie sformatowanych notatek wydania dla GitHub Releases i powiadomień w aplikacji.
 * 4. Inspekcję historii git (commity, diffy) i generowanie propozycji wpisów.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const CHANGELOG_MD_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');
const VERSION_HISTORY_PATH = path.join(ROOT_DIR, 'VERSION_HISTORY.md');
const CHANGELOG_TS_PATH = path.join(ROOT_DIR, 'src', 'constants', 'changelog.ts');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');

/**
 * Pomocnicza funkcja pobierająca aktualną wersję z package.json
 */
function getCurrentAppVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
    return pkg.version || '2.8.40';
  } catch {
    return '2.8.40';
  }
}

/**
 * Dynamiczne załadowanie bazy changeloga z src/constants/changelog.ts
 */
async function loadChangelogEntries() {
  try {
    const module = await import(`file://${CHANGELOG_TS_PATH}?t=${Date.now()}`);
    return {
      entries: module.APP_CHANGELOG || [],
      formatReleaseMarkdown: module.formatReleaseMarkdown
    };
  } catch (err) {
    console.error('⚠️ Nie udało się zaimportować changelog.ts bezpośrednio, używam parsera awaryjnego:', err.message);
    return parseChangelogTsFallback();
  }
}

/**
 * Parser awaryjny dla src/constants/changelog.ts
 */
function parseChangelogTsFallback() {
  const content = fs.readFileSync(CHANGELOG_TS_PATH, 'utf8');
  const match = content.match(/export const APP_CHANGELOG:\s*ReleaseEntry\[\]\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Nie znaleziono tablicy APP_CHANGELOG w src/constants/changelog.ts');
  }
  try {
    // Ewaluacja literału tablicy
    const entries = eval(`(${match[1]})`);
    return {
      entries,
      formatReleaseMarkdown: (entry) => {
        let md = `## [v${entry.version}] — ${entry.date}: ${entry.title}\n\n`;
        if (entry.highlights?.length) {
          md += `### 🌟 Kluczowe Zmiany:\n`;
          entry.highlights.forEach(h => md += `- ${h}\n`);
          md += `\n`;
        }
        return md;
      }
    };
  } catch (e) {
    throw new Error('Błąd parsowania tablicy APP_CHANGELOG: ' + e.message);
  }
}

/**
 * Generowanie pliku CHANGELOG.md na podstawie wszystkich wpisów
 */
async function generateChangelogMarkdown() {
  const { entries } = await loadChangelogEntries();

  let md = `# ☕ Dziennik Zmian — Starbucks Operations Suite (108120 Janki)\n\n`;
  md += `Dokument prowadzony automatycznie przez **Agenta Dziennika Zmian** (\`scripts/changelog-agent.js\`).\n`;
  md += `Zawiera pełną chronologię aktualizacji platformy desktopowej, wprowadzonych funkcji, tarczy Kodeksu Pracy i optymalizacji SQLite.\n\n`;
  md += `---\n\n`;

  for (const entry of entries) {
    md += `## [v${entry.version}] — ${entry.date}: ${entry.title}\n`;
    if (entry.author) {
      md += `*Autor: ${entry.author}*\n\n`;
    } else {
      md += `\n`;
    }

    if (entry.highlights && entry.highlights.length > 0) {
      md += `### 🌟 Główne Atuty Wydania:\n`;
      for (const h of entry.highlights) {
        md += `- **${h}**\n`;
      }
      md += `\n`;
    }

    const features = entry.items.filter(i => i.type === 'feature');
    const enhancements = entry.items.filter(i => i.type === 'enhancement');
    const compliance = entry.items.filter(i => i.type === 'compliance' || i.type === 'database');
    const fixes = entry.items.filter(i => i.type === 'fix');

    if (features.length > 0) {
      md += `### ✨ Nowe Funkcje (Features):\n`;
      features.forEach(f => {
        const mod = f.module && f.module !== 'all' && f.module !== 'system' ? `\`[${f.module}]\` ` : '';
        md += `- ${mod}${f.description}\n`;
      });
      md += `\n`;
    }

    if (enhancements.length > 0) {
      md += `### ⚡ Usprawnienia & Ergonomia (UI/UX):\n`;
      enhancements.forEach(e => {
        const mod = e.module && e.module !== 'all' && e.module !== 'system' ? `\`[${e.module}]\` ` : '';
        md += `- ${mod}${e.description}\n`;
      });
      md += `\n`;
    }

    if (compliance.length > 0) {
      md += `### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:\n`;
      compliance.forEach(c => {
        md += `- ${c.description}\n`;
      });
      md += `\n`;
    }

    if (fixes.length > 0) {
      md += `### 🐛 Poprawki Błędów (Fixes):\n`;
      fixes.forEach(fx => {
        md += `- ${fx.description}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  }

  fs.writeFileSync(CHANGELOG_MD_PATH, md.trim() + '\n', 'utf8');
  console.log(`✅ [Changelog-Agent] Wygenerowano plik CHANGELOG.md (${entries.length} zarejestrowanych wydań).`);

  // Wygeneruj również VERSION_HISTORY.md (Centralne Jedyne Źródło Prawdy w IDE)
  let vh = `# ☕ Starbucks Operations Suite — Centralny Rejestr Historii Wydań i Wersji\n`;
  vh += `> **Plik Główny Projektu (Jedyne Źródło Prawdy):** Ten dokument jest automatycznie aktualizowany przez agenta IDE (\`.agents/skills/version-tracker/\`) przy każdej zmianie, mikropatchu i publikacji wydania.\n\n`;
  vh += `---\n\n`;
  vh += `## 📑 Spis Treści Wydań\n\n`;
  vh += `| Wersja | Data | Tytuł Wydania | Typ | Status |\n`;
  vh += `| :--- | :--- | :--- | :---: | :---: |\n`;
  for (const entry of entries) {
    vh += `| **[v${entry.version}](#v${entry.version.replace(/\\./g, '')}--${entry.date})** | ${entry.date} | ${entry.title} | \`${entry.type}\` | 🚀 Opublikowana |\n`;
  }
  vh += `\n---\n\n`;
  vh += `## Szczegółowa Historia Wydań\n\n`;

  for (const entry of entries) {
    vh += `### [v${entry.version}] — ${entry.date}\n`;
    vh += `**Tytuł:** ${entry.title}  \n`;
    if (entry.author) vh += `**Autorzy:** ${entry.author}  \n`;
    vh += `\n`;

    if (entry.highlights && entry.highlights.length > 0) {
      vh += `#### 🌟 Co Wprowadziliśmy:\n`;
      for (const h of entry.highlights) {
        vh += `- ${h}\n`;
      }
      vh += `\n`;
    }

    const features = entry.items.filter(i => i.type === 'feature');
    const enhancements = entry.items.filter(i => i.type === 'enhancement');
    const compliance = entry.items.filter(i => i.type === 'compliance' || i.type === 'database');
    const fixes = entry.items.filter(i => i.type === 'fix');

    if (features.length > 0) {
      vh += `#### ✨ Nowe Funkcje:\n`;
      features.forEach(f => vh += `- ${f.description}\n`);
      vh += `\n`;
    }
    if (enhancements.length > 0) {
      vh += `#### ⚡ Usprawnienia & Ergonomia:\n`;
      enhancements.forEach(e => vh += `- ${e.description}\n`);
      vh += `\n`;
    }
    if (compliance.length > 0) {
      vh += `#### 🛡️ Kodeks Pracy & Baza SQLite:\n`;
      compliance.forEach(c => vh += `- ${c.description}\n`);
      vh += `\n`;
    }
    if (fixes.length > 0) {
      vh += `#### 🐛 Poprawki Błędów:\n`;
      fixes.forEach(fx => vh += `- ${fx.description}\n`);
      vh += `\n`;
    }
    vh += `---\n\n`;
  }

  vh += `*Rejestr prowadzony przez Agenta Dziennika Zmian (\`.agents/skills/version-tracker/\`). Jednostka: 108120 SBX Warszawa Janki.*\n`;
  fs.writeFileSync(VERSION_HISTORY_PATH, vh.trim() + '\n', 'utf8');
  console.log(`✅ [Changelog-Agent] Zaktualizowano centralny plik VERSION_HISTORY.md.`);
}

/**
 * Zapis nowego wydania do src/constants/changelog.ts oraz CHANGELOG.md
 */
async function recordRelease(newEntry) {
  const { entries } = await loadChangelogEntries();

  // Sprawdź czy wersja już istnieje
  const cleanVer = newEntry.version.replace(/^v/, '');
  const existingIdx = entries.findIndex(e => e.version === cleanVer);

  if (existingIdx >= 0) {
    console.log(`🔄 [Changelog-Agent] Aktualizuję istniejący wpis dla v${cleanVer}`);
    entries[existingIdx] = { ...entries[existingIdx], ...newEntry, version: cleanVer };
  } else {
    console.log(`✨ [Changelog-Agent] Dodaję nowy wpis dla v${cleanVer}`);
    entries.unshift({ ...newEntry, version: cleanVer });
  }

  // Zapisz do src/constants/changelog.ts
  saveEntriesToTs(entries);

  // Zregeneruj CHANGELOG.md
  await generateChangelogMarkdown();

  console.log(`🎉 [Changelog-Agent] Wersja v${cleanVer} została trwale zarejestrowana w bazie zmian!`);
}

/**
 * Pomocniczy zapis sformatowanej tablicy do pliku TS
 */
function saveEntriesToTs(entries) {
  const tsContent = `// src/constants/changelog.ts
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

export const APP_CHANGELOG: ReleaseEntry[] = ${JSON.stringify(entries, null, 2)};

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
  let md = \`## [v\${entry.version}] — \${entry.date}: \${entry.title}\\n\\n\`;

  if (entry.highlights && entry.highlights.length > 0) {
    md += \`### 🌟 Kluczowe Zmiany:\\n\`;
    entry.highlights.forEach((h) => {
      md += \`- \${h}\\n\`;
    });
    md += \`\\n\`;
  }

  const features = entry.items.filter((i) => i.type === 'feature');
  const enhancements = entry.items.filter((i) => i.type === 'enhancement');
  const compliance = entry.items.filter((i) => i.type === 'compliance' || i.type === 'database');
  const fixes = entry.items.filter((i) => i.type === 'fix');

  if (features.length > 0) {
    md += \`### ✨ Nowe Funkcje:\\n\`;
    features.forEach((f) => {
      const modPrefix = f.module && f.module !== 'all' && f.module !== 'system' ? \`**[\${f.module}]** \` : '';
      md += \`- \${modPrefix}\${f.description}\\n\`;
    });
    md += \`\\n\`;
  }

  if (enhancements.length > 0) {
    md += \`### ⚡ Usprawnienia & Optymalizacje:\\n\`;
    enhancements.forEach((e) => {
      const modPrefix = e.module && e.module !== 'all' && e.module !== 'system' ? \`**[\${e.module}]** \` : '';
      md += \`- \${modPrefix}\${e.description}\\n\`;
    });
    md += \`\\n\`;
  }

  if (compliance.length > 0) {
    md += \`### 🛡️ Kodeks Pracy & Baza SQLite:\\n\`;
    compliance.forEach((c) => {
      md += \`- \${c.description}\\n\`;
    });
    md += \`\\n\`;
  }

  if (fixes.length > 0) {
    md += \`### 🐛 Poprawki Błędów:\\n\`;
    fixes.forEach((fx) => {
      md += \`- \${fx.description}\\n\`;
    });
    md += \`\\n\`;
  }

  return md;
}
`;

  fs.writeFileSync(CHANGELOG_TS_PATH, tsContent, 'utf8');
}

/**
 * Automatyczna inspekcja zmian gita od ostatniego tagu i wygenerowanie propozycji
 */
function inspectGitChanges() {
  try {
    const latestTag = execSync('git describe --tags --abbrev=0', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    const commitLogs = execSync(`git log ${latestTag}..HEAD --oneline`, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    const diffStat = execSync(`git diff ${latestTag}..HEAD --stat`, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    
    return {
      latestTag,
      commitLogs: commitLogs ? commitLogs.split('\n') : [],
      diffStat
    };
  } catch (err) {
    return {
      latestTag: 'HEAD',
      commitLogs: [],
      diffStat: ''
    };
  }
}

/**
 * Zwraca notatki najnowszego wydania w formacie markdown (dla GitHub Releases)
 */
async function getLatestReleaseNotes() {
  const { entries } = await loadChangelogEntries();
  if (!entries || entries.length === 0) {
    return 'Brak wpisów w dzienniku zmian.';
  }

  const latest = entries[0];
  let md = `## ☕ Starbucks Operations Suite v${latest.version} — ${latest.title}\n\n`;

  if (latest.highlights?.length) {
    md += `### 🌟 Kluczowe Zmiany:\n`;
    latest.highlights.forEach(h => md += `- ${h}\n`);
    md += `\n`;
  }

  if (latest.items?.length) {
    md += `### 📋 Szczegóły Aktualizacji:\n`;
    latest.items.forEach(item => {
      const icon = item.type === 'feature' ? '✨' : item.type === 'enhancement' ? '⚡' : item.type === 'fix' ? '🐛' : '🛡️';
      md += `- ${icon} ${item.description}\n`;
    });
    md += `\n`;
  }

  md += `*Data wydania: ${latest.date} • Jednostka: 108120 SBX Warszawa Janki*`;
  return md;
}

// ==========================================
// CLI RUNNER
// ==========================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'generate') {
    await generateChangelogMarkdown();
  } else if (command === 'latest-notes') {
    const notes = await getLatestReleaseNotes();
    console.log(notes);
  } else if (command === 'status') {
    const { entries } = await loadChangelogEntries();
    const appVer = getCurrentAppVersion();
    const latest = entries[0];
    console.log(`\n📋 [Changelog-Agent] Status Dziennika Zmian:`);
    console.log(`   - Wersja w package.json: v${appVer}`);
    console.log(`   - Najnowszy zarejestrowany wpis: v${latest?.version || 'brak'} (${latest?.date || 'brak'}) — "${latest?.title || ''}"`);
    console.log(`   - Liczba skatalogowanych wydań: ${entries.length}`);

    const gitChanges = inspectGitChanges();
    if (gitChanges.commitLogs.length > 0) {
      console.log(`\n🔍 Wykryto ${gitChanges.commitLogs.length} nieudokumentowanych commitów od ${gitChanges.latestTag}:`);
      gitChanges.commitLogs.forEach(c => console.log(`     ${c}`));
    } else {
      console.log(`   - Stan: Wszystkie commity od ${gitChanges.latestTag} są zsynchronizowane ✓`);
    }
    console.log(``);
  } else if (command === 'add') {
    // node scripts/changelog-agent.js add --version 2.8.41 --title "Tytuł" --notes "Opis 1; Opis 2"
    let ver = getCurrentAppVersion();
    let title = 'Aktualizacja Operacyjna';
    let notes = [];

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--version' && args[i + 1]) {
        ver = args[i + 1];
        i++;
      } else if (args[i] === '--title' && args[i + 1]) {
        title = args[i + 1];
        i++;
      } else if (args[i] === '--notes' && args[i + 1]) {
        notes = args[i + 1].split(';').map(s => s.trim()).filter(Boolean);
        i++;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const items = notes.map(n => ({
      type: 'enhancement',
      description: n,
      module: 'system'
    }));

    await recordRelease({
      version: ver,
      date: today,
      title,
      type: 'patch',
      author: 'Dawid Apel & Antigravity Agent',
      highlights: notes.slice(0, 3),
      items: items.length > 0 ? items : [{ type: 'enhancement', description: title, module: 'system' }]
    });
  } else {
    console.log(`
Użycie:
  node scripts/changelog-agent.js status       - Wyświetla status dziennika i commity git
  node scripts/changelog-agent.js generate     - Regeneruje CHANGELOG.md z bazy changelog.ts
  node scripts/changelog-agent.js latest-notes - Wypisuje sformatowane notatki dla GitHub Release
  node scripts/changelog-agent.js add          - Dodaje nowe wydanie z parametrami (--version, --title, --notes)
    `);
  }
}

main().catch(err => {
  console.error('❌ Błąd Agenta Changeloga:', err);
  process.exit(1);
});
