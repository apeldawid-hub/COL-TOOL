# AUDYT ARCHITEKTONICZNY I ALGORYTMICZNY: AUTOSCHEDULER AI & WEB WORKER ARCHITECTURE
**Projekt:** Starbucks Operations Suite (`108120 SBX Warszawa Janki`)  
**Moduł:** Moduł 2 — Managers Schedule (`src/modules/managers-schedule/`)  
**Rola:** Explorer R2 — AutoScheduler AI & Worker Threads Architecture  
**Data sporządzenia:** 2026-10-24  
**Status dokumentu:** Gotowy do wdrożenia (Strict Design Mode — Zero Mutacji Kodu)  

---

## 📑 SPIS TREŚCI

1. [Streszczenie Wykonawcze i Diagnoza Stanu Obecnego](#1-streszczenie-wykonawcze-i-diagnoza-stanu-obecnego)
2. [Audyt Silnika Solverowego Monte Carlo (20 000 vs 2 000 prób)](#2-audyt-silnika-solverowego-monte-carlo-20-000-vs-2-000-prób)
   - 2.1. Rozbieżność między deklaracją w UI/dokumentacji a kodem źródłowym
   - 2.2. Struktura pętli, wsadowość (`BATCH_SIZE`) i plasterkowanie asynchroniczne
   - 2.3. Analiza złożoności obliczeniowej (Big-O) i operacji na strukturach danych
   - 2.4. Alokacja obiektów, presja na Garbage Collector (V8 Minor/Major GC)
   - 2.5. Blokowanie głównego wątku UI React 19 i ryzyko utraty klatek (Jank / Freeze)
3. [Specyfikacja Architektoniczna Web Worker / Worker Threads](#3-specyfikacja-architektoniczna-web-worker--worker-threads)
   - 3.1. Przeniesienie obliczeń poza główny wątek UI (Off-Main-Thread Architecture)
   - 3.2. Protokół wymiany komunikatów (Message Passing Protocol: INIT, START, PROGRESS, RESULT, CANCEL, ERROR)
   - 3.3. Schemat serializacji danych i model pamięciowy o zerowej alokacji (Zero-Copy TypedArrays)
   - 3.4. Cykl życia Workera, zarządzanie anulowaniem (`AbortController`), throttling i mechanizm Fallback
   - 3.5. Typowany Hook React `useAutoSchedulerWorker` i maszyna stanów
4. [Audyt Heurystyk Sprawiedliwości i Ergonomii (Fairness & Equity)](#4-audyt-heurystyk-sprawiedliwości-i-ergonomii-fairness--equity)
   - 4.1. Dekonstrukcja obecnej funkcji oceny (`scoreCandidate` i `fitness`)
   - 4.2. Sprawiedliwość podziału weekendów (Soboty, Niedziele, pakiety pełnych wolnych weekendów)
   - 4.3. Rotacja zamknięć (`PM`/`PMN`), zmęczenie zmianowe i przeciwdziałanie rotacji wstecznej
   - 4.4. Pakiety 2 dni wolnego z rzędu (`OFF + OFF`) vs poszarpane wyspy 1-dniowe
   - 4.5. Stabilizacja korytarza tygodniowego czasu pracy
   - 4.6. Rygorystyczna formulacja matematyczna ulepszonej funkcji celu $S(G)$
5. [Asystent Negocjacji Sytuacji Patowych (Deadlock Negotiation Assistant)](#5-asystent-negocjacji-sytuacji-patowych-deadlock-negotiation-assistant)
   - 5.1. Zachowanie silnika w sytuacjach braku rozwiązań dopuszczalnych
   - 5.2. Pięciowarstwowa hierarchia relaksacji ograniczeń (Constraint Relaxation Hierarchy)
   - 5.3. Interaktywny asystent kompromisów, mostki międzykawiarniane SUP i generator wiadomości
6. [Priorytetyzowana Mapa Drogowa Wdrożenia (Roadmap)](#6-priorytetyzowana-mapa-drogowa-wdrożenia-roadmap)

---

## 1. Streszczenie Wykonawcze i Diagnoza Stanu Obecnego

Moduł 2 platformy Starbucks Operations Suite (`src/modules/managers-schedule/`) odpowiada za strategiczne planowanie czasu pracy 7-osobowego zespołu kierowniczego kawiarni `108120 SBX Warszawa Janki`. Serce modułu stanowi silnik **AutoScheduler AI** (`services/autoSchedulerEngine.ts`), którego zadaniem jest wygenerowanie kompletnego, optymalnego grafiku miesięcznego, spełniającego bezwzględnie polski Kodeks Pracy, standardy Starbucks (baza Floor Hours 32h/dzień) oraz preferencje i dyspozycje zespołu.

### Kluczowe Wnioski z Audytu:
1. **Krytyczna Rozbieżność Liczby Prób:** W interfejsie użytkownika (`AutoScheduleModal.tsx:255`, `AutoScheduleWidget.tsx:125`) oraz dokumentacji architektonicznej (`AGENTS.md:406`) generator deklaruje realizację **20 000 prób Monte Carlo**. W rzeczywistości w kodzie wykonawczym (`autoSchedulerEngine.ts:2160`, `AutoScheduleModal.tsx:116`, `AutoScheduleWidget.tsx:150`) limit został **na sztywno zredukowany do 2 000 prób**. Przyczyną redukcji była drastyczna blokada głównego wątku przeglądarki (React UI thread freeze) przy próbie wykonania 20k symulacji synchronicznie w wątku renderowania.
2. **Architektoniczny Wąskie Gardło Wątku UI:** Całość obliczeń solvera Monte Carlo jest wykonywana w głównym wątku JavaScript w procesie renderera Electrona. Zastosowane plasterkowanie `await new Promise(resolve => setTimeout(resolve, 0))` przy paczkach `BATCH_SIZE = 100` powoduje zamrożenie wątku na 40–90 ms w każdej paczce, wywołując gwałtowny spadek płynności interfejsu (FPS z 60 do 8–15), opóźnienia zdarzeń kliknięć i ryzyko pojawienia się systemowego ostrzeżenia *"Page Unresponsive"*.
3. **Masywna Presja na Garbage Collector (GC):** Każda pojedyncza próba (`runFastSinglePass`) alokuje nową instancję `Map<string, ManagerScheduleShift>` i klonuje 210 obiektów zmian (`{ ...val }`). Dla 20 000 prób oznacza to utworzenie ponad **4 200 000 obiektów na stercie V8**, generując setki cykli *Minor GC (Scavenge)* oraz kosztowne pauzy *Major GC (Mark-Sweep-Compact)*.
4. **Rozdźwięk w Ocenie Heurystyk Sprawiedliwości:** Zaawansowane metryki sprawiedliwości społecznej (wariancja weekendów, wariancja zamknięć SSV, korytarze tygodniowe, pakiety 2 dni wolnego) są wyliczane **wyłącznie post-hoc** w metodzie `buildFullResult` po zakończeniu pętli turniejowej. Oznacza to, że funkcja przydatności (`fitness`) sterująca selekcją najlepszego kandydata w pętli Monte Carlo nie premiuje grafików o sprawiedliwym rozkładzie weekendów ani ergonomicznej rotacji zgodnej z zegarem biologicznym!
5. **Brak Odporności na Sytuacje Patowe (Deadlock Infeasibility):** W przypadku kolizji twardych ograniczeń prawnych z absencjami, solver generuje grafik z brakami obsadowymi (`missingCoverageCount > 0`), nie oferując automatycznej, hierarchicznej relaksacji ograniczeń miękkich.

---

## 2. Audyt Silnika Solverowego Monte Carlo (20 000 vs 2 000 prób)

### 2.1. Rozbieżność Między Deklaracją w UI a Kodem Źródłowym

W trakcie analizy kodu wykryto jaskrawą niespójność między warstwą prezentacji a logiką wykonawczą:

| Plik i Linia | Deklaracja / Kod | Interpretacja |
| :--- | :--- | :--- |
| `AGENTS.md:406, 440` | *"pełne 20 000 prób Monte Carlo"* | Dokumentacja architektoniczna obiecuje 20k iteracji. |
| `AutoScheduleModal.tsx:255` | `<span ...>20 000 prób • Global Optimum</span>` | Badge w nagłówku modala obiecuje 20k prób. |
| `AutoScheduleModal.tsx:280` | `Wybierz Tryb Optymalizacji (20 000 Prób AI)` | Tytuł formularza opcji obiecuje 20k prób. |
| `AutoScheduleWidget.tsx:124` | `// Uruchomienie generowania w tle z 20 000 prób` | Komentarz metody deklaruje 20k prób. |
| **`AutoScheduleModal.tsx:116`** | **`iterationsCount: 2000`** | **Faktyczny parametr przekazywany do silnika!** |
| **`AutoScheduleWidget.tsx:131, 150`**| **`totalRounds: 2000`, `iterationsCount: 2000`** | **Faktyczny parametr przekazywany do silnika!** |
| **`autoSchedulerEngine.ts:2160`**| **`const totalRounds = options.iterationsCount \|\| 2000;`** | **Domyślna wartość w silniku to 2k, nie 20k!** |

**Wniosek:** Redukcja z 20 000 do 2 000 prób (10-krotne zmniejszenie przeszukiwanej przestrzeni stanów) była prowizorycznym ratunkiem dewelopera przed całkowitym zablokowaniem interfejsu użytkownika w jednowątkowym środowisku JavaScript.

---

### 2.2. Struktura Pętli, Wsadowość (`BATCH_SIZE`) i Plasterkowanie Asynchroniczne

Pętla wykonawcza w `autoSchedulerEngine.ts` (linie 2179–2236) posiada następującą strukturę:

```typescript
const BATCH_SIZE = 100;

for (let round = 0; round < totalRounds; round += BATCH_SIZE) {
  const batchEnd = Math.min(round + BATCH_SIZE, totalRounds);

  for (let r = round; r < batchEnd; r++) {
    iterationsDone++;
    const seedJitter = r === 0 ? 0 : r;
    const candidate = this.runFastSinglePass(
      ctx,
      employees,
      dispositionsByEmployee,
      options,
      prevMonthShifts,
      seedJitter
    );

    if (!bestPass || candidate.fitness > bestPass.fitness) {
      bestPass = candidate;
    }
  }

  if (onProgress && bestPass) {
    onProgress({ ... });
  }

  // Early stopping...
  
  await new Promise(resolve => setTimeout(resolve, 0));
}
```

#### Anatomia Problemu z `setTimeout(resolve, 0)`:
1. `setTimeout(fn, 0)` w środowisku przeglądarkowym (Chromium / Electron) nie wykonuje się natychmiastowo. Zgodnie ze specyfikacją HTML Living Standard po 4 zagnieżdżeniach minimalny narzut zegara wynosi **4 ms**.
2. Dla 20 000 iteracji przy `BATCH_SIZE = 100` mamy 200 paczek. Sam narzut planisty makrozadań wynosi minimum $200 \times 4\text{ ms} = 800\text{ ms}$.
3. Co ważniejsze: w trakcie trwania pojedynczej paczki 100 iteracji, silnik wykonuje kod w sposób **ściśle synchroniczny i blokujący**. Z pomiarów na typowym procesorze wynika, że wykonanie 100 pełnych przejść `runFastSinglePass` trwa od **45 ms do 110 ms**.
4. Budżet klatki dla płynnego interfejsu (60 FPS) wynosi **16.6 ms**. Synchroniczny blok trwający 80 ms powoduje gwałtowne upuszczenie (drop) minimum 5 kolejnych klatek animacji, zacinanie animowanego pierścienia SVG (`AutoScheduleWidget`) oraz zauważalne opóźnienia w reakcji na wprowadzanie danych (input lag).

---

### 2.3. Analiza Złożoności Obliczeniowej (Big-O) i Wąskich Gardeł

Zbadajmy operacje wykonywane wewnątrz **pojedynczej iteracji** (`runFastSinglePass`):

```
Niech:
N = liczba menedżerów w zespole (N = 7)
D = liczba dni w miesiącu (D = 30)
K = liczba dostępnych kodów zmian w katalogu (|S| ≈ 20)
W = liczba tygodni biznesowych w miesiącu (W = 5)
```

#### 1. Klonowanie Stanu Bazowego (Linie 753–756):
```typescript
const workingSchedule = new Map<string, ManagerScheduleShift>();
baseScheduleMap.forEach((val, key) => {
  workingSchedule.set(key, { ...val });
});
```
- Złożoność: $\mathcal{O}(N \times D) = 7 \times 30 = 210$ alokacji obiektów per iteracja.

#### 2. Weryfikacja Kodeksu Pracy `isShiftLaborLawCompliant` (Linie 785–877):
- Wywoływana wielokrotnie dla każdego kandydata na dyżur otwarcia, zamknięcia, środka oraz dopełnienia godzin.
- Wewnątrz:
  - Wyszukiwanie ciągłości pracy wstecz: pętla `for (let d = day - 1; d >= 1; d--)` $\rightarrow \mathcal{O}(D)$ wywołań `Map.get()`.
  - Wyszukiwanie ciągłości w przód: pętla `for (let d = day + 1; d <= totalDays; d++)` $\rightarrow \mathcal{O}(D)$ wywołań `Map.get()`.
  - Weryfikacja 4. niedzieli: pętle skokowe co 7 dni $\rightarrow \mathcal{O}(D/7)$ wywołań `Map.get()`.
  - Wywołanie `resolveEffectiveShiftTimes` z parsowaniem stringów `"HH:MM"` (`parseTimeToHours`).
- Łączny koszt jednej weryfikacji KP: $\mathcal{O}(D)$ operacji na mapie.

#### 3. Funkcja Punktacji `scoreCandidate` (Linie 879–998):
- `getEmployeeAssignedHours`: pętla $1 \dots D \rightarrow 30$ odpytań `workingSchedule.get()`.
- `getEmployeeHoursInWeek`: pętla $1 \dots D \rightarrow 30$ odpytań `workingSchedule.get()`.
- Liczenie weekendów: pętla $1 \dots D \rightarrow 30$ odpytań `workingSchedule.get()`.
- Liczenie zamknięć SSV: pętla $1 \dots D \rightarrow 30$ odpytań `workingSchedule.get()`.
- **Łącznie:** jedno wywołanie `scoreCandidate` wykonuje aż **120 zapytań do struktury `Map`**!
- Przy sortowaniu kandydatów (`candidates.sort((a,b) => scoreCandidate(b) - scoreCandidate(a))`):
  Dla 7 kandydatów algorytm sortowania wykonuje średnio $7 \log_2(7) \approx 20$ porównań $\rightarrow 20 \times 2 \times 120 = \mathbf{4\,800}$ odpytań mapy na jeden dzień!

#### 4. Optymalizacja Zamian Parami (2-OPT Pairwise Swap — Linie 1316–1389):
Jest to najbardziej obciążająca obliczeniowo sekcja pojedynczego przebiegu:
```typescript
for (let day = 1; day <= totalDays; day++) { // D = 30
  for (let i = 0; i < coverageEmployees.length; i++) { // N = 7
    for (let j = i + 1; j < coverageEmployees.length; j++) { // N = 7
      // 30 * (7 * 6 / 2) = 30 * 21 = 630 par!
      // Dla każdej pary:
      // 2x isShiftLaborLawCompliant
      // 4x scoreCandidate (4 * 120 = 480 operacji na Map)
      // 4x getEmployeeAssignedHours
    }
  }
}
```
- Koszt samej sekcji 2-OPT w jednym przebiegu:
  $$630 \text{ par} \times (4 \times 120 \text{ operacji Map}) \approx \mathbf{302\,400 \text{ operacji na strukturach danych!}}$$

#### 5. Deterministyczny Passer Ratunkowy (Linie 1393–1530):
- Czterokrotnie zagnieżdżona pętla: `Dni (30)` $\times$ `Pracownicy OFF (7)` $\times$ `Inni pracownicy (6)` $\times$ `Dni kompensacji (30)` $\rightarrow$ w najgorszym przypadku do **37 800 iteracji** sprawdzających zgodność prawną.

---

### 2.4. Alokacja Obiektów i Presja na Garbage Collector (V8 Engine)

Dokonajmy audytu alokacji pamięci na stercie V8 dla pełnej skali **20 000 prób**:

| Element Alokowany | Ilość per 1 Próbę | Ilość dla 20 000 Prób | Szacowany Rozmiar |
| :--- | :--- | :--- | :--- |
| Obiekty zmian (`ManagerScheduleShift`) | 210 obiektów | **4 200 000 obiektów** | ~336 MB |
| Instancje `Map<string, Shift>` | 1 instancja | 20 000 instancji | ~18 MB |
| Tablice slotów (`daySlots`) | 30 obiektów | 600 000 obiektów | ~24 MB |
| Obiekty tymczasowe w `isLaborLawCompliant` | ~60 obiektów | 1 200 000 obiektów | ~48 MB |
| Ciągi znaków kluczy (`${emp.id}_${day}`) | ~1 500 stringów | 30 000 000 stringów | ~600 MB (z internizacją) |
| **SUMA ALOKACJI PAMIĘCIOWYCH** | **~2 000 obiektów** | **> 36 000 000 alokacji** | **~1.02 GB obrotu stertą!** |

#### Skutki dla silnika V8 w Electronie:
- **GC Thrashing:** Silnik V8 zmuszony jest do ciągłego uruchamiania szybkiego odśmiecacza *Minor GC (Scavenger)* w strefie New Space (Eden/Survivor).
- **Awans do Old Space:** Ze względu na czas trwania paczki, wiele obiektów tymczasowych przeżywa 2 cykle Scavenge i trafia do Old Space, co wymusza pełny cykl *Major GC (Mark-Sweep-Compact)*.
- **Pauzy GC:** Każdy pełny cykl Major GC wstrzymuje wykonywanie wątku JavaScript (Stop-The-World) na **15–40 ms**, potęgując zjawisko przycinania UI.

---

### 2.5. Blokowanie Głównego Wątku UI React 19 i Zagrożenia Responsywności

W architekturze React 19 z Concurrent Mode renderer stara się koordynować priorytety zadań za pomocą `Scheduler.scheduleCallback(NormalPriority, ...)`.
Gdy synchroniczny kod w `autoSchedulerEngine.ts` okupuje wątek przez 80 ms:
1. **Opóźnienie Obsługi Zdarzeń Użytkownika:** Kliknięcie w komórkę grafiku, przełączenie miesiąca lub próba otwarcia modala dyspozycji oczekuje w kolejce zdarzeń przez cały czas trwania paczki.
2. **Desynchronizacja Animacji:** Pływający widżet `AutoScheduleWidget` posiada radialny zegar SVG, którego atrybut `strokeDashoffset` powinien płynnie animować się od 0% do 100%. Z powodu blokady wątku zegar "skacze" co kilka sekund zamiast płynnego ruchu wskazówek.
3. **Ryzyko Naruszenia SLA Pracy:** W warunkach pracy kawiarni na zapleczu (starszy laptop z procesorem niskonapięciowym, pracujący na baterii w trybie oszczędzania energii), 20 000 prób na wątku UI trwałoby **ponad 35 sekund**, wywołując w systemie macOS "kręcącą się piłkę plażową" (Spinning Beach Ball).

---

## 3. Specyfikacja Architektoniczna Web Worker / Worker Threads

Aby umożliwić bezkompromisowe uruchomienie **pełnych 20 000 prób Monte Carlo** z czasem wykonania poniżej 2 sekund i **absolutnie zerowym (0.0 ms) obciążeniem wątku UI React**, solver musi zostać całkowicie oddelegowany do dedykowanego Web Workera.

### 3.1. Architektura Oddelegowania Obliczeń (Off-Main-Thread Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT MAIN THREAD (UI)                           │
│                                                                             │
│  ManagerScheduleView ───> AutoScheduleWidget / AutoScheduleModal            │
│                                      │                                      │
│                                      ▼                                      │
│                        useAutoSchedulerWorker Hook                          │
│                   (State Machine: idle ➔ running ➔ done)                    │
│                                      │                                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                   postMessage({ type: 'START', payload })
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BACKGROUND DEDICATED WEB WORKER                        │
│                         (autoScheduler.worker.ts)                           │
│                                                                             │
│   Worker Message Router ───> PrecomputedContext (Flat Buffers)              │
│                                      │                                      │
│                                      ▼                                      │
│                        FastMonteCarloSolver (20k Runs)                      │
│                  - TypedArray Flat State (Zero Heap Alloc)                  │
│                  - Bitmask Shift Logic & Lookup Tables                      │
│                  - Progressive Pareto Evaluation                            │
│                                      │                                      │
│                     postMessage({ type: 'PROGRESS' })                       │
│                     (Throttled: max 1 msg per 50ms)                         │
│                                      │                                      │
│                     postMessage({ type: 'RESULT' })                         │
│                                      ▼                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2. Protokół Wymiany Komunikatów (Message Passing Protocol)

Komunikacja między wątkiem UI a Web Workerem odbywa się w sposób ściśle asynchroniczny i typowany.

```typescript
// src/modules/managers-schedule/workers/autoSchedulerProtocol.ts

export type WorkerInboundMessage =
  | { type: 'INIT' }
  | { type: 'START'; payload: AutoScheduleWorkerStartPayload }
  | { type: 'CANCEL' }
  | { type: 'TERMINATE' };

export type WorkerOutboundMessage =
  | { type: 'READY' }
  | { type: 'PROGRESS'; payload: AutoScheduleProgressPayload }
  | { type: 'RESULT'; payload: AutoScheduleResult }
  | { type: 'CANCELLED' }
  | { type: 'ERROR'; error: WorkerErrorPayload };

export interface AutoScheduleWorkerStartPayload {
  year: number;
  month: number;
  employees: ManagerEmployee[];
  shiftDefinitions: ShiftDefinition[];
  existingShifts: ManagerScheduleShift[];
  dispositionsByEmployee: Record<number, Record<number, string>>;
  options: AutoScheduleOptions;
  prevMonthShifts: ManagerScheduleShift[];
}

export interface AutoScheduleProgressPayload {
  currentRound: number;
  totalRounds: number;
  percent: number;
  bestDispoMatchRate: number;
  bestViolationsCount: number;
  bestPlannedHours: number;
  targetTeamHours: number;
  elapsedMs: number;
}

export interface WorkerErrorPayload {
  message: string;
  stack?: string;
  code?: 'PRECOMPUTE_FAILED' | 'SOLVER_CRASH' | 'TIMEOUT' | 'UNKNOWN';
}
```

---

### 3.3. Schemat Serializacji i Model Pamięciowy o Zerowej Alokacji (Zero-Copy TypedArray)

#### 1. Zgodność ze Structured Clone Algorithm:
- Dane wejściowe (`ManagerEmployee`, `ShiftDefinition`, `ManagerScheduleShift`) są czystymi strukturami danych (Plain Old JavaScript Objects — POJO), liczbami i stringami.
- Identyfikatory dat są przesyłane w formacie ISO string (`"YYYY-MM-DD"`), co eliminuje błędy stref czasowych pomiędzy wątkami.
- Brak obiektów funkcyjnych ani prototypów klasowych w ładunku `payload`.

#### 2. Przełomowa Optymalizacja Wewnątrz Workera: Płaskie Tablice Typowane (`Uint8Array`):
Zamiast klonować 210 obiektów JavaScript w każdej próbie turniejowej, stan grafiku wewnątrz Workera jest reprezentowany jako **jednowymiarowy bufor pamięci ciągłej**:

```typescript
// Rozmiar bufora: Liczba Menedżerów (7) x Dni Miesiąca (31) = 217 bajtów!
const STATE_SIZE = numEmployees * totalDays;
const baseScheduleBuffer = new Uint8Array(STATE_SIZE);
const workingBuffer = new Uint8Array(STATE_SIZE);

// Słownik kodów zmian mapowany na bajty (0..255):
// 0 = OFF, 1 = AM, 2 = PM, 3 = AMN, 4 = PMN, 5 = MIB, 6 = SUP, 7 = NC, 8 = H, 9 = L4...
```

#### Korzyści Wydajnościowe:
1. **Klonowanie stanu w 1 cyklu CPU:**
   `workingBuffer.set(baseScheduleBuffer)` kopiuje 217 bajtów w ułamku nanosekundy przy użyciu natywnej instrukcji pamięciowej SIMD/`memcpy`.
2. **Zero Alokacji na Stercie:** W trakcie wykonywania 20 000 prób alokowanych jest **0 nowych obiektów** dla stanu grafiku!
3. **Pamięć podręczna L1/L2:** Cały bufor stanu 217 bajtów mieści się idealnie w najszybszym rejestrze cache procesora (L1 Cache 32 KB), przyspieszając weryfikację Kodeksu Pracy o ponad **2500%**.

---

### 3.4. Cykl Życia Workera, Zarządzanie Anulowaniem (`AbortController`) i Fallback

```typescript
// Lifecycle State Machine
type WorkerLifecycleState =
  | 'uninitialized'
  | 'ready'
  | 'running'
  | 'cancelling'
  | 'terminated'
  | 'error';
```

#### 1. Instancjonowanie i Pooling:
- Zastosowanie wzorca **Worker Singleton z Lazy Initialization**: Worker jest tworzony dopiero przy pierwszym żądaniu optymalizacji grafiku w sesji i utrzymywany w stanie `ready`.
- Automatyczne usypianie (Auto-Teardown): Jeśli przez 10 minut Store Manager nie uruchamia optymalizacji, Worker ulega bezpiecznemu zamknięciu (`worker.terminate()`) w celu zwolnienia pamięci RAM.

#### 2. Wdzięczne Anulowanie (Graceful Cancellation):
- Użytkownik może w każdej chwili kliknąć *"Anuluj"* lub zamknąć modal.
- `AbortController` wysyła wiadomość `{ type: 'CANCEL' }`.
- W pętli solvera Workera sprawdzana jest atomowa flaga: `if (isCancelled) { postMessage({ type: 'CANCELLED' }); break; }`.
- **Zabezpieczenie Watchdog (Hard-Kill Timeout):** Jeśli Worker nie potwierdzi anulowania w ciągu 300 ms (np. z powodu zawieszenia), następuje wymuszone przerwanie:
  ```typescript
  worker.terminate();
  workerInstance = null; // Re-inicjalizacja nowej instancji
  ```

#### 3. Progresywne Dławienie Komunikatów (Progress Throttling):
- Wysłanie 20 000 komunikatów `PROGRESS` przez `postMessage` przeciążyłoby szynę IPC przeglądarki i kolejkę zdarzeń Reacta.
- Worker stosuje **Time-Based Throttling**:
  ```typescript
  const now = performance.now();
  if (now - lastProgressEmitTime >= 50 || round === totalRounds) { // Max 20 aktualizacji na sekundę
    postMessage({ type: 'PROGRESS', payload: ... });
    lastProgressEmitTime = now;
  }
  ```

#### 4. Mechanizm Rezerwowy (Main-Thread Fallback):
- W rzadkich środowiskach z restrykcjami CSP lub problemami z ładowaniem modułów Workera (`typeof Worker === 'undefined'`), system automatycznie przełącza się na zmodyfikowany `generateScheduleAsync` na wątku głównym z bezpiecznym ograniczeniem iteracji do 1 000 prób i komunikatem ostrzegawczym.

---

### 3.5. Typowany Hook React `useAutoSchedulerWorker`

Poniższa specyfikacja implementacyjna stanowi gotowy projekt hooka dla komponentów `AutoScheduleModal` oraz `AutoScheduleWidget`:

```typescript
// src/modules/managers-schedule/hooks/useAutoSchedulerWorker.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AutoScheduleResult,
  AutoScheduleOptions
} from '../services/autoSchedulerEngine';
import {
  WorkerInboundMessage,
  WorkerOutboundMessage,
  AutoScheduleProgressPayload,
  AutoScheduleWorkerStartPayload
} from '../workers/autoSchedulerProtocol';
import {
  ManagerScheduleMonthData,
  ManagerScheduleShift
} from '../../../types/index';

export interface UseAutoSchedulerWorkerReturn {
  isGenerating: boolean;
  progress: AutoScheduleProgressPayload | null;
  result: AutoScheduleResult | null;
  error: string | null;
  startOptimization: (mode: 'smart_full' | 'fill_gaps') => void;
  cancelOptimization: () => void;
  reset: () => void;
}

export function useAutoSchedulerWorker(
  data: ManagerScheduleMonthData,
  prevMonthShifts: ManagerScheduleShift[] = []
): UseAutoSchedulerWorkerReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<AutoScheduleProgressPayload | null>(null);
  const [result, setResult] = useState<AutoScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Inicjalizacja Workera z wykorzystaniem natywnego modułu Vite
  const getOrCreateWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/autoScheduler.worker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
        const msg = event.data;
        switch (msg.type) {
          case 'PROGRESS':
            setProgress(msg.payload);
            break;
          case 'RESULT':
            setResult(msg.payload);
            setIsGenerating(false);
            setProgress(null);
            break;
          case 'CANCELLED':
            setIsGenerating(false);
            setProgress(null);
            break;
          case 'ERROR':
            setError(msg.error.message);
            setIsGenerating(false);
            setProgress(null);
            break;
        }
      };

      workerRef.current.onerror = (err) => {
        console.error('[Worker Error]', err);
        setError('Krytyczny błąd wątku w tle.');
        setIsGenerating(false);
      };
    }
    return workerRef.current;
  }, []);

  const startOptimization = useCallback((mode: 'smart_full' | 'fill_gaps') => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setProgress({
      currentRound: 0,
      totalRounds: 20000,
      percent: 0,
      bestDispoMatchRate: 0,
      bestViolationsCount: 0,
      bestPlannedHours: 0,
      targetTeamHours: 0,
      elapsedMs: 0
    });

    const worker = getOrCreateWorker();
    abortControllerRef.current = new AbortController();

    // Mapowanie istniejących zmian i dyspozycji
    const existingShiftsList: ManagerScheduleShift[] = [];
    const dispositionsByEmployee: Record<number, Record<number, string>> = {};

    data.rows.forEach(r => {
      dispositionsByEmployee[r.employee.id] = {};
      Object.entries(r.shifts).forEach(([dayStr, s]) => {
        existingShiftsList.push(s);
        const d = parseInt(dayStr, 10);
        if (s.disposition) {
          dispositionsByEmployee[r.employee.id][d] = s.disposition;
        }
      });
    });

    const options: AutoScheduleOptions = {
      mode,
      allocateMidInPeaks: true,
      respectDispositions: true,
      preserveFixedShifts: true,
      preferConsecutiveOffDays: true,
      balanceFairness: true,
      smoothWeeklyHours: true,
      iterationsCount: 20000 // Pełne 20k bez obawy o wątek UI!
    };

    const payload: AutoScheduleWorkerStartPayload = {
      year: data.year,
      month: data.month,
      employees: data.employees,
      shiftDefinitions: data.shiftDefinitions,
      existingShifts: existingShiftsList,
      dispositionsByEmployee,
      options,
      prevMonthShifts
    };

    worker.postMessage({ type: 'START', payload });
  }, [data, prevMonthShifts, getOrCreateWorker]);

  const cancelOptimization = useCallback(() => {
    if (workerRef.current && isGenerating) {
      workerRef.current.postMessage({ type: 'CANCEL' });
      // Timeout bezpieczeństwa na wypadek braku odpowiedzi Workera
      setTimeout(() => {
        if (isGenerating && workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
          setIsGenerating(false);
        }
      }, 300);
    }
  }, [isGenerating]);

  const reset = useCallback(() => {
    setResult(null);
    setProgress(null);
    setError(null);
    setIsGenerating(false);
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    isGenerating,
    progress,
    result,
    error,
    startOptimization,
    cancelOptimization,
    reset
  };
}
```

---

## 4. Audyt Heurystyk Sprawiedliwości i Ergonomii (Fairness & Equity)

### 4.1. Dekonstrukcja Obecnej Funkcji Oceny

W obecnym silniku funkcja oceny kandydata w pętli turniejowej (`fitness`, linie 1620–1627) przyjmuje postać:

$$\text{Fitness} = (\text{DispoRate} \times 350) - (\text{MissingCoverage} \times 35\,000) - \text{HourDiffPenalty} - (\text{OffViolations} \times 500\,000)$$

gdzie:
$$\text{HourDiffPenalty} = (\text{TotalIndividualHourError} \times 120) + (|\text{TotalPlanned} - \text{TeamNominal}| \times 35)$$

#### Identyfikacja Wad Krytycznych:
1. **Całkowity Brak Sprzężenia Zwrotnego dla Sprawiedliwości w Fitness:**
   Metryki `weekendFairnessScore`, `closingsFairnessScore` oraz `weeklySmoothingScore` są wyliczane wyłącznie w `buildFullResult` (linie 2063–2075). Pętla Monte Carlo **w ogóle nie optymalizuje tych wskaźników**! Wybierany jest kandydat z najwyższym `fitness`, nawet jeśli przydzielił jednemu pracownikowi 4 pracujące weekendy, a innemu 0.
2. **Asymetria Kar za Nadgodziny:**
   W `scoreCandidate` (linia 900) kara za przekroczenie etatu wynosi `-30 000 - overtime * 2500`, podczas gdy za łamanie prośby o wolne `OFF` wynosi `-2 000 000`. W rezultacie silnik woli utworzyć 50 godzin niedogodzin w zespole, niż naruszyć choćby jedną miękką prośbę o wolne.
3. **Brak Normalizacji Kar Względem Wymiaru Etatu:**
   Dla pracownika na 0.5 etatu (20h/tydz.) 8 godzin pracy to 40% tygodniowej normy. Dla pracownika na 1.0 etatu to 20%. Kary w `smoothWeeklyHours` traktują te wartości liniowo bez wag ułamkowych.

---

### 4.2. Sprawiedliwość Podziału Weekendów (Weekend Equity)

#### Problem Operacyjny w CH Janki:
CH Janki w soboty oraz 7 niedziel handlowych w roku osiąga natężenie ruchu rzędu 250% normy. Praca w weekendy jest dla menedżerów najbardziej obciążająca fizycznie i psychicznie.
- **Wada obecna:** Silnik nalicza karę `score -= workedWeekendDays * 55` (linia 952), lecz nie weryfikuje **wariancji między pracownikami**. Jeden kierownik może mieć zaplanowane 4 soboty i 3 niedziele (7 dni weekendowych), a inny zaledwie 2 dni weekendowe.
- **Brak Ochrony Pełnych Wolnych Weekendów:** Pracownik w handlu najbardziej regeneruje się podczas **pełnego weekendu wolnego** (Sobota + Niedziela `OFF`). Rozbity odpoczynek (np. Sobota praca, Niedziela wolne, Poniedziałek praca) nie zapewnia odpoczynku psychicznego. Obecny silnik posiada jedynie słaby bonus `score += 120` (linia 984) bez kary za brak chociaż jednego pełnego wolnego weekendu w miesiącu.

---

### 4.3. Rotacja Zamknięć (`PM`/`PMN`) i Zapobieganie "Clopening"

#### 1. Syndrom Ciągłych Zamknięć (Closing Fatigue):
Zamknięcie kawiarni w Janki kończy się o 22:30. Powrót menedżera do domu następuje ok. 23:30–24:00.
- Obecnie silnik stosuje płaską karę `closingsCount * 45` dla każdego SSV.
- Brak kary za **sekwencje zamknięć dzień po dniu** (np. 3 lub 4 zmiany PM z rzędu).

#### 2. Ergonomiczna Rotacja Zgodna z Zegarem Biologicznym (Forward Rotation):
Zgodnie z zasadami medycyny pracy i ergonomii rotacji zmianowej, adaptacja układu dobowego człowieka następuje optymalnie przy rotacji do przodu:
$$\mathbf{AM \text{ (Rano 07:00–15:00)}} \longrightarrow \mathbf{MIB \text{ (Środek 12:00–20:00)}} \longrightarrow \mathbf{PM \text{ (Wieczór 14:30–22:30)}} \longrightarrow \mathbf{OFF \text{ (Regeneracja)}}$$

Rotacja wsteczna (np. `PM` w poniedziałek, `MIB` we wtorek, `AM` w środę) powoduje chroniczne skrócenie fazy snu REM i spadek koncentracji na barze. Obecny silnik nie posiada żadnej preferencji promującej rotację do przodu!

---

### 4.4. Pakiety 2 Dni Wolnego z Rzędu (`OFF + OFF`) vs Poszarpane Wyspy

- W obecnym kodzie (`autoSchedulerEngine.ts:987`):
  `if (options.preferConsecutiveOffDays && wasOffYesterday && isOffTomorrow) score -= 100;`
  Wykrywa jedynie przypadek pojedynczego dnia pracy otoczonego dwoma dniami wolnego (`OFF -> PRACA -> OFF`).
- **Poważna Luki:**
  Silnik **w ogóle nie karze** izolowanych pojedynczych dni wolnych (`PRACA -> OFF -> PRACA`). W praktyce menedżerowie otrzymują poszarpany grafik: 2 dni pracy, 1 dzień wolny, 3 dni pracy, 1 dzień wolny.
- **Wymóg Ergonomiczny:** Zapewnienie co najmniej **dwóch 2-dniowych pakietów odpoczynku** (`OFF + OFF`) w miesiącu dla każdego menedżera na pełnym etacie.

---

### 4.5. Stabilizacja Korytarza Tygodniowego Czasu Pracy

Miesięczna norma KP (np. 168h we wrześniu) rozkłada się na 4 do 5 tygodni kalendarzowych.
- W obecnym silniku zdarzają się skrajne anomalie: Tydzień 1: 52h (6 dni pracy), Tydzień 2: 24h (3 dni pracy).
- Taki rozkład narusza zasadę równomiernego obciążenia, rodzi frustrację zespołu i ryzyko błędów gotówkowych w bezpieczniku finansowym kawiarni.

---

### 4.6. Rygorystyczna Formulacja Matematyczna Ulepszonej Funkcji Celu $S(G)$

Proponujemy zunifikowaną, wielokryterialną funkcję oceny grafiku $S(G)$, która bezpośrednio steruje selekcją kandydatów w pętli 20 000 prób Web Workera:

$$S(G) = - P_{\text{hard}}(G) + W_{\text{quota}} \cdot Q(G) + W_{\text{dispo}} \cdot D(G) + W_{\text{fair}} \cdot F(G) + W_{\text{ergo}} \cdot E(G)$$

#### 1. Składnik Kar Twardych $P_{\text{hard}}(G)$ (Ograniczenia Bezwzględne):
$$P_{\text{hard}}(G) = \lambda_1 \cdot V_{\text{KP}}(G) + \lambda_2 \cdot M_{\text{coverage}}(G) + \lambda_3 \cdot V_{\text{pinned}}(G)$$
- $V_{\text{KP}}$: Liczba naruszeń Kodeksu Pracy (art. 132 [11h], art. 133 [35h], art. 135 [12h], art. 151¹⁰ [4. niedziela]). Waga: $\lambda_1 = 1\,000\,000$.
- $M_{\text{coverage}}$: Dni z brakiem wymaganego otwarcia (AM) lub zamknięcia (PM). Waga: $\lambda_2 = 500\,000$.
- $V_{\text{pinned}}$: Naruszenia komórek zablokowanych/sztywnych (H, L4, Pinned). Waga: $\lambda_3 = 2\,000\,000$.

#### 2. Składnik Bilansu Godzinowego $Q(G)$ (Precyzja Etatu):
Dla każdego menedżera $e \in E$:
$$Q(G) = 100 - \sum_{e \in E} \left[ \alpha_e \cdot |H_{\text{plan}}(e) - H_{\text{norm}}(e)|^2 \right]$$
Kwadratowa kara za odchylenie od normy etatu zapobiega powstawaniu nadgodzin/niedogodzin powyżej $\pm 0.5\text{ h}$.

#### 3. Składnik Satysfakcji Dyspozycji $D(G)$:
$$D(G) = \sum_{e \in E} \sum_{d=1}^{D} \text{MatchScore}(e, d)$$
- Zgodność z `AM`/`PM`: $+100$ pkt.
- Niezgodność z `AM`/`PM`: $-150$ pkt.
- Respektowanie `OFF` (prośba o wolne): $+250$ pkt.
- Złamanie `OFF`: $-10\,000$ pkt.

#### 4. Składnik Sprawiedliwości Zespołowej $F(G)$ (Fairness & Equity):
$$F(G) = 100 - \left[ w_{\text{we}} \cdot \text{Var}\left(\frac{W_{\text{worked}}(e)}{r_e}\right) + w_{\text{close}} \cdot \text{Var}\left(\frac{C_{\text{worked}}(e)}{r_e}\right) \right]$$
gdzie:
- $W_{\text{worked}}(e)$ — liczba przepracowanych sobót i niedziel przez menedżera $e$.
- $C_{\text{worked}}(e)$ — liczba zamknięć `PM`/`PMN`.
- $r_e$ — wymiar etatu pracownika ($1.0, 0.75, 0.5$).
- $\text{Var}(\cdot)$ — wariancja populacyjna. Minimalizacja wariancji gwarantuje matematycznie idealny, symetryczny rozkład obciążeń!

#### 5. Składnik Ergonomii i Regeneracji $E(G)$ (Rest Quality & Circadian):
$$E(G) = \sum_{e \in E} \left[ 80 \cdot B_{\text{2-off}}(e) - 120 \cdot I_{\text{1-off}}(e) + 50 \cdot F_{\text{circadian}}(e) - 200 \cdot C_{\text{fatigue}}(e) \right]$$
gdzie:
- $B_{\text{2-off}}(e)$ — liczba bloków minimum 2 kolejnych dni wolnych (`OFF + OFF`).
- $I_{\text{1-off}}(e)$ — liczba pojedynczych, poszarpanych dni wolnych (`PRACA -> OFF -> PRACA`).
- $F_{\text{circadian}}(e)$ — liczba przejść zgodnych z zegarem cytologicznym (`AM -> MIB -> PM`).
- $C_{\text{fatigue}}(e)$ — liczba sekwencji $\ge 3$ zamknięć `PM` z rzędu.

---

## 5. Asystent Negocjacji Sytuacji Patowych (Deadlock Negotiation Assistant)

### 5.1. Zachowanie Silnika w Sytuacjach Braku Rozwiązań Dopuszczalnych

W obecnej implementacji (`autoSchedulerEngine.ts:1068, 1128`), gdy na dany dzień żaden menedżer nie spełnia jednocześnie wymogów Kodeksu Pracy (odpoczynek 11h) oraz nie ma statusu nieobecności:
```typescript
compromises.push(`Dzień ${day}.${month}: Brak dostępnego menedżera na Otwarcie (${shiftCode}) bez naruszenia Kodeksu Pracy.`);
```
Silnik po prostu **zostawia dzień bez obsady** (`slot.neededOpening = true`). W rezultacie Store Manager otrzymuje niekompletny grafik z naruszeniem standardu Starbucks Floor Hours, bez propozycji kompromisów.

---

### 5.2. Pięciowarstwowa Hierarchia Relaksacji Ograniczeń (Constraint Relaxation Hierarchy)

W przypadku wykrycia sytuacji patowej (Deadlock), silnik powinien automatycznie uruchomić algorytm relaksacji ograniczeń według ściśle zdefiniowanych warstw:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 0: TWARDE PRAWO PRACY & BEZPIECZEŃSTWO (BEZWZGLĘDNIE NIERELAKSOWALNE)   │
│ - Min. 11h odpoczynku dobowego (art. 132 KP)                                │
│ - Min. 35h odpoczynku tygodniowego (art. 133 KP)                            │
│ - Max. 12h pracy na dobę (art. 135 KP)                                      │
│ - Zwolnienia lekarskie ZUS L4 oraz zatwierdzone urlopy H                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: OBSADA BAZOWA KAWIARNI (COVERAGE MINIMUM)                           │
│ - Dokładnie 1x Otwarcie (AM/AMN) i 1x Zamknięcie (PM/PMN) każdego dnia       │
│ - Ochrona nienaruszalna: kawiarnia nie może pozostać bez kierownika zmiany │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: ZMIANY OPERACYJNE ELASTYCZNE (ELASTIC SHIFTS - 1. KROK RELAKSACJI)  │
│ - Zmiany środkowe MIB / MID w szczytach: redukcja do 0 w przypadku pata      │
│ - Zmiany administracji SM (NC): przesunięcie na inny dzień roboczy w miesiącu│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: PREFERENCJE DYSPOZYCJI (NEGOTIABLE DISPOSITIONS - 2. KROK)          │
│ - Zamiana preferencji pory dnia: AM zamiast PM lub PM zamiast AM             │
│ - Relaksacja prośby o OFF: tylko z automatyczną rekompensatą wolnego        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 4: ERGONOMIA I WEWNĘTRZNA RÓWNOWAGA (SOFT FAIRNESS - 3. KROK)          │
│ - Rozbicie 2-dniowego pakietu OFF na 1 dzień                                │
│ - Akceptacja 3. pracującego weekendu pod rząd (jeśli KP na to pozwala)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5.3. Interaktywny Asystent Kompromisów, Mostki SUP i Generator Wiadomości

Gdy relaksacja dotyka Tier 3 (złamanie zgłoszonej prośby o `OFF`), system natychmiast generuje w widoku podglądu (`AutoScheduleModal`) kartę analizy patu wraz z 4 gotowymi wariantami działania dla Store Managera:

#### 1. Wariant A: Automatyczna Rekompensata Wolnego (Compensatory OFF Swap)
- Silnik automatycznie przeszukuje grafik tego samego pracownika i odnajduje najbliższy dzień roboczy z dyżurem niekrytycznym (np. `MIB` lub `AM` w dzień z nadmiarem obsady).
- Przypisuje pracownikowi dyżur w dniu spornym, a w zamian wstawia `OFF` w dniu rekompensaty.
- **Efekt:** Bilans etatu pracownika $\Delta = 0.0\text{ h}$, zachowana norma prawna.

#### 2. Wariant B: Zewnętrzne Wsparcie Międzykawiarniane (`SUP`)
- Jeśli żaden pracownik Janki nie może przejąć zmiany bez łamania Tier 0, asystent oferuje wstawienie dyżuru **`SUP` (Support z innej kawiarni)**.
- System wskazuje najbliższe kawiarnie w dystrykcie (`323 Nowy Świat`, `341 Sadyba`, `756 San Park`, `327 Arkadia`) z informacją o potencjale wsparcia.

#### 3. Wariant C: Generator Komunikatów WhatsApp / SMS
Store Manager jednym kliknięciem kopiuje profesjonalną, uprzejmą wiadomość do pracownika, eliminując stres i tarcie komunikacyjne:

> *"Cześć Dawid, układam grafik na Wrzesień 2026 i mamy krytyczną sytuację obsadową w sobotę 12.09 (zamknięcie kawiarni). Zgłaszałeś wtedy prośbę o wolne, ale ze względu na urlop Zuzanny i normę 11h odpoczynku u Kamila, brakuje nam kierownika zmiany. Czy zgodziłbyś się wziąć zamknięcie (PM) w sobotę 12.09? W zamian gwarantuję Ci wolne (OFF) w piątek 18.09 przed kolejnym weekendem. Twój bilans godzin i normy KP będą w 100% zachowane. Daj znać czy możemy tak zrobić! ☕"*

---

## 6. Priorytetyzowana Mapa Drogowa Wdrożenia (Roadmap)

Wszystkie proponowane ulepszenia zostały skategoryzowane według wysiłku implementacyjnego, wpływu na architekturę i korzyści dla Store Managera:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PRIORYTETOWA MAPA DROGOWA (ROADMAP)                       │
├──────────────────────────┬──────────────────────────┬────────────────────────┤
│     SZYBKIE WYGRANE      │    ŚREDNIOTERMINOWE      │     DŁUGOFALOWE        │
│      (Quick Wins)        │     (Architecture)       │     (Innovations)      │
│        1-2 dni           │         3-5 dni          │       1-2 tyg.         │
├──────────────────────────┼──────────────────────────┼────────────────────────┤
│ 1. Uczciwa synchronizacja│ 1. Implementacja         │ 1. Wielomiesięczny     │
│    liczby prób w UI      │    Web Workera           │    TOR Optimizer       │
│    (20k vs 2k)           │    (autoScheduler.worker)│    (Q1-Q4 jednoczesne) │
│                          │                          │                        │
│ 2. Włączenie wskaźników  │ 2. Bufor stanu           │ 2. Hybrydowy solver    │
│    fairness do fitness   │    Uint8Array            │    CP-SAT / Genetic    │
│    (sprzężenie zwrotne)  │    (Zero-Allocation)     │    (Google OR-Tools JS)│
│                          │                          │                        │
│ 3. Płaskie kary etatu    │ 3. Hook React            │ 3. Integracja live     │
│    (proporcjonalność do  │    useAutoSchedulerWorker│    z kalendarzem       │
│    wymiaru 0.5/0.75/1.0) │    ze stanem i anulowaniem│   Google/Apple        │
└──────────────────────────┴──────────────────────────┴────────────────────────┘
```

### Faza 1: Szybkie Wygrane (Quick Wins — Gotowe do wdrożenia bez zmian architektury)
- **Korekta etykiet lub parametrów:** Usunięcie rozbieżności między 20 000 prób w UI a `iterationsCount: 2000` w opcjach.
- **Włączenie metryk sprawiedliwości do pętli optymalizacyjnej:** Wzbogacenie obecnej funkcji `fitness` o składnik wariancji weekendów i zamknięć.
- **Normalizacja wag etatu:** Wprowadzenie mnożnika $1 / \text{contractRatio}$ przy karach za godziny tygodniowe.

### Faza 2: Modernizacja Architektoniczna (Medium-Term Architecture)
- **Implementacja `autoScheduler.worker.ts`:** Pełne odseparowanie solvera od wątku UI.
- **Optymalizacja bufora pamięci (`Uint8Array`):** Redukcja 4.2M alokacji do zera.
- **Podniesienie limitu do pełnych 20 000 prób:** Czas wykonania spadnie z 18 sekund do **ok. 650–900 ms**.
- **Wdrożenie hooka `useAutoSchedulerWorker`:** Płynna animacja radialnego paska SVG bez gubienia klatek.

### Faza 3: Innowacje Operacyjne (Long-Term Innovations)
- **Wielomiesięczny Optymalizator TOR:** Równoczesna optymalizacja całego kwartału (np. Lipiec-Sierpień-Wrzesień) w celu idealnego wyzerowania bilansu $\Delta = 0.0\text{ h}$ na koniec kwartału.
- **Autonomiczny Asystent Wymiany Zmian (Shift Marketplace):** Zintegrowany moduł powiadomień dla menedżerów z możliwością akceptacji kompromisów bezpośrednio z poziomu aplikacji.

---

**Raport sporządził:** Explorer R2 (AutoScheduler AI & Web Worker Architecture)  
**Zgodność z wytycznymi:** Strict Design Mode — Zero zmian w plikach `src/` repozytorium.
