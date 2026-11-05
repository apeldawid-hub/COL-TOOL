import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PRELOAD_PATH = path.join(ROOT_DIR, 'electron/preload.ts');
const DB_PATH = path.join(ROOT_DIR, 'electron/database/db.ts');
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/IPC_AND_SCHEMA.md');

console.log('\x1b[36m🔄 [Self-Healing] Generowanie kontraktów IPC i schematu bazy SQLite...\x1b[0m');

// 1. Ekstrakcja metod z IElectronAPI w preload.ts
let ipcMethods = [];
if (fs.existsSync(PRELOAD_PATH)) {
  const preloadContent = fs.readFileSync(PRELOAD_PATH, 'utf-8');
  const apiMatch = preloadContent.match(/export interface IElectronAPI \{([\s\S]*?)\n\}/);
  if (apiMatch) {
    const rawBody = apiMatch[1];
    const lines = rawBody.split('\n');
    let currentComment = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) {
        currentComment = trimmed.replace(/^\/\/\s*/, '');
      } else if (trimmed && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        const methodMatch = trimmed.match(/^([a-zA-Z0-9_]+)(\??)\s*:\s*(.+);?$/);
        if (methodMatch) {
          ipcMethods.push({
            name: methodMatch[1],
            optional: !!methodMatch[2],
            signature: methodMatch[3].replace(/;$/, ''),
            comment: currentComment
          });
          currentComment = '';
        }
      }
    }
  }
}

// 2. Ekstrakcja tabel z electron/database/db.ts
let tables = [];
if (fs.existsSync(DB_PATH)) {
  const dbContent = fs.readFileSync(DB_PATH, 'utf-8');
  const tableMatches = [...dbContent.matchAll(/CREATE TABLE IF NOT EXISTS ([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/g)];

  for (const match of tableMatches) {
    const tableName = match[1];
    const rawColumns = match[2].trim();
    const columns = rawColumns
      .split('\n')
      .map(col => col.trim().replace(/,$/, ''))
      .filter(col => col && !col.startsWith('--'));

    tables.push({
      name: tableName,
      columns
    });
  }
}

// 3. Generowanie dokumentu Markdown
const now = new Date().toISOString();
const mdContent = `# ⚡ Samonaprawialny Rejestr Kontraktów IPC i Tabel SQLite
> **Plik generowany automatycznie przez \`scripts/generate-contracts-doc.js\`**  
> Ostatnia synchronizacja: \`${now}\` (Zawsze zgodny ze stanem faktycznym w kodzie).

---

## 📡 1. Kontrakty Mostu IPC (\`window.api.*\` — \`IElectronAPI\`)
Łącznie wykrytych metod IPC w \`electron/preload.ts\`: **${ipcMethods.length}**.

| Metoda IPC | Opcjonalna | Podpis Typu | Kategoria / Uwagi |
| :--- | :---: | :--- | :--- |
${ipcMethods.map(m => `| \`window.api.${m.name}\` | ${m.optional ? 'Tak' : 'Nie'} | \`${m.signature.replace(/\|/g, '\\|')}\` | ${m.comment || '—'} |`).join('\n')}

---

## 🗄️ 2. Schemat Tabel Bazy SQLite (\`store_\${safeId}.db\`)
Łącznie wykrytych tabel w \`electron/database/db.ts\`: **${tables.length}**.

${tables.map(t => `### Tabela: \`${t.name}\`
\`\`\`sql
CREATE TABLE IF NOT EXISTS ${t.name} (
${t.columns.map(c => `  ${c}`).join(',\n')}
);
\`\`\`
`).join('\n')}
`;

fs.writeFileSync(OUTPUT_PATH, mdContent, 'utf-8');
console.log(`\x1b[32m✅ Wygenerowano docs/IPC_AND_SCHEMA.md (${ipcMethods.length} metod IPC, ${tables.length} tabel SQLite)\x1b[0m\n`);
