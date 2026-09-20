import path from 'path';
import fs from 'fs';
import { DatabaseManager } from '../electron/database/db';
import { BackupManager } from '../electron/database/backupManager';

async function run() {
  console.log('🧪 Rozpoczynam weryfikację systemu backupów SQLite...');

  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  const backupManager = BackupManager.getInstance();

  // 1. Status początkowy
  const initialStatus = backupManager.getDatabaseStatus();
  console.log('1. Początkowy status bazy danych:', {
    dbPath: initialStatus.dbPath,
    exists: initialStatus.exists,
    sizeKB: (initialStatus.sizeBytes / 1024).toFixed(1),
    backupsCount: initialStatus.backupsCount,
  });

  if (!initialStatus.exists) {
    throw new Error('Baza danych nie istnieje na dysku!');
  }

  // 2. Utworzenie testowego backupu
  const backupRes = backupManager.createBackup('test_verification');
  console.log('2. Wynik tworzenia backupu:', {
    success: backupRes.success,
    filename: backupRes.filename,
    sizeKB: (backupRes.sizeBytes / 1024).toFixed(1),
    reason: backupRes.reason
  });

  if (!backupRes.success || !fs.existsSync(backupRes.filePath)) {
    throw new Error(`Plik backupu nie został poprawnie zapisany: ${backupRes.filePath}`);
  }

  // 3. Sprawdzenie listy backupów
  const backupsList = backupManager.listBackups();
  console.log(`3. Liczba znalezionych kopii zapasowych: ${backupsList.length}`);
  const found = backupsList.find(b => b.filename === backupRes.filename);
  if (!found) {
    throw new Error('Utworzony backup nie znajduje się na liście listBackups()!');
  }
  console.log('   Znaleziono nową kopię:', found.filename, `(${found.formattedDate}, ${found.reason})`);

  // 4. Test statusu po backupie
  const updatedStatus = backupManager.getDatabaseStatus();
  console.log('4. Zaktualizowany status bazy danych:', {
    backupsCount: updatedStatus.backupsCount,
    latestBackup: updatedStatus.latestBackup?.filename
  });

  console.log('\n✅ WSZYSTKIE TESTY SYSTEMU BACKUPÓW SQLITE ZAKOŃCZONE SUKCESEM!');
}

run().catch(err => {
  console.error('❌ Błąd weryfikacji backupów:', err);
  process.exit(1);
});
