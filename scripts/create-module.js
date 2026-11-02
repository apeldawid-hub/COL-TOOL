import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`\x1b[33mUżycie: npm run create:module <kebab-case-name> ["Tytuł Modułu"]\x1b[0m`);
  console.log(`Przykład: npm run create:module inventory "Inventory & Waste Tracker"`);
  process.exit(1);
}

const rawName = args[0].toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
const displayName = args[1] || rawName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

// Helpers do nazw
const toPascalCase = (str) => str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
const toCamelCase = (str) => {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const pascalName = toPascalCase(rawName);
const camelName = toCamelCase(rawName);

const targetDir = path.join(ROOT_DIR, 'src/modules', rawName);

if (fs.existsSync(targetDir)) {
  console.error(`\x1b[31mBłąd: Moduł "${rawName}" już istnieje w ${targetDir}!\x1b[0m`);
  process.exit(1);
}

const pkgPath = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;
const today = new Date().toISOString().slice(0, 10);

console.log(`\x1b[36m🚀 Generowanie nowego modułu: ${displayName} (${rawName}) w wersji v${currentVersion}...\x1b[0m\n`);

// 1. Tworzenie folderów
fs.mkdirSync(path.join(targetDir, 'components'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'services'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'types'), { recursive: true });
fs.mkdirSync(path.join(targetDir, 'constants'), { recursive: true });

// 1b. constants/index.ts
const constantsContent = `// src/modules/${rawName}/constants/index.ts

export const ${rawName.toUpperCase().replace(/-/g, '_')}_DEFAULT_STATUS = 'ACTIVE';
`;
fs.writeFileSync(path.join(targetDir, 'constants/index.ts'), constantsContent, 'utf-8');

// 2. types/index.ts
const typesContent = `// src/modules/${rawName}/types/index.ts

export interface ${pascalName}Item {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ${pascalName}State {
  items: ${pascalName}Item[];
  isLoading: boolean;
  error: string | null;
}
`;
fs.writeFileSync(path.join(targetDir, 'types/index.ts'), typesContent, 'utf-8');

// 3. services/{camelName}Engine.ts
const engineContent = `// src/modules/${rawName}/services/${camelName}Engine.ts
import type { ${pascalName}Item } from '../types';

export class ${pascalName}Engine {
  /**
   * Oblicza podstawowe statystyki modułu
   */
  public static calculateSummary(items: ${pascalName}Item[]) {
    return {
      totalCount: items.length,
      lastUpdated: new Date().toISOString()
    };
  }
}
`;
fs.writeFileSync(path.join(targetDir, `services/${camelName}Engine.ts`), engineContent, 'utf-8');

// 4. components/{pascalName}View.tsx
const viewContent = `// src/modules/${rawName}/components/${pascalName}View.tsx
import React, { useState } from 'react';
import type { ${pascalName}Item } from '../types';
import { ${pascalName}Engine } from '../services/${camelName}Engine';

export const ${pascalName}View: React.FC = () => {
  const [items] = useState<${pascalName}Item[]>([]);
  const summary = ${pascalName}Engine.calculateSummary(items);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">${displayName}</h1>
          <p className="text-sm text-stone-500 font-medium">Autonomiczny moduł operacyjny Starbucks Operations Suite</p>
        </div>
        <div className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
          Aktywny
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Liczba Elementów</span>
          <p className="text-3xl font-black text-stone-900 mt-2">{summary.totalCount}</p>
        </div>
      </div>
    </div>
  );
};
`;
fs.writeFileSync(path.join(targetDir, `components/${pascalName}View.tsx`), viewContent, 'utf-8');

// 5. index.ts (Barrel export)
const barrelContent = `// src/modules/${rawName}/index.ts

export * from './types';
export * from './constants';
export * from './services/${camelName}Engine';
export * from './components/${pascalName}View';
`;
fs.writeFileSync(path.join(targetDir, 'index.ts'), barrelContent, 'utf-8');

// 5b. Rejestracja w src/modules/index.ts
const rootModulesIndexPath = path.join(ROOT_DIR, 'src/modules/index.ts');
if (fs.existsSync(rootModulesIndexPath)) {
  const rootIndexContent = fs.readFileSync(rootModulesIndexPath, 'utf-8');
  const exportLine = `export * as ${pascalName} from './${rawName}';\n`;
  if (!rootIndexContent.includes(`./${rawName}`)) {
    fs.appendFileSync(rootModulesIndexPath, exportLine, 'utf-8');
    console.log(`\x1b[32m   - Rejestracja: Dodano do src/modules/index.ts\x1b[0m`);
  }
}

// 6. CHANGELOG.md
const changelogContent = `# Historia Zmian — Moduł: ${displayName}

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module ${displayName}.

---

## [v${currentVersion}] — ${today}
- **Inicjalizacja Modułu**: Utworzenie bazowej struktury katalogów (\`components/\`, \`services/\`, \`types/\`).
- **Warstwa Prezentacji**: Dodano widok główny \`${pascalName}View.tsx\`.
- **Silnik Obliczeniowy**: Dodano \`${camelName}Engine.ts\`.
- **Reguła Auto-Sync**: Wdrożenie bezwzględnej reguły ciągłej aktualizacji dokumentacji po modyfikacjach.
`;
fs.writeFileSync(path.join(targetDir, 'CHANGELOG.md'), changelogContent, 'utf-8');

// 7. README.md
const readmeContent = `# Moduł: ${displayName}

Autonomiczny moduł platformy **Starbucks Operations Suite**.

---

## 🎯 Główne Funkcjonalności
1. **Zarządzanie Danymi**: Przetwarzanie i persystencja w bazie SQLite (\`store_\${safeId}.db\`).
2. **Kalkulacje Operacyjne**: Dedykowany silnik \`${pascalName}Engine\`.

---

## 📦 Struktura
- \`components/${pascalName}View.tsx\` — Główny widok modułu.
- \`services/${camelName}Engine.ts\` — Logika domenowa i obliczenia.
- \`types/index.ts\` — Interfejsy TypeScript.

---

👉 Pełna historia wydań modułu: **[CHANGELOG.md](./CHANGELOG.md)** | Specyfikacja techniczna: **[AGENTS.md](./AGENTS.md)**
`;
fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');

// 8. AGENTS.md
const agentsContent = `# AGENTS.md — Instrukcje Agenta dla Modułu: ${displayName}

Dokument definiuje kontekst domenowy, strukturę plików, logikę obliczeniową i reguły biznesowe dla modułu **${displayName}**.

---

## ☕ 1. Kontekst Domenowy i Biznesowy
- **Status modułu**: 🟢 **v${currentVersion} Active**
- **Cel modułu**: Wsparcie Store Managera (SM) w procesie: ${displayName}.
- **Architektura**: Multi-Store Fleet (baza \`store_\${safeId}.db\`).

---

## 📁 2. Struktura Plików Modułu (\`src/modules/${rawName}/\`)

\`\`\`
src/modules/${rawName}/
├── types/
│   └── index.ts                     # Interfejsy TypeScript modułu
├── constants/
│   └── index.ts                     # Stałe domenowe i konfiguracyjne modułu
├── components/
│   └── ${pascalName}View.tsx             # Główny widok modułu
├── services/
│   └── ${camelName}Engine.ts            # Główny silnik obliczeniowy modułu
├── index.ts                         # Barrel export modułu (Public API)
├── CHANGELOG.md                     # Dedykowana historia zmian i wydań
├── AGENTS.md                        # Niniejsze instrukcje techniczne agenta
└── README.md                        # Dokumentacja użytkowa modułu
\`\`\`

---

## 🧮 3. Algorytmy Domenowe (\`services/${camelName}Engine.ts\`)
Podstawowa logika agregacji i walidacji danych.

---

## 📝 4. Reguła Bezwzględnej Synchronizacji Dokumentacji (Documentation Auto-Sync)
Po każdej modyfikacji kodu źródłowego, komponentów lub serwisów w Module ${displayName}:
1. Natychmiast zaktualizuj niniejszy plik \`AGENTS.md\` (drzewo plików, algorytmy).
2. Zarejestruj wpis w dedykowanej historii zmian: \`src/modules/${rawName}/CHANGELOG.md\`.
3. Zsynchronizuj nadrzędny rejestr wydań \`VERSION_HISTORY.md\` przy publikacji wydania/patcha.
`;
fs.writeFileSync(path.join(targetDir, 'AGENTS.md'), agentsContent, 'utf-8');

console.log(`\x1b[32m✅ Sukces! Pomyślnie wygenerowano moduł "${rawName}" w src/modules/${rawName}/\x1b[0m`);
console.log(`\x1b[32m   - Komponenty: src/modules/${rawName}/components/${pascalName}View.tsx\x1b[0m`);
console.log(`\x1b[32m   - Serwis:     src/modules/${rawName}/services/${camelName}Engine.ts\x1b[0m`);
console.log(`\x1b[32m   - Typy:       src/modules/${rawName}/types/index.ts\x1b[0m`);
console.log(`\x1b[32m   - AGENTS.md:  src/modules/${rawName}/AGENTS.md (Z regułą Auto-Sync)\x1b[0m`);
console.log(`\x1b[32m   - CHANGELOG:  src/modules/${rawName}/CHANGELOG.md (Dla v${currentVersion})\x1b[0m`);
console.log(`\x1b[32m   - README.md:  src/modules/${rawName}/README.md\x1b[0m`);
console.log(`\nUruchom \x1b[36mnpm run verify:docs\x1b[0m, aby sprawdzić integralność.`);
