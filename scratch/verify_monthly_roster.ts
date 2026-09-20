import { DatabaseManager } from '../electron/database/db';
import { TorEngine } from '../src/modules/managers-schedule/services/torEngine';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 TEST: Weryfikacja Autonomicznego Składu Miesięcznego Menedżerów');
  console.log('================================================================\n');

  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  // 1. Sprawdzenie składu na Lipiec 2026 (powinno być 8 menedżerów, w tym Hanna Domachowska, Dawid Apel SSV)
  console.log('--- KROK 1: Skład na Lipiec 2026 (2026-07) ---');
  const julyRoster = dbManager.getMonthlyRoster(2026, 7);
  console.log(`Liczba menedżerów w lipcu: ${julyRoster.length} (Oczekiwano: 8)`);
  const hannaJuly = julyRoster.find(e => e.name.toLowerCase().includes('hanna'));
  const dawidJuly = julyRoster.find(e => e.name.toLowerCase().includes('dawid apel'));
  console.log(`- Hanna Domachowska w lipcu: ${hannaJuly ? `Obecna (${hannaJuly.role}, etat ${hannaJuly.contract_hours_ratio})` : 'BRAK!'}`);
  console.log(`- Dawid Apel w lipcu: ${dawidJuly ? `${dawidJuly.role} (etat ${dawidJuly.contract_hours_ratio})` : 'BRAK!'}`);

  if (julyRoster.length !== 8 || !hannaJuly || !dawidJuly || dawidJuly.role !== 'SSV') {
    throw new Error('BŁĄD w Lipcu 2026!');
  }
  console.log('✅ Krok 1 zakończony sukcesem.\n');

  // 2. Sprawdzenie składu na Sierpień 2026 (powinno być 8 menedżerów, w tym Hanna Domachowska, Dawid Apel ASM)
  console.log('--- KROK 2: Skład na Sierpień 2026 (2026-08) ---');
  const augustRoster = dbManager.getMonthlyRoster(2026, 8);
  console.log(`Liczba menedżerów w sierpniu: ${augustRoster.length} (Oczekiwano: 8)`);
  const hannaAug = augustRoster.find(e => e.name.toLowerCase().includes('hanna'));
  const dawidAug = augustRoster.find(e => e.name.toLowerCase().includes('dawid apel'));
  console.log(`- Hanna Domachowska w sierpniu: ${hannaAug ? `Obecna (${hannaAug.role}, etat ${hannaAug.contract_hours_ratio})` : 'BRAK!'}`);
  console.log(`- Dawid Apel w sierpniu: ${dawidAug ? `${dawidAug.role} (etat ${dawidAug.contract_hours_ratio})` : 'BRAK!'}`);

  if (augustRoster.length !== 8 || !hannaAug || !dawidAug || !dawidAug.role.includes('ASSISTANT')) {
    throw new Error('BŁĄD w Sierpniu 2026!');
  }
  console.log('✅ Krok 2 zakończony sukcesem.\n');

  // 3. Sprawdzenie składu na Wrzesień 2026 (powinno być 7 menedżerów, Hanna Domachowska odeszła)
  console.log('--- KROK 3: Skład na Wrzesień 2026 (2026-09) ---');
  const septRoster = dbManager.getMonthlyRoster(2026, 9);
  console.log(`Liczba menedżerów we wrześniu: ${septRoster.length} (Oczekiwano: 7)`);
  const hannaSept = septRoster.find(e => e.name.toLowerCase().includes('hanna'));
  console.log(`- Hanna Domachowska we wrześniu: ${hannaSept ? 'Nadal widnieje (BŁĄD)' : 'Brak (PRAWIDŁOWO - odeszła ze sklepu)'}`);

  if (septRoster.length !== 7 || hannaSept) {
    throw new Error('BŁĄD we Wrześniu 2026: Hanna powinna być wyłączona ze składu na wrzesień!');
  }
  console.log('✅ Krok 3 zakończony sukcesem.\n');

  // 4. Sprawdzenie automatycznego dziedziczenia dla nowego miesiąca (Październik 2026)
  console.log('--- KROK 4: Automatyczne dziedziczenie składu dla Października 2026 (2026-10) ---');
  // Usunięcie ewentualnego istniejącego rekordu testowego na październik
  const db = dbManager.getDb();
  db.run("DELETE FROM manager_monthly_roster WHERE year = 2026 AND month = 10");

  const octRoster = dbManager.getMonthlyRoster(2026, 10);
  console.log(`Liczba menedżerów w nowo otwieranym październiku: ${octRoster.length} (Pobrano z września: 7)`);
  if (octRoster.length !== 7) {
    throw new Error('BŁĄD: Październik nie odziedziczył prawidłowo 7 menedżerów z września!');
  }
  console.log('✅ Krok 4 zakończony sukcesem.\n');

  // 5. Modyfikacja składu w październiku bez propagacji - czy wrzesień i sierpień pozostają nietknięte?
  console.log('--- KROK 5: Izolacja zmian bez propagacji ---');
  const modifiedOct = octRoster.filter(e => !e.name.toLowerCase().includes('kamil')); // Symulacja odejścia Kamila w październiku
  dbManager.saveMonthlyRoster(2026, 10, modifiedOct, false);

  const octAfterSave = dbManager.getMonthlyRoster(2026, 10);
  const septAfterOctChange = dbManager.getMonthlyRoster(2026, 9);

  console.log(`Liczba menedżerów w październiku po zmianie: ${octAfterSave.length} (Oczekiwano: 6)`);
  console.log(`Liczba menedżerów we wrześniu po zmianie w październiku: ${septAfterOctChange.length} (Oczekiwano: 7)`);

  if (octAfterSave.length !== 6 || septAfterOctChange.length !== 7) {
    throw new Error('BŁĄD izolacji: zmiana w październiku naruszyła skład z września!');
  }
  console.log('✅ Krok 5 zakończony sukcesem: Modyfikacja składu jest w 100% izolowana per miesiąc.\n');

  // Przywrócenie października przez skopiowanie z września
  console.log('--- KROK 6: Kopiowanie składu z poprzedniego miesiąca (copyRosterFromPreviousMonth) ---');
  const octRestored = dbManager.copyRosterFromPreviousMonth(2026, 10);
  console.log(`Liczba menedżerów po copyRosterFromPreviousMonth: ${octRestored.length} (Oczekiwano: 7)`);
  if (octRestored.length !== 7) {
    throw new Error('BŁĄD kopiowania z poprzedniego miesiąca!');
  }
  console.log('✅ Krok 6 zakończony sukcesem.\n');

  // 6. Weryfikacja TOR dla Q3 2026 (Lipiec, Sierpień, Wrzesień)
  console.log('--- KROK 7: Kalkulacja TOR dla Q3 2026 z częściowym zatrudnieniem (Hanna Domachowska) ---');
  // Zbudujmy employees na podstawie kwartalnej agregacji
  const months = [7, 8, 9];
  const employeeMap = new Map<number, any>();
  for (const m of months) {
    const mRoster = dbManager.getMonthlyRoster(2026, m);
    for (const emp of mRoster) {
      if (!employeeMap.has(emp.id)) {
        employeeMap.set(emp.id, {
          ...emp,
          activeMonths: [m],
          monthlyRatios: { [m]: emp.contract_hours_ratio },
          monthlyRoles: { [m]: emp.role }
        });
      } else {
        const existing = employeeMap.get(emp.id);
        if (!existing.activeMonths.includes(m)) {
          existing.activeMonths.push(m);
        }
        existing.monthlyRatios[m] = emp.contract_hours_ratio;
        existing.monthlyRoles[m] = emp.role;
      }
    }
  }
  const torEmployees = Array.from(employeeMap.values()).sort((a, b) => a.sort_order - b.sort_order);

  console.log(`Liczba menedżerów w całym Q3: ${torEmployees.length} (Oczekiwano: 8)`);

  const hannaTorEmp = torEmployees.find(e => e.name.toLowerCase().includes('hanna'));
  if (!hannaTorEmp) {
    throw new Error('Hanna Domachowska musi być uwzględniona w Q3!');
  }
  console.log(`- Hanna aktywne miesiące w Q3: [${hannaTorEmp.activeMonths.join(', ')}] (Oczekiwano: 7, 8)`);
  if (hannaTorEmp.activeMonths.includes(9)) {
    throw new Error('Hanna nie powinna być aktywna w miesiącu 9 (wrzesień)!');
  }

  // Uruchomienie kalkulacji TOR
  const mockNorms = {
    7: { year: 2026, month: 7, full_time_hours: 184, working_days: 23, off_days: 8, is_custom: 0, notes: null, updated_at: '' },
    8: { year: 2026, month: 8, full_time_hours: 160, working_days: 20, off_days: 11, is_custom: 0, notes: null, updated_at: '' },
    9: { year: 2026, month: 9, full_time_hours: 176, working_days: 22, off_days: 8, is_custom: 0, notes: null, updated_at: '' }
  };

  const torResult = TorEngine.calculateQuarterData(
    2026,
    3,
    torEmployees,
    [], // bez zmian - testujemy same normy i statusy miesięcy
    mockNorms as any
  );

  const hannaRow = torResult.rows.find(r => r.employee.id === hannaTorEmp.id);
  if (!hannaRow) throw new Error('Brak Hanny w wierszach TOR!');

  console.log('\nPodsumowanie Hanny Domachowskiej w TOR Q3:');
  console.log(`- Lipiec (m=7): Aktywna=${hannaRow.months[0].isActiveInMonth}, Norma=${hannaRow.months[0].normHours}h (Oczekiwano: 92h dla etatu 0.5)`);
  console.log(`- Sierpień (m=8): Aktywna=${hannaRow.months[1].isActiveInMonth}, Norma=${hannaRow.months[1].normHours}h (Oczekiwano: 80h dla etatu 0.5)`);
  console.log(`- Wrzesień (m=9): Aktywna=${hannaRow.months[2].isActiveInMonth}, Norma=${hannaRow.months[2].normHours}h (Oczekiwano: 0h - brak w składzie)`);

  if (hannaRow.months[0].normHours !== 92 || hannaRow.months[1].normHours !== 80 || hannaRow.months[2].normHours !== 0) {
    throw new Error(`BŁĄD norm Hanny: Oczekiwano 92, 80, 0, a otrzymano ${hannaRow.months[0].normHours}, ${hannaRow.months[1].normHours}, ${hannaRow.months[2].normHours}`);
  }
  if (hannaRow.months[2].isActiveInMonth !== false) {
    throw new Error('BŁĄD: Hanna powinna mieć isActiveInMonth = false we wrześniu!');
  }

  console.log('✅ Krok 7 zakończony sukcesem: Kalkulacja TOR dla pracowników odchodzących w trakcie kwartału działa w 100% poprawnie!\n');

  console.log('================================================================');
  console.log('🎉 WSZYSTKIE TESTY ZAKOŃCZYŁY SIĘ PEŁNYM SUKCESEM!');
  console.log('================================================================');
}

runVerification().catch(err => {
  console.error('❌ Błąd podczas weryfikacji:', err);
  process.exit(1);
});
