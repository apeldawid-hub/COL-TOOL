# RAPORT AUDYTU R3: KWARTALNE ROZLICZENIE TOR ORAZ MODEL KOLIZJI FICHAJES RCP VS ABSENCJE
**Moduł 2: Managers Schedule — Starbucks Operations Suite (108120 SBX Warszawa Janki)**
**Autor**: Explorer R3 (Teamwork Explorer / Integrity & Labor Law Sentinel)
**Data audytu**: 2026-10-24
**Status**: DESIGN & AUDIT COMPLETE (Zero modyfikacji kodu w `src/`)

---

## Executive Summary (Podsumowanie Menedżerskie)

Niniejszy raport stanowi wyczerpujący audyt architektoniczny, algorytmiczny, matematyczny i prawny podsystemu **Trzymiesięcznego Okresu Rozliczeniowego (TOR, Q1–Q4)** oraz mechanizmów integracji z ewidencją czasu pracy **MAPAL Fichajes (RCP)** i detekcji kolizji absencji w **Module 2 (Managers Schedule)**.

Aplikacja implementuje wzorcowy podział na 3 kolumny godzinowe (`RCP`, `H`, `L4`) oraz zaawansowaną integrację z bazą SQLite (`labor_actuals_log`, `manager_monthly_roster`, `manager_schedule_shifts`). Pomimo wysokiej kultury inżynieryjnej i zgodności z referencyjnym arkuszem Excel (`Grafik wrzesień Janki 2026.xlsm`), audyt zidentyfikował **4 krytyczne luki logiczne i prawne**:

1. **Fałszywe niedogodziny u pracowników niepełnoetatowych (0.5, 0.75, 0.8 FTE)**: Sztywne przeliczanie dobowego wymiaru urlopu i chorobowego jako $8.0\text{h} \times \text{etat}$ (np. 4.0h dla 0.5 FTE) w połączeniu ze standardowymi 8-godzinnymi zmianami Starbucks (`AM`/`PM`) powoduje, że pojedynczy dzień nieobecności chorobowej na zaplanowanej zmianie generuje nieuzasadniony deficyt **-4.0h niedogodzin** w bilansie kwartalnym, z naruszeniem **art. 130 § 3 Kodeksu Pracy**.
2. **Zerowe zaliczenie L4 w weekendy i niedziele handlowe**: Silnik `torEngine.ts` bezwzględnie zeruje godziny `H` i `L4` w soboty i niedziele (`dayL4 = 0.0h`). Gdy menedżer choruje w dniu zaplanowanego dyżuru weekendowego (np. 7h `PMN` w niedzielę handlową CH Janki), system zdejmuje zmianę z grafiku, nie przyznaje żadnych godzin usprawiedliwionych i generuje **-7.0h fałszywych niedogodzin**.
3. **Cichy fallback do planu i myląca kontrolka MAPAL**: W przypadku braku logowań pracownika w danym miesiącu (np. nieobecność, błąd dopasowania nazwiska), silnik TOR po cichu pobiera godziny z roboczego grafiku zamiast 0.0h, oznaczając komórkę zieloną kropką `isRcpFromActuals` ("Zarejestrowane z MAPAL").
4. **Podwójne naliczanie godzin przy kolizji i brak aktywnej resolucji w UI**: W przypadku jednoczesnej rejestracji odbicia na kasie w MAPAL oraz zaplanowanego urlopu `H` lub `L4`, formuła sumowania $H_{\text{total}} = \text{RCP} + H + L4$ podwaja godziny (np. $8.5\text{h} + 8.0\text{h} = 16.5\text{h}$ w jednej dobie). Dialog `RcpAbsenceConflictDialog.tsx` jest czysto informacyjny (brak przycisków akcji/zamiany/podziału zmiany), co naraża kawiarnię na sankcje z **art. 17 Ustawy zasiłkowej** oraz **art. 283 § 1 Kodeksu Pracy**.

Poniższy raport zawiera szczegółową diagnozę matematyczno-prawną, analizę kodu źródłowego oraz 4 gotowe do wdrożenia specyfikacje techniczne (RFC).

---

## 1. Architektura i Matematyka 3-Kolumnowego Modelu TOR

### 1.1. Podział na Kwartały i Okresy Rozliczeniowe
Zgodnie z art. 129 § 1 Kodeksu Pracy, w kawiarniach Starbucks obowiązuje 3-miesięczny okres rozliczeniowy (TOR). W silniku `TorEngine.ts` (linie 16–45) zdefiniowano sztywne mapowanie:
- **Q1**: Styczeń (M1), Luty (M2), Marzec (M3)
- **Q2**: Kwiecień (M4), Maj (M5), Czerwiec (M6)
- **Q3**: Lipiec (M7), Sierpień (M8), Wrzesień (M9)
- **Q4**: Październik (M10), Listopad (M11), Grudzień (M12)

Funkcje pomocnicze `TorEngine.getQuarterMonths` oraz `TorEngine.getQuarterFromMonth` działają w pełni deterministycznie.

### 1.2. Model Trzech Kolumn Godzinowych
W tabeli TOR (`TorView.tsx`, linie 301–317) oraz w eksporcie Excel (`managerExcelExport.ts`, linie 133–146) każdy miesiąc kwartału reprezentowany jest przez **dokładnie 3 kolumny wejściowe** oraz 1 kolumnę bilansową:

| Kolumna | Źródło Danych | Reguła Obliczeniowa |
| :--- | :--- | :--- |
| **`RCP (h)`** | Rzeczywiste odbicia na kasie MAPAL (`labor_actuals_log`) lub dyżury z grafiku | Suma godzin zrealizowanych na sali w kawiarni macierzystej (Janki 384) oraz wsparć zewnętrznych (`SAM`, `SPM`, `SUP` w innych lokalach). |
| **`H (h)`** | Kod zmiany `H` w `manager_schedule_shifts` | Godziny płatnego urlopu wypoczynkowego przypadające w dni robocze. |
| **`L4 (h)`** | Kod zmiany `L4` w `manager_schedule_shifts` | Godziny usprawiedliwionej niezdolności do pracy z powodu choroby. |
| **`BILANS`** | Formuła różnicowa | $\text{Bilans}_M = (\text{RCP} + H + L4) - \text{Norma Indywidualna}_M$ |

### 1.3. Formuła Czasu Zaliczonego i Salda Kwartału
Zgodnie z `src/modules/managers-schedule/services/torEngine.ts` (linie 144–175):

$$\text{TotalHours}_M = \text{round}_1(\text{RCP}_M + H_M + L4_M)$$

$$\text{BalanceHours}_M = \begin{cases} \text{round}_1(\text{TotalHours}_M - \text{NormHours}_M) & \text{jeśli } \text{isActiveInMonth} = \text{true} \\ 0.0 & \text{jeśli } \text{isActiveInMonth} = \text{false} \end{cases}$$

$$\text{QuarterTotalBalance} = \text{round}_1\left(\sum_{M \in Q} \text{BalanceHours}_M\right)$$

### 1.4. Progi Kwalifikacji Statusu Kwartalnego
W silniku zastosowano strefę nieczułości (deadband) $\pm 0.1\text{ h}$ eliminującą błędy zaokrągleń zmiennoprzecinkowych IEEE 754:

$$\text{Status} = \begin{cases} \mathbf{\text{nadgodziny}} & \text{dla } \text{QuarterTotalBalance} > +0.1\text{ h} \\ \mathbf{\text{niedogodziny}} & \text{dla } \text{QuarterTotalBalance} < -0.1\text{ h} \\ \mathbf{\text{OK}} & \text{dla } \text{QuarterTotalBalance} \in [-0.1, +0.1]\text{ h} \end{cases}$$

**Ocena inżynieryjna**: Formuła bilansowania kwartału jest matematycznie spójna i poprawna w warunkach idealnych (gdy dane są kompletne, a pracownik pracuje w pełnym wymiarze czasu pracy od poniedziałku do piątku).

---

## 2. Audyt Zrównoważenia Czasu Pracy Niepełnego Etatu (Part-Time FTE)

### 2.1. Normy Miesięczne Pracowników Niepełnoetatowych
Norma pełnego etatu wyliczana jest w `ManagerScheduleEngine.calculateMonthNorms(year, month)`:
$$\text{Norma Pełny Etat} = (\text{Dni Pn–Pt bez świąt} - \text{Święta w soboty}) \times 8.0\text{ h}$$

Dla menedżerów niepełnoetatowych norma skaluje się liniowo przez `contract_hours_ratio`:
$$\text{Norma Indywidualna} = \text{round}_1(\text{Norma Pełny Etat} \times \text{contract\_hours\_ratio})$$

*Przykłady dla Września 2026 (22 dni robocze, 176.0h pełny etat):*
- **1.0 FTE**: $176.0 \times 1.0 = 176.0\text{ h}$ (Dawid Szeluga, Dawid Apel, Kamil Kamiński, Gabi Znojek, Aleksandra Płużyńska)
- **0.75 FTE**: $176.0 \times 0.75 = 132.0\text{ h}$ (Zuzanna Makowska)
- **0.50 FTE**: $176.0 \times 0.50 = 88.0\text{ h}$ (Weronika Bieńkowska)
- **0.80 FTE**: $176.0 \times 0.80 = 140.8\text{ h}$

### 2.2. Algorytm Naliczania Godzin H i L4 w Kodzie Źródłowym
W pliku `torEngine.ts` (linie 112–126) oraz w `managerScheduleEngine.ts` (linie 809–819) zaimplementowano następującą logikę dobową:

```typescript
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
const isHoliday = holidays.has(dateStr);
const isNonWorkingDay = isWeekend || isHoliday;

if (code === 'H') {
  hDays++;
  const dayH = isNonWorkingDay ? 0.0 : Number((8.0 * contractRatio).toFixed(1));
  hHours += dayH;
} else if (code === 'L4') {
  l4Days++;
  const dayL4 = isNonWorkingDay ? 0.0 : Number((8.0 * contractRatio).toFixed(1));
  l4Hours += dayL4;
}
```

### 2.3. Identyfikacja Błędu Matematyczno-Prawnego: "Pułapka Fałszywych Niedogodzin"

#### Źródło problemu
W gastronomii i retailu (Starbucks) pracownicy na 0.5 etatu nie pracują po 4.0h dziennie przez 5 dni w tygodniu. Pracują w **systemie równoważnego czasu pracy (art. 135 KP)** w pełnych 8-godzinnych zmianach operacyjnych (`AM` 07:00–15:00, `PM` 14:30–22:30).
Aby wypracować normę 88h we wrześniu 2026, menedżer na 0.5 etatu ma zaplanowane **11 zmian po 8.0h** oraz **19 dni wolnych (OFF)**.

#### Scenariusz A: Nieobecność na zaplanowanej zmianie roboczej
Załóżmy, że Weronika Bieńkowska (0.5 FTE, norma 88.0h) ma zaplanowaną na 10 września zmianę `PM` (8.0h). W tym dniu ulega wypadkowi lub chorobie i przynosi zwolnienie lekarskie ZUS ZLA na ten 1 dzień.
1. Kierownik zamienia kod `PM` na `L4` w dniu 10 września.
2. Zgodnie z `torEngine.ts`:
   $$\text{dayL4} = 8.0 \times 0.5 = 4.0\text{ h}$$
3. Liczba przepracowanych zmian: $10 \times 8.0\text{h} = 80.0\text{h}$.
4. Liczba godzin L4 zaliczona przez system: $1 \times 4.0\text{h} = 4.0\text{h}$.
5. Czas łączny: $80.0\text{h} + 4.0\text{h} = 84.0\text{h}$.
6. **Wynik bilansu w TOR**:
   $$\text{Bilans} = 84.0\text{h} - 88.0\text{h} = \mathbf{-4.0\text{ h} \quad (NIEDOGODZINY)}$$

#### Naruszenie Art. 130 § 3 Kodeksu Pracy
Zgodnie z art. 130 § 3 Kodeksu Pracy:
> *"Wymiar czasu pracy pracownika w okresie rozliczeniowym, ustalony zgodnie z art. 130 § 1 i 2, ulega obniżeniu o liczbę godzin usprawiedliwionej nieobecności w pracy, **przypadających do przepracowania w czasie tej nieobecności, zgodnie z przyjętym rozkładem czasu pracy**."*

W opublikowanym grafiku pracownik miał do przepracowania **8.0 godzin**. Wskutek choroby nie przepracował 8.0 godzin. Zaliczenie mu zaledwie 4.0 godzin kredytu powoduje, że pracownik zostaje ukarany deficytem 4.0 godzin za to, że zachorował w dniu, w którym grafik przewidywał 8-godzinną zmianę. Aby zlikwidować ten sztuczny deficyt, Store Manager musiałby bezprawnie kazać pracownikowi odpracować 4 godziny w innym terminie!

### 2.4. Identyfikacja Błędu Weekendowego i Niedziel Handlowych

#### Warunek brzegowy w kodzie
W liniach 108–110 `torEngine.ts`:
```typescript
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
const isHoliday = holidays.has(dateStr);
const isNonWorkingDay = isWeekend || isHoliday;
```
Dla **każdej soboty** (`dayOfWeek === 6`) oraz **każdej niedzieli** (`dayOfWeek === 0`):
`isNonWorkingDay` wynosi bezwzględnie `true`.
W konsekwencji:
$$\text{dayH} = 0.0\text{ h}, \quad \text{dayL4} = 0.0\text{ h}$$

#### Scenariusz B: Choroba w Niedzielę Handlową lub Pracującą Sobotę
Kawiarnia Starbucks w CH Janki funkcjonuje w 7 niedziel handlowych w roku oraz we wszystkie soboty.
1. Menedżer ma zaplanowaną zmianę w Niedzielę Handlową: `PMN` (7.0h) lub `AM` (8.0h).
2. Pracownik choruje w niedzielę.
3. W grafiku zostaje wpisany kod `L4`.
4. Silnik `torEngine.ts` stwierdza, że niedziela to `isWeekend = true`, więc `dayL4 = 0.0h`!
5. Godziny ze zmiany `PMN` (7.0h) znikają z `RCP`, a kolumna `L4` otrzymuje **0.0h**.
6. Bilans miesiąca natychmiast spada o **-7.0h** lub **-8.0h**, wywołując fałszywy status `niedogodziny`.

### 2.5. Ograniczenia Konfiguracji Etatów w UI (`ManagerTeamModal.tsx`)
W pliku `ManagerTeamModal.tsx` (linie 67–71) wykryto sztywny łańcuch warunkowy:
```typescript
if (type === 'FULL') updated[index].contract_hours_ratio = 1.0;
else if (type === '0.75') updated[index].contract_hours_ratio = 0.75;
else if (type === '0.5') updated[index].contract_hours_ratio = 0.5;
else if (type === '0.25') updated[index].contract_hours_ratio = 0.25;
```
Jeśli pracownik jest zatrudniony na **0.80 FTE (4/5 etatu)** lub **0.60 FTE (3/5 etatu)**:
- Żaden warunek `else if` nie zostaje spełniony.
- Pole `contract_hours_ratio` nie zostaje zaktualizowane i zachowuje poprzednią wartość (np. 1.0).
- Skutkuje to przypisaniem normy 176h zamiast 140.8h i wywołaniem ogromnego deficytu (-35.2h).

---

## 3. Audyt Odporności Bazy Danych i Obsługi Brakujących Danych

### 3.1. Odporność na Wartości Null i Niezdefiniowane w `TorEngine.calculateQuarterData`

Przeprowadzona analiza odporności typów w `torEngine.ts`:

| Parametr / Zmienna | Ryzyko Runtime (`undefined`/`null`) | Konsekwencja w Silniku | Rekomendowane Zabezpieczenie |
| :--- | :--- | :--- | :--- |
| `monthlyNorms` (linia 55) | Brak wpisu w bazie dla danego miesiąca | Silnik bezpiecznie używa fallbacku `ManagerScheduleEngine.calculateMonthNorms(year, m)`. Jednak gdy `monthlyNorms` jest `undefined` (brak parametru), próba odczytu `monthlyNorms[m]` wyrzuci `TypeError: Cannot read properties of undefined`. | Dodanie domyślnej inicjalizacji: `monthlyNorms: Record<number, MonthlyNormRecord | null> = {}`. |
| `shifts` (linia 76) | Brak przekazania tablicy zmian (`shifts = undefined`) | Wywołanie pętli `for (const s of shifts)` wyrzuci `TypeError: shifts is not iterable`. | Inicjalizacja: `for (const s of (shifts || []))`. |
| `employees` (linia 83) | `employees = undefined` | `[...employees]` wyrzuci `TypeError: employees is not iterable`. | Zabezpieczenie: `[...(employees || [])]`. |
| `s.hours` (linia 123) | Wartość `null` lub `string` z importu JSON | Wyrażenie `rcpHours += s.hours` może wywołać konkatenację ciągów tekstowych (np. `"08888"`) lub `NaN`. | Konwersja jawna: `Number(s.hours || 0)`. |
| `sort_order` (linia 81) | Brak wartości `sort_order` | `a.sort_order - b.sort_order` zwraca `NaN`, psując kolejność menedżerów. | `(a.sort_order ?? 99) - (b.sort_order ?? 99)`. |

### 3.2. Podatność "Cichego Fallbacku" i Dezinformacji UI (`isRcpFromActuals`)

W pliku `electron/main.ts` (linie 1125) stan `hasActualRcpByMonth[m]` definiowany jest na poziomie **całej kawiarni**:
```typescript
hasActualRcpByMonth[m] = mRcpDays.has(daysInM) || (mRcpDays.size >= 15);
```
Jeśli w bazie `labor_actuals_log` znajduje się co najmniej 15 dni logowań z MAPAL dla kawiarni, flaga `hasActualRcpByMonth[m]` przyjmuje wartość `true`.

W pliku `torEngine.ts` (linie 130–140):
```typescript
const isMonthClosed = ManagerScheduleEngine.isMonthClosed(year, m);
const hasActualRcp = isActiveInMonth && Boolean(
  hasActualRcpByMonth?.[m] || 
  (isMonthClosed && actualRcpByMonth?.[emp.id]?.[m] !== undefined)
);

if (hasActualRcp && actualRcpByMonth?.[emp.id]?.[m] !== undefined) {
  rcpHours = actualRcpByMonth[emp.id][m];
} else {
  rcpHours = Number(rcpHours.toFixed(1)); // ⚠️ POBIERA Z PLANOWANYCH ZMIAN GRAFIKU!
}

return {
  ...
  isRcpFromActuals: hasActualRcp, // ⚠️ FLAGA CAŁOMIESIĘCZNA, NIE PER-PRACOWNIK!
};
```

#### Zagrożenie operacyjne
Rozważmy Pracownika X (np. nowy kierownik zmiany lub pracownik, którego nazwisko w MAPAL różni się od bazy SQLite, np. "KOWALSKA, ANNA" vs "ANNA KOWALSKA-NOWAK"):
1. Kawiarnia zaimportowała pełny raport MAPAL Fichajes za wrzesień 2026 $\rightarrow$ `hasActualRcpByMonth[9] = true`.
2. Dla Pracownika X brak jest dopasowania w `actualRcpByMonth[emp.id][9]` (obiekt jest `undefined`).
3. Silnik wchodzi do gałęzi `else` i podstawia sumę godzin **z roboczego grafiku**.
4. W obiekcie wyjściowym silnik ustawia `isRcpFromActuals = true`.
5. W interfejsie (`TorView.tsx`, linie 371–373):
   ```tsx
   {m.isRcpFromActuals && (
     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Zarejestrowane logowania w systemie MAPAL" />
   )}
   ```
6. **Skutek**: Store Manager widzi zieloną kropkę sugerującą, że godziny pochodzą z oficjalnych logowań kasowych MAPAL. W rzeczywistości są to czysto szacunkowe godziny z wersji roboczej grafiku, ponieważ pracownik w ogóle nie odbił się w systemie lub algorytm fuzzy matching nie rozpoznał jego nazwiska.

### 3.3. Obsługa Zmian Składu w Trakcie Kwartału (`manager_monthly_roster`)
Podsystem wielomiesięcznej agregacji składu (`electron/main.ts`, linie 1040–1062) działa bardzo dojrzale:
- Silnik buduje mapę unikalnych pracowników ze wszystkich 3 miesięcy danego kwartału.
- Zapisuje listę `activeMonths` (miesiące, w których pracownik figurował w składzie) oraz `monthlyRatios` (indywidualne etaty w poszczególnych miesiącach).
- W miesiącach nieaktywności (`isActiveInMonth = false`) w tabeli TOR i eksporcie Excel pojawia się znak pauzy `-` zamiast mylącego `0.0h`, a norma wynosi `0.0h`. Zapobiega to generowaniu fałszywych niedogodzin u pracowników zatrudnionych w trakcie kwartału lub odchodzących z kawiarni.

---

## 4. Audyt Ewidencji Fichajes RCP i Detekcji Kolizji z Absencjami (L4 / H)

### 4.1. Architektura Rurociągu Danych (Data Pipeline)

```
[Arkusz Excel MAPAL Fichajes] 
       │ (Eksport tygodniowy/miesięczny)
       ▼
[universalReportParser.ts / mapalParser.ts]
       │ Normalizacja nazwisk (NICKNAME_MAP: Gabi <-> Gabriela, Zuza <-> Zuzanna)
       │ Filtracja lokali: unit_code == '384' / '18120' LUB managerNames.includes(emp)
       ▼
[Tabela SQLite: labor_actuals_log]
       │ (date, employee, computable_time, unit_code, unit_name)
       ▼
[IPC Handler: db:get-manager-schedule-data]
       │ rcpLogs[empId][day] = { hours, unitCode, unitName }
       ▼
[managerScheduleEngine.ts: linie 959-988]
       │ Detekcja kolizji: shiftCode in ['H', 'L4'] && rcpDay.hours > 0
       ▼
[Stan React: rcpConflicts: RcpAbsenceConflict[]]
       ├── Baner ostrzegawczy w ManagerScheduleView.tsx
       ├── Pulsująca odznaka ⚡ i złoty obrys w ManagerScheduleGrid.tsx
       └── Dialog RcpAbsenceConflictDialog.tsx
```

### 4.2. Błąd Podwójnego Naliczania Godzin przy Kolizji (Double-Crediting Bug)

W obecnej implementacji `torEngine.ts`:
```typescript
rcpHours = actualRcpByMonth[emp.id][m]; // Np. 168.0h z MAPAL (zawiera 8.0h z dnia kolizji)
...
if (code === 'H') {
  hHours += dayH; // Np. 8.0h z grafiku z tego samego dnia
}
...
const totalHours = Number((rcpHours + hHours + l4Hours).toFixed(1));
```

#### Przykład numeryczny
Menedżer ma w grafiku wpisany urlop `H` w dniu 15 września (8.0h). W tym samym dniu przychodzi do kawiarni na wezwanie lub pracuje na wsparciu w Arkadii (8.0h) i odbija się na kasie:
- W MAPAL pojawia się 8.0h $\rightarrow$ kolumna `RCP` wzrasta o 8.0h.
- W grafiku pozostaje kod `H` $\rightarrow$ kolumna `H` wzrasta o 8.0h.
- **Suma godzin zaliczonych**: $8.0\text{h (RCP)} + 8.0\text{h (H)} = \mathbf{16.0\text{ h}}$ w jednej dobie!
- Miesięczny bilans pracownika zostaje zawyżony o **+8.0h fałszywych nadgodzin**.
- Jeśli Store Manager nie usunie ręcznie kodu `H` z grafiku, pracownik otrzyma w rozliczeniu kwartalnym podwójne wynagrodzenie za ten sam dzień.

### 4.3. Konsekwencje Prawne Podwójnej Ewidencji w Polskim Prawie

#### 1. Praca w trakcie zwolnienia lekarskiego L4 (Art. 17 Ustawy Zasiłkowej)
- **Podstawa prawna**: Art. 17 ust. 1 Ustawy z dnia 25 czerwca 1999 r. o świadczeniach pieniężnych z ubezpieczenia społecznego w razie choroby i macierzyństwa:
  > *"Ubezpieczony wykonujący w okresie orzeczonej niezdolności do pracy pracę zarobkową lub wykorzystujący zwolnienie od pracy w sposób niezgodny z celem tego zwolnienia traci prawo do zasiłku chorobowego za cały okres tego zwolnienia."*
- **Skutki dla pracownika**: Całkowita utrata zasiłku chorobowego / wynagrodzenia chorobowego za cały okres orzeczonego zaświadczenia lekarskiego ZUS ZLA.
- **Skutki dla pracodawcy (Starbucks / AmRest)**:
  - Naruszenie **art. 207 i art. 229 Kodeksu Pracy** — dopuszczenie do pracy pracownika formalnie niezdolnego do pracy stanowi rażące naruszenie przepisów BHP.
  - Odpowiedzialność wykroczeniowa z **art. 283 § 1 KP** — kara grzywny od 1 000 zł do 30 000 zł nakładana przez Państwową Inspekcję Pracy (PIP).
  - W razie kontroli ZUS: Zakwestionowanie deklaracji rozliczeniowych ZUS RSA/RCA, obowiązek korekty dokumentów ubezpieczeniowych i zwrot nienależnie pobranych świadczeń wraz z odsetkami.

#### 2. Praca w trakcie urlopu wypoczynkowego H (Art. 164–167 Kodeksu Pracy)
- **Podstawa prawna**: Art. 166 i 167 § 1 Kodeksu Pracy.
- **Naruszenie procedury**: Pracownik nie może jednocześnie przebywać na urlopie wypoczynkowym i świadczyć pracy. Wykonywanie pracy w dniu zadeklarowanego urlopu wymaga:
  - Formalnego **odwołania pracownika z urlopu** przez pracodawcę (art. 167 § 1 KP — z przyczyn nieprzewidzianych w chwili rozpoczynania urlopu i ze zwrotem poniesionych kosztów), albo
  - Formalnego wniosku o **anulowanie/przesunięcie urlopu** (art. 164 § 1 KP).
- Pozostawienie kodu `H` w grafiku przy jednoczesnym logowaniu na kasie stanowi **fałszowanie ewidencji czasu pracy** (art. 149 KP), za co pracodawcy grozi grzywna z art. 281 pkt 6 KP.

### 4.4. Ocena Interfejsu i Przepływu w `RcpAbsenceConflictDialog.tsx`

Przegląd kodu w `src/modules/managers-schedule/components/RcpAbsenceConflictDialog.tsx`:
- **Zalety**:
  - Bardzo czytelna prezentacja danych (data, nazwisko menedżera, kod absencji, liczba godzin logowania, kod i nazwa lokalu wsparcia).
  - Wyróżnienie wizualne (czerwona kolorystyka, ikona tarczy `ShieldAlert`).
  - Prezentacja kontekstu: czy logowanie nastąpiło w Janki (384), czy na wsparciu w innej kawiarni (np. 323 Nowy Świat, 341 Sadyba).
- **Krytyczne wady i braki ergonomiczne**:
  1. **Czysto pasywny charakter (Read-Only)**: Jedynym elementem interaktywnym jest przycisk `<button onClick={onClose}>Zamknij powiadomienie</button>`. Dialog nie oferuje żadnych przycisków akcji naprawczej.
  2. **Brak akcji 1-Click Resolve**: Store Manager po przeczytaniu komunikatu musi zamknąć okno, ręcznie odnaleźć dany dzień i menedżera w siatce grafiku, kliknąć komórkę i ręcznie wybrać inną zmianę.
  3. **Brak obsługi podziału zmiany (Split Shift)**: Zdarza się, że menedżer przepracował 3 godziny otwarcia (07:00–10:00), po czym nagle zasłabł i udał się do lekarza, uzyskując L4 od tego samego dnia. W obecnym systemie zmiana może mieć tylko jeden kod: albo `AM` albo `L4`. Brak możliwości zarejestrowania: `AM 3.0h (RCP) + L4 (usprawiedliwione)`.
  4. **Brak ostrzeżenia w rurociągu importu**: Podczas importu pliku MAPAL (`universalReportParser.ts`) silnik w ogóle nie weryfikuje kolizji z istniejącymi wpisami w tabeli `manager_schedule_shifts`. Informacja o kolizjach pojawia się dopiero po wejściu do widoku grafiku.

---

## 5. Przegląd Danych Referencyjnych (`IMPORT/*.json`)

### 5.1. Analiza `IMPORT/manager_schedule_shifts.json`
- Zbiór zawiera 36 917 rekordów zmian od stycznia 2026.
- Struktura rekordu:
  ```json
  {
    "id": 3597,
    "year": 2026,
    "month": 1,
    "day": 1,
    "date": "2026-01-01",
    "employee_id": 1,
    "shift_code": "OFF",
    "hours": 0,
    "notes": null,
    "disposition": "",
    "custom_start_time": null,
    "custom_end_time": null
  }
  ```
- **Weryfikacja integralności**: Klucz unikalny `(year, month, day, employee_id)` jest przestrzegany. Pola `custom_start_time` i `custom_end_time` są w większości `null`, z wyjątkiem zmian o dostosowanym przedziale czasowym.

### 5.2. Analiza `IMPORT/labor_actuals_log.json`
- Zbiór zawiera 70 386 wpisów rzeczywistych odbić.
- Reprezentacja wsparć menedżerskich:
  ```json
  {
    "date": "2026-09-02",
    "employee": "APEL, DAWID",
    "category": "Assistant Manager",
    "contract_type": "Standard 1,0|40h",
    "computable_time": 9.69,
    "unit_code": "323",
    "unit_name": "108004 SBX Warszawa Nowy Swiat"
  }
  ```
- **Kluczowa obserwacja**: Wpis `APEL, DAWID` w lokalu `323` z czasem `9.69h` potwierdza konieczność obsługi wsparć zewnętrznych. Zmiana ta nie może zasilać obsady Floor Hours w CH Janki, ale musi w 100% zasilać kolumnę `RCP` w rozliczeniu TOR Dawida Apela.

---

## 6. Katalog Rekomendacji Architektonicznych i Specyfikacje RFC (Design Mode Only)

### 📋 RFC 1: Inteligentny Silnik Naliczania Godzin Usprawiedliwionych (Schedule-Aware Absence Engine)

#### Problem
Sztywne przypisywanie godzin nieobecności jako $8.0\text{h} \times \text{etat}$ w dni robocze oraz $0.0\text{h}$ w weekendy generuje fałszywe niedogodziny u pracowników niepełnoetatowych oraz u osób chorujących na zmianach weekendowych/niedzielnych.

#### Architektura rozwiązania
Wprowadzenie dwupoziomowego algorytmu wyliczania godzin usprawiedliwionych w `torEngine.ts` oraz `managerScheduleEngine.ts`:

1. **Poziom A: Grafik Opublikowany / Rozkład Przyjęty (art. 130 § 3 i art. 154² § 1 KP)**:
   - Jeżeli dla danego dnia w grafiku istniała zaplanowana zmiana robocza (np. `AM` 8h, `PMN` 7h, `MI4` 4h, `SUP` 8h) przed wprowadzeniem absencji, lub pole `s.hours` zostało manualnie dostosowane przez SM:
     $$\text{CreditedHours}(H \lor L4) = \text{scheduled\_shift\_hours}$$
   - Dotyczy to **również sobót i niedziel handlowych**, jeśli pracownik miał zaplanowaną pracę w tym dniu.

2. **Poziom B: Planowanie Nominalne / Brak Zaplanowanej Zmiany**:
   - Jeżeli pracownik zgłasza nieobecność przed ułożeniem grafiku na cały tydzień/miesiąc:
     - W dni robocze (Pn–Pt niebędące świętami):
       $$\text{CreditedHours} = 8.0\text{ h} \times \text{contract\_hours\_ratio}$$
     - W dni wolne z rozkładu (OFF, weekendy, święta):
       $$\text{CreditedHours} = 0.0\text{ h}$$

```typescript
// Proponowana implementacja w torEngine.ts
public static resolveCreditedAbsenceHours(
  shift: ManagerScheduleShift,
  empRatio: number,
  isNonWorkingDay: boolean
): number {
  // Jeśli zmiana w bazie posiada zachowany oryginalny wymiar zaplanowanego dyżuru (> 0h)
  if (shift.planned_work_hours && shift.planned_work_hours > 0) {
    return Number(shift.planned_work_hours.toFixed(1));
  }
  
  // W przypadku braku zaplanowanego dyżuru: kalkulacja nominalna
  if (isNonWorkingDay) return 0.0;
  return Number((8.0 * empRatio).toFixed(1));
}
```

---

### 📋 RFC 2: Interaktywny Moduł Rozwiązywania Kolizji w `RcpAbsenceConflictDialog.tsx`

#### Problem
`RcpAbsenceConflictDialog.tsx` jest oknem czysto pasywnym. Store Manager nie ma możliwości bezpośredniego rozwiązania konfliktu, co sprzyja pozostawianiu podwójnie naliczonych godzin i narusza art. 17 Ustawy zasiłkowej.

#### Specyfikacja UX & Architektury UI
Rozbudowa dialogu o panel szybkich akcji naprawczych (1-Click Hub) dla każdej wykrytej kolizji:

1. **Wariant 1: "Zamień na dyżur operacyjny" (Konwersja na pracę)**:
   - Kliknięcie przycisku zamienia kod `H` lub `L4` na:
     - `AM` lub `PM` (jeśli logowanie było w lokalu macierzystym 384),
     - `SAM`, `SPM` lub `SUP` (jeśli logowanie nastąpiło w obcym lokalu, np. 323 Nowy Świat).
   - Wymiar godzinowy zostaje zaktualizowany na podstawie rzeczywistego czasu z MAPAL (`computable_time`).
2. **Wariant 2: "Podziel zmianę (Praca + L4)" (Split Shift)**:
   - Dedykowany tryb dla sytuacji, gdy pracownik przepracował część zmiany (np. 3h), po czym poszedł na zwolnienie lekarskie.
   - Zapis w grafiku: `hours = rcpHours`, notatka: `Zalogowano Xh, reszta dnia L4`.
3. **Wariant 3: "Anuluj logowanie (Błąd odbicia)"**:
   - Oznaczenie wpisu w MAPAL flagą `is_disputed = 1` i zachowanie kodu absencji w grafiku (dla sytuacji, gdy inny pracownik omyłkowo zalogował się na cudzą kartę/kod).

```tsx
// Proponowany komponent akcji w RcpAbsenceConflictDialog.tsx
<div className="flex items-center gap-2 mt-2">
  <button
    onClick={() => handleConvertToWorkShift(c)}
    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
  >
    <Check className="w-3.5 h-3.5" />
    <span>Zmień na {c.unitCode && c.unitCode !== '384' ? 'Wsparcie (SUP)' : 'Dyżur (AM/PM)'}</span>
  </button>

  <button
    onClick={() => handleSplitShift(c)}
    className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer"
  >
    Podziel zmianę ({c.rcpHours}h praca + L4)
  </button>
</div>
```

---

### 📋 RFC 3: Walidacja Kolizji w Rurociągu Importu Fichajes (`universalReportParser.ts`)

#### Problem
Podczas importu arkusza MAPAL Fichajes system nie weryfikuje kolizji z istniejącymi nieobecnościami `L4`/`H` w `manager_schedule_shifts`. Dane są bezkrytycznie zapisywane do bazy.

#### Specyfikacja techniczna
W metodzie `parseMapalForPreview` w `universalReportParser.ts`:
1. Po sparsowaniu rekordów z arkusza Fichajes silnik wykonuje szybkie zapytanie sprawdzające:
   ```sql
   SELECT mss.employee_id, mss.day, mss.date, mss.shift_code, me.name
   FROM manager_schedule_shifts mss
   JOIN manager_employees me ON me.id = mss.employee_id
   WHERE mss.date >= ? AND mss.date <= ?
     AND mss.shift_code IN ('H', 'L4')
   ```
2. Jeśli importowany rekord Fichajes pokrywa się z dniem urlopu lub L4 pracownika:
   - Do tablicy `validation.warnings` dodawane jest ostrzeżenie o wysokim priorytecie:
     `"⚠️ Wykryto kolizję: Pracownik X posiada zaplanowany urlop/L4 w dniu Y, a w pliku MAPAL zarejestrowano Z godzin pracy."`
   - Na etapie podglądu importu użytkownik widzi badge ostrzegawczy z liczbą wykrytych kolizji przed ostatecznym kliknięciem "Zatwierdź i zapisz w bazie".

---

### 📋 RFC 4: Ochrona Integralności Danych i Precyzja Kontrolek MAPAL w `TorEngine`

#### Problem
Flaga `isRcpFromActuals` jest ustawiana globalnie na podstawie obecności danych dla kawiarni, a w razie braku danych pracownika system pobiera godziny z grafiku roboczego, dając złudzenie zweryfikowanego wpisu MAPAL.

#### Specyfikacja techniczna w `torEngine.ts`
1. **Rozdzielenie flagi statusu na poziom indywidualnego pracownika**:
   ```typescript
   // Kolumna RCP pochodzi z MAPAL wyłącznie wtedy, gdy ten konkretny pracownik ma wpis w actualRcpByMonth
   const hasEmployeeActuals = actualRcpByMonth?.[emp.id]?.[m] !== undefined;
   const isRcpFromActuals = isActiveInMonth && (hasEmployeeActuals || (isMonthClosed && hasEmployeeActuals));

   if (isRcpFromActuals) {
     rcpHours = actualRcpByMonth[emp.id][m];
   } else if (isMonthClosed && hasActualRcpByMonth?.[m]) {
     // Miesiąc jest zamknięty i kawiarnia ma kompletne dane z MAPAL, ale ten pracownik nie ma odbić:
     // Rzeczywisty czas pracy wynosi 0.0h (pracownik nie pracował), a NIE godziny z grafiku roboczego!
     rcpHours = 0.0;
   } else {
     // Miesiąc otwarty / planowany — pobieramy godziny z grafiku roboczego
     rcpHours = Number(rcpHours.toFixed(1));
   }
   ```
2. **Eliminacja twardo zakodowanych jednostek**:
   Usunięcie ciągów `'18120'`, `'108120'`, `'384'` w `universalReportParser.ts` i `managerExcelExport.ts`. Pobieranie jednostki dynamicznie z konfiguracji sklepu (`appSettings.unit_code`).

---

## 7. Podsumowanie Wniosków Audytowych (Verification Matrix)

| Obszar Audytu | Stan Obecny | Zgodność Prawna / Standard | Rekomendowany Priorytet |
| :--- | :--- | :--- | :--- |
| **Model 3-kolumnowy TOR** | Wdrożony i zoptymalizowany (`RCP`, `H`, `L4`) | Zgodny z `Grafik wrzesień Janki 2026.xlsm` | ✅ Stabilny |
| **Częściowe zatrudnienie (Part-Time)** | Sztywne $8\text{h} \times \text{etat}$ w dni powszednie | ❌ Naruszenie art. 130 § 3 KP (fałszywe niedogodziny) | 🔴 P1 (Krytyczny) |
| **Absencje w weekendy i niedziele handl.** | Sztywne zerowanie godzin w soboty i niedziele | ❌ Naruszenie art. 130 § 3 KP (utrata godzin przy L4) | 🔴 P1 (Krytyczny) |
| **Podwójne naliczanie przy kolizji** | $\text{RCP} + H + L4$ bez deduplikacji | ❌ Naruszenie art. 17 Ustawy zasiłkowej i art. 149 KP | 🔴 P1 (Krytyczny) |
| **Dialog kolizji RCP vs Absencja** | Dialog czysto informacyjny (brak akcji) | ⚠️ Ryzyko zignorowania ostrzeżenia przez SM | 🟡 P2 (Wysoki) |
| **Obsługa brakujących danych w TOR** | Cichy fallback do planu z zieloną kropką | ⚠️ Dezinformacja w interfejsie Store Managera | 🟡 P2 (Wysoki) |
| **Wielomiesięczny skład zespołu** | Autonomiczny skład per miesiąc, obsługa leavers | ✅ Pełna ochrona przed fałszywymi niedogodzinami | ✅ Stabilny |
| **Obsługa wsparć zewnętrznych (SUP)** | Wliczanie do RCP pracownika, wyłączenie z sali Janki | ✅ Zgodne ze standardem Starbucks | ✅ Stabilny |

---
*Raport sporządził: Explorer R3 — Starbucks Operations Suite Teamwork Squad*
*Tryb pracy: Ściśle projektowy (Design Mode) — zero mutacji plików źródłowych.*
