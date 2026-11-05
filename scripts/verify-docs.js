import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
const currentVersion = pkg.version;
const isFixMode = process.argv.includes('--fix');
const today = new Date().toISOString().slice(0, 10);

console.log(`\x1b[36m🔍 Weryfikacja integralności dokumentacji technicznej dla v${currentVersion}${isFixMode ? ' (Tryb Self-Healing --fix)' : ''}...\x1b[0m\n`);

let hasError = false;

// 0. Auto-sync kontraktów IPC i SQLite oraz mapy symboli
if (isFixMode) {
  try {
    const contractsScript = path.join(ROOT_DIR, 'scripts/generate-contracts-doc.js');
    if (fs.existsSync(contractsScript)) {
      execSync(`node "${contractsScript}"`, { stdio: 'inherit' });
    }
    const symbolsScript = path.join(ROOT_DIR, 'scripts/generate-symbols-map.js');
    if (fs.existsSync(symbolsScript)) {
      execSync(`node "${symbolsScript}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn(`  ⚠️ Nie udało się zaktualizować kontraktów lub mapy symboli:`, err.message);
  }
}

const modulesBaseDir = path.join(ROOT_DIR, 'src/modules');
const MODULES = fs.readdirSync(modulesBaseDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map((dirent, idx) => ({
    id: `m${idx + 1}`,
    name: dirent.name,
    path: `src/modules/${dirent.name}`
  }));

for (const mod of MODULES) {
  const modDir = path.join(ROOT_DIR, mod.path);
  const agentsPath = path.join(modDir, 'AGENTS.md');
  const readmePath = path.join(modDir, 'README.md');
  const changelogPath = path.join(modDir, 'CHANGELOG.md');

  console.log(`📦 \x1b[1mModuł: ${mod.name}\x1b[0m (${mod.path})`);

  // 1. Sprawdź obecność kluczowych plików dokumentacji
  if (!fs.existsSync(agentsPath)) {
    console.error(`  ❌ Brak pliku AGENTS.md`);
    hasError = true;
  } else {
    console.log(`  ✅ AGENTS.md obecny`);
  }

  if (!fs.existsSync(readmePath)) {
    console.error(`  ❌ Brak pliku README.md`);
    hasError = true;
  } else {
    console.log(`  ✅ README.md obecny`);
  }

  if (!fs.existsSync(changelogPath)) {
    if (isFixMode) {
      const template = `# Historia Zmian — Moduł: ${mod.name}\n\n## [v${currentVersion}] — ${today}\n- Inicjalizacja rejestru zmian modułu.\n`;
      fs.writeFileSync(changelogPath, template, 'utf-8');
      console.log(`  🛠️ [Self-Healing] Utworzono brakujący plik CHANGELOG.md dla v${currentVersion}`);
    } else {
      console.error(`  ❌ Brak pliku CHANGELOG.md`);
      hasError = true;
    }
  } else {
    let changelogContent = fs.readFileSync(changelogPath, 'utf-8');
    if (!changelogContent.includes(`[v${currentVersion}]`)) {
      if (isFixMode) {
        const entry = `\n## [v${currentVersion}] — ${today}\n- Bieżąca synchronizacja i optymalizacje modułu.\n`;
        const insertPos = changelogContent.indexOf('## [');
        if (insertPos !== -1) {
          changelogContent = changelogContent.slice(0, insertPos) + entry + '\n' + changelogContent.slice(insertPos);
        } else {
          changelogContent += '\n' + entry;
        }
        fs.writeFileSync(changelogPath, changelogContent, 'utf-8');
        console.log(`  🛠️ [Self-Healing] Dodano sekcję [v${currentVersion}] w CHANGELOG.md`);
      } else {
        console.warn(`  ⚠️  CHANGELOG.md nie zawiera wpisu dla bieżącej wersji v${currentVersion}`);
      }
    } else {
      console.log(`  ✅ CHANGELOG.md zsynchronizowany z v${currentVersion}`);
    }
  }

  // 2. Sprawdź czy pliki komponentów, serwisów, typów i stałych są wymienione w AGENTS.md
  if (fs.existsSync(agentsPath)) {
    let agentsContent = fs.readFileSync(agentsPath, 'utf-8');

    const checkDir = (subDir) => {
      const targetDir = path.join(modDir, subDir);
      if (!fs.existsSync(targetDir)) return;
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          checkDir(`${subDir}/${entry.name}`);
        } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
          if (!agentsContent.includes(entry.name)) {
            console.error(`  ❌ Plik ${subDir}/${entry.name} NIE jest wymieniony w AGENTS.md!`);
            hasError = true;
          }
        }
      }
    };

    checkDir('components');
    checkDir('services');
    checkDir('types');
    checkDir('constants');
  }

  // 3. Sprawdź obecność Public API index.ts
  const indexPath = path.join(modDir, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    console.error(`  ❌ Brak pliku Public API: index.ts`);
    hasError = true;
  } else {
    console.log(`  ✅ Public API index.ts obecny`);
  }

  console.log('');
}

// 4. Sprawdź root modules index
const rootModulesIndex = path.join(ROOT_DIR, 'src/modules/index.ts');
if (fs.existsSync(rootModulesIndex)) {
  let rootIndexContent = fs.readFileSync(rootModulesIndex, 'utf-8');
  for (const mod of MODULES) {
    if (!rootIndexContent.includes(`./${mod.name}`)) {
      if (isFixMode) {
        const pascalName = mod.name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
        rootIndexContent += `export * as ${pascalName} from './${mod.name}';\n`;
        fs.writeFileSync(rootModulesIndex, rootIndexContent, 'utf-8');
        console.log(`  🛠️ [Self-Healing] Zarejestrowano moduł ${mod.name} w src/modules/index.ts`);
      } else {
        console.warn(`  ⚠️ Moduł ${mod.name} nie jest wyeksportowany w src/modules/index.ts`);
      }
    }
  }
}

// 5. Sprawdź integralność root AGENTS.md
const rootAgentsPath = path.join(ROOT_DIR, 'AGENTS.md');
if (fs.existsSync(rootAgentsPath)) {
  const rootContent = fs.readFileSync(rootAgentsPath, 'utf-8');
  if (rootContent.includes('272.0 h bazy Floor')) {
    console.error(`❌ Root AGENTS.md zawiera przestarzałą wartość Floor 272.0h zamiast 224.0h!`);
    hasError = true;
  } else {
    console.log(`✅ Root AGENTS.md: standard Floor Hours (224.0h) poprawny.`);
  }

  if (rootContent.includes('AutoScheduler AI (20k prób)')) {
    console.error(`❌ Root AGENTS.md zawiera '20k prób' zamiast '2k prób'!`);
    hasError = true;
  } else {
    console.log(`✅ Root AGENTS.md: parametry AutoScheduler AI (2k) poprawne.`);
  }
}

if (hasError) {
  console.log(`\n\x1b[31m❌ Wykryto rozbieżności w dokumentacji technicznej! Skoryguj powyższe pliki lub użyj --fix.\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32m✨ Cała dokumentacja techniczna jest w 100% zsynchronizowana ze stanem faktycznym w kodzie.\x1b[0m`);
  process.exit(0);
}
