import initSqlJs from 'sql.js';
import fs from 'fs';
import { TrainingEngine } from '../src/modules/trainings/services/trainingEngine';
import { DatabaseManager } from '../electron/database/db';

async function testTrainingsModule() {
  console.log('🧪 === WERYFIKACJA MODUŁU 3: SZKOLENIA (STARBUCKS TRAINING SUITE) ===\n');

  // Test 1: Inicjalizacja bazy i pobranie partnerów
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();
  const partners = dbManager.getTrainingPartners();
  console.log(`✅ 1. Pobrano partnerów z bazy SQLite: ${partners.length} partnerów`);
  for (const p of partners) {
    console.log(`   • ID: ${p.id} | ${p.name} | Program: ${p.current_program} | Status: ${p.status} | Trener: ${p.assigned_trainer_name}`);
  }

  if (partners.length === 0) {
    throw new Error('Brak partnerów w bazie!');
  }

  // Test 2: Generowanie Zmian T dla pierwszego partnera (First 30: T1-T10)
  const firstPartner = partners[0];
  const shifts = TrainingEngine.generateDefaultShiftsForPartner(
    firstPartner.id,
    firstPartner.hire_date,
    'first_30',
    firstPartner.assigned_trainer_name
  );
  console.log(`\n✅ 2. Wygenerowano standardowy pakiet First 30: ${shifts.length} Zmian T`);
  
  // Zapis do bazy
  dbManager.saveTrainingShiftsBatch(firstPartner.id, shifts);
  const loadedShifts = dbManager.getTrainingShifts(firstPartner.id);
  console.log(`✅ 3. Zapisano i wczytano z bazy ${loadedShifts.length} Zmian T dla partnera ID ${firstPartner.id}`);

  // Test 3: Weryfikacja bilansu godzin Zmian T (Non-Coverage)
  const summary = TrainingEngine.calculateHoursSummary(loadedShifts);
  console.log('\n📊 Bilans godzin Zmian T (Starbucks Standard):');
  console.log(`   • Barista (T): ${summary.totalBaristaPlanned}h`);
  console.log(`   • Trener BT (T): ${summary.totalTrainerPlanned}h`);
  console.log(`   • Store Manager SM (T): ${summary.totalSmPlanned}h`);
  console.log(`   • Całkowita inwestycja szkoleniowa (NC): ${summary.totalInvestmentPlanned}h`);

  if (summary.totalBaristaPlanned < 38.0 || summary.totalTrainerPlanned < 14.0) {
    throw new Error(`Niezgodna suma godzin Zmian T: Barista=${summary.totalBaristaPlanned}, BT=${summary.totalTrainerPlanned}`);
  }

  // Test 4: Zapis i weryfikacja egzaminu Skill Check
  const skillCheck = {
    partner_id: firstPartner.id,
    check_type: 'milk_steaming',
    exam_date: '2026-09-08',
    examiner_name: 'Dawid Apel',
    examiner_role: 'SM',
    is_passed: true,
    score_pct: 100.0,
    criteria_results: [
      { id: 'ms_1', category: 'Wlewanie', label: 'Świeże mleko', description: 'Do kreski', isPassed: true },
      { id: 'ms_2', category: 'Napowietrzanie', label: '1-3s Latte', description: 'Kontrola czasu', isPassed: true },
      { id: 'ms_3', category: 'Wirowanie', label: 'Vortex', description: 'Bez bąbli 65C', isPassed: true },
      { id: 'ms_4', category: 'Dezynfekcja', label: 'Przetarcie & Purge 2s', description: 'Natychmiast', isPassed: true },
      { id: 'ms_5', category: 'Polerowanie', label: 'Gładka mikropianka', description: 'Mokra farba', isPassed: true }
    ],
    notes: 'Wzorcowe spienianie mleka zgodnie ze standardem Starbucks Mastrena II.'
  };

  const checkId = dbManager.saveTrainingSkillCheck(skillCheck);
  console.log(`\n✅ 4. Zapisano egzamin Skill Check (ID: ${checkId})`);

  const loadedChecks = dbManager.getTrainingSkillChecks(firstPartner.id);
  console.log(`✅ 5. Pobrano egzaminy z bazy: ${loadedChecks.length} wpisów`);
  console.log(`   • Egzamin: ${loadedChecks[0].check_type} | Wynik: ${loadedChecks[0].score_pct}% | Zdany: ${loadedChecks[0].is_passed ? 'TAK' : 'NIE'} | Egzaminator: ${loadedChecks[0].examiner_name}`);

  // Test 5: Kamienie Milowe Partner Journey
  const milestones = TrainingEngine.calculateMilestones(firstPartner.hire_date);
  console.log('\n🗺️ Kamienie milowe Barista Journey:');
  console.log(`   • Start: ${firstPartner.hire_date}`);
  console.log(`   • First 30 Cel: ${milestones.first30Target}`);
  console.log(`   • Barista 90 Cel: ${milestones.barista90Target}`);
  console.log(`   • Barista 180 Cel: ${milestones.barista180Target}`);
  console.log(`   • Dni w kawiarni: ${milestones.daysSinceHire}`);

  console.log('\n🎉 WSZYSTKIE TESTY MODUŁU SZKOLEŃ PRZESZŁY POMYŚLNIE!');
}

testTrainingsModule().catch(err => {
  console.error('❌ Błąd podczas weryfikacji modułu szkoleń:', err);
  process.exit(1);
});
