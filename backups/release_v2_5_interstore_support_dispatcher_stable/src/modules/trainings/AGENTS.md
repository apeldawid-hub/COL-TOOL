# AGENTS.md — Moduł 3: Szkolenia (Starbucks Training Suite)

Dokument stanowi techniczną specyfikację architektoniczną oraz rejestr algorytmów dla **Modułu 3: Szkolenia (Starbucks Training Suite)** w kawiarni `108120 SBX Warszawa Janki`.

---

## 🏛️ 1. Architektura i Założenia Domenowe

1. **Autonomia i Brak Sprzężenia z Grafikiem Managerskim (Moduł 2)**:
   - Moduł 3 zarządza onboardingiem i rozwojem baristów oraz trenerów na dedykowanej tabeli `training_partners`.
   - Moduł 2 pozostaje dedykowany wyłącznie 7 menedżerom lokalu 108120 Janki. Moduł 3 nie ingeruje w siatkę zmian menedżerskich ani normy Kodeksu Pracy Modułu 2.
2. **Koncepcja Zmian T (Training Shifts)**:
   - Zmiany T (`T1`–`T10`, `B90-1`, `B180-1`, `BT-1`) to dedykowane sesje szkoleniowe rozliczane w 100% w budżecie **Non-Coverage (NC Training)**.
   - Godziny Zmian T **nie wliczają się do Floor Hours** (32.0h/dzień ochrony przepustowości operacyjnej) kawiarni, dzięki czemu proces wdrożenia nowego pracownika nie obniża poziomu obsługi gości.
   - Każda zmiana T posiada precyzyjne rozbicie na:
     - **Barista `(T)`**: czas szkolenia nowego pracownika (łącznie ~39h w First 30),
     - **Trener Baristów BT `(T)`**: dedykowany czas 1:1 trenera (łącznie ~14.25h),
     - **Store Manager SM `(T)`**: punkty kontrolne, degustacja First Sip, check-iny i certyfikacja (łącznie 3.5h).
3. **Cyfrowe Arkusze Egzaminacyjne Skill Check**:
   - Bezpośrednia implementacja oficjalnych kryteriów z Podręcznika Treningowego Starbucks:
     - `milk_steaming`: Rutyna Spieniania Mleka (5 kroków: wlewanie, napowietrzanie 1-3s/6-8s, wirowanie, purge 2s, polerowanie),
     - `espresso_bar`: Espresso Bar Skill Check #1 (Latte, Cappuccino, Caramel Macchiato 7x7, Flat White),
     - `cold_beverage`: Cold Beverage Station Skill Check #2 (Frappuccino, Iced Latte, Refresha 10x shake, Cold Foam),
     - `teaching_model`: 4-etapowy Model Nauczania Barista Trener (Prepare, Present, Practice, Follow-up),
     - `completion_check`: Weryfikacja końcowa First 30 (100% LMS, zdane testy, akceptacja SM, Zielona Przypinka).
4. **The Barista Journey**:
   - Automatyczna kalkulacja kamieni milowych na podstawie daty zatrudnienia (`hire_date`):
     - **First 30**: 30 dni od zatrudnienia,
     - **Barista 90**: 90 dni (uprzedzenia i de-eskalacja),
     - **Barista 180**: 180 dni (Coffee Academy 200),
     - **Barista Trener & Coffee Master**: ścieżki aspiracyjne.

---

## 🗄️ 2. Schemat Bazy Danych SQLite

1. `training_partners`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `name TEXT NOT NULL`
   - `hire_date TEXT NOT NULL`
   - `current_program TEXT DEFAULT 'first_30'`
   - `assigned_trainer_id INTEGER`
   - `assigned_trainer_name TEXT`
   - `store_manager_name TEXT DEFAULT 'Dawid Apel'`
   - `sanepid_valid_until TEXT`
   - `bhp_completed_date TEXT`
   - `status TEXT DEFAULT 'in_progress'`
   - `notes TEXT`
2. `training_shifts`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `partner_id INTEGER NOT NULL`
   - `shift_code TEXT NOT NULL`
   - `title TEXT NOT NULL`
   - `scheduled_date TEXT NOT NULL`
   - `start_time TEXT DEFAULT '08:00'`
   - `end_time TEXT DEFAULT '12:00'`
   - `barista_hours_t REAL NOT NULL`
   - `trainer_hours_t REAL DEFAULT 0.0`
   - `sm_hours_t REAL DEFAULT 0.0`
   - `status TEXT DEFAULT 'planned'`
   - `trainer_name TEXT`
   - `station TEXT`
   - `notes TEXT`
3. `training_skill_checks`:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`
   - `partner_id INTEGER NOT NULL`
   - `check_type TEXT NOT NULL`
   - `exam_date TEXT NOT NULL`
   - `examiner_name TEXT NOT NULL`
   - `examiner_role TEXT DEFAULT 'SM'`
   - `is_passed INTEGER NOT NULL`
   - `score_pct REAL NOT NULL`
   - `criteria_results TEXT` (JSON)
   - `notes TEXT`

---

## 💻 3. Serwisy i Komponenty

- `src/modules/trainings/services/trainingStandardData.ts`: Standardowe szablony zmian T1–T10, B90, B180, BT oraz baza kryteriów egzaminacyjnych.
- `src/modules/trainings/services/trainingEngine.ts`: Silnik generatora zmian T, kalkulator bilansu godzin i dat kamieni milowych.
- `src/modules/trainings/components/TrainingsView.tsx`: Główny widok modułu z selektorem partnerów i 4 zakładkami.
- `src/modules/trainings/components/TrainingStatsCard.tsx`: Kafelki analityczne i KPI szkoleń.
- `src/modules/trainings/components/TrainingShiftsSchedule.tsx`: Interaktywny harmonogram sesji T z edycją godzin i dat.
- `src/modules/trainings/components/DigitalSkillCheckModal.tsx`: Cyfrowy arkusz egzaminacyjny z dynamiczną oceną punktową.
- `src/modules/trainings/components/PartnerEditModal.tsx`: Formularz profilu baristy ze statusem Sanepid i BHP.
- `src/modules/trainings/components/PartnerJourneyTracker.tsx`: Wizualna oś czasu The Barista Journey.
