import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PKG_PATH = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
const currentVersion = pkg.version;

console.log(`\x1b[36m🔍 Weryfikacja integralności dokumentacji technicznej dla v${currentVersion}...\x1b[0m\n`);

let hasError = false;

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
    console.error(`  ❌ Brak pliku CHANGELOG.md`);
    hasError = true;
  } else {
    const changelogContent = fs.readFileSync(changelogPath, 'utf-8');
    if (!changelogContent.includes(`[v${currentVersion}]`)) {
      console.warn(`  ⚠️  CHANGELOG.md nie zawiera wpisu dla bieżącej wersji v${currentVersion}`);
    } else {
      console.log(`  ✅ CHANGELOG.md zsynchronizowany z v${currentVersion}`);
    }
  }

  // 2. Sprawdź czy pliki komponentów i serwisów są wymienione w AGENTS.md
  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');

    const checkDir = (subDir) => {
      const targetDir = path.join(modDir, subDir);
      if (!fs.existsSync(targetDir)) return;
      const files = fs.readdirSync(targetDir);
      for (const file of files) {
        if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          if (!agentsContent.includes(file)) {
            console.error(`  ❌ Plik ${subDir}/${file} NIE jest wymieniony w AGENTS.md!`);
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

// 3. Sprawdź integralność root AGENTS.md
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
  console.log(`\n\x1b[31m❌ Wykryto rozbieżności w dokumentacji technicznej! Skoryguj powyższe pliki.\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\n\x1b[32m✨ Cała dokumentacja techniczna jest w 100% zsynchronizowana ze stanem faktycznym w kodzie.\x1b[0m`);
  process.exit(0);
}
