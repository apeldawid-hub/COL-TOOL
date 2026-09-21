# AGENTS.md — Instrukcje Agenta dla Modułu 2: Managers Schedule (Grafik Managerski)

Dokument definiuje kontekst domenowy, zasady Kodeksu Pracy, katalog kodów zmian Starbucks, architekturę bazy danych oraz algorytmy kalkulacyjne dla **Modułu 2: Managers Schedule**.

---

## ☕ 1. Kontekst Domenowy i Biznesowy

- **Status modułu**: ✅ **v1.0 Active** (w pełni funkcjonalny, przetestowany).
- **Cel modułu**: Autonomiczny planer grafiku dla zespołu kierowniczego kawiarni (Store Manager, Assistant Store Manager, Shift Supervisors).
- **Plik referencyjny**: `./Grafik/Grafik wrzesień Janki 2026.xlsm`.
- **Kawiarnia bazowa**: `108120 SBX Warszawa Janki` (Kod jednostki: `384`).
- **Zespół bazowy (7 osób)**:
  1. `Dawid Szeluga` (SM — Customer & Sales Manager, FULL = 1.0)
  2. `Dawid Apel` (ASM — People Manager, FULL = 1.0)
  3. `Kamil Kamiński` (SSV — Shift Supervisor, FULL = 1.0)
  4. `Zuzanna Makowska` (SSV, 0.75 = 30h/tydzień)
  5. `Weronika Bieńkowska` (SSV, 0.50 = 20h/tydzień)
  6. `Gabi Znojek` (SSV, FULL = 1.0)
  7. `Aleksandra Płużyńska` (SSV, FULL = 1.0)

---

## 📁 2. Struktura Plików Modułu (`src/modules/managers-schedule/`)

```
src/modules/managers-schedule/
├── components/
│   ├── ManagerScheduleGrid.tsx     # Miesięczna matryca grafiku z przypiętymi kolumnami i wierszem wydarzeń
│   ├── ManagerScheduleView.tsx     # Główny widok modułu (przełącznik zakładek Grafik/TOR, kafelki KPI, akcje)
│   ├── TorView.tsx                 # [NOWY] Trzymiesięczny Okres Rozliczeniowy (TOR) z podsumowaniem kwartalnym Q1-Q4
│   ├── ManagerTeamModal.tsx        # Modal dodawania/edycji menedżerów, stawek, ról i etatów
│   ├── ShiftConfigModal.tsx        # Modal konfiguracji katalogu zmian Starbucks i reguł niedzielnych
│   ├── ShiftPickerPopover.tsx      # Szybki selektor zmian z blokadą zmian niedzielnych w dni powszednie
│   ├── LaborLawComplianceModal.tsx # Tarcza Kodeksu Pracy (inspektor naruszeń)
│   ├── LaborLawViolationDialog.tsx # Dialog ostrzegawczy pre-flight przy próbie złamania przepisów KP
│   ├── ScheduleVersionModal.tsx    # Historia wersji grafiku i publikacja (reguła 7 dni przed startem)
│   ├── MonthNormEditModal.tsx      # Modal edycji i podglądu normy miesięcznej KP z przywracaniem
│   ├── ManagerDispositionsModal.tsx # Zbiorcza matryca dyspozycyjności menedżerów i import z Excela
│   ├── RcpAbsenceConflictDialog.tsx # Modal ostrzegawczy i raport kolizji RCP z absencją L4/H
│   ├── AutoScheduleModal.tsx        # Modal AutoScheduling (generator grafiku AI, diff, KPI)
│   └── AutoScheduleWidget.tsx       # Floating Starbucks Speed-Dial Navigation Hub (radial progress, LM/NM, TOR, akcje)
├── services/
│   ├── managerScheduleEngine.ts    # Silnik wyliczania norm KP, świąt, bilansu godzin, L4 do etatu i walidacji na przejściach
│   ├── torEngine.ts                # Silnik kwartalny TOR (agregacja 3 miesięcy, bilanse, status nadgodzin/niedogodzin)
│   ├── autoSchedulerEngine.ts      # [NOWY] Silnik optymalizacyjny AutoScheduling (solver, KP, dyspozycje, MID)
│   └── managerExcelExport.ts       # Generator eksportu grafiku miesięcznego oraz arkusza TOR do pliku .xlsx
├── index.ts                        # Barrel export modułu
├── AGENTS.md                       # Niniejsze instrukcje techniczne agenta
└── README.md                       # Dokumentacja użytkowa modułu
```

---

## ⚖️ 3. Reguły Obliczeniowe Kodeksu Pracy (`services/managerScheduleEngine.ts`)

### Algorytm 1: Polski Kalendarz Świąt Ustawowych
1. **Święta stałe**: 1 stycznia, 6 stycznia, 1 maja, 3 maja, 15 sierpnia, 1 listopada, 11 listopada, 25 i 26 grudnia.
2. **Święta ruchome**: Wielkanoc (algorytm Meeus/Jones/Butcher), Poniedziałek Wielkanocny (+1 dzień), Boże Ciało (+60 dni).
3. **Reguła Sobotnia (art. 130 § 2 KP)**: Każde święto przypadające w sobotę obniża wymiar czasu pracy w danym miesiącu o 8 godzin (daje pracownikowi dodatkowy dzień wolny).

### Algorytm 2: Miesięczna Norma Czasu Pracy
1. **Dni robocze**: liczba dni poniedziałek–piątek niebędących świętami, pomniejszona o święta przypadające w soboty:
   $$\text{Dni Robocze} = \text{Dni Pn–Pt (bez świąt)} - \text{Święta w soboty}$$
2. **Norma Pełnego Etatu (1.0)**:
   $$\text{Norma Pełny Etat} = \text{Dni Robocze} \times 8.0\text{ h}$$
   *(Dla Września 2026: 22 dni robocze $\times$ 8.0h = **176.0 h**)*.
3. **Wymagane Dni Wolne (Norma OFF)**:
   $$\text{Norma Dni Wolnych} = \text{Dni Miesiąca} - \text{Dni Robocze}$$
   *(Dla Września 2026: 30 - 22 = **8 dni wolnych**)*.
4. **Indywidualna Norma Menedżera**:
   $$\text{Norma Indywidualna} = \text{Norma Pełny Etat} \times \text{Wymiar Etatu}$$
   *(Full: 176.0 h, 0.75: 132.0 h, 0.5: 88.0 h, 0.25: 44.0 h)*.

### Algorytm 3: Bilans Godzin Menedżera, Wliczanie H/L4 do Etatu oraz Reguła Dni Wolnych
1. **Zależność H i L4 od wymiaru etatu**:
   - W dni robocze urlop (`H`) oraz chorobowe (`L4`) zaliczają pracownikowi dobowy wymiar etatu:
     $$\text{Godziny H/L4 (dzień roboczy)} = 8.0\text{ h} \times \text{etat}$$
     *(Pełny etat: 8.0h, 0.75: 6.0h, 0.50: 4.0h, 0.25: 2.0h)*.
2. **Wyłączenie weekendów i świąt z godzin urlopu i L4 (art. 154² § 1 KP)**:
   - Zgodnie z art. 154² § 1 Kodeksu Pracy urlopu udziela się wyłącznie w dniach i godzinach, które byłyby dniami pracy pracownika.
   - W soboty, niedziele oraz święta ustawowo wolne od pracy urlop `H` oraz chorobowe `L4` **nie generują godzin do etatu ($0.0\text{ h}$)** i nie obciążają limitu urlopowego.
   - W oknie wyboru zmiany (`ShiftPickerPopover`) kafelki `H` i `L4` w takie dni pokazują `0h (Weekend / Święto — bez godzin)`.
3. **Nieobecności nie wliczają się do obsady sali**:
   - `L4` i `H` nie generują obecności na zmianie (`totalManagersWorking` ignoruje `L4` i `H`).
4. **Liczba dni OFF**: zliczenie komórek o kodzie `OFF`. Aplikacja oznacza ostrzeżeniem wiersz menedżera, jeśli $\text{Liczba OFF} < \text{Norma Dni Wolnych}$.
5. **Pokrycie %**: $\frac{\text{Wypracowane}}{\text{Norma Indywidualna}} \times 100\%$.
6. **Bilans Godzin**: $\text{Wypracowane} - \text{Norma Indywidualna}$ (np. `0.0 h`, `+8.0 h` nadgodzin, `-4.0 h` niedopracowania).

### Algorytm 4: Kalendarz Dni Wolnych od Pracy i Niedziel Handlowych na Matrycy
1. **7 Niedziel Handlowych w Roku (Ustawa o ograniczeniu handlu)**:
   - Ostatnia niedziela stycznia.
   - Niedziela bezpośrednio poprzedzająca Wielkanoc.
   - Ostatnia niedziela kwietnia.
   - Ostatnia niedziela czerwca.
   - Ostatnia niedziela sierpnia.
   - Dwie kolejne niedziele bezpośrednio poprzedzające Boże Narodzenie (grudzień).
2. **Wizualizacja na Matrycy Grafiku (`ManagerScheduleGrid`)**:
   - **Wiersz STATUS w nagłówku tabeli**:
     - `ŚWIĘTO` (czerwony badge 🇵🇱, tło `bg-rose-100`) dla świąt państwowych.
     - `🛒 HANDL.` (szmaragdowy badge, tło `bg-emerald-100`) dla niedziel handlowych.
     - `WOLNA` (bursztynowy badge, tło `bg-amber-100`) dla niedziel niehandlowych.
     - `SOB` (szary badge) dla sobót.
     - `Praca` dla dni roboczych.
   - **Tło kolumn dni**: dni świąteczne (`bg-rose-50/40`), niedziele handlowe (`bg-emerald-50/30`), niedziele niehandlowe (`bg-amber-50/25`), soboty (`bg-amber-50/15`).
   - **Baner kalendarza w widoku głównym**: zestawienie liczby dni roboczych, dni wolnych, konkretnych dat niedziel handlowych i świąt państwowych.

### Algorytm 4: Inspekcja Kodeksu Pracy na Przejściach Między Miesiącami
Tarcza Kodeksu Pracy weryfikuje ciągłość norm na granicy miesięcy ($M-1 \rightarrow M$ oraz $M \rightarrow M+1$):
1. **Odpoczynek dobowy 11h na styku miesięcy (art. 132 KP)**:
   - Weryfikacja przerwy między ostatnią zmianą poprzedniego miesiąca ($D_{prev\_last}$) a zmianą w dniu 1 ($D_1$).
   - Weryfikacja przerwy między ostatnią zmianą bieżącego miesiąca ($D_{totalDays}$) a zaplanowaną zmianą w dniu 1 kolejnego miesiąca ($D_{next\_1}$).
   - Jeśli przerwa $< 11.0\text{h}$, system generuje błąd KP z podaniem godzin obu zmian.
2. **Odpoczynek tygodniowy 35h (art. 133 KP)**:
   - Licznik ciągłych dni pracy uwzględnia serię dni przepracowanych na koniec poprzedniego miesiąca bez dnia wolnego.
3. **Maksymalnie 3 pracujące niedziele pod rząd (art. 151^10 KP)**:
   - Seria pracujących niedziel uwzględnia niedziele z końcówki poprzedniego miesiąca.

---

## 📊 4. Trzymiesięczny Okres Rozliczeniowy (TOR) (`services/torEngine.ts`)

Moduł implementuje kwartalne rozliczenie menedżerów (Q1: Sty-Mar, Q2: Kwi-Cze, Q3: Lip-Wrz, Q4: Paź-Gru) zgodnie z referencyjnym arkuszem `TOR`:
### Algorytm 5: Trzymiesięczny Okres Rozliczeniowy (TOR) i 3 Kolumny Godzinowe (`RCP`, `H`, `L4`)
1. **Reguła pierwszeństwa L4 nad H (art. 166 KP)**:
   - Czasowa niezdolność do pracy wskutek choroby przerywa bieg urlopu wypoczynkowego.
   - Jeśli pracownik w danym dniu choruje (`L4`), godziny zaliczane są wyłącznie do kolumny `L4`, a kolumna `H` dla tego dnia wynosi $0.0\text{ h}$.
2. **Czysty układ 3 kolumn godzinowych per miesiąc**:
   - Kolumna `ETAT` występuje jednorazowo przy danych menedżera.
   - W każdym z 3 miesięcy kwartału (Q1–Q4) prezentowane są wyłącznie 3 sumaryczne kolumny godzinowe:
     - `RCP (h)`: wypracowane godziny dyżurów operacyjnych na sali (oraz support/NC),
     - `H (h)`: godziny płatnego urlopu wypoczynkowego w dniach roboczych ($8\text{h} \times \text{etat}$),
     - `L4 (h)`: godziny usprawiedliwionej nieobecności chorobowej w dniach roboczych ($8\text{h} \times \text{etat}$),
     - `BILANS`: różnica między sumą wypracowanych godzin ($\text{RCP} + \text{H} + \text{L4}$) a normą miesiąca dla danego etatu.
3. **Saldo kwartału**: Suma bilansów z 3 miesięcy danego kwartału.
4. **Status kwartalny**:
   - $\text{Saldo} > 0.1\text{ h} \rightarrow$ **Nadgodziny** (do wypłaty lub odbioru w kolejnym okresie).
   - $\text{Saldo} < -0.1\text{ h} \rightarrow$ **Niedogodziny** (niedopracowanie wymiaru).
   - $\text{Saldo} \in [-0.1, 0.1]\text{ h} \rightarrow$ **OK** (idealne zrównoważenie czasu pracy).
5. **Eksport Excel**: Generator pliku `.xlsx` odwzorowujący arkusz `TOR` z 3-kolumnowym układem miesięcy i podsumowaniem zespołu.

### Algorytm 6: Blokada Edycji Zamkniętych Miesięcy (`isMonthClosed`)
1. **Status zamknięcia miesiąca**:
   - Miesiąc uznawany jest za zamknięty, jeśli przypada w przeszłości względem bieżącego czasu zegara systemowego ($\text{rok} < \text{bieżący\_rok} \lor (\text{rok} = \text{bieżący\_rok} \land \text{miesiąc} < \text{bieżący\_miesiąc})$).
2. **Ochrona integralności danych (Read-Only)**:
   - **Komórki grafiku**: zablokowane kliknięcie, brak możliwości wywołania popovera zmiany.
   - **Wydarzenia i notatki**: zablokowana edycja tekstu wydarzeń operacyjnych.
   - **Matryca dyspozycji**: tryb tylko do odczytu, ukryty przycisk wklejania z Excela, wyłączone przyciski masowej modyfikacji wiersza, brak zapisu.
   - **Norma miesięczna**: zablokowana edycja i resetowanie normy (ikona kłódki `Lock` zamiast ołówka edycji).
   - **Sygnalizacja w UI**: widoczny badge `🔒 Miesiąc zamknięty (Tylko do odczytu)` w pasku kontrolnym.

### Algorytm 7: Integracja RCP z Modułem TPLH Forecast i Detekcja Kolizji RCP vs Absencja (L4/H)
1. **Rejestracja RCP z systemu MAPAL Fichajes (`labor_actuals_log`) i Zmiany Supportowe**:
   - Kolumna RCP dla menedżerów odzwierciedla zarejestrowany czas pracy z systemu MAPAL.
   - W przypadku menedżerów logowania obejmują wszystkie zmiany — **również te zrealizowane w innych kawiarniach** (wsparcia SAM, SPM, SUP, Nowy Świat 323, Sadyba 341, San Park 756, Arkadia 327 itd.).
   - Parser importu MAPAL (`mapalParser.ts`) oraz handlery IPC (`main.ts`) wykorzystują kanoniczny słownik polskich zdrobnień (`NICKNAME_MAP`: `Gabi` $\leftrightarrow$ `Gabriela`, `Zuza` $\leftrightarrow$ `Zuzanna`, `Werka` $\leftrightarrow$ `Weronika`, `Hania` $\leftrightarrow$ `Hanna`, `Ola` $\leftrightarrow$ `Aleksandra`, `Kuba` $\leftrightarrow$ `Jakub`, `Maciek` $\leftrightarrow$ `Maciej` itd.).
   - Zapytania do bazy łączą tabelę główną `manager_employees` oraz składy miesięczne `manager_monthly_roster`, zapewniając prawidłowe przypisanie godzin menedżerów historycznych (np. Hanna Domachowska, Maciej Chlabicz, Weronika Stasiewicz).
   - **Ochrona Floor Hours Modułu 1**: Zapytania Modułu 1 filtrują bazę ściśle po lokalu 384 (`unit_code = '384'`), gwarantując, że godziny wsparcia w obcych lokalach nie zniekształcają wskaźników TPLH ani zapotrzebowania Floor Hours samej kawiarni Janki.
   - Tooltip komórki grafiku informuje o lokalu wsparcia: `📍 Zalogowano wsparcie MAPAL: Xh w [Nazwa Lokalu] (kod: XXX)`.
2. **Automatyczne zasilanie i nieedytowalność RCP**:
   - Gdy w danym miesiącu dostępne są kompletne logowania (lub miesiąc jest zamknięty), kolumna `RCP (h)` w widoku grafiku i w module TOR wypełnia się automatycznie.
   - Pole `RCP (h)` jest nieedytowalne (oznaczone zieloną kropką i badge'em `Zarejestrowane z MAPAL`).
3. **Detekcja Kolizji RCP vs L4 / H (`rcpConflicts`)**:
   - Jeśli pracownik posiada zarejestrowany czas pracy w systemie RCP ($>0\text{ h}$) w dniu, w którym w grafiku przypisano kod absencji `L4` (zwolnienie lekarskie) lub `H` (urlop wypoczynkowy), silnik generuje wpis kolizji `RcpAbsenceConflict`.
   - **Sygnalizacja w UI**:
     - **Baner kolizji nad kalendarzem**: ostrzeżenie o liczbie kolizji z przyciskiem przejścia do modala.
     - **Wskaźnik w komórce dnia (`ManagerScheduleGrid`)**: pulsujący badge `⚡` w rogu komórki, złota obwódka komórki oraz informacja w tooltipie.
     - **Pre-flight warning (`handleUpdateShift`)**: przy próbie ręcznego przypisania L4 lub H w dniu ze zliczonym czasem RCP użytkownik otrzymuje ostrzeżenie z informacją o godzinach i lokalu logowania.
     - **Dedykowany modal (`RcpAbsenceConflictDialog`)**: tabela z datami, nazwiskami, godzinami logowania, kawiarnią oraz zaleceniami operacyjnymi dla Store Managera.

## 🏷️ 4. Katalog Zmian Starbucks (`shift_definitions`)

| Kod | Nazwa Zmiany | Godziny | Godz. Start | Godz. Stop | Kategoria |
|---|---|---|---|---|---|
| **AM** | Opening | 8.0 h | 07:00 | 15:00 | Coverage (Otwarcie) |
| **PM** | Closing | 8.0 h | 14:30 | 22:30 | Coverage (Zamknięcie) |
| **AMN** | AM Niedziela | 6.0 h | 08:00 | 14:00 | Coverage (Niedziela) |
| **PMN** | PM Niedziela | 7.0 h | 14:00 | 21:00 | Coverage (Niedziela) |
| **SAM** | Support AM | 8.0 h | 07:00 | 15:00 | Coverage (Wsparcie rano) |
| **SPM** | Support PM | 8.0 h | 14:30 | 22:30 | Coverage (Wsparcie wieczór) |
| **SUP** | Support do oddania | 8.0 h | 10:00 | 18:00 | Coverage |
| **MIB** | MID Bar | 8.0 h | 12:00 | 20:00 | Coverage |
| **AMB** | AM Bar | 8.0 h | 07:00 | 15:00 | Coverage |
| **PMB** | PM Bar | 8.0 h | 14:30 | 22:30 | Coverage |
| **MI4** | MiD 4h | 4.0 h | 10:00 | 14:00 | Coverage |
| **BT** | Business Trip | 8.0 h | 10:00 | 18:00 | Non-Coverage |
| **NC** | NC (Administracja SM) | 8.0 h | 07:00 | 15:00 | Non-Coverage |
| **TAM** | Szkolenie AM | 8.0 h | 07:00 | 15:00 | Non-Coverage |
| **TPM** | Szkolenie PM | 8.0 h | 14:30 | 22:30 | Non-Coverage |
| **RET** | Odbiór nadgodziny | 8.0 h | 08:00 | 16:00 | Non-Coverage |
| **T** | Training | 8.0 h | 08:00 | 16:00 | Non-Coverage |
| **PRE** | Preventive (Konserwacja) | 8.0 h | 10:00 | 18:00 | Non-Coverage |
| **MEE** | Partners Meeting | 3.0 h | 19:00 | 22:00 | Non-Coverage |
| **OFF** | Dzień Wolny (Day Off) | 0.0 h | 00:00 | 00:00 | Dzień Wolny |
| **H** | Urlop Wypoczynkowy | 8.0 h | 08:00 | 16:00 | Płatna Nieobecność |
| **L4** | Zwolnienie Lekarskie | 0.0 h | 00:00 | 00:00 | Nieobecność Usprawiedliwiona |
| **M** / **Z** / **FULL** | Dyspozycje | 0.0 h | — | — | Planowanie |

---

- `manager_employees`: centralny rejestr menedżerów generujący unikalne ID pracowników (id, name, role, contract_type, contract_hours_ratio, hourly_rate, monthly_salary, sort_order, is_active).
- `manager_monthly_roster`: autonomiczny skład zespołu per rok i miesiąc (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, monthly_salary, sort_order, is_active).
- `shift_definitions`: słownik zmian i parametrów (code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, category, is_sunday_only).
- `manager_schedule_shifts`: przypisane zmiany (year, month, day, date, employee_id, shift_code, hours, notes).
- `manager_schedule_events`: ważne wydarzenia per dzień (year, month, day, date, event_text).
- `manager_schedule_versions`: rejestr wersji grafiku i publikacji (id, year, month, version_num, version_type, title, description, shifts_json, events_json, is_published, created_at).
- `manager_monthly_norms`: oficjalne normy miesięczne na -10 i +10 lat (lata 2016–2036, 252 miesiące) z możliwością manualnego override (`year, month, working_days, off_days, full_time_hours, is_custom, notes, updated_at`).
- Indeksy: `idx_mgr_roster_ym`, `idx_mgr_roster_emp`, `idx_mgr_shifts_ym`, `idx_mgr_shifts_emp`, `idx_mgr_events_ym`, `idx_mgr_versions_ym`.

---

## 🛡️ 6. Tarcza Kodeksu Pracy (Walidacja 4 Norm Prawnych)

Moduł automatycznie weryfikuje 4 kluczowe normy polskiego Kodeksu Pracy dla każdego ułożonego grafiku:

1. **⏱️ Min. 11h Odpoczynku Dobowego (art. 132 § 1 KP)**:
   - Obliczanie czasu odpoczynku między końcem zmiany dnia $D$ a początkiem zmiany dnia $D+1$:
     $$\text{Odpoczynek} = (24.0 - T_{end}) + T_{start}$$
   - Flaga błędu, jeśli $\text{Odpoczynek} < 11.0\text{ h}$ (np. po zmianie PM kończącej się o 22:30 kolejna zmiana nie może rozpocząć się przed 09:30).

2. **🛌 Min. 35h Nieprzerwanego Odpoczynku Tygodniowego (art. 133 § 1 KP)**:
   - Weryfikacja ciągłości pracy — zakaz planowania 7 kolejnych dni pracy z rzędu bez co najmniej 35-godzinnej ciągłej przerwy wypoczynkowej (obejmującej 11h odpoczynku dobowego).

3. **⏱️ Maks. 12h Pracy w Dobie (art. 135 KP)**:
   - Flaga błędu w przypadku przypisania zmiany przekraczającej 12.0 godzin w jednej dobie pracowniczej.

4. **🗓️ Maksymalnie 3 Pracujące Niedziele z Rzędu (art. 151^10 KP)**:
   - Pracownik pracujący w niedziele musi mieć zapewnioną co najmniej jedną wolną niedzielę na 4 tygodnie. Naruszenie zgłaszane jest przy 4. pracującej niedzieli pod rząd.

5. **☀️ Zasada Niedzieli (Reguła Operacyjna)**:
   - Zmiany oznaczone jako *Tylko Niedziela* (`is_sunday_only = 1`) lub posiadające słowo *"Niedziela"* w nazwie (np. `AMN`, `PMN`) mogą być planowane **wyłącznie w niedziele**.
   - W oknie wyboru zmiany w dni powszednie (Pn–So) kody te są nieaktywne (`🔒 Tylko w niedziele`).
   - W przypadku obecności zmiany niedzielnej w dzień powszedni silnik zgłasza błąd `sunday_shift_invalid`.

**Prezentacja w UI**:
- Kafel KPI `Kodeks Pracy`: wskaźnik zgodności (100% Zgodny lub liczba alertów).
- Modal `LaborLawComplianceModal`: pełna lista naruszeń, podstawa prawna i zalecenia naprawcze.
- Komórki grafiku: pulsująca czerwona odznaka `!` i obramowanie z podpowiedzią tooltip.
- Wiersz menedżera: badge `[X KP]` w kolumnie `MANAGER`.
- Modal `ShiftConfigModal`: pełna konfiguracja zmian, godzin, stawek i reguł niedzielnych.

---

## 🏢 7. Obsada Kawiarni vs Zmiany Support (`SUP`, `SAM`, `SPM`)
- **Charakterystyka zmian wsparcia zewnętrznego**: Zmiany `SUP` (Support ogólny 8.0h), `SAM` (Support AM 8.0h) oraz `SPM` (Support PM 8.0h) to dyżury menedżera wykonywane w **innych jednostkach Starbucks** (np. Arkadia, Złote Tarasy, Sadyba).
- **Zasada kalkulacji**:
  - **Czas pracy menedżera**: 8.0 h wlicza się do wypracowanych godzin (`totalWorkedHours`), bilansu etatu (+/- h) oraz rozliczenia TOR.
  - **Obsada kawiarni macierzystej (108120 Janki)**: Zmiany `SUP`, `SAM`, `SPM` **NIE SĄ** liczone do obsady kawiarni Janki w wierszu *Obsada Menedżerska* (`totalManagersWorking`).
  - **Otwarcia i Zamknięcia Janki**: `SAM` i `SPM` nie obsadzają fizycznych otwarć ani zamknięć w kawiarni Janki (otwarcia Janki to wyłącznie `AM`, `AMN`, `AMB`; zamknięcia to `PM`, `PMN`, `PMB`).
  - **Podsumowanie wiersza obsady**: Jeśli w danym dniu menedżerowie pracują na wsparciu poza Janki, w wierszu obsady wyświetla się odznaka `+X SUP` z tooltipem wskazującym osoby i kawiarnie.

---

## 🔒 8. Wersjonowanie Grafiku i Publikacja 7 Dni (art. 129 § 3 KP)
- **Tabela**: `manager_schedule_versions` (id, year, month, version_num, version_type, title, description, shifts_json, events_json, is_published, created_at).
- **Reguła 7 dni**:
  - Zgodnie z art. 129 § 3 KP grafik musi zostać podany do wiadomości pracownikom na co najmniej **7 dni przed rozpoczęciem okresu**.
  - **Faza robocza (draft)** ($> 7$ dni przed 1. dniem miesiąca): SM może tworzyć punkty przywracania i dowolnie cofać wersje.
  - **Faza opublikowana** ($\le 7$ dni przed 1. dniem miesiąca oraz w trakcie miesiąca):
    - Grafik zostaje zamrożony jako wersja oficjalna.
    - Wcześniejsze wersje robocze zostają zablokowane do przywracania (ochrona praw pracowniczych).
    - Każda kolejna edycja kafelka rejestruje się automatycznie jako **Korekta po publikacji (`post_publication_edit`)** z audytem poprzedniej i nowej zmiany.

---

## 🚨 9. Pre-flight Walidacja Kodeksu Pracy (`LaborLawViolationDialog`)
- Zanim zmiana zostanie utrwalona w bazie danych, metoda `ManagerScheduleEngine.testShiftCompliance(...)` symuluje nowy stan.
- W przypadku wykrycia naruszenia (np. dobowy odpoczynek < 11h, praca > 12h, 4. niedziela z rzędu, zmiana niedzielna w dzień powszedni):
  - Wyświetla się modal **🚨 Niezgodne z Kodeksem Pracy!** z podaniem dokładnego powodu i artykułu KP.
  - Użytkownik ma wybór: **Anuluj (Wybierz inną zmianę)** lub **Wymuś mimo niezgodności** (dla sytuacji awaryjnych).

---

## ⏱️ 10. Baza Norm Czasu Pracy na -10 i +10 Lat (2016–2036) i Klikalny Kafelek
- **Tabela**: `manager_monthly_norms` przechowuje precyzyjnie wyliczone oficjalne normy Kodeksu Pracy dla każdego miesiąca z lat 2016–2036 (252 miesiące).
- **Zasady wyznaczania**:
  - Dni robocze: Pn–Pt minus święta państwowe (stałe i ruchome wg Meeus/Jones/Butcher).
  - Obniżenie wymiaru o 8h za święta przypadające w sobotę (art. 130 § 2 KP).
  - Norma pełnego etatu: $\text{Dni Robocze} \times 8.0\text{ h}$.
- **Interaktywny kafelek i edycja**:
  - Kafelek `Norma Miesiąca` w nagłówku jest klikalny (`cursor-pointer`).
  - Kliknięcie otwiera modal `MonthNormEditModal`, umożliwiając ręczną korektę godzin pełnego etatu, dni roboczych, dni wolnych lub dodanie notatki.
  - Możliwość natychmiastowego powrotu do oficjalnej normy KP jednym kliknięciem (`Przywróć normę KP`).
  - Modyfikacja normy automatycznie przelicza bilans (+/- h) i normy cząstkowe wszystkich menedżerów w siatce grafiku.

---

## 📝 11. Dyspozycyjność Menedżera, Zbiorcza Matryca i Import z Excela (`ManagerDispositionsModal`)
- **Stany dyspozycyjności**:
  - `Puste` (wartość domyślna): **Pełna dyspozycyjność (FULL)** — brak preferencji/ograniczeń (07:00 – 22:30).
  - `AM`: dyspozycyjność ranna (Morning, 07:00 – 15:00) — ciepły bursztynowy badge `AM`.
  - `PM`: dyspozycyjność wieczorna / zamykająca (14:30 – 22:30) — chłodny fioletowo-indygo badge `PM`.
  - `OFF`: prośba o wolne / niedostępność — wyraźny, odseparowany czerwony badge `OFF`.
- **Wprowadzanie jednostkowe**:
  - W oknie wyboru zmiany `ShiftPickerPopover` na samej górze umieszczony jest panel szybkiego wyboru dyspozycyjności `[ FULL | AM | PM | OFF ]`.
  - Zmiana dyspozycyjności jest natychmiast utrwalana w bazie poprzez handler `db:save-manager-disposition`.
- **Zbiorcza Matryca Dyspozycyjności Menedżerów (`ManagerDispositionsModal`)**:
  - Otwierana dedykowanym przyciskiem `Matryca Dyspozycji` w głównym pasku kontrolnym.
  - Prezentuje pełną siatkę miesiąca: wiersze dla każdego menedżera, kolumny dla dni 1..31 z wyróżnieniem świąt, niedziel handlowych i sobót.
  - Szybka interakcja:
    - 1-klik cykliczny: `Puste (FULL)` ➔ `AM` ➔ `PM` ➔ `OFF` ➔ `Puste (FULL)`.
    - Skróty klawiszowe wprost w komórce: <kbd>A</kbd> (AM), <kbd>P</kbd> (PM), <kbd>O</kbd> (OFF), <kbd>Delete</kbd> / <kbd>F</kbd> (Puste/FULL).
    - Szybkie akcje w wierszu: wyczyszczenie do stanu `FULL` (`Wyczyść`), ustawienie `OFF` na cały miesiąc.
    - Liczniki dyspozycji per pracownik: ile dni zgłoszono jako `AM`, `PM`, `OFF`.
- **Inteligentne Wklejanie z Excela (Smart Clipboard Paste)**:
  - Przycisk `Wklej z Excela`: pozwala na wklejenie danych skopiowanych bezpośrednio z arkusza Excel menedżerów (`Ctrl+V`).
  - Dwa tryby docelowe: dla wskazanego menedżera (pojedynczy wiersz z Excela) lub dla całego zespołu (wielowierszowa tabela).
  - Automatyczny parser tokenów rozdzielanych tabulatorami i nowymi liniami, mapujący potoczne polskie i angielskie oznaczenia:
    - `"am"`, `"a"`, `"m"`, `"rano"`, `"1"` ➔ `AM`
    - `"pm"`, `"p"`, `"z"`, `"zamknięcie"`, `"wieczór"`, `"2"` ➔ `PM`
    - `"off"`, `"w"`, `"wolne"`, `"brak"` ➔ `OFF`
    - `"full"`, `"f"`, `"cały"`, `"pełna"`, `"dyspo"`, `""`, `"-"` ➔ `Puste (FULL)`
  - Transakcyjny zbiorczy zapis do bazy danych przez `db:save-batch-manager-dispositions` (`BEGIN TRANSACTION` ... `COMMIT`).
- **Prezentacja graficzna w grafiku głównym**:
  - W komórce danego dnia menedżera, **po lewej stronie kwadratu ze zmianą**, pojawia się czytelny badge ze wskaźnikiem dyspozycyjności (wyłącznie gdy dyspozycja jest inna niż `OFF`).
  - Jeśli dyspozycyjność to `OFF`, w komórce widoczny jest wyłącznie standardowy kafelek zmiany.

---

## ⌨️ 12. Ergonomiczna Nawigacja Klawiaturą i Szybka Edycja Zmian (`ManagerScheduleGrid`)
- **Fokus i Aktywna Komórka**:
  - Dowolne naciśnięcie klawisza nawigacyjnego lub kliknięcie w siatkę zaznacza komórkę menedżera dla danego dnia.
  - Zaznaczona komórka posiada wyraźną obwódkę fokusową w szmaragdowej barwie Starbucks (`ring-2 ring-[#006241] ring-offset-2 bg-emerald-100/80 font-bold z-20 shadow-md`).
  - Automatyczny płynny autoscroll (`scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })`) utrzymuje aktywną komórkę w polu widzenia.
- **Klawisze Nawigacyjne**:
  - <kbd>↑</kbd> / <kbd>↓</kbd>: ruch pionowy między menedżerami w obrębie tego samego dnia.
  - <kbd>←</kbd> / <kbd>→</kbd>: ruch poziomy między dniami miesiąca ($1 \dots D_{\text{max}}$).
  - <kbd>Tab</kbd> / <kbd>Shift+Tab</kbd>: przejście do kolejnego/poprzedniego dnia z automatycznym zawijaniem do następnego/poprzedniego menedżera.
  - <kbd>Home</kbd> / <kbd>End</kbd>: błyskawiczny skok do pierwszego lub ostatniego dnia miesiąca.
  - <kbd>Esc</kbd>: odznaczenie aktywnej komórki lub zamknięcie otwartego popovera.
- **Skróty Klawiszowe Szybkiego Przypisywania Zmian (Hotkeys)**:
  - <kbd>A</kbd>: Zmiana `AM` (8.0h) — w niedziele automatycznie wybiera dedykowaną zmianę niedzielną `AMN` (6.0h).
  - <kbd>P</kbd>: Zmiana `PM` (8.0h) — w niedziele automatycznie wybiera dedykowaną zmianę niedzielną `PMN` (7.0h).
  - <kbd>N</kbd>: Zmiana administracyjna `NC` (8.0h, Non-Coverage SM).
  - <kbd>O</kbd> lub <kbd>Delete</kbd> / <kbd>Backspace</kbd>: Ustawienie dnia wolnego `OFF` (0.0h).
  - <kbd>H</kbd>: Przypisanie urlopu `H` (zgodnie z etatem pracownika w dni robocze).
  - <kbd>L</kbd>: Przypisanie chorobowego `L4` (zgodnie z etatem pracownika w dni robocze).
  - <kbd>Ctrl+C</kbd> / <kbd>Cmd+C</kbd>: Kopiowanie zmiany z aktywnej komórki (wraz z dostosowanym wymiarem godzin i przedziałem czasowym).
  - <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>: Wklejanie skopiowanej zmiany do aktywnej komórki (z automatyczną pre-flight walidacją Kodeksu Pracy oraz inteligentnym mapowaniem kodów niedzielnych `AM` $\leftrightarrow$ `AMN`, `PM` $\leftrightarrow$ `PMN`).
  - <kbd>Enter</kbd> lub <kbd>Spacja</kbd>: Otwarcie pełnego popovera wyboru wszystkich zmian (`ShiftPickerPopover`).
- **Tarcza Kodeksu Pracy przy Edycji z Klawiatury**:
  - Każde przypisanie zmiany z klawiatury lub wklejenie ze schowka wykonuje pre-flight walidację `ManagerScheduleEngine.testShiftCompliance`.
  - W razie kolizji z normą 11h odpoczynku, limitu 12h, odpoczynku 35h lub serii niedziel, zmiana nie jest zapisywana po cichu — system natychmiast wyświetla `LaborLawViolationDialog` z podaniem artykułu KP i możliwością świadomego anulowania lub wymuszenia zapisu przez Store Managera.
- **Pasek Pomocniczy w Stopce**:
  - Pod tabelą znajduje się stały, elegancki pasek informacyjny z legendą klawiszy, informacją o skopiowanej zmianie oraz dynamicznym wskaźnikiem aktualnie wybranej komórki (imię pracownika, dzień, dzień tygodnia, przypisany kod zmiany).

---

## 👥 13. Autonomiczny Skład Miesięczny Menedżerów i Rozliczenie Częściowe (`manager_monthly_roster`, `ManagerTeamModal`)
- **Geneza Biznesowa**:
  - W realiach kawiarni menedżerowie odchodzą i przychodzą (np. Hanna Domachowska pracowała w lipcu i sierpniu 2026, a we wrześniu 2026 już jej nie ma). Zmianie ulegają także role i etaty w poszczególnych miesiącach (np. Dawid Apel jako SSV w lipcu i awans na ASM od sierpnia).
  - Globalna tabela `manager_employees` nie może decydować o składzie wszystkich miesięcy wstecz, ponieważ modyfikacja usunęłaby dane archiwalne lub zafałszowała historyczne grafiki i rozliczenia.
- **Architektura Dwuwarstwowa**:
  1. `manager_employees` (Master Registry): centralny rejestr pracowników generujący unikalne `id` dla powiązań w `manager_schedule_shifts`.
  2. `manager_monthly_roster`: autonomiczny skład na konkretny miesiąc `(year, month)` zawierający: `employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active`.
- **Automatyczne Dziedziczenie Składu (Auto-Inheritance)**:
  - Przy pierwszym otwarciu nowego miesiąca (np. Październik 2026), jeśli w tabeli `manager_monthly_roster` brak wpisów dla tego okresu, system automatycznie klonuje strukturę z miesiąca poprzedniego ($M-1$).
  - Store Manager ma od razu gotowy skład, który może dowolnie zmodyfikować.
- **Izolacja Modyfikacji i Propagacja w Przyszłość (`ManagerTeamModal`)**:
  - Edycja składu (dodanie nowego menedżera, usunięcie ze składu na dany miesiąc, zmiana roli, etatu lub stawki) domyślnie dotyczy wyłącznie wybranego miesiąca.
  - Opcjonalny przełącznik w oknie zarządzania zespołem: *"Zastosuj zmiany również do kolejnych miesięcy"* (`propagateToFuture`). Po zaznaczeniu zmiany propagują się do wszystkich kolejnych zaplanowanych miesięcy ($M+1, M+2 \dots$), ale **nigdy nie naruszają miesięcy przeszłych/archiwalnych**.
  - Dedykowany przycisk *"Kopiuj z poprzedniego m-ca"* (`copyRosterFromPreviousMonth`) pozwala w dowolnym momencie zresetować i przywrócić strukturę z minionego okresu.
- **Kalkulacja TOR (Trzymiesięczny Okres Rozliczeniowy) dla Częściowego Zatrudnienia**:
  - Silnik `TorEngine` i widok `TorView` pobierają skład menedżerów aktywnych w dowolnym z miesięcy kwartału (np. 8 osób w Q3 2026).
  - Dla każdego pracownika wyznaczana jest lista aktywnych miesięcy `activeMonths` oraz indywidualne wymiary etatu `monthlyRatios` per miesiąc.
  - Menedżerowie z częściowym zatrudnieniem (np. odejście we wrześniu):
    - W miesiącach aktywności: norma liczona zgodnie z etatem (np. Hanna w lipcu: 184h $\times$ 0.5 = 92.0h, w sierpniu: 160h $\times$ 0.5 = 80.0h).
    - W miesiącach poza składem (np. wrzesień): `normHours = 0.0 h`, `isActiveInMonth = false`.
    - W tabeli TOR i eksporcie Excela komórki nieaktywnego miesiąca wyświetlają czytelną kreskę `-` zamiast mylącego zera, a saldo kwartału bilansuje się precyzyjnie bez fałszywych niedogodzin.

---

## ⚡ 14. Dostosowywanie Wymiaru Godzinowego Zmian i Presety (`ShiftPickerPopover`, `ShiftConfigModal`)
- **Elastyczne zmiany robocze**: Zmiany administracyjne (`NC`), środkowe (`MID`, `MIB`, `MI4`) oraz wsparcia zewnętrzne (`SUP`, `SAM`, `SPM`) mogą w praktyce trwać od 1h do 12h w zależności od potrzeb kawiarni.
- **Dostosowywanie per zmiana w popoverze (`ShiftPickerPopover`)**:
  - Store Manager ma do dyspozycji szybkie pigułki presetów (`4.0h`, `5.0h`, `6.0h`, `7.0h`, `8.0h`, `9.0h`, `10.0h`) oraz stepper precyzyjny `+/- 0.5h`.
  - W siatce grafiku zmiana o niestandardowym wymiarze prezentuje czytelny indeks (np. `NC 4h` lub `SUP 6h`).
- **Globalne Presety w Katalogu Zmian (`ShiftConfigModal`)**:
  - Dedykowana zakładka *Elastyczne & Presety* pozwala jednym kliknięciem zmienić domyślny wymiar dla danej zmiany w katalogu (np. `MIB` na 8.0h lub `MI4` na 4.0h).
- **Walidacja i TOR**:
  - System waliduje limit 12h na dobę (art. 135 KP).
  - Wymiar z `customHours` w 100% zasila sumę przepracowanych godzin, bilans miesięczny oraz rozliczenie kwartalne TOR.

---

## ⏰ 15. Dostosowywanie Przedziału Czasowego Zmiany (Od – Do) (`ShiftPickerPopover`, `ManagerScheduleEngine`)
- **Problem Biznesowy**:
  - Standardowe definicje zmian mają sztywne godziny ramowe (np. AM: 07:00–15:00, PM: 14:30–22:30, NC: 08:00–16:00).
  - W rzeczywistości operacyjnej kawiarni menedżer może zaczynać zmianę o innej porze (np. administracja od 09:00 do 17:00 zamiast od 08:00, lub wsparcie w innej kawiarni od 10:00 do 18:00).
- **Dwukierunkowa Synchronizacja Czasu w Popoverze (`ShiftPickerPopover`)**:
  - **Pole Od (Początek)**: wybór godziny startu lub szybki wybór z presetów (`07:00`, `08:00`, `08:30`, `09:00`, `10:00`, `11:00`, `12:00`, `13:00`, `14:00`, `14:30`) oraz steppery `-30m` / `+30m`.
  - **Auto-kalkulacja Końca**: Zmiana godziny startu automatycznie wylicza nową godzinę zakończenia na podstawie aktualnego czasu trwania zmiany ($\text{Koniec} = \text{Start} + \text{Czas Trwania}$).
  - **Pole Do (Koniec)**: Manualna modyfikacja godziny zakończenia natychmiast aktualizuje czas trwania zmiany ($\text{Czas Trwania} = \text{Koniec} - \text{Start}$).
- **Persystencja w SQLite (`manager_schedule_shifts`)**:
  - Kolumny `custom_start_time TEXT` i `custom_end_time TEXT` przechowują zdefiniowany przedział (np. `'09:00'`, `'17:00'`).
- **Wizualizacja na Matrycy Grafiku (`ManagerScheduleGrid`)**:
  - Tooltip komórki wyświetla dokładne godziny: `• Godziny: 09:00 – 17:00 (8.0h)`.
  - Badge zmiany wyświetla skrótowy przedział (np. `9-17`) lub dostosowany wymiar.
- **Tarcza Kodeksu Pracy i 11h Odpoczynku (art. 132 KP)**:
  - Weryfikator odpoczynku dobowego (`ManagerScheduleEngine.validateLaborLaw` oraz `testShiftCompliance`) używa `custom_start_time` i `custom_end_time`, jeśli zostały manualnie ustawione przez użytkownika.
  - **Płynna adaptacja godzin zmian administracyjnych (`NC`, `resolveEffectiveShiftTimes`)**: Zmiany administracyjne SM (`NC`) oraz pozostałe elastyczne kody Non-Coverage (`BT`, `T`, `MEE`, `PRE`, `SUP`) nie mają sztywnego przypisania do godzin 07:00–15:00 na sali. Jeśli użytkownik nie ustawił dla nich manualnego czasu startu, silnik (`resolveEffectiveShiftTimes`) automatycznie dopasowuje ich okno czasowe (np. `09:30–17:30` lub `10:00–18:00` po niedzielnym zamknięciu `PM` 22:30), gwarantując pełne 11.0h odpoczynku dobowego od dnia poprzedniego oraz 11.0h+ przed dniem kolejnym bez wywoływania fałszywych kolizji prawnych.
  - Zabezpieczenie działa zarówno pomiędzy kolejnymi dniami wewnątrz miesiąca, jak i na granicy miesięcy ($M-1 \rightarrow D_1$ oraz $D_{\text{last}} \rightarrow M+1$).

---

## ✨ 16. AutoScheduling — Inteligentny Generator Grafiku i Solver Optymalizacyjny (`autoSchedulerEngine.ts`, `AutoScheduleModal.tsx`)

### Geneza i Architektura Silnika Solverowego:
System automatycznie generuje w 100% poprawny, zbalansowany i zgodny z polskim Kodeksem Pracy grafik miesięczny dla zespołu menedżerów, łącząc twarde reguły prawne z heurystyczną optymalizacją dyspozycji i obsady kawiarni 108120 Starbucks Janki.

### Kluczowe Założenia i Zasady Solverowe:
1. **Twarda Tarcza Kodeksu Pracy (Zero Naruszeń)**:
   - **11h odpoczynku dobowego (art. 132 KP)**: bezwzględny zakaz planowania zmiany porannej (AM/AMN) bezpośrednio po wieczornej (PM/PMN) z poprzedniego dnia oraz na granicy miesięcy ($M-1 \rightarrow D_1$).
   - **35h odpoczynku tygodniowego (art. 133 KP)**: zakaz planowania więcej niż 6 kolejnych pracujących dni z rzędu.
   - **Max 3 pracujące niedziele pod rząd (art. 151^10 KP)**: zagwarantowanie min. 1 wolnej niedzieli na 4 tygodnie.
   - **Separacja zmian niedzielnych**: kody `AMN` (6.0h) i `PMN` (7.0h) wyłącznie w niedziele; w dni powszednie `AM` (8.0h) i `PM` (8.0h).
2. **Obsada Operacyjna (Coverage Minimum) & Przydział Zmian MID**:
   - Każdego dnia kawiarnia ma zagwarantowane min. 1 otwarcie (`AM`/`AMN`) i 1 zamknięcie (`PM`/`PMN`).
   - Gdy suma etatów zespołu przewyższa zapotrzebowanie bazy AM+PM ($\text{Surplus} > 0$), silnik automatycznie przydziela zmiany środkowe (`MID` / `MIB` 12:00–20:00) w dniach o najwyższym natężeniu ruchu (**Soboty**, **Piątki**, **Niedziele Handlowe**).
3. **Ochrona Zmian Stałych i Zasada Braku Samowolnego Dodawania NC / T / BT / SUP / H**:
   - **Zakaz samowolnego generowania zmian specjalnych**: AutoScheduling **kategorycznie nie dodaje sam z siebie** godzin administracyjnych `NC`, szkoleń `T`/`TAM`/`TPM`, wyjazdów `BT`, wsparć zewnętrznych `SUP`/`SAM`/`SPM` ani urlopów `H` czy chorobowego `L4`. Generator zajmuje się wyłącznie obsadą dyżurów operacyjnych na sali (`AM`, `PM`, `AMN`, `PMN`, `MIB`) oraz dni wolnych (`OFF`).
   - 🌟 **Smart Full**: układa cały miesiąc od nowa, zachowując sztywne absencje (`H`, `L4`), wprowadzoną administrację SM (`NC`), szkolenia (`T`, `TAM`, `TPM`), wyjazdy (`BT`), konserwacje (`PRE`), zebrania (`MEE`) i wsparcia zewnętrzne (`SUP`, `SAM`, `SPM`).
   - 🧩 **Fill Gaps**: zachowuje wszystkie dotychczas wprowadzone zmiany i dopełnia jedynie brakujące dyżury operacyjne i luki w etacie.
   - 🔒 **Pinned Shifts**: respektowanie komórek oznaczonych kłódką.
4. **Hierarchia Priorytetów i Dopasowanie Dyspozycji (Domyślne FULL i Czerwone OFF)**:
   - **Domyślna dyspozycyjność `FULL`**: w matrycy dyspozycyjności oraz całym systemie domyślnym stanem jest pełna dostępność `FULL` (07:00–22:30).
   - **Czerwone `OFF` jako prośba o wolne**: deklaracja `OFF` w matrycy dyspozycyjności jest traktowana jako formalna prośba o wolny dzień i oznaczana wyróżniającym się, czerwonym badge'em (`bg-rose-600 text-white` / `bg-rose-100 text-rose-950 border-rose-400 font-black`) z fizycznym oddzieleniem od pozostałych opcji w UI.
   - **Priorytet 1 (Twardy)**: Wypełnienie indywidualnego etatu menedżera ($\Delta \approx 0.0\text{h}$).
   - **Priorytet 2 (Miękki)**: Dopasowanie do preferencji:
     - `OFF`: wysoka kara punktowa (-900 pkt) za zaplanowanie pracy w dniu prośby o wolne.
     - `M`: preferencja poranków (+800 pkt dla `AM`/`AMN`, kara -800 pkt dla `PM`/`PMN`).
     - `Z`: preferencja zamknięć (+800 pkt dla `PM`/`PMN`, kara -800 pkt dla `AM`/`AMN`).
     - `FULL`: pełna elastyczność grafiku (+150 pkt).
   - **Priorytet 3 (Sprawiedliwość i Ergonomia AI — Fairness & Equity)**:
     - **Sprawiedliwy balans weekendów**: równomierny podział pracujących sobót i niedziel per menedżer na zbliżonym etacie oraz gwarancja min. 1 pełnego wolnego weekendu (Sobota + Niedziela `OFF`).
     - **Sprawiedliwy podział zamknięć**: równomierny rozkład wieczornych dyżurów `PM` / `PMN` pomiędzy kierowników zmian (SSV/ASM).
     - **Wygładzanie obciążenia tygodniowego (Weekly Workload Smoothing)**: pilnowanie korytarza tygodniowego (np. 32–44h / tydzień dla 1.0 etatu), zapobiegając przeciążeniom w jednym tygodniu i pustkom w innym.
     - **Pakiety 2 dni wolnego (Consecutive OFF)**: preferowanie łączenia wolnego w 2-dniowe bloki (`OFF + OFF`), unikanie 1-dniowych poszarpanych wysp pracy i promowanie rotacji zgodnej z zegarem biologicznym (`AM` $\rightarrow$ `MIB` $\rightarrow$ `PM` $\rightarrow$ `OFF`).
     - **Ciągłość z poprzedniego miesiąca (Inter-Month Continuity)**: wliczanie ostatniego tygodnia i weekendu z poprzedniego miesiąca (`prevMonthShifts`) w celu ochrony pierwszego weekendu nowego miesiąca.
5. **Asynchroniczny Widżet Pływający w Tle i Zegarowy Radialny Pasek Postępu (`AutoScheduleWidget.tsx`, 20 000 prób)**:
   - **Pływające kółeczko po lewej stronie grafiku**: Kompaktowy, elegancki widget Starbucks Emerald po lewej stronie matrycy grafiku z animowaną ikoną AI i statusem.
   - **Dwie czyste opcje bez zbędnych checkboxów**: Po kliknięciu w kółko rozwijają się 2 proste opcje: **🌟 Smart Full (Pełne Generowanie)** oraz **🧩 Fill Gaps (Dopełnij Luki)**. Wszystkie zaawansowane heurystyki (ochrona dyspozycji, tarcza KP, sprawiedliwy podział weekendów i zamknięć, 2-dniowe pakiety OFF, wygładzanie tygodniowe) działają **na stałe i domyślnie**.
   - **Praca asynchroniczna w tle**: Solver wykonuje pełne **20 000 prób Monte Carlo** w tle w nieblokujących porcjach batchowych (`BATCH_SIZE = 150`). Użytkownik może swobodnie zamknąć menu, edytować komórki grafiku, przełączać miesiące i wykonywać inne zadania podczas generowania.
   - **Zegarowy Radialny Pasek Postępu (Clockwise SVG Progress Ring)**: Dookoła kółka wypełnia się okrągły pierścień SVG płynnie od 0% do 100% zgodnie z ruchem wskazówek zegara, a w środku wyświetlany jest aktualny procent zaawansowania.
   - **Powiadomienie o gotowości i panel propozycji (`AutoScheduleModal.tsx`)**: Po zakończeniu 20 000 prób kółeczko pulsuje na zielono z badgem gotowości. Kliknięcie otwiera zoptymalizowany pulpit podglądu wygenerowanej propozycji (KPI, Siatka, Bilans etatów, Diff, Wyjaśnienia AI) z 1-klikiem zatwierdzenia lub odrzucenia.
6. **Transakcyjny Zapis i Wersjonowanie**:
   - Bezpieczny zapis przez dedykowany handler IPC `db:save-batch-manager-shifts` z automatycznym punktem przywracania w historii wersji (`manager_schedule_versions`).

---

## 🤝 17. Asystent Negocjacji z Zespołem i Ochrona TPLH (`AutoScheduleModal.tsx`, `autoSchedulerEngine.ts`)

### 1. Asystent Kompromisów i Negocjacji Dyspozycji (`ConflictInsight`, `ConflictNegotiationOption`):
- **Wykrywanie Sytuacji Patowych**: Gdy ze względów prawnych (odpoczynek 11h, urlopy H/L4) lub obsadowych nie da się obsadzić kawiarni bez przydzielenia dyżuru pracownikowi z prośbą o `OFF`, silnik natychmiast generuje dedykowaną kartę analizy patu.
- **Diagnoza Blokad Zespołu**: Prezentacja przyczyn niemożliwości obsadzenia przez innych (np. *Dawid Szeluga: brak 11h odpoczynku po PM; Zuzanna: Urlop H; Weronika: limit 0.5 etatu*).
- **3-4 Konkretne Warianty Kompromisu**:
  1. **Zamiana z Rekompensatą Wolnego**: Wyszukanie innego pracującego dnia w miesiącu na oddanie wolnego `OFF` w zamian za ten dyżur, z zachowaniem 100% normy etatu i odpoczynku.
  2. **Gotowy Generator Wiadomości na WhatsApp/SMS**: 1-klik kopiowanie uprzejmej prośby do pracownika (`handleCopyMessage`).
  3. **1-klik Aplikacja Kompromisu**: Natychmiastowe przeliczenie grafiku w pamięci podglądu z aktualizacją KPI i bilansów.
  4. **Wsparcie Zewnętrzne (`SUP`)**: Wstawienie dyżuru wsparcia i natychmiastowe zwolnienie pracownika na `OFF`.

### 2. Twarda Ochrona Dobowych Limitów TPLH i Floor Hours:
- **Niedziele i Święta (w tym 1.11 Wszystkich Świętych)**: Bezwzględny limit **dokładnie 2 osób (1x AMN + 1x PMN)**. Bezwzględny zakaz duplikowania otwarć/zamknięć na dniach o niskim popycie.
- **Dni powszednie (Pn–Cz)**: Standardowo 2 osoby na dyżurach lokalu (1x AM + 1x PM) + opcjonalne NC.
- **Dni szczytowe (Pt–Sob)**: Max 3 osoby (1x AM + 1x PM + max 1x MID/MIB).

### 3. Alokacja Nadwyżek Godzinowych (`MIB` & `SUP`):
- Wszystkie wolne godziny potrzebne menedżerom do osiągnięcia **100% normy etatu (0 niedogodzin w TOR)** są rozdzielane w dniach roboczych i sobotach jako:
  - **`MIB` (Środkowa / Barista na barze)**: wsparcie szczytów popytowych i Customer Connection.
  - **`SUP` (Support do oddania)**: elastyczne dyżury do oddania jako płatne wsparcie do innej kawiarni Starbucks w Warszawie (Nowy Świat, Sadyba, Arkadia) lub jako 2. osoba na barze.

---

## 🤝 18. Asystent Wsparcia Międzykawiarnianego (`InterStoreSupportEngine`, `InterStoreSupportModal`)

Narzędzie umożliwia Store Managerowi kawiarni 108120 Janki natychmiastową, zautomatyzowaną obsługę nagłych próśb o wsparcie menedżerskie z innych kawiarni Starbucks w dystrykcie (np. `323 Nowy Świat`, `341 Sadyba`, `756 San Park`, `327 Arkadia`):

### 1. Trzy Inteligentne Scenariusze Oddawania Zmian:
1. **Scenariusz 1 (Bezpośrednia Nadwyżka)**:
   - Konwersja zbędnej w Janki zmiany środkowej `MIB`/`MID`/`SUP` lub zdublowanego otwarcia/zamknięcia bezpośrednio w zmianę wyjazdową `SAM` (otwarcie 07:00–15:30), `SPM` (zamknięcie 14:30–23:00) lub elastyczne `SUP` (8.0h).
   - **Wpływ na Janki**: Zero zmian dla pozostałych pracowników, brak konieczności dobierania obsady.
2. **Scenariusz 2 (Wewnętrzna Sztafeta / Zamiana Obsadowa)**:
   - Pracownik A (który miał np. `AM` w Janki) jedzie na wsparcie (`SAM`/`SUP`), a jego zmianę w Janki przejmuje Pracownik B (który miał zaplanowany `OFF`).
   - Obaj pracownicy mają w 100% zweryfikowaną zgodność z Kodeksem Pracy (11h odpoczynku dobowego dzień wcześniej i dzień później oraz 35h odpoczynku tygodniowego).
3. **Scenariusz 3 (Rotacja z Dniem Rekompensaty)**:
   - Pracownik zgadza się pojechać na wsparcie w swoim dniu wolnym `OFF`, a system automatycznie wyszukuje inny dzień powszedni w miesiącu na oddanie wolnego `OFF`, zachowując idealny bilans etatu i 0 nadgodzin.

### 2. Twarde Ograniczenia i Bezpieczeństwo Operacyjne:
- **Twarda Ochrona Floor Hours w Janki**: Narzędzie **bezwzględnie zabrania** oddania zmiany, jeśli pozostawiłoby to lokal 108120 Janki bez kluczowej obsady otwarcia (1x `AM`) lub zamknięcia (1x `PM`).
- **Pre-flight Tarcza Kodeksu Pracy**: Rygorystyczna kontrola normy 11h odpoczynku dobowego (art. 132 KP) oraz 35h odpoczynku tygodniowego (art. 133 KP) przed i po zmianie wsparcia.
- **Wliczanie do Etatu**: Godziny wypracowane na wsparciu wliczają się w 100% do etatu menedżera oraz rozliczenia TOR, lecz nie wliczają się do obsady sali Janki.

### 3. Komunikacja i Szybkie Zastosowanie (1-Click Hub):
- **1-klik Kopiowanie SMS / WhatsApp**: Gotowe, profesjonalnie zredagowane wiadomości do Store Managera proszącej kawiarni oraz do pracownika delegowanego na wsparcie.
- **1-klik Zastosowanie w Bazie SQLite**: Zmiany są transakcyjnie zapisywane w bazie danych, tworząc automatyczny punkt przywracania w historii wersji grafiku.

