import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/SYMBOLS_MAP.json');

console.log('\x1b[36m🔍 [Symbols-Map] Generowanie indeksu symboli i eksportów...\x1b[0m');

const targetDirs = [
  path.join(ROOT_DIR, 'src/modules'),
  path.join(ROOT_DIR, 'src/services'),
  path.join(ROOT_DIR, 'src/types'),
  path.join(ROOT_DIR, 'src/context'),
  path.join(ROOT_DIR, 'src/constants'),
  path.join(ROOT_DIR, 'electron/database')
];

const symbolsMap = {};

function scanFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Wykrywanie: export [class|function|interface|type|const|enum] Name
    const match = trimmed.match(/^export\s+(?:abstract\s+)?(class|function|interface|type|const|enum)\s+([a-zA-Z0-9_]+)/);
    if (match) {
      const kind = match[1];
      const name = match[2];

      // Ignoruj prywatne lub specyficzne wewnętrzne stałe
      if (!name.startsWith('_')) {
        symbolsMap[name] = {
          file: relativePath,
          line: lineNum,
          kind
        };
      }
    }
  });
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'dist-electron') {
        walkDir(fullPath);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (!entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
        scanFile(fullPath);
      }
    }
  }
}

for (const dir of targetDirs) {
  walkDir(dir);
}

// Posortuj klucze alfabetycznie dla stabilnego diffu
const sortedMap = Object.keys(symbolsMap).sort().reduce((acc, key) => {
  acc[key] = symbolsMap[key];
  return acc;
}, {});

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sortedMap, null, 2), 'utf-8');
const symbolCount = Object.keys(sortedMap).length;
console.log(`\x1b[32m✅ Wygenerowano docs/SYMBOLS_MAP.json (${symbolCount} zindeksowanych symboli)\x1b[0m\n`);
