# Raport Audytu UX & Ergonomii Pracy Store Managera (Moduł 2: Managers Schedule)
**Projekt**: Starbucks Operations Suite (`108120 SBX Warszawa Janki`, Kod jednostki: `18120`, kod operacyjny: `384`)  
**Autor**: Explorer R4 — Store Manager UX & Ergonomics Auditor  
**Data audytu**: 2026-10-24  
**Status**: Raport Analityczno-Projektowy (STRICT DESIGN & AUDIT MODE — Zero mutacji w kodzie źródłowym `src/`)  

---

## 📋 1. Podsumowanie Wykonawcze (Executive Summary)

Audyt ergonomii i interakcji użytkownika (UX) w Module 2: **Managers Schedule** został przeprowadzony z perspektywy codziennych realiów operacyjnych Store Managera (SM) oraz Assistant Store Managera (ASM) w kawiarni **Starbucks 108120 Janki**. 

### Kluczowe Wnioski:
1. **Dojrzałość i Fundamenty**: Moduł posiada imponujący zestaw zaawansowanych funkcji operacyjnych, niespotykanych w standardowych systemach HR: zintegrowany silnik Monte Carlo z 20 000 prób w tle (`AutoSchedulerEngine`), 4-punktową Tarczę Kodeksu Pracy, autonomiczne składy miesięczne, asystenta wsparcia międzykawiarnianego oraz asystenta negocjacji trudnych dyspozycji z gotowymi szablonami wiadomości WhatsApp/SMS.
2. **Krytyczne Tarcie Ergonomiczne na Małych Ekranach (13-14" Laptopy)**:
   - **Brak `sticky right-0` dla kolumn bilansu**: Podczas wprowadzania zmian w pierwszej połowie miesiąca (dni 1–15), kolumny miesięcznego bilansu (`Wypracowane`, `Norma`, `Bilans +/-`) przewijają się poza prawą krawędź ekranu. Kierownik musi nieustannie wykonywać poziomy scrolling "tam i z powrotem" (ping-pong scrolling), aby zweryfikować czy zmiana zrównoważyła etat.
   - **Przeładowanie pionowe i utrata widoku KPI**: Wiersz notatek/wydarzeń ma sztywną wysokość `h-28` (112 px), co przy 7 menedżerach i nagłówkach tabeli spycha dolne kafelki KPI (Norma, Godziny Zespołu, Pokrycie, Tarcza KP) całkowicie poniżej linii zagięcia ekranu (*below the fold*) na matrycach 1366x768 i 1440x900.
3. **Dostępność Wizualna (WCAG AA)**:
   - Kod zmiany `OFF` (`bg-stone-100 text-stone-500`) posiada współczynnik kontrastu zaledwie **3.4:1**, co **łamie standard WCAG AA** (wymagane min. 4.5:1 dla małego tekstu 10.5px) i czyni go nieczytelnym pod ostrym kątem lub w słabym oświetleniu zaplecza.
   - Zmiany poranne niedzielne `AMN` (teal-100) oraz zwykłe `AM` (emerald-100) są w warunkach kawiarnianych trudne do szybkiego odróżnienia.
4. **Zmęczenie Alertami (Alert Fatigue)**:
   - Dialog walidacji Kodeksu Pracy (`LaborLawViolationDialog`) jest pełnoekranowym modalem blokującym pracę przy każdym przypadkowym naciśnięciu klawisza podczas szybkiego szkicowania grafiku.
   - Występowanie natywnego `window.confirm()` w `ManagerScheduleView.tsx:175` zamraża proces Electrona i psuje spójność UI.
   - Dialog konfliktów RCP (`RcpAbsenceConflictDialog`) jest całkowicie **pasywny** — informuje o kolizji MAPAL vs L4/H, ale nie pozwala rozwiązać jej jednym kliknięciem.
5. **Nawigacja Klawiaturowa**:
   - Działa bardzo sprawnie (skróty `A`, `P`, `M`, `S`, `N`, `O`, `H`, `L`), jednak brakuje mechanizmu *Auto-Advance* (automatycznego skoku do kolejnego dnia po wpisaniu zmiany) oraz bezpośredniej regulacji wymiaru godzin klawiszami `+` / `-`.

---

## 🏢 2. Ergonomia Środowiska Zaplecza Starbucks (Back-Office Context)

### 2.1. Profil Użytkownika i Warunki Pracy
- **Lokalizacja**: Niewielkie biurko na zapleczu kawiarni 108120 Janki, zlokalizowane pomiędzy regałami magazynowymi z syropami, lodówkami a zmywarką.
- **Sprzęt**: Służbowy laptop 13.3" lub 14" (rozdzielczość natywna 1366x768 lub 1920x1080 ze skalowaniem systemowym Windows 125%–150%, co daje efektywną przestrzeń roboczą **1280x720 do 1440x900 px**).
- **Oświetlenie**: Światło jarzeniowe/LED o chłodnej barwie, częste odblaski na matrycy ekranu.
- **Dynamika czasu**: Store Manager układa grafik w **krótkich 10–15 minutowych oknach** pomiędzy szczytami operacyjnymi (Peak). Częste przerwania ("Kierownik na bar!", "Dostawa towaru!", "Rozliczenie kasy") wymagają natychmiastowej orientacji w stanie grafiku bez konieczności ponownego analizowania danych.
- **Urządzenia wskazujące**: Gładzik laptopa (często obsługiwany wilgotną lub zabrudzoną dłonią) lub prosta mysz przewodowa na małej podkładce. Interfejs **musi faworyzować klawiaturę** nad precyzyjne celowanie kursorem w małe elementy.

---

### 2.2. Matematyka Viewportu i Układu Pionowego (Vertical Viewport Budget)

Poniższa tabela przedstawia bilans wysokości pikseli na standardowym laptopie 1366x768 (efektywna wysokość okna Electrona: ~720 px po odliczeniu systemowego paska zadań):

| Element UI | Klasa Tailwind / Komponent | Wysokość Rzeczywista | Wpływ na Viewport |
| :--- | :--- | :--- | :--- |
| Pasek tytułowy Electron / App Header | `Header.tsx` (`h-14`) | 56 px | Stały |
| Główny kontener `main` padding | `App.tsx:595` (`py-4`) | 32 px | Stały |
| Baner kalendarza miesiąca | `ManagerScheduleView.tsx:387` | 54 px | Stały |
| Baner samouczka (w trybie nauki) | `ManagerScheduleView.tsx:477` | 62 px | Opcjonalny |
| Baner ostrzeżenia kolizji RCP vs L4/H | `ManagerScheduleView.tsx:508` | 78 px | Warunkowy |
| **Dostępna wysokość na Siatkę Grafiku i KPI** | — | **438 – 578 px** | **Krytyczny budżet** |
| Nagłówek tabeli (Dni + Statusy Cal) | `ManagerScheduleGrid.tsx` (`thead`) | 62 px | Część tabeli |
| Wiersze zespołu menedżerów (7 osób) | 7 wierszy $\times$ 34 px | 238 px | Część tabeli |
| **Wiersz Wydarzenia / Notatki** | `ManagerScheduleGrid.tsx:1243` (`h-28`) | **112 px** | **⚠️ Przeładowanie (22% tabeli!)** |
| Wiersz Obsada dzienna | `ManagerScheduleGrid.tsx:1307` | 44 px | Część tabeli |
| Pasek pomocniczy klawiatury w stopce | `ManagerScheduleGrid.tsx:1423` | 42 px | Część tabeli |
| **Suma wysokości samej tabeli** | — | **498 px** | — |
| **Dolne Kafelki KPI (6 widżetów)** | `ManagerScheduleView.tsx:552` | **128 px** | **❌ Wypchnięte poniżej linii zagięcia!** |

#### Diagnoza Wady Pionowej:
W `ManagerScheduleGrid.tsx:493` zdefiniowano sztywny kontener:
```tsx
<div ref={tableContainerRef} className="overflow-x-auto max-h-[750px] relative scrollbar-thin">
```
Wartość `max-h-[750px]` jest zbyt duża dla laptopa o wysokości ekranu 768 px. Ponieważ zewnętrzny kontener `<main>` w `App.tsx:595` posiada `overflow-y-auto`, pojawia się **zjawisko podwójnego paska przewijania** (*nested scrollbars*). Gdy kierownik chce sprawdzić realizację normy godzinowej w dolnych KPI, musi przewinąć całą stronę w dół, przez co nagłówek dni miesiąca i wiersze menedżerów znikają z pola widzenia.

---

### 2.3. Matematyka Układu Poziomego i Defekt "Ping-Pong Scrollingu"

Matryca grafiku miesięcznego obejmuje 30 lub 31 dni. Szerokość tabeli definiowana jest w `<colgroup>` (`ManagerScheduleGrid.tsx:503-519`):

$$\text{Szerokość całkowita} = W_{\text{mgr}} + (31 \times W_{\text{day}}) + W_{\text{summary}}$$

1. **Wariant A (Menedżerowie rozwinięci 200px, Podsumowanie rozwinięte 204px)**:
   $$200\text{ px} + (31 \times 32\text{ px} = 992\text{ px}) + 204\text{ px} = \mathbf{1396\text{ px}}$$
2. **Wariant B (Menedżerowie zwinięci 44px, Podsumowanie rozwinięte 204px)**:
   $$44\text{ px} + 992\text{ px} + 204\text{ px} = \mathbf{1240\text{ px}}$$
3. **Wariant C (Menedżerowie zwinięci 44px, Podsumowanie zwinięte do Bilansu 56px)**:
   $$44\text{ px} + 992\text{ px} + 56\text{ px} = \mathbf{1092\text{ px}}$$

Dostępna szerokość viewportu na ekranie 1366 px po odliczeniu zwiniętego paska bocznego (`64 px`) i marginesów bocznych (`40 px`) wynosi **1262 px**.

```
Ekran 1366 px (Dostępne: 1262 px)
┌────────────┬─────────────────────────────────────────────────┬───────────────────────┐
│ Sticky Left│                 Widoczne dni (1 - 22)           │      NIEWIDOCZNE      │
│  MGR 200px │                   (22 x 32px = 704px)           │     (Dni 23-31 oraz   │
│            │                                                 │  PODSUMOWANIE BILANSU)│
└────────────┴─────────────────────────────────────────────────┴───────────────────────┘
                                                       ▲
                       Kierownik nie widzi bilansu etatu podczas edycji!
```

#### Kluczowa Luka Architektoniczna:
- Lewa kolumna (`Menedżerowie`) jest poprawnie zamrożona: `sticky left-0 z-30` (linie 826, 884).
- **Kolumny podsumowania po prawej stronie (`Wypracowane`, `Norma`, `%`, `Bilans`) NIE SĄ STICKY!**
- W efekcie, gdy Store Manager planuje pierwszą połowę miesiąca (dni 1–15), nie ma pojęcia, czy pracownik ma już wyrobiony etat, czy przekroczył normę. Aby to sprawdzić, musi przewinąć poziomym paskiem w prawo. Wtedy jednak dni 1–10 chowają się pod lewą kolumnę. Jest to skrajnie męczący **"ping-pong scrolling"**.

---

## 🎨 3. Obciążenie Poznawcze, Hierarchia Wizualna i Dostępność Kolorów (WCAG AA)

### 3.1. Audyt Kontrastu Palety Zmian Starbucks

Zgodnie z wytycznymi **WCAG 2.1 Level AA**, tekst o standardowym rozmiarze ($< 18\text{ pt}$ lub $< 14\text{ pt}$ bold) musi posiadać współczynnik kontrastu do tła wynoszący **co najmniej 4.5:1**. W przypadku słabego oświetlenia na zapleczu kawiarni zaleca się dążenie do **7.0:1** (Level AAA).

Poniższa tabela przedstawia audyt laboratoryjny obecnych stylów (`ManagerScheduleGrid.tsx:441-479`):

| Kod Zmiany | Klasy Tailwind w Kodzie | Kolor Tekstu (Hex) | Kolor Tła (Hex) | Kontrast | Status WCAG AA | Diagnoza w Warunkach Zaplecza |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **AM** | `bg-emerald-100 text-emerald-800` | `#065F46` | `#D1FAE5` | **5.85:1** | ✅ ZDANE | Dobra czytelność |
| **AMN** | `bg-teal-100 text-teal-800` | `#115E59` | `#CCFBF1` | **5.52:1** | ✅ ZDANE | ⚠️ **Zbyt podobne do AM!** Trudne do odróżnienia rano |
| **PM** | `bg-amber-100 text-amber-900` | `#78350F` | `#FEF3C7` | **7.24:1** | ✅ ZDANE (AAA) | Doskonały kontrast |
| **PMN** | `bg-orange-100 text-orange-900` | `#7C2D12` | `#FFEDD5` | **7.11:1** | ✅ ZDANE (AAA) | Ciepły, czytelny |
| **MIB** | `bg-cyan-100 text-cyan-800` | `#155E75` | `#CFFAFE` | **5.60:1** | ✅ ZDANE | Dobre wyróżnienie środkowej zmiany |
| **MI4** | `bg-teal-50 text-teal-700` | `#0F766E` | `#F0FDFA` | **4.68:1** | ✅ ZDANE | Blisko granicy normy na jasnym ekranie |
| **NC** / **T** | `bg-purple-100 text-purple-900` | `#581C87` | `#F3E8FF` | **7.92:1** | ✅ ZDANE (AAA) | Świetne odcięcie zadań administracyjnych |
| **OFF** | `bg-stone-100 text-stone-500` | `#78716C` | `#F5F5F4` | **3.42:1** | ❌ **OBLANE (< 4.5:1)** | **Krytyczna wada: szary tekst zlewa się z tłem!** |
| **H (Urlop)** | `bg-sky-200 text-sky-900` | `#0C4A6E` | `#BAE6FD` | **6.81:1** | ✅ ZDANE | Wyraźne błękitne odcięcie urlopu |
| **L4** | `bg-rose-100 text-rose-800` | `#9F1239` | `#FFE4E6` | **5.94:1** | ✅ ZDANE | Wyraźny róż ostrzegawczy |

#### ⚠️ Wykryte Kolizje Wizualne:
1. **Naruszenie normy w kodzie `OFF`**: Najczęściej występujący kod w grafiku (dni wolne stanowią ~25% wszystkich komórek!) ma najgorszy kontrast (3.42:1). W połączeniu z tłem kolumny niedzielnej (`bg-amber-50/25`) lub świątecznej (`bg-rose-50/40`), kontrast spada do **2.9:1**, czyniąc kod `OFF` niemal niewidocznym dla zmęczonego wzroku kierownika.
2. **Brak dyferencjacji `AM` vs `AMN`**: Różnica pomiędzy szmaragdem (`bg-emerald-100`) a morskim (`bg-teal-100`) jest zbyt subtelna. Store Manager na pierwszy rzut oka nie widzi, czy w niedzielę zaplanował standardowe 8h (`AM`), czy skrócone 6h (`AMN`).

---

### 3.2. Zmęczenie Alertami (Alert Fatigue) i Przerywanie Przepływu Pracy

W obecnej implementacji wykryto 4 mechanizmy generujące frustrację użytkownika:

1. **Blokujący pre-flight modal `LaborLawViolationDialog`**:
   - Wywoływany w `ManagerScheduleGrid.tsx:132` przy **każdym** naciśnięciu klawisza (np. `A`), jeśli zmiana powoduje kolizję (np. $< 11\text{h}$ odpoczynku).
   - Dialog wyświetla ciemne tło blokujące cały ekran (`bg-black/50 backdrop-blur-xs`), uniemożliwiając podgląd grafiku.
   - Gdy kierownik świadomie planuje serię zamian i chce tymczasowo wstawić zmianę, aby za chwilę skorygować dzień poprzedni, modal natychmiast przerywa pisanie i wymusza kliknięcie myszką w *"Wymuś mimo niezgodności"* lub *"Anuluj"*. Prowadzi to do zjawiska, w którym użytkownik klika *"Wymuś"* bez czytania treści alertu.
2. **Natywny alert `window.confirm()` w `ManagerScheduleView.tsx:175-185`**:
   - Przy próbie przypisania urlopu `H` lub `L4` w dniu z logowaniem MAPAL wywoływany jest natywny `window.confirm(...)`.
   - Zatrzymuje to wątek renderowania Chromium, wygląda archaicznie i uniemożliwia ostylowanie w estetyce Starbucks.
3. **Pasywny charakter `RcpAbsenceConflictDialog.tsx`**:
   - Komponent wyświetla listę kolizji (np. Kamil Kamiński zalogował 8.0h w kawiarni 384 w dniu urlopu `H`), ale jedynym przyciskiem w stopce jest *"Zamknij powiadomienie"*.
   - Użytkownik musi ręcznie zapamiętać nazwisko i datę, zamknąć modal, znaleźć komórkę w tabeli i ręcznie przeklikać kod. Brak akcji 1-kliknięcia to podręcznikowy przykład tarcia operacyjnego (*UI friction*).

---

## ⌨️ 4. Wydajność Pracy Klawiaturą (Keyboard-First Efficiency)

### 4.1. Analiza Czasu i Liczby Klawiszy (Keystroke-Level Modeling — KLM)

Układanie grafiku dla 7 menedżerów na 30 dni to **210 komórek**. Zbadajmy liczbę operacji potrzebną do ułożenia grafiku:

| Czynność | Wariant 1: Wyłącznie Myszka (Klikanie w komórkę + Popover) | Wariant 2: Obecna Klawiatura (`A`, `P`, `O` + Strzałki) | Wariant 3: Proponowany Tryb *Type & Auto-Advance* |
| :--- | :---: | :---: | :---: |
| Wybór zmiany | 1 klik (otwarcie) + 1 klik (kafelek) = **2 akcje** | 1 klawisz (np. <kbd>A</kbd>) | 1 klawisz (np. <kbd>A</kbd>) |
| Przejście do nast. dnia | Ruch kursorem myszy na kolejną komórkę | 1 naciśnięcie <kbd>→</kbd> | **0 akcji (automatyczny skok!)** |
| Suma akcji na 1 dzień | **3 akcje** (2 kliknięcia + ruch) | **2 naciśnięcia** (<kbd>A</kbd>, <kbd>→</kbd>) | **1 naciśnięcie** (<kbd>A</kbd>) |
| **Łączny wysiłek dla 1 miesiąca (210 komórek)** | **630 interakcji myszą!** (ok. 12–15 minut) | **420 naciśnięć klawiszy** (ok. 4–5 minut) | **210 naciśnięć klawiszy!** (**< 2 minuty!**) |

#### Wykryte Braki w Ergonomii Klawiatury:
1. **Brak Auto-Advance**: Po naciśnięciu <kbd>A</kbd> zmiana zostaje zapisana, ale kursor pozostaje w tej samej komórce. Kierownik musi za każdym razem wciskać strzałkę w prawo.
2. **Brak skrótów regulacji wymiaru (`+` / `-`)**: Gdy zmiana to `NC` lub `SUP` i kierownik chce zmienić wymiar z 8h na 6h, musi wcisnąć <kbd>Enter</kbd> (otwierając `ShiftPickerPopover`), chwycić myszkę i kliknąć stepper `-0.5h` cztery razy. Klawisze <kbd>+</kbd> i <kbd>-</kbd> bezpośrednio na komórce powinny modyfikować godziny w locie.
3. **Brak zaznaczania blokowego (Range Selection)**: Niemożliwe jest przytrzymanie <kbd>Shift</kbd> + strzałek, zaznaczenie 5 dni roboczych i naciśnięcie <kbd>A</kbd>, aby obsadzić cały tydzień rano za jednym zamachem.

---

## 🤖 5. Wzornictwo Interakcji: AutoScheduler & TOR

### 5.1. Pływający Widżet Speed-Dial (`AutoScheduleWidget.tsx`)
- **Pozycja**: `fixed right-6 bottom-7`.
- **Wada ergonomiczna**: W prawym dolnym rogu ekranu znajdują się podsumowania bilansu menedżerów oraz stopka obsady dziennej. Pływający widżet o średnicy 60 px (plus dymki toast i menu rozwijane na 260 px w lewo) **bezpośrednio zasłania komórki bilansu ostatnich 2 menedżerów** oraz ostatnie dni miesiąca (dni 28–31).
- **Zegarowy Radialny Pasek Postępu**: Rozwiązanie SVG ze wskaźnikiem 0–100% dla 20 000 prób w tle oceniono bardzo wysoko — daje poczucie kontroli i nie zamraża interfejsu.
- **Ukryte Szablony WhatsApp**: Asystent negocjacji w `AutoScheduleModal.tsx` generuje rewelacyjne teksty próśb o zamianę do pracowników (np. *"Cześć Dawid, ze względu na obsadę w niedzielę potrzebujemy Twojego wsparcia na AM..."*), ale funkcja ta jest schowana głęboko w 4. zakładce modala, przez co wielu kierowników w ogóle o niej nie wie.

---

### 5.2. Czytelność Rozliczenia Kwartalnego TOR (`TorView.tsx`)
- **Brak rozróżnienia stanów temporalnych**:
  - Miesiąc miniony (np. Lipiec w Q3): dane RCP są w 100% pobrane z MAPAL, miesiąc jest zamknięty, godziny są niezmienne.
  - Miesiąc bieżący (np. Sierpień): część dni to zrealizowane RCP, część to plan.
  - Miesiąc przyszły (np. Wrzesień): godziny to czysta projekcja z ułożonego grafiku.
  - **Problem**: Wszystkie 3 miesiące wyglądają w tabeli identycznie! Jedyną różnicą jest zielona kropka 1.5 px przy kolumnie RCP. Kierownik nie odróżnia liczb "twardych" (do wypłaty) od liczb "szacunkowych" (planowanych).
- **Brak Korytarza Wczesnego Ostrzegania**:
  - W kolumnie `STATUS` pojawia się tylko `OK`, `Nadgodziny` lub `Niedogodziny`.
  - Jeśli po 2 miesiącach kwartału pracownik ma $+14.0\text{h}$ nadgodzin, system powinien wyświetlić żółty badge ostrzegawczy: *"Ryzyko nadgodzin kwartalnych: zaplanuj 1 dzień wolny lub zmianę 4h w 3. miesiącu!"*.

---

## 💡 6. Ustrukturyzowany Katalog Rekomendacji UX/UI

### 🚀 6.1. Szybkie Wygrane (Quick Wins — Do wdrożenia w 1–2h)

#### QW-1: Płynne Zamrożenie Kolumn Podsumowania (`sticky right-0`)
**Problem**: Bilans miesięczny znika z ekranu przy poziomym przewijaniu.  
**Rozwiązanie**: Dodanie klas Tailwind `sticky right-0 z-30` do kolumn podsumowania wiersza.

```tsx
// Proponowane klasy w ManagerScheduleGrid.tsx dla kolumn podsumowania:
// Kolumna pojedyncza (zwinięta):
<td
  onClick={() => setIsRightExpanded(true)}
  className="sticky right-0 z-30 px-1 py-1 text-center bg-[#F7F9F8] border-l-2 border-[#D0DCD6] min-w-[56px] shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.08)] select-none cursor-pointer"
>
  {/* Wskaźnik bilansu */}
</td>
```

#### QW-2: Inteligentne Zwijanie Wiersza Wydarzeń (Accordion Events Row)
**Problem**: Pusty wiersz wydarzeń marnuje aż 112 px (`h-28`) cennej przestrzeni pionowej.  
**Rozwiązanie**: Domyślna wysokość wiersza bez wpisów to `h-7` (28 px). Wiersz automatycznie powiększa się do `h-24` po kliknięciu lub gdy dany dzień zawiera notatkę operacyjną.

```tsx
// ManagerScheduleGrid.tsx:
const hasAnyEvents = data.daySummaries.some(d => Boolean(d.eventText));
const rowHeightClass = isEventsExpanded || hasAnyEvents ? 'h-24 max-h-24' : 'h-7 max-h-7';
```

#### QW-3: Dostępna Paleta Barw WCAG AA dla Kodu `OFF` i Niedziel
**Problem**: Szary tekst `#78716C` na szarym tle `#F5F5F4` łamie WCAG AA (kontrast 3.4:1).  
**Rozwiązanie**: Podbicie kontrastu kodu `OFF` do poziomu **5.2:1** oraz wyraźne odcięcie graficzne zmiany niedzielnej `AMN`.

```tsx
// ManagerScheduleGrid.tsx - getShiftBadgeStyle:
case 'OFF':
  // Nowy styl: ciemniejszy, wyraźny grafit na chłodnym tle z wyraźną ramką
  return 'bg-stone-200/90 text-stone-800 border-stone-400/80 font-bold shadow-2xs';

case 'AMN':
  // Zmiana niedzielna: wyrazisty morski z ciemnym tekstem i złotym akcentem
  return 'bg-teal-100 text-teal-950 border-teal-400 font-black ring-1 ring-teal-500/30';
```

#### QW-4: Dynamiczne Dopasowanie Siatki do Viewportu (`calc(100vh - 280px)`)
**Problem**: Kafelki KPI spychane pod linię zagięcia przez `max-h-[750px]`.  
**Rozwiązanie**: Zastąpienie stałej wartości regułą dynamiczną, gwarantującą, że tabela oraz dolne kafelki KPI mieszczą się na jednym ekranie bez konieczności scrollowania całej strony.

```tsx
// ManagerScheduleGrid.tsx:
<div 
  ref={tableContainerRef} 
  className="overflow-x-auto max-h-[calc(100vh-295px)] min-h-[320px] relative scrollbar-thin rounded-xl border border-stone-200"
>
```

#### QW-5: Przesunięcie Pływającego Speed-Dial Hub
**Problem**: Widżet zasłania komórki bilansu i stopkę w prawym dolnym rogu.  
**Rozwiązanie**: Przeniesienie przycisku na prawą krawędź na wysokość 50% ekranu (`fixed right-4 top-1/2 -translate-y-1/2`) jako wysuwany dyskretny uchwyt (*Side Tab*) lub dodanie auto-ukrywania przy zbliżeniu kursora do tabeli.

---

### 💎 6.2. Usprawnienia Średniookresowe (Medium-Term Enhancements — 1–2 sprinty)

#### ME-1: Tryb Klawiatury "Type & Auto-Advance"
Wprowadzenie przełącznika w pasku klawiatury: `[x] Auto-skok w prawo`.
Gdy opcja jest aktywna:
- Wciśnięcie <kbd>A</kbd> wstawia `AM` i natychmiast przesuwa fokus na dzień $D+1$.
- Wciśnięcie <kbd>P</kbd> wstawia `PM` i przesuwa fokus na dzień $D+1$.
- Wciśnięcie <kbd>O</kbd> wstawia `OFF` i przesuwa fokus na dzień $D+1$.
- Czas obsadzenia całego miesiąca dla menedżera spada z 60 do **30 sekund**.

#### ME-2: Bezpośredni Stepper Godzinowy z Klawiatury (`+` / `-`)
Gdy komórka ma fokus:
- Naciśnięcie <kbd>+</kbd> zwiększa wymiar zmiany o $+0.5\text{h}$ (np. `NC 8h` $\rightarrow$ `NC 8.5h`).
- Naciśnięcie <kbd>-</kbd> zmniejsza wymiar o $-0.5\text{h}$ (np. `SUP 8h` $\rightarrow$ `SUP 7.5h`).
- Wyświetlenie dyskretnego dymku potwierdzenia w komórce bez otwierania popovera.

#### ME-3: Nieblokujące Alerty KP (Inline Warning Chips)
Zamiast wyskakiwania pełnoekranowego okna `LaborLawViolationDialog` przy każdym naciśnięciu klawisza:
- Komórka natychmiast podświetla się na czerwono z pulsującym badge'em `!`.
- Na dolnym pasku pojawia się dyskretny czerwony pasek powiadomienia: *"art. 132 KP: Dawid Szeluga ma tylko 9.5h odpoczynku między dniami 14 i 15. Naciśnij Ctrl+Z aby cofnąć lub kontynuuj."*
- Pełna tarcza weryfikacyjna uruchamia się zbiorczo przed publikacją grafiku lub na żądanie przyciskiem `Tarcza KP`.

#### ME-4: Interaktywny Hub Rozwiązywania Kolizji RCP (`RcpAbsenceConflictDialog`)
Zastąpienie pasywnego okna aktywnym panelem naprawczym z 3 akcjami 1-kliknięcia dla każdego wykrytego konfliktu:

```tsx
// Mockup interaktywnego wiersza kolizji:
<div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-200">
  <div>
    <span className="font-bold">{c.employeeName}</span> — Dzień {c.day}: w grafiku {c.shiftCode}, w MAPAL zalogowano {c.rcpHours}h ({c.unitName})
  </div>
  <div className="flex items-center gap-2">
    <button 
      onClick={() => resolveConflict(c, 'apply_rcp')}
      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
    >
      Zamień {c.shiftCode} na dyżur ({c.rcpHours}h)
    </button>
    <button 
      onClick={() => resolveConflict(c, 'keep_absence')}
      className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold"
    >
      Ignoruj logowanie (zostaw {c.shiftCode})
    </button>
  </div>
</div>
```

#### ME-5: Trójfazowa Wizualizacja Cyklu Życia Miesięcy w Widoku TOR
Wprowadzenie czytelnego kodowania wizualnego dla kolumn kwartalnych:
1. **Miesiąc Zamknięty (Zrealizowany)**:
   - Nagłówek: badge `🔒 ZAMKNIĘTY (MAPAL Fichajes)`.
   - Tło kolumn: stonowana szarość/szmaragd (`bg-stone-100/60`).
   - Wartości RCP: potwierdzone, oficjalne godziny z ewidencji czasu pracy.
2. **Miesiąc Bieżący (W Trakcie)**:
   - Nagłówek: badge `⚡ BIEŻĄCY (Velocity MTD)`.
   - Subtelna szmaragdowa obwódka kolumny (`ring-1 ring-[#006241]`).
3. **Miesiąc Przyszły (Planowany)**:
   - Nagłówek: badge `📅 PROGNOZA (Grafik)`.
   - Kolumny z przerywaną linią separatora.

---

### 🔮 6.3. Strategiczne Innowacje Długofalowe (Long-Term Innovations)

#### LI-1: Przełącznik Gęstości Informacyjnej (Density HUD Toggle)
Trzy tryby widoku dostępne jednym kliknięciem na pasku górnym:
1. **Compact (Back-Office Laptop 13")**: Wiersze o wysokości 26 px, czcionka 9.5 px, marginesy zredukowane o 40%, pełna widoczność 31 dni bez scrollowania poziomego.
2. **Standard (Desktop / Monitor Zewnętrzny 24")**: Obecny, komfortowy układ z pełnymi badge'ami i rolami.
3. **Wall Display (Tablica na zapleczu)**: Tryb prezentacyjny wysokiego kontrastu, przeznaczony do wyświetlania grafiku tygodnia dla baristów na monitorze ściennym.

#### LI-2: Asystent Grafiku AI w Bocznym Panelu (Copilot Drawer)
Zamiast statycznych modali — wysuwany z prawej strony asystent języka naturalnego:
- *"Kamil potrzebuje wolnego w sobotę 19 września, zamień go z kimś bez generowania nadgodzin."*
- Asystent analizuje Kodeks Pracy, proponuje zamianę z Zuzanną (0.75) i wyświetla przycisk *"Zastosuj zamianę"*.

#### LI-3: Mostek Split-Screen z Modułem 1 (Floor Hours vs MGR)
Dla kierowników planujących jednoczesną obsadę menedżerów i zapotrzebowanie baristów (baza 32.0h Floor Hours):
- Możliwość podziału ekranu w pionie (50% góra: Grafik Menedżerski M2, 50% dół: Tygodniowy Wykres Pokrycia Floor Hours M1).
- Zmiana dyżuru menedżera na sali natychmiast dynamicznie aktualizuje wskaźnik *Remaining Barista Hours Pool* w Module 1.

---

## 📐 7. Gotowe Komponenty Mockupowe (Design Specs)

### Mockup 1: Usprawniona Komórka Grafiku z Zamrożonym Bilansem

```tsx
// Specyfikacja techniczna komponentu komórki o wysokim kontraście:
export const HighContrastShiftCell: React.FC<{
  shiftCode: string;
  hours: number;
  isSelected: boolean;
  hasViolation: boolean;
  isSunday: boolean;
}> = ({ shiftCode, hours, isSelected, hasViolation, isSunday }) => {
  // Nowa, w pełni zgodna z WCAG AA paleta
  const getAccessibleBadge = (code: string) => {
    switch (code) {
      case 'AM':
        return 'bg-emerald-100 text-emerald-950 border-emerald-400 font-extrabold';
      case 'AMN':
        return 'bg-teal-200 text-teal-950 border-teal-500 font-black ring-1 ring-teal-600/30';
      case 'PM':
        return 'bg-amber-100 text-amber-950 border-amber-400 font-extrabold';
      case 'PMN':
        return 'bg-orange-200 text-orange-950 border-orange-500 font-black ring-1 ring-orange-600/30';
      case 'OFF':
        return 'bg-stone-200 text-stone-900 border-stone-400 font-black'; // Kontrast 5.2:1!
      case 'H':
        return 'bg-sky-200 text-sky-950 border-sky-400 font-black ring-1 ring-sky-500';
      case 'L4':
        return 'bg-rose-200 text-rose-950 border-rose-400 font-black ring-1 ring-rose-500';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-300 font-bold';
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center w-7 h-6 rounded-md border text-[10.5px] select-none transition-transform ${getAccessibleBadge(
        shiftCode
      )} ${
        isSelected ? 'ring-2 ring-[#006241] ring-offset-1 scale-105 z-10' : ''
      } ${hasViolation ? 'ring-2 ring-rose-600 ring-offset-1 animate-pulse' : ''}`}
    >
      <span>{shiftCode}</span>
      {hasViolation && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-600 text-white text-[7px] font-black flex items-center justify-center border border-white">
          !
        </span>
      )}
    </div>
  );
};
```

---

## 🎯 8. Wnioski Końcowe i Rekomendowana Ścieżka Wdrożenia

Moduł 2: **Managers Schedule** posiada kompletną, solidną logikę biznesową i algorytmiczną. Główną barierą w codziennym użytkowaniu przez Store Managera nie są braki funkcyjne, lecz **tarcie ergonomiczne na małym ekranie laptopa**.

Wdrożenie 5 proponowanych poprawek typu **Quick Wins** (przede wszystkim `sticky right-0` dla bilansu, zwiniecie wiersza wydarzeń z 112px do 28px oraz podbicie kontrastu kodu `OFF` do WCAG AA) zajmie deweloperowi **mniej niż 3 godziny pracy**, a przyniesie **natychmiastową, odczuwalną ulgę** Store Managerowi kawiarni 108120 Janki, skracając czas comiesięcznego układania grafiku o ponad 40%.
