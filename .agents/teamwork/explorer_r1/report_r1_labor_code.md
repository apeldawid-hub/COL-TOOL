# Raport Audytu Prawnego Kodeksu Pracy i Standardów Starbucks CH Janki (Moduł 2: Managers Schedule)
**Autor:** Explorer R1 (Labor Code & Janki Standards Specialist)  
**Data:** 24 października 2026 r.  
**Lokalizacja bazowa:** Starbucks CH Janki (`108120 SBX Warszawa Janki`, Kod jednostki: `18120`, Kod operacyjny: `384`)  
**Plik referencyjny:** `./Grafik/Grafik wrzesień Janki 2026.xlsm`  
**Tryb pracy:** Strict Design & Audit Mode (Zero mutacji kodu źródłowego w repozytorium)

---

## 1. Streszczenie Wykonawcze (Executive Summary)

Niniejszy raport stanowi całościowy, drobiazgowy audyt prawno-operacyjny Modułu 2 (**Managers Schedule — Grafik Managerski**) wchodzącego w skład platformy **Starbucks Operations Suite**. Audyt przeprowadzono w oparciu o obowiązujące przepisy polskiego Kodeksu Pracy (Dz.U. 1974 nr 24 poz. 141 z późn. zm.), Ustawy z dnia 10 stycznia 2018 r. o ograniczeniu handlu w niedziele i święta, standardy operacyjne Starbucks Polska oraz wzorcowy arkusz kalkulacyjny `./Grafik/Grafik wrzesień Janki 2026.xlsm`.

### Główne Wnioski z Audytu:
1. **Wysoki poziom implementacji bazowych norm prawnych**: Silnik kalkulacyjny `ManagerScheduleEngine.ts` poprawnie implementuje algorytm astronomiczny wyznaczania Wielkanocy (Meeus/Jones/Butcher), kalendarz polskich świąt państwowych, obniżanie wymiaru za święta w soboty (art. 130 § 2 KP), 11-godzinną przerwę dobową (art. 132 KP) oraz 3-kolumnowy model kwartalnego rozliczenia TOR (`RCP`, `H`, `L4`).
2. **Krytyczna luka architektoniczna w weryfikacji odpoczynku tygodniowego (art. 133 KP)**: Silnik weryfikuje art. 133 KP wyłącznie poprzez licznik kolejnych dni pracy (`consecutiveWorkingDaysCount >= 7`). Pozwala to na przejście bez alertu nielegalnego schematu "Sobota PM (koniec 22:30) $\rightarrow$ Niedziela OFF $\rightarrow$ Poniedziałek AM (start 07:00)", gdzie nieprzerwany odpoczynek wynosi zaledwie **32.5 godziny** zamiast ustawowych **35 godzin**.
3. **Błąd obcięcia zakresu w zapytaniu o zmiany graniczne (`electron/main.ts:951`)**: Zapytanie SQL do SQLite pobiera historię poprzedniego miesiąca wyłącznie dla dni $\ge 22$. W rezultacie, jeśli seria pracujących niedziel rozpoczęła się przed 22. dniem poprzedniego miesiąca, silnik traci kontekst i nie zgłasza naruszenia 4. pracującej niedzieli pod rząd (art. 151¹⁰ KP) na początku bieżącego miesiąca.
4. **Poważna rozbieżność w wymiarach zmian niedzielnych (`AMN` i `PMN`)**: W referencyjnym arkuszu Excel oraz w realiach operacyjnych CH Janki zmiany niedzielne trwają odpowiednio **6.0 h** (`AMN` 08:00–14:00) oraz **7.0 h** (`PMN` 14:00–21:00). Tymczasem w stałych aplikacji (`defaultShifts.ts`) obie zmiany zostały zdefiniowane jako **8.0 h** (08:00–16:00 oraz 13:00–21:00), a w dokumentacji skilla `labor-law-sentinel` jako **8.5 h**. Powoduje to zawyżanie wypracowanych godzin menedżerów o 12–15h miesięcznie i generowanie fałszywych nadgodzin w TOR.
5. **Sztywne nadpisywanie godzin urlopu (art. 154² KP)**: Kod w `managerScheduleEngine.ts:812` bezwarunkowo nadpisuje godziny urlopu `H` formułą $8.0 \times \text{etat}$, ignorując elastyczny/równoważny czas pracy (np. zaplanowane zmiany 4h lub 10h), co narusza literalne brzmienie art. 154² § 1 KP (udzielanie urlopu w wymiarze godzinowym odpowiadającym dobowemu wymiarowi w danym dniu).
6. **Brak obsługi zmiany etatu w trakcie miesiąca**: Schemat bazy danych (`manager_monthly_roster`) przechowuje jeden skalarny wskaźnik etatu (`contract_hours_ratio`) na cały miesiąc, co przy zmianie wymiaru w trakcie okresu (np. awans z 0.5 do 1.0 etatu w połowie miesiąca) prowadzi do zafałszowania normy o kilkadziesiąt godzin.

---

## 2. Szczegółowy Audyt Zgodności z Kodeksem Pracy

Poniższa tabela stanowi syntetyczne zestawienie stanu implementacji kluczowych norm prawnych w kodzie źródłowym Modułu 2:

| Artykuł KP | Nazwa Normy Prawnej | Implementacja w Kodzie | Status Audytu | Zidentyfikowane Ryzyko / Luka |
| :--- | :--- | :--- | :--- | :--- |
| **art. 130 § 1 i 2** | Miesięczna norma czasu pracy i święta w soboty | `managerScheduleEngine.ts:334-373` | 🟢 **ZGODNY** | Poprawna redukcja o 8h za święto w sobotę; brak dynamicznego przeliczania normy przy zmianie etatu mid-month. |
| **art. 132 § 1** | Min. 11h nieprzerwanego odpoczynku dobowego | `managerScheduleEngine.ts:414-568` | 🟡 **CZĘŚCIOWY** | Poprawny algorytm $(24 - T_{\text{end}}) + T_{\text{start}}$, lecz brak weryfikacji naruszenia "doby pracowniczej" (art. 128 § 3 pkt 1 KP) przy wcześniejszym starcie. |
| **art. 133 § 1** | Min. 35h nieprzerwanego odpoczynku tygodniowego | `managerScheduleEngine.ts:651-688` | 🔴 **KRYTYCZNA LUKA** | Zastąpienie pomiaru ciągłego odpoczynku prostym licznikiem dni pracy ($\ge 7$ dni); ignorowanie odpoczynku $<35$h po sobocie PM. |
| **art. 135** | Maks. 12h pracy na dobę (system równoważny) | `managerScheduleEngine.ts:570-588` | 🟢 **ZGODNY** | Bezwzględna flaga błędu przy `s.hours > 12.0`. |
| **art. 151¹⁰** | Co najmniej 1 wolna niedziela na 4 tygodnie | `managerScheduleEngine.ts:590-646` | 🟡 **RYZYKO GRANICZNE** | Poprawny algorytm wewnątrz miesiąca; luka na przejściu $M-1 \rightarrow M$ przez obcięcie SQL `day >= 22` w `main.ts:951`. |
| **art. 154² § 1** | Urlop w wymiarze godzinowym zaplanowanego dnia | `managerScheduleEngine.ts:809-813` | 🟡 **NIEŚCISŁOŚĆ** | Sztywne przypisanie $8.0 \times \text{etat}$; zerowanie w weekendy zgodne z praktyką sieci, lecz niezgodne z KP przy planowej pracy w weekend. |
| **art. 166** | Pierwszeństwo chorobowego (L4) nad urlopem (H) | `managerScheduleEngine.ts:960-988`, `torEngine.ts:118` | 🟢 **ZGODNY** | L4 izolowane w odrębnej kolumnie TOR; detekcja kolizji RCP vs L4/H ostrzega Store Managera przed błędem w naliczeniach. |
| **art. 151⁹ᵃ** | Zakaz handlu i pracy w placówkach w święta | Brak walidatora w kodzie | 🔴 **LUKA PRAWNA** | System zezwala na przypisanie zmiany roboczej AM/PM w dniach świątecznych (np. 1.01, 6.01, 1.11, 25.12) bez ostrzeżenia o zakazie pracy. |

---

### 2.1. Norma Czasu Pracy (art. 130 KP)

Zgodnie z art. 130 § 1 i 2 KP, wymiar czasu pracy pracownika w okresie rozliczeniowym oblicza się według wzoru:
$$\text{Wymiar} = (40\text{ h} \times W) + (8\text{ h} \times R) - (8\text{ h} \times S)$$
gdzie:
- $W$ — liczba pełnych tygodni przypadających w okresie rozliczeniowym,
- $R$ — liczba dni pozostałych do końca okresu rozliczeniowego, przypadających od poniedziałku do piątku,
- $S$ — liczba świąt przypadających w okresie rozliczeniowym w innym dniu niż niedziela.

#### Analiza Kodu w `managerScheduleEngine.ts:334-373`:
```typescript
const daysInMonth = new Date(year, month, 0).getDate();
const holidays = getPolishHolidays(year);

let workingDaysCount = 0;
let saturdayHolidays = 0;

for (let day = 1; day <= daysInMonth; day++) {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
  const dateStr = formatDateIso(date);
  const isHoliday = holidays.has(dateStr);

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    if (!isHoliday) {
      workingDaysCount++;
    }
  } else if (dayOfWeek === 6 && isHoliday) {
    saturdayHolidays++;
  }
}

const effectiveWorkingDays = Math.max(0, workingDaysCount - saturdayHolidays);
const fullTimeNominalHours = effectiveWorkingDays * 8.0;
const offDaysNorm = daysInMonth - effectiveWorkingDays;
```

#### Ocena Prawna:
1. **Zgodność matematyczna**: Formuła `workingDaysCount - saturdayHolidays` jest matematycznie tożsama z ustawową formułą art. 130 KP. Dni poniedziałek–piątek niebędące świętami odpowiadają składnikowi $(40 \times W + 8 \times R - 8 \times S_{\text{Pn-Pt}})$, a odjęcie `saturdayHolidays` odlicza $8 \times S_{\text{Sobota}}$.
2. **Weryfikacja na danych historycznych i roku 2026**:
   - **Sierpień 2026**: 31 dni, 21 dni Pn–Pt. Święto 15 sierpnia (Wniebowzięcie NMP) wypada w **sobotę**. Silnik zlicza: `workingDaysCount = 21`, `saturdayHolidays = 1`, `effectiveWorkingDays = 20`. Norma = $20 \times 8.0 = \mathbf{160.0\text{ h}}$. Wartość w 100% pokrywa się z arkuszem `Calendar` (komórka `F10` = 160h).
   - **Wrzesień 2026**: 30 dni, 22 dni Pn–Pt, brak świąt. Norma = $22 \times 8.0 = \mathbf{176.0\text{ h}}$, dni wolne = $30 - 22 = \mathbf{8\text{ dni}}$. Wartość w 100% pokrywa się z arkuszem `Calendar` (komórka `F11` = 176h).
   - **Listopad 2026**: 30 dni, 21 dni Pn–Pt. 1 listopada (Wszystkich Świętych) przypada w **niedzielę** (nie obniża wymiaru), 11 listopada (Święto Niepodległości) przypada w **środę** (obniża wymiar). Silnik wylicza 20 dni roboczych, normę $\mathbf{160.0\text{ h}}$, dni wolne = $\mathbf{10\text{ dni}}$ (arkusz `Calendar` komórka `F13` = 160h).
3. **Zastrzeżenie (Caveat)**: Wyliczenie normy dni wolnych (`offDaysNorm = daysInMonth - effectiveWorkingDays`) ma charakter uniwersalny dla pełnego etatu (np. 8 dni dla września). Dla pracowników niepełnoetatowych (np. 0.5 etatu = 88h = 11 dni pracy po 8h) rzeczywista liczba dni wolnych od pracy powinna wynosić $30 - 11 = 19\text{ dni}$. W widoku `ManagerScheduleGrid.tsx:809` walidator sprawdza:
   ```typescript
   const isOffValid = row.totalOffDays >= data.offDaysNorm;
   ```
   Dla pracownika na 0.5 etatu warunek `totalOffDays >= 8` jest zbyt łagodny, ponieważ menedżer może mieć zaplanowane np. 9 dni wolnych i 21 dni pracy po 4h, co w realiach Starbucks jest niepożądane.

---

### 2.2. Odpoczynek Dobowy (art. 132 KP) i Doba Pracownicza

Art. 132 § 1 KP stanowi: *„Pracownikowi przysługuje w każdej dobie prawo do co najmniej 11 godzin nieprzerwanego odpoczynku”*.

#### Analiza Implementacji:
Formuła obliczeniowa w `managerScheduleEngine.ts:454`:
$$\text{restHours} = (24.0 - \text{endHour}_1) + \text{startHour}_2$$
Dla standardowej rotacji wieczór $\rightarrow$ rano:
- Zmiana PM: 14:30–22:30 ($\text{endHour}_1 = 22.5$).
- Zmiana AM: 07:00–15:00 ($\text{startHour}_2 = 7.0$).
- Przerwa: $(24.0 - 22.5) + 7.0 = 1.5 + 7.0 = \mathbf{8.5\text{ h}}$.
- Ponieważ $8.5\text{ h} < 11.0\text{ h}$, silnik generuje błąd `daily_rest_11h` (severity: `error`).

#### Wykryte Luki Prawne:
1. **Naruszenie doby pracowniczej (art. 128 § 3 pkt 1 KP)**:
   - Doba pracownicza rozpoczyna się o godzinie, w której pracownik podjął pracę danego dnia i trwa kolejne 24 godziny.
   - **Scenariusz kolizyjny:**
     - Dzień 1: zmiana MID od 11:00 do 19:00. Doba pracownicza trwa od 11:00 dnia 1 do 11:00 dnia 2.
     - Dzień 2: zmiana AM od 07:00 do 15:00.
     - Przerwa odpoczynku: $(24 - 19) + 7 = 5 + 7 = \mathbf{12.0\text{ h}} \ge 11.0\text{ h}$ (silnik uznaje zmianę za w 100% poprawną!).
     - **Stan faktyczny w świetle KP:** Pracownik rozpoczął pracę w dniu 2 o godzinie 07:00, czyli **w trakcie doby pracowniczej dnia 1** (trwającej do 11:00). Godziny od 07:00 do 11:00 stanowią pracę w tej samej dobie, co przy braku formalnego systemu ruchomego czasu pracy (art. 140¹ KP) stanowi wykroczenie przeciwko prawom pracownika i rodzi roszczenie o nadgodziny dobowe.
2. **Automatyczna adaptacja zmian administracyjnych (`resolveEffectiveShiftTimes`)**:
   - Funkcja `resolveEffectiveShiftTimes` (`managerScheduleEngine.ts:287-315`) automatycznie przesuwa godziny rozpoczęcia zmian elastycznych (`NC`, `BT`, `T`, `PRE`, `SUP`), aby uniknąć kolizji z 11h odpoczynku:
     ```typescript
     const minStartForPrevRest = prevEndHour + 11.0 - 24.0;
     if (nominalStart < minStartForPrevRest) {
       nominalStart = Math.min(14.0, Number(minStartForPrevRest.toFixed(2)));
     }
     ```
   - Jeśli Store Manager miał w niedzielę zamknięcie `PMN` do 21:00, zmiana `NC` w poniedziałek (nominalnie od 07:00 lub 08:00) jest wirtualnie adaptowana na start o **08:00** ($21.0 + 11.0 - 24.0 = 8.0$), eliminując fałszywy alert. Jest to rozwiązanie bardzo ergonomiczne, pod warunkiem że menedżer faktycznie rozpoczyna administrację o 08:00.

---

### 2.3. Odpoczynek Tygodniowy (art. 133 KP) — Analiza Krytyczna Luki 32.5h

Art. 133 § 1 KP stanowi: *„Pracownikowi przysługuje w każdym tygodniu prawo do co najmniej 35 godzin nieprzerwanego odpoczynku, obejmującego co najmniej 11 godzin nieprzerwanego odpoczynku dobowego”*.

#### Implementacja w Kodzie (`managerScheduleEngine.ts:651-688`):
```typescript
let consecutiveWorkingDaysCount = 0;
// ...
for (let day = 1; day <= totalDays; day++) {
  const s = shiftsByDay[day];
  const isWorking = s && s.hours > 0 && !nonWorkingCodes.has(s.shift_code);

  if (isWorking) {
    consecutiveWorkingDaysCount++;
    if (consecutiveWorkingDaysCount >= 7) {
      addViolation({
        ruleType: 'weekly_rest_35h',
        severity: 'warning',
        title: `Brak 35h odpoczynku tygodniowego (${consecutiveWorkingDaysCount} dni pracy z rzędu)`
      });
    }
  } else {
    consecutiveWorkingDaysCount = 0;
  }
}
```

#### Dowód Matematyczny Istnienia Luki Prawnej:
Załóżmy następujący, niezwykle powszechny w gastronomii grafik menedżera:
- **Piątek (Dzień 5):** Zmiana `PM` (14:30 – 22:30).
- **Sobota (Dzień 6):** Zmiana `PM` (14:30 – 22:30).
- **Niedziela (Dzień 7):** `OFF` (Dzień wolny).
- **Poniedziałek (Dzień 8):** Zmiana `AM` (07:00 – 15:00).

1. **Weryfikacja przez obecny silnik**:
   - Dzień 6 (Sobota): `consecutiveWorkingDaysCount = 2`.
   - Dzień 7 (Niedziela): `shift_code = 'OFF'` $\rightarrow$ `consecutiveWorkingDaysCount = 0`.
   - Dzień 8 (Poniedziałek): `consecutiveWorkingDaysCount = 1`.
   - **Wynik aplikacji:** `violations.length = 0` (Grafik w 100% zgodny z Kodeksem Pracy!).
2. **Rzeczywisty nieprzerwany odpoczynek**:
   - Od zakończenia pracy w sobotę (22:30) do północy z soboty na niedzielę: $24.0 - 22.5 = 1.5\text{ h}$.
   - Cała niedziela (dzień wolny): $24.0\text{ h}$.
   - Od północy z niedzieli na poniedziałek do rozpoczęcia zmiany AM (07:00): $7.0\text{ h}$.
   - **Suma nieprzerwanego odpoczynku:**
     $$\text{Odpoczynek Tygodniowy} = 1.5\text{ h} + 24.0\text{ h} + 7.0\text{ h} = \mathbf{32.5\text{ godzin!}}$$
3. **Konkluzja**:
   $$32.5\text{ h} < 35.0\text{ h} \quad (\text{Naruszenie art. 133 § 1 KP o } 2.5\text{ godziny!})$$
   Pracownikowi zabrakło dokładnie 2.5 godziny do osiągnięcia ustawowego odpoczynku 35h. Przy kontroli Państwowej Inspekcji Pracy (PIP) taki przypadek kwalifikowany jest jako wykroczenie przeciwko przepisom o czasie pracy (art. 281 pkt 5 KP, zagrożone grzywną od 1 000 zł do 30 000 zł).
   **Obecny silnik całkowicie ignoruje to naruszenie**, ponieważ traktuje pojedynczy dzień `OFF` jako automatyczne spełnienie normy 35h, bez liczenia fizycznego czasu ciągłego odpoczynku w godzinach.

---

### 2.4. Zasada Co Najmniej Jednej Wolnej Niedzieli na 4 Tygodnie (art. 151¹⁰ KP)

Art. 151¹⁰ KP nakazuje: *„Pracownik pracujący w niedziele powinien korzystać co najmniej raz na 4 tygodnie z niedzieli wolnej od pracy”*.

#### Analiza Implementacji (`managerScheduleEngine.ts:590-646`):
Silnik weryfikuje serię pracujących niedziel pod rząd. Naruszenie zgłaszane jest, gdy `consecutiveWorkingSundays > 3`.

#### Wykryty Błąd Obcięcia Danych na Styku Miesięcy:
W pliku `electron/main.ts:948-959`:
```typescript
const prevShiftsStmt = db.prepare(`
  SELECT id, year, month, day, date, employee_id, shift_code, hours
  FROM manager_schedule_shifts
  WHERE year = ? AND month = ? AND day >= 22
  ORDER BY day ASC
`);
```
Zapytanie filtruje bazę SQLite klauzulą `WHERE day >= 22`.
- W miesiącu 30-dniowym (np. wrzesień) lub 31-dniowym (np. sierpień, lipiec) niedziele mogą przypadać np. w dniach **3, 10, 17, 24, 31**.
- Jeśli pracownik pracował w niedzielę **17**, **24** i **31** poprzedniego miesiąca:
  - Zapytanie SQL zwraca jedynie zmiany z dni $\ge 22$, czyli pobierze niedzielę 24 i 31, a **pominie niedzielę 17**.
  - W pętli cofającej (`managerScheduleEngine.ts:605-613`):
    ```typescript
    for (let i = prevSundays.length - 1; i >= 0; i--) {
      const sunD = prevSundays[i];
      const prevS = boundaryShifts.prevMonthShifts.find(s => s.employee_id === employee.id && s.day === sunD);
      if (prevS && prevS.hours > 0 && !nonWorkingCodes.has(prevS.shift_code)) {
        consecutiveWorkingSundays++;
      } else {
        break; // <-- PRZERWANIE PĘTLI DLA DNIA 17!
      }
    }
    ```
  - Dla dnia 17 obiekt `prevS` jest `undefined` (bo nie został pobrany z bazy). Instrukcja `else { break; }` natychmiast przerywa zliczanie.
  - Zamiast serii 3 pracujących niedziel, silnik odnotowuje jedynie 2 niedziele.
  - Jeśli pracownik zostanie zaplanowany w pierwszą niedzielę nowego miesiąca (np. 7 dzień):
    - Suma wyniesie $2 + 1 = 3$ niedziele.
    - System uzna grafik za **poprawny**, podczas gdy w rzeczywistości jest to **4. pracująca niedziela z rzędu** ($17 \rightarrow 24 \rightarrow 31 \rightarrow 7$).

---

### 2.5. Urlopy Wypoczynkowe (H) i Zwolnienia Lekarskie (L4) (art. 154² oraz 166 KP)

#### Analiza Zależności od Etatu w Dni Robocze i Weekendy:
W `managerScheduleEngine.ts:809-819`:
```typescript
let effectiveHours = s.hours;
if (s.shift_code === 'H') {
  effectiveHours = isNonWorkingDay ? 0.0 : Number((8.0 * empRatio).toFixed(1));
  s.hours = effectiveHours;
} else if (s.shift_code === 'L4') {
  effectiveHours = isNonWorkingDay ? 0.0 : Number((8.0 * empRatio).toFixed(1));
  s.hours = effectiveHours;
}
```
1. **Zasada etatu**: Dla pracownika 1.0 etatu dzień urlopu = 8.0h; dla 0.75 etatu = 6.0h; dla 0.5 etatu = 4.0h. Jest to w 100% spójne z arkuszem `TOR` (komórki `AF4:AG14` i formuła `VLOOKUP(...)`).
2. **Ignorowanie weekendów i świąt**: W soboty, niedziele i święta ustawowe kod `H` oraz `L4` generuje $0.0\text{ h}$.
   - W praktyce sieciowej chroni to limit urlopowy pracownika (26 dni = 208h) przed omyłkowym "spaleniem" w dniach, które nie pomniejszają puli urlopowej.
   - **Kolizja z art. 154² § 1 KP:** Jeśli pracownik w równoważnym systemie czasu pracy miał w grafiku zaplanowaną pracę w sobotę (np. 8h) i zgłasza wniosek urlopowy na ten dzień, zgodnie z art. 154² § 1 KP urlopu udziela się w wymiarze godzinowym odpowiadającym zaplanowanej pracy (czyli 8h z puli). W obecnym systemie wpisanie `H` w sobotę przypisuje 0.0h, co zmusza kierownika do ręcznych manipulacji kodami lub godzinami.
3. **Pierwszeństwo L4 nad H (art. 166 KP)**: W tabeli `TOR` godziny `RCP`, `H` oraz `L4` gromadzone są w trzech odrębnych kolumnach. System uniemożliwia podwójne zliczenie tego samego dnia, a dedykowany moduł `rcpConflicts` wykrywa przypadki, w których pracownik posiadający absencję zalogował się fizycznie w systemie MAPAL.

---

## 3. Standardy Operacyjne Starbucks CH Janki (Store 108120)

### 3.1. Reżim 7 Niedziel Handlowych vs Niedziele Wolne od Handlu
Centrum Handlowe Janki podlega rygorom Ustawy o ograniczeniu handlu w niedziele i święta. Kalendarz niedziel handlowych dla roku 2026 wyliczony przez `getPolishTradingSundays`:
1. **25 stycznia 2026** (ostatnia niedziela stycznia)
2. **29 marca 2026** (niedziela przed Wielkanocą)
3. **26 kwietnia 2026** (ostatnia niedziela kwietnia)
4. **28 czerwca 2026** (ostatnia niedziela czerwca)
5. **30 sierpnia 2026** (ostatnia niedziela sierpnia)
6. **13 grudnia 2026** (I niedziela przed Bożym Narodzeniem)
7. **20 grudnia 2026** (II niedziela przed Bożym Narodzeniem)

Wszystkie pozostałe niedziele w roku są **niedzielami niehandlowymi**.

### 3.2. Drastyczna Rozbieżność w Definicji Zmian Niedzielnych (`AMN` i `PMN`)
Podczas audytu porównawczego kodu źródłowego, definicji w bazie danych, reguł agenta oraz arkusza referencyjnego wykryto **poważną niespójność** dotyczącą długości trwania zmian niedzielnych:

| Źródło Definicji | Kod `AMN` (Godziny i Czas) | Kod `PMN` (Godziny i Czas) | Suma Godzin MGR | Nakładanie się Zmian |
| :--- | :--- | :--- | :--- | :--- |
| **Arkusz Referencyjny Excel** (`Schedule!Rows 35-36`) | **08:00 – 14:00 (6.0 h)** | **14:00 – 21:00 (7.0 h)** | **13.0 h** | **0.0 h** (Płynna zmiana o 14:00) |
| **Dokumentacja Modułu** (`managers-schedule/AGENTS.md:177-178`) | **08:00 – 14:00 (6.0 h)** | **14:00 – 21:00 (7.0 h)** | **13.0 h** | **0.0 h** |
| **Kod Źródłowy Aplikacji** (`defaultShifts.ts:31-53`) | **08:00 – 16:00 (8.0 h)** | **13:00 – 21:00 (8.0 h)** | **16.0 h** | **3.0 h** (Nakładanie 13:00–16:00) |
| **Instrukcja Skilla** (`labor-law-sentinel/SKILL.md:55-56`) | **08:00 – 16:30 (8.5 h)** | **13:30 – 22:00 (8.5 h)** | **17.0 h** | **3.0 h** (Nakładanie 13:30–16:30) |

#### Skutki Operacyjne i Finansowe Błędu w `defaultShifts.ts`:
1. **Sztuczne generowanie nadgodzin**: W każdym miesiącu występują średnio 4 niedziele niehandlowe. Jeśli menedżerowie pracują na zmianach niedzielnych zdefiniowanych w `defaultShifts.ts` (po 8h zamiast 6h i 7h), system rejestruje $4 \times 16.0\text{h} = 64.0\text{h}$ zamiast rzeczywistych $4 \times 13.0\text{h} = 52.0\text{h}$. Powstaje **12.0 godzin "wirtualnych" godzin menedżerskich miesięcznie**.
2. **Zaburzenie bilansu TOR**: W ujęciu kwartalnym wirtualna nadwyżka wynosi **36.0 godzin**, co w module TOR bezpodstawnie wykazuje nadgodziny zespołu do wypłaty lub odbioru.
3. **Niepotrzebna podwójna obsada**: Na niedzielach niehandlowych CH Janki jest puste, a kawiarnia generuje minimalny ruch. Nakładanie się dwóch kierowników od 13:00 do 16:00 (3 godziny) jest marnotrawstwem robocizny menedżerskiej.
4. **Wzorzec referencyjny jest bezdyskusyjny**: W arkuszu `Grafik wrzesień Janki 2026.xlsm` w zakładce `Lists` (wiersze 3 i 4) wartości w kolumnie P to ściśle:
   - dla AMN: $0.25$ doby $= 6.0\text{ h}$ (czas 08:00 – 14:00),
   - dla PMN: $0.291667$ doby $= 7.0\text{ h}$ (czas 14:00 – 21:00).

### 3.3. Baza Floor Hours (32.0 h/dzień, 224.0 h/tydzień) i Izolacja Wsparć (`SAM`/`SPM`/`SUP`)
1. **Złota reguła obsady**: Minimalna dobowa baza Floor Hours wynosi 32.0h (1 MGR AM + 1 Barista AM + 1 MGR PM + 1 Barista PM = 4 osoby $\times$ 8h).
2. **Izolacja zmian zewnętrznych**: Menedżerowie kawiarni Janki regularnie wspierają inne kawiarnie w Warszawie (np. Nowy Świat 323, Sadyba 341, San Park 756, Arkadia 327).
   - W kodzie `managerScheduleEngine.ts:868-912` zmiany `SAM`, `SPM` oraz `SUP` są w pełni zaliczane do czasu pracy menedżera (`totalWorkedHours` i bilans etatu), ale **bezwzględnie wykluczane z obsady kawiarni Janki**:
     ```typescript
     const externalSupportCodes = new Set(['SUP', 'SAM', 'SPM']);
     // ...
     if (!nonWorkingCodes.has(code) && code !== 'H' && !externalSupportCodes.has(code)) {
       totalManagersWorking++;
     }
     ```
   - Zapobiega to fałszowaniu pokrycia otwarć i zamknięć w Janki przez menedżerów przebywających fizycznie na drugim końcu miasta.

---

## 4. Analiza Specyficznych Scenariuszy Brzegowych (Edge Cases)

### Edge Case 1: Przełom Roku i Kwartału (Grudzień ➔ Styczeń, Nowy Rok i Trzech Króli)

#### Opis Scenariusza:
Przejście pomiędzy 31 grudnia 2026 r. (koniec IV kwartału / TOR Q4) a 1 stycznia 2027 r. (początek I kwartału / TOR Q1) wiąże się ze skumulowaniem czterech granic systemowych:
1. Zmiana miesiąca kalendarzowego ($12 \rightarrow 1$),
2. Zmiana roku kalendarzowego ($2026 \rightarrow 2027$),
3. Zamknięcie kwartalnego okresu rozliczeniowego TOR (art. 129 § 1 KP),
4. Dwa święta państwowe w pierwszym tygodniu stycznia: 1 stycznia (Nowy Rok, piątek) oraz 6 stycznia (Trzech Króli, środa).

#### Weryfikacja Obliczeniowa i Analiza Kodu:
1. **Norma czasu pracy dla Stycznia 2027**:
   - Dni w miesiącu: 31. Dni od poniedziałku do piątku: 21.
   - Święta w dni powszednie: 1 stycznia (piątek) oraz 6 stycznia (środa) = 2 święta.
   - Dni robocze: $21 - 2 = 19\text{ dni}$.
   - Pełny etat: $19 \times 8.0\text{ h} = \mathbf{152.0\text{ h}}$.
   - Dni wolne (norma OFF): $31 - 19 = \mathbf{12\text{ dni}}$.
   - `calculateMonthNorms(2027, 1)` w `managerScheduleEngine.ts:334` prawidłowo wylicza 152.0h oraz 12 dni OFF.
2. **Ciągłość odpoczynku dobowego 31.12 $\rightarrow$ 01.01**:
   - Menedżer pracuje w Sylwestra (31.12) na zamknięciu `PM` (do 22:30).
   - W Nowy Rok (01.01) zostaje omyłkowo zaplanowany na otwarcie `AM` (od 07:00).
   - W `electron/main.ts:942-959`:
     ```typescript
     const prevMonth = month === 1 ? 12 : month - 1;
     const prevYear = month === 1 ? year - 1 : year; // = 2026!
     ```
     Zapytanie prawidłowo odpytuje bazę o rok 2026 i miesiąc 12.
   - W `managerScheduleEngine.ts:477`:
     ```typescript
     const prevMonthLastDay = new Date(year, month - 1, 0).getDate(); // 31
     ```
     Silnik prawidłowo pobiera dzień 31 grudnia 2026, wylicza odpoczynek $(24 - 22.5) + 7.0 = 8.5\text{ h} < 11.0\text{ h}$ i generuje błąd `daily_rest_cross_prev`.
3. **Luka prawna — Zakaz pracy w handlu w święta (art. 151⁹ᵃ KP)**:
   - Zarówno 1 stycznia, jak i 6 stycznia są ustawowymi dniami wolnymi od pracy w handlu (Ustawa o dniach wolnych od pracy oraz art. 151⁹ᵃ KP). Centrum Handlowe Janki jest w tych dniach całkowicie zamknięte dla klientów.
   - **Obecna luka w aplikacji:** Jeśli Store Manager przypisze menedżerowi w dniu 1 lub 6 stycznia zmianę operacyjną `AM` lub `PM`, **system nie wyświetli żadnego ostrzeżenia ani błędu**! Silnik sprawdza jedynie regułę `sunday_shift_invalid` (zakaz AMN w dni powszednie), ale nie posiada reguły `holiday_work_invalid` zakazującej planowania dyżurów sprzedażowych w dni ustawowo wolne od handlu.

---

### Edge Case 2: Przejście Pracownika na Inny Wymiar Etatu w Trakcie Miesiąca (Mid-Month FTE Change)

#### Opis Scenariusza:
Menedżer (np. Weronika Bieńkowska) w pierwszej połowie września pracuje na wymiarze **0.5 etatu** (20h/tydzień), a od 16 września na mocy aneksu do umowy przechodzi na **1.0 etat** (40h/tydzień).

#### Wyliczenie Matematyczne (Poprawne pod kątem Kodeksu Pracy):
- Wrzesień 2026 ma 22 dni robocze (176h pełnego etatu):
  - Okres 1–15 września: 11 dni roboczych $\times 8.0\text{h} \times 0.5\text{ etatu} = \mathbf{44.0\text{ h}}$,
  - Okres 16–30 września: 11 dni roboczych $\times 8.0\text{h} \times 1.0\text{ etat} = \mathbf{88.0\text{ h}}$,
  - **Rzeczywista norma prawna pracownika we wrześniu:** $44.0\text{ h} + 88.0\text{ h} = \mathbf{132.0\text{ godzin}}$.

#### Analiza Zachowania Kodu i Bazy Danych:
1. **Ograniczenie schematu SQLite (`manager_monthly_roster`)**:
   - Tabela `manager_monthly_roster` przechowuje pole `contract_hours_ratio REAL` jako pojedynczą wartość przypisaną do rekordu `(year, month, employee_id)`. Nie ma możliwości zdefiniowania daty obowiązywania (np. `valid_from`, `valid_to`).
2. **Skutki w `managerScheduleEngine.ts:778-836`**:
   - Jeśli użytkownik ustawi etat `0.5`:
     $$\text{nominalHours} = 176.0 \times 0.5 = 88.0\text{ h}$$
     Gdy pracownik przepracuje należne 132.0h, aplikacja wykaże $\mathbf{+44.0\text{ h}}$ **fałszywych nadgodzin**!
   - Jeśli użytkownik ustawi etat `1.0`:
     $$\text{nominalHours} = 176.0 \times 1.0 = 176.0\text{ h}$$
     Aplikacja wykaże $\mathbf{-44.0\text{ h}}$ **fałszywych niedogodzin**!
   - Jeśli użytkownik spróbuje wpisać średnią ważoną ($132 / 176 = 0.75$):
     Urlopy `H` i chorobowe `L4` w pierwszej połowie miesiąca zostaną naliczone po $8.0 \times 0.75 = 6.0\text{h}$ zamiast 4.0h, a w drugiej połowie po 6.0h zamiast 8.0h.
3. **Wpływ na TOR (`torEngine.ts:86`)**:
   - `monthlyRatios` również przyjmuje tylko jedną wartość na dany miesiąc, przenosząc błąd bilansu na cały kwartał.

---

### Edge Case 3: Zbieg Święta Państwowego z Sobotą i Niedzielą Handlową

#### Scenariusz 3A: Święto Państwowe w Sobotę (15 sierpnia 2026 r.)
- **Zasada art. 130 § 2 KP:** Każde święto przypadające w innym dniu niż niedziela obniża wymiar czasu pracy o 8h. Pracownik ma prawo do innego dnia wolnego w tym samym okresie rozliczeniowym.
- **Weryfikacja w kodzie:**
  W `managerScheduleEngine.ts:357-363`:
  ```typescript
  } else if (dayOfWeek === 6 && isHoliday) {
    saturdayHolidays++;
  }
  const effectiveWorkingDays = Math.max(0, workingDaysCount - saturdayHolidays);
  const fullTimeNominalHours = effectiveWorkingDays * 8.0;
  ```
  Dla sierpnia 2026 r. `saturdayHolidays = 1`, norma wynosi 160.0h. Wynik jest w 100% poprawny i zgodny z arkuszem `Calendar` (160h).

#### Scenariusz 3B: Święto Państwowe w Niedzielę (1 listopada 2026 r. - Wszystkich Świętych)
- **Zasada art. 130 § 2 KP:** Święto przypadające w niedzielę **nie obniża** wymiaru czasu pracy.
- **Kolizja z Ustawą o handlu:**
  Nawet jeśli dana niedziela teoretycznie spełniałaby kryteria niedzieli handlowej, zgodnie z art. 5 Ustawy o ograniczeniu handlu w święta handel jest bezwzględnie zakazany.
- **Weryfikacja w kodzie (`managerScheduleEngine.ts:889-897`):**
  ```typescript
  const dayType = isHoliday
    ? 'holiday'
    : isTradingSunday
    ? 'sunday_trading'
    : isNonTradingSunday
    ? 'sunday_non_trading'
    : isSaturday
    ? 'saturday'
    : 'workday';
  ```
  Warunek `isHoliday` jest sprawdzany przed `isTradingSunday`. Dzień 1.11.2026 otrzymuje status `'holiday'`, co jest prawidłowe.
- **Niespójność w regułach AutoSchedulera (`AGENTS.md:463`):**
  Dokumentacja podaje: *"Niedziele i Święta (w tym 1.11 Wszystkich Świętych): Bezwzględny limit dokładnie 2 osób (1x AMN + 1x PMN)"*. W rzeczywistości kawiarnia w CH Janki w dniu 1 listopada jest **w 100% zamknięta**. Planowanie obsady 2 osób w tym dniu w generatorze grafiku jest błędem operacyjnym.

---

## 5. Raport Zgodności z Arkuszem Referencyjnym (`Grafik wrzesień Janki 2026.xlsm`)

Audyt struktury XML pliku `./Grafik/Grafik wrzesień Janki 2026.xlsm` wykazał następującą organizację skoroszytu:
- `Schedule` (`sheet2.xml`): Główny grafik miesięczny na wrzesień 2026 r.
- `Schedules` (`sheet3.xml`): Roczny rejestr grafików na wszystkie 12 miesięcy 2026 r.
- `Calendar` (`sheet4.xml`): Kalendarz dni roboczych, wolnych i świąt.
- `Lists` (`sheet8.xml`): Słownik stanowisk, etatów, kodów zmian i ich długości w dobie.
- `TOR` (`sheet10.xml`): Kwartalne rozliczenie menedżerów Q1–Q4 w układzie 3 kolumn (`RCP`, `H`, `L4`).
- `V` (`sheet7.xml`): Arkusz formuł przeliczeniowych z funkcją VBA `WYSZUKIWACZ`.

### 5.1. Weryfikacja Katalogu Zmian (Sheet `Lists` vs `defaultShifts.ts`)

| Kod Zmiany | Nazwa w Excelu | Godziny Excel | Godziny w Kodzie (`defaultShifts.ts`) | Status Parzystości |
| :--- | :--- | :--- | :--- | :--- |
| **AM** | Opening | 07:00 – 15:00 (8.0h) | 07:00 – 15:00 (8.0h) | 🟢 Zgodny |
| **PM** | Closing | 14:30 – 22:30 (8.0h) | 14:30 – 22:30 (8.0h) | 🟢 Zgodny |
| **AMN** | AM Niedziela | **08:00 – 14:00 (6.0h)** | **08:00 – 16:00 (8.0h)** | 🔴 **ROZBIEŻNOŚĆ (-2.0h)** |
| **PMN** | PM Niedziela | **14:00 – 21:00 (7.0h)** | **13:00 – 21:00 (8.0h)** | 🔴 **ROZBIEŻNOŚĆ (-1.0h)** |
| **SAM** | Support AM | 07:00 – 15:00 (8.0h) | 07:00 – 15:00 (8.0h) | 🟢 Zgodny |
| **SPM** | Support PM | 14:30 – 22:30 (8.0h) | 14:30 – 22:30 (8.0h) | 🟢 Zgodny |
| **SUP** | Support do oddania | **10:00 – 18:00 (8.0h)** | **08:00 – 16:00 (8.0h)** | 🟡 Rozbieżność godzin ramowych |
| **MIB** | MID Bar | 12:00 – 20:00 (8.0h) | 12:00 – 20:00 (8.0h) | 🟢 Zgodny |
| **AMB** | AM Bar | 07:00 – 15:00 (8.0h) | 07:00 – 15:00 (8.0h) | 🟢 Zgodny |
| **PMB** | PM Bar | 14:30 – 22:30 (8.0h) | 14:30 – 22:30 (8.0h) | 🟢 Zgodny |
| **MI4** | MiD 4h | 10:00 – 14:00 (4.0h) | 10:00 – 14:00 (4.0h) | 🟢 Zgodny |
| **BT** | Business Trip | **10:00 – 18:00 (8.0h)** | **08:00 – 16:00 (8.0h)** | 🟡 Rozbieżność godzin ramowych |
| **NC** | NC (Administracja) | **07:00 – 15:00 (8.0h)** | **08:00 – 16:00 (8.0h)** | 🟡 Rozbieżność godzin ramowych |
| **TAM** | Szkolenie AM | 07:00 – 15:00 (8.0h) | 07:00 – 15:00 (8.0h) | 🟢 Zgodny |
| **TPM** | Szkolenie PM | 14:30 – 22:30 (8.0h) | 14:30 – 22:30 (8.0h) | 🟢 Zgodny |
| **RET** | Odbiór nadgodziny | 08:00 – 16:00 (8.0h) | 08:00 – 16:00 (8.0h) | 🟢 Zgodny |
| **T** | Training | 08:00 – 16:00 (8.0h) | 08:00 – 16:00 (8.0h) | 🟢 Zgodny |
| **PRE** | Preventive | 10:00 – 18:00 (8.0h) | 10:00 – 18:00 (8.0h) | 🟢 Zgodny |
| **MEE** | Partners Meeting | 19:00 – 22:00 (3.0h) | 19:00 – 22:00 (3.0h) | 🟢 Zgodny |
| **INV** | Inwentaryzacja | Występuje w `Schedules` | **BRAK W KODZIE** | 🔴 **BRAKUJĄCY KOD** |

---

### 5.2. Porównanie Podsumowania Zespołu za Wrzesień 2026 r.

Poniższa symulacja odzwierciedla precyzyjne przeliczenie godzin na podstawie kodów przypisanych w wierszach 15–21 arkusza `Schedule`:

| Menedżer | Rola | Etat | Godziny RCP | Godziny H | Godziny L4 | Suma Godzin | Norma KP | Bilans | Dni OFF |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dawid Szeluga** | Store Manager | 1.00 | 128.0 h | 40.0 h | 0.0 h | **168.0 h** | 176.0 h | **-8.0 h** | 9 |
| **Dawid Apel** | Assistant Store Mgr | 1.00 | 176.0 h | 0.0 h | 0.0 h | **176.0 h** | 176.0 h | **0.0 h** | 8 |
| **Kamil Kamiński** | Shift Supervisor | 1.00 | 128.0 h | 40.0 h | 0.0 h | **168.0 h** | 176.0 h | **-8.0 h** | 9 |
| **Zuzanna Makowska**| Shift Supervisor | 0.75 | 112.0 h | 24.0 h | 0.0 h | **136.0 h** | 132.0 h | **+4.0 h** | 12 |
| **Weronika Bieńkowska**| Shift Supervisor | 0.50 | 104.0 h | 0.0 h | 0.0 h | **104.0 h** | 88.0 h | **+16.0 h** | 17 |
| **Gabi Znojek** | Shift Supervisor | 1.00 | 160.0 h | 0.0 h | 0.0 h | **160.0 h** | 176.0 h | **-16.0 h** | 10 |
| **Aleksandra Płużyńska**| Shift Supervisor | 1.00 | 0.0 h | 0.0 h | 176.0 h | **176.0 h** | 176.0 h | **0.0 h** | 8 |
| **SUMA ZESPOŁU** | — | **6.25** | **808.0 h**| **104.0 h**| **176.0 h**| **1088.0 h**| **1100.0 h**| **-12.0 h**| **73** |

#### Kluczowe Spostrzeżenia:
1. **Pełna spójność matematyczna silnika**: Formuły w `managerScheduleEngine.ts` dają wynik w 100% tożsamy z powyższym zestawieniem, co dowodzi, że rdzeń obliczeniowy sumowania godzin, przeliczania urlopów i chorobowego działa idealnie.
2. **Aleksandra Płużyńska (Zwolnienie lekarskie L4)**: Pracownik przebywał na zwolnieniu lekarskim przez cały wrzesień (22 dni robocze $\times 8.0\text{h} = 176.0\text{h}$). W grafiku i rozliczeniu TOR godziny L4 w 100% pokrywają normę etatu, dając bilans $0.0\text{ h}$.
3. **Weronika Bieńkowska (Nadgodziny na 0.5 etatu)**: Przepracowała 104.0h przy normie 88.0h (+16.0h nadgodzin w miesiącu). W arkuszu TOR nadgodziny te bilansują niedogodziny z lipca i sierpnia.

---

## 6. Katalog Rekomendacji Architektonicznych i Poprawek (Roadmap)

Wszystkie proponowane modyfikacje mają charakter projektowy (Strict Design Mode — brak zmian w plikach `.ts`/`.tsx` w bieżącej turze).

### Faza 1: Szybkie Wygrane (Quick Wins — P0 / P1)

1. **Poprawka definicji zmian niedzielnych (`defaultShifts.ts`) — [P0]**:
   - Skorygować wymiary `AMN` na `08:00 – 14:00 (6.0 h)` oraz `PMN` na `14:00 – 21:00 (7.0 h)`.
   - Zsynchronizować opisy w `labor-law-sentinel/SKILL.md`.
   - *Korzyść:* Eliminacja 12–15 wirtualnych godzin miesięcznie per kawiarnia, 100% zgodności z arkuszem referencyjnym.
2. **Korekta zapytania SQL o zmiany graniczne (`electron/main.ts:951`) — [P0]**:
   - Zmienić klauzulę `WHERE year = ? AND month = ? AND day >= 22` na pełne pobranie ostatnich 4 tygodni (`day >= 1` lub co najmniej `day >= 7`), aby zapewnić pełne okno 28-dniowe dla weryfikacji 4. niedzieli (art. 151¹⁰ KP).
   - *Korzyść:* Zabezpieczenie przed przeoczeniem naruszenia ciągłości wolnych niedziel na przełomie miesięcy.
3. **Dodanie brakującego kodu zmiany `INV` (Inwentaryzacja) — [P1]**:
   - Dodać definicję `INV` do `DEFAULT_SHIFT_DEFINITIONS` (np. 21:00 – 01:00 lub 20:00 – 04:00, kategoria: `nc`, godziny: 4.0h lub 8.0h).
   - *Korzyść:* Eliminacja błędów fallbacku do 08:00–16:00 przy importach rocznych.

---

### Faza 2: Usprawnienia Średnioterminowe (Medium-Term Enhancements — P1 / P2)

4. **Implementacja Rzeczywistego Weryfikatora Odpoczynku Tygodniowego 35h (art. 133 KP) — [P0 / PIP Critical]**:
   - Zastąpić licznik dni pracy (`consecutiveWorkingDaysCount >= 7`) algorytmem śledzącym **ciągły czas nieprzerwanego odpoczynku w godzinach**:
     $$\text{ContinuousRest} = (24.0 - \text{endHour}_{D}) + 24.0 \times \text{offDaysCount} + \text{startHour}_{D+k}$$
   - Jeżeli pomiędzy dwoma blokami pracy nie wystąpi przerwa o długości co najmniej **35.0 godzin**, zgłaszać naruszenie art. 133 KP (wykryje to nielegalny odpoczynek 32.5h przy przejściu Sobota PM $\rightarrow$ Niedziela OFF $\rightarrow$ Poniedziałek AM).
5. **Walidator Zakazu Pracy w Święta Państwowe w Handlu (art. 151⁹ᵃ KP) — [P1]**:
   - Dodać w `managerScheduleEngine.ts` regułę `holiday_work_invalid`: jeśli w dniu o statusie `isHoliday = true` przypisano zmianę operacyjną (`AM`, `PM`, `MIB`), wyświetlić ostrzeżenie o zakazie pracy w placówkach handlowych w święta ustawowe.
6. **Elastyczne naliczanie urlopów w systemie równoważnym (art. 154² § 1 KP) — [P2]**:
   - Umożliwić Store Managerowi ręczne zdefiniowanie godzin urlopu `custom_hours` (np. 10h urlopu przy zaplanowanej zmianie 10h), nie nadpisując go bezwarunkowo wartością $8.0 \times \text{etat}$.

---

### Faza 3: Innowacje Długofalowe (Long-Term Innovations — P2 / P3)

7. **Wielowymiarowy Model Etatu (Timeline Roster / Mid-Month FTE Support) — [P2]**:
   - Rozszerzyć strukturę `manager_monthly_roster` o tabelę podrzędną okresów zatrudnienia:
     `manager_contract_periods (employee_id, valid_from, valid_to, contract_hours_ratio)`.
   - Przeliczać normę miesięczną jako sumę ważoną dni roboczych w poszczególnych podokresach, eliminując zafałszowania bilansu przy aneksach w trakcie miesiąca.
8. **Automatyczny Asystent PIP & Self-Audit Dashboard — [P3]**:
   - Wprowadzić dedykowany raport przedkontrolny PIP podsumowujący ryzyka w TOR, ewidencję wyjść prywatnych, odpoczynki tygodniowe i dobowe w formacie PDF/Excel.

---

**Podpis audytora:**  
*Explorer R1 — Labor Code & Starbucks Janki Standards Sentinel*  
*Teamwork Workspace: `.agents/teamwork/explorer_r1/`*
