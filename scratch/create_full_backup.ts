import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../electron/database/db';
import { BackupManager } from '../electron/database/backupManager';

async function createFullProjectBackup() {
  console.log('================================================================');
  console.log('📦 TWORZENIE PEŁNEJ KOPII ZAPASOWEJ (PROJEKT + BAZA DANYCH)');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolderName = `pre_major_feature_${timestamp}`;
  const targetBackupDir = path.join(rootDir, 'backups', backupFolderName);

  // 1. Kopia bazy danych przez BackupManager
  console.log('--- KROK 1: Kopia zapasowa SQLite przez BackupManager ---');
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();
  const backupManager = BackupManager.getInstance();
  const dbBackupResult = backupManager.createBackup('pre_major_feature');
  console.log(`✅ Utworzono kopię bazy SQLite w backups/db_backups/:`);
  console.log(`   Plik: ${dbBackupResult.filename} (${(dbBackupResult.sizeBytes / 1024).toFixed(1)} KB)\n`);

  // 2. Kopia całego kodu źródłowego i bazy do katalogu snapshotu
  console.log(`--- KROK 2: Kopia snapshotowa całego projektu w ${targetBackupDir} ---`);
  fs.mkdirSync(targetBackupDir, { recursive: true });

  const itemsToCopy = [
    { src: 'src', dest: 'src', isDir: true },
    { src: 'electron', dest: 'electron', isDir: true },
    { src: 'desktop_app_blueprint', dest: 'desktop_app_blueprint', isDir: true },
    { src: 'data/tplh_forecast.db', dest: 'tplh_forecast.db', isDir: false },
    { src: 'package.json', dest: 'package.json', isDir: false },
    { src: 'package-lock.json', dest: 'package-lock.json', isDir: false },
    { src: 'tsconfig.json', dest: 'tsconfig.json', isDir: false },
    { src: 'tsconfig.node.json', dest: 'tsconfig.node.json', isDir: false },
    { src: 'vite.config.ts', dest: 'vite.config.ts', isDir: false },
    { src: 'index.html', dest: 'index.html', isDir: false },
    { src: 'AGENTS.md', dest: 'AGENTS.md', isDir: false },
    { src: 'README.md', dest: 'README.md', isDir: false }
  ];

  let totalFilesCopied = 0;
  let totalBytesCopied = 0;

  function copyRecursive(source: string, destination: string) {
    if (!fs.existsSync(source)) return;
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      fs.mkdirSync(destination, { recursive: true });
      const children = fs.readdirSync(source);
      for (const child of children) {
        copyRecursive(path.join(source, child), path.join(destination, child));
      }
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      totalFilesCopied++;
      totalBytesCopied += stat.size;
    }
  }

  for (const item of itemsToCopy) {
    const srcPath = path.join(rootDir, item.src);
    const destPath = path.join(targetBackupDir, item.dest);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, destPath);
      console.log(`  ✓ Skopiowano: ${item.src} -> ${item.dest}`);
    } else {
      console.log(`  ⚠️ Pominięto (brak pliku): ${item.src}`);
    }
  }

  // 3. Utworzenie pliku README / manifestu w folderze backupu
  const manifestContent = `# Kopia Zapasowa Projektu: Starbucks Operations Suite
- **Data i godzina**: ${new Date().toLocaleString('pl-PL')}
- **Sygnatura znacznika**: ${timestamp}
- **Powód**: Pre-major feature snapshot (przed wdrożeniem dużej funkcjonalności)
- **Liczba skopiowanych plików**: ${totalFilesCopied}
- **Łączny rozmiar danych**: ${(totalBytesCopied / (1024 * 1024)).toFixed(2)} MB
- **Kopia SQLite w rejestrze db_backups**: \`${dbBackupResult.filename}\`

## Zawartość kopii:
1. \`src/\` — cały kod frontendu obu modułów (Labor Forecast + Managers Schedule), komponenty, serwisy, algorytmy i typy.
2. \`electron/\` — kod Electrona, handlery IPC, menedżer bazy danych, menedżer backupów, parser MAPAL Fichajes.
3. \`tplh_forecast.db\` — pełny zrzut bazy SQLite z wszystkimi 9 miesiącami 2026, składami autorskimi i zmianami.
4. \`desktop_app_blueprint/\` — schematy bazy danych i seedy.
5. Pliki konfiguracyjne: \`package.json\`, \`tsconfig.json\`, \`vite.config.ts\`, \`AGENTS.md\`, \`README.md\`.

## Instrukcja przywrócenia (Rollback):
W razie potrzeby natychmiastowego przywrócenia stanu przed zmianami:
1. Nadpisz katalogi \`src/\` oraz \`electron/\` zawartością z tego folderu.
2. Nadpisz \`data/tplh_forecast.db\` plikiem \`tplh_forecast.db\` z tego folderu (lub przywróć przez interfejs w DatabaseBackupModal).
`;

  fs.writeFileSync(path.join(targetBackupDir, 'BACKUP_INFO.md'), manifestContent, 'utf-8');
  console.log(`  ✓ Utworzono manifest: BACKUP_INFO.md\n`);

  console.log('================================================================');
  console.log(`🎉 KOPIA ZAPASOWA UKOŃCZONA SUKCESEM!`);
  console.log(`📁 Lokalizacja: backups/${backupFolderName}/`);
  console.log(`📊 Skopiowano ${totalFilesCopied} plików (${(totalBytesCopied / (1024 * 1024)).toFixed(2)} MB).`);
  console.log(`🗄️ Baza SQLite: ${dbBackupResult.filename}`);
  console.log('================================================================');
}

createFullProjectBackup().catch(err => {
  console.error('Błąd podczas tworzenia backupu:', err);
  process.exit(1);
});
