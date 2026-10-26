# Raport Audytu Operacyjnego i Ergonomii UI/UX (Moduł 1: Labor Forecast)
**Kawiarnia bazowa:** Starbucks `108120 SBX Warszawa Janki` (Unit Code: `384` / `18120`)  
**Rola audytora:** Store Manager Operational Workflow & UX Auditor (`explorer_m3_ux`)  
**Data audytu:** 2026-10-24  
**Status projektu:** Design & Audit Mode (Read-Only)

---

## 1. Streszczenie Wykonawcze & Rejestr Problemów (P0 – P3)

Audyt ergonomii, obciążenia poznawczego (cognitive load) i rytmu operacyjnego Modułu 1 (**TPLH Forecast & Labor Balancing**) został przeprowadzony z perspektywy Kierownika Kawiarni (Store Managera — SM) pracującego w warunkach zaplecza kawiarni w Centrum Handlowym Janki (laptop 13"–14", pośpiech, ograniczona przestrzeń robocza, presja czasu w poniedziałki przed publikacją grafiku).

W toku drobiazgowej inspekcji kodu źródłowego (`src/modules/labor-forecast/components/`, `services/`, `src/App.tsx`) zidentyfikowano **krytyczne luki architektoniczno-użytkowe**, które stoją w sprzeczności z założeniami operacyjnymi Starbucks oraz deklaracjami w dokumentacji `AGENTS.md`.

### Macierz Wykrytych Podatności i Problemów Ergonomicznych

| ID | Poziom | Komponent / Plik | Opis Problemu Operacyjnego / UX |
| :--- | :--- | :--- | :--- |
| **UX-01** | **P0 (Krytyczny)** | `LaborForecastView.tsx` vs `OperationalAlert.tsx` & `KpiSummaryCards.tsx` | **Osierocone kluczowe komponenty decyzji:** `OperationalAlert` (rekomendacja poniedziałkowa, weryfikacja grafiku W+1/W+2, ochrona Floor) oraz `KpiSummaryCards` (karty AOP, MTD, HANW) **nie są w ogóle renderowane** w głównym widoku modułu! Zostały zastąpione wąskim paskiem Hero Bar, przez co kierownik traci kontekst decyzyjny. |
| **UX-02** | **P0 (Krytyczny)** | `WeeklyScheduleTable.tsx` (l. 63–79) | **Wyciek danych i brak persystencji w SQLite:** Dobowe godziny baristów (`dailyBaristaHours`) zapisywane są w `localStorage` pod niespójnym, globalnym kluczem `sbux_daily_barista_hours`. W architekturze Multi-Store (100+ kawiarni) dane kawiarni Janki nadpisują dane innych lokali lub znikają przy czyszczeniu cache! |
| **UX-03** | **P1 (Wysoki)** | `TrendIntelligencePanel.tsx` vs `calculationEngine.ts` | **Pozorne przełączanie strategii (Fasada UX):** Wybór wariantu planowania (*Floor-Safe*, *Balanced*, *Growth*) w panelu AI jest wyłącznie makietą wizualną — stan `selectedStrategy` **nie jest przekazywany** do `CalculationEngine.calculateMonthlySummary` i w żaden sposób nie modyfikuje rekomendacji HANW ani puli baristów w tabeli. |
| **UX-04** | **P1 (Wysoki)** | `LaborForecastView.tsx` (l. 83, 392–401) | **Niedostępny modal importu w widoku:** Zdefiniowano stan `isImportModalOpen` i komponent `<ImportModal>`, ale w całym `LaborForecastView.tsx` ani w pływającym Speed-Dialu **nie ma ani jednego przycisku wywołującego `setIsImportModalOpen(true)`**. Kierownik nie ma kontekstowego punktu wejścia do importu Fichajes z poziomu modułu. |
| **UX-05** | **P1 (Wysoki)** | `calculationEngine.ts` (l. 902–911, 942) | **Ślepota na odchylenia w trakcie tygodnia (Mid-Week Blindness):** Trwający tydzień kalendarzowy (`isCurrentCalendarWeek`) nie trafia do `closedRows`. Rzeczywiste spadki lub piki sprzedaży wprowadzone w środę/piątek nie wpływają na `trendVelocityMtd`, przez co SM nie może śródtygodniowo przekalibrować budżetu na weekend. |
| **UX-06** | **P2 (Średni)** | `WeeklyScheduleTable.tsx` | **Przeciążenie szerokości tabeli na laptopie 13":** 12 kolumn głównych + 9 kolumn w zagnieżdżonej podtabeli dniowej bez mechanizmu `sticky` dla nagłówków i kolumny tygodnia powoduje gubienie wiersza przy przewijaniu poziomym. |
| **UX-07** | **P2 (Średni)** | `OperationalAlert.tsx` (l. 202, 229, 245) | **Zaszłości twardo zakodowanych liczb (Hardcoded Defaults):** W logice alertów zaszyto sztywne stałe `372.1`, `417.3` oraz tekst `MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h` (niezależnie od faktycznej wielkości delty budżetowej). |
| **UX-08** | **P2 (Średni)** | `WeeklyScheduleTable.tsx` & `KpiSummaryCards.tsx` | **Konfuzja terminologiczna i obciążenie poznawcze:** Występowanie 4 kolumn godzinowych o zbliżonych nazwach (*Plan Godz.*, *Act RCP*, *Grafik h*, *H Plan*) oraz brak prezentacji bieżącego MTD TPLH na kartach KPI zmusza do domysłów i kalkulatora na zapleczu. |
| **UX-09** | **P3 (Niski)** | `WeeklyScheduleTable.tsx` | **Brak nawigacji klawiaturą:** Edycja komórek nie obsługuje strzałek (Góra/Dół) ani klawisza Tab do przechodzenia między tygodniami; brak skrótów klawiaturowych w podtabeli baristów. |
| **UX-10** | **P3 (Niski)** | `LaborForecastWidget.tsx` | **Zasłanianie treści przez widget pływający:** Pływający przycisk syreny (Speed-Dial) w prawym dolnym rogu zasłania stopkę tabeli i podsumowanie miesiąca na ekranach o małej rozdzielczości pionowej (768px). |

---

## 2. Szczegółowy Audyt Komponentów UI i Architektury Widoku

### 2.1. `OperationalAlert.tsx` — Analiza Rekomendacji i Alertów

Komponent `OperationalAlert.tsx` został pierwotnie zaprojektowany jako centralny punkt dowodzenia Store Managera w rytmie poniedziałkowym. Zawiera rozbudowany silnik podpowiedzi operacyjnych oparty o `planningCadence` (tydzień bieżący, tydzień opublikowany $W+1$, tydzień docelowy $W+2$).

#### Wykryte Wady i Analityczne Obserwacje:
1. **Osierocenie komponentu (Brak renderowania):**
   W pliku `src/modules/labor-forecast/components/LaborForecastView.tsx` komponent `OperationalAlert` **nie występuje w drzewie JSX**. Pomimo pełnego wyeksportowania w `index.ts` i opisania w dokumentacji `AGENTS.md` (wiersz 29), użytkownik w aktualnej wersji aplikacji nie widzi ani rekomendacji na tydzień opublikowany, ani weryfikacji nowego grafiku.
2. **Twardo zakodowane wartości zapasowe (Hardcoded Defaults):**
   W kodzie komponentu znajdują się statyczne literały liczbowe, które naruszają zasadę czystego kodu:
   - Wiersz 202: `const plan = pubRow?.planHours || 372.1;` — fallback do sztywnej wartości `372.1 h`.
   - Wiersz 245: `const targetBudget = nextWeekHanwFinal ?? targetRow?.planHours ?? 417.3;` — fallback do `417.3 h`.
   - Wiersz 229: `MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h` — statyczny string tekstowy informujący o `+15h`, nawet jeśli zaoszczędzono 3h lub 40h!
3. **Agresywność alertu Floor Hours (Fałszywe Alarmy):**
   Wiersz 128: Alert `🚨 KRYTYCZNY DEFICYT: SPRZEDAŻ WYMUSZA CIĘCIA PONIŻEJ FLOOR HOURS` aktywuje się w warunku `hanwRaw < floorH`. 
   *Wada operacyjna:* Na początku miesiąca (np. W1 i W2), jeśli w bazie nie ma jeszcze zarejestrowanych pełnych transakcji lub pierwsze dni miały niższe obroty, surowy algorytm wypracowanego budżetu potrafi gwałtownie ściąć pozostałe tygodnie. Pokazywanie kierownikowi czerwonego baneru z żądaniem *"Wymagana akceptacja i konsultacja z District Managerem"* wywołuje niepotrzebną panikę operacyjną w sytuacjach, które są standardową fluktuacją początku miesiąca.
4. **Wymiary fizyczne i kanibalizacja ekranu:**
   Pełen baner `OperationalAlert` z dwiema kartami decyzyjnymi mierzy ponad **420 px wysokości**. Na laptopie o rozdzielczości `1366x768` (gdzie po odliczeniu paska systemu, nagłówka okna i Hero Bara zostaje ~450 px przestrzeni pionowej) wyświetlenie alertu spycha całą tabelę harmonogramu poza krawędź ekranu, wymuszając nieustanne przewijanie.

---

### 2.2. `WeeklyScheduleTable.tsx` — Ergonomia Matrycy i Wprowadzania Danych

Tabela tygodniowa stanowi podstawowe narzędzie pracy kierownika w kawiarni. Poniżej przedstawiono analizę ergonomii dobowego rozkładu, inline overrides oraz dostępności.

#### A. Podział Robocizny (MGR vs Barista vs Total)
- **Logika rozbicia:** Wiersze tabeli poprawnie rozdzielają godziny zaplanowane na kadrę kierowniczą (`managerHours`, zasilane z Modułu 2 z wykluczeniem wsparć obcych i absencji) oraz pulę baristów (`baristaHoursPool` / `baristaScheduledHours`).
- **Tarcie przy wprowadzaniu (Friction Point):** W kolumnie *Grafik (h)* kliknięcie otwiera pole tekstowe, które oczekuje wpisania **łącznej sumy godzin tygodnia (MGR + Barisci)**.
  - W realiach Starbucks Store Manager zna z góry godziny kierowników (są one sztywno ułożone w grafiku menedżerskim).
  - Pytanie, na które odpowiada SM, brzmi: *"Ile godzin rozpisuję baristom w systemie MAPAL?"*
  - Wymuszanie sumowania w pamięci godzin menedżerów (np. 120h) i baristów (np. 264h) do wartości `384h` rodzi pomyłki arytmetyczne. Przycisk `+ Dodaj MGR` (wiersz 674) jest mały i nieintuicyjny.

#### B. Usability Inline Overrides (TRX i Godziny)
- Kliknięcie w `Act TRX` otwiera miniaturowe pole input z natychmiastowym podglądem odchylenia `vs AOP`. Działa to sprawnie, ale brakuje walidacji wpisywanych liczb (np. zabezpieczenia przed ujemnymi transakcjami lub przypadkowym wpisaniem 10-krotności wartości).
- Po wpisaniu wartości w `Grafik (h)` system automatycznie uruchamia algorytm `enrichDailyCoverageWithFlex`, rozdzielając godziny na poszczególne dni wg wag trendu popytu. Jest to doskonała funkcja, lecz jej efekt jest niewidoczny dopóki kierownik nie rozwinie wiersza tygodnia przyciskiem `▾`.

#### C. Krytyczna Wada Persystencji: `localStorage` zamiast SQLite
W wierszach 63–79 zaimplementowano stan dobowych godzin baristów:
```typescript
const [dailyBaristaHours, setDailyBaristaHours] = useState<Record<string, number>>(() => {
  try {
    const saved = localStorage.getItem('sbux_daily_barista_hours');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
});
```
**Konsekwencje operacyjne:**
1. **Wyciek danych między kawiarniami:** Klucz `sbux_daily_barista_hours` nie zawiera identyfikatora kawiarni (`storeId`). Po przełączeniu lokalu w platformie dobowy rozkład z lokalu Janki pojawi się w nowej kawiarni!
2. **Utrata danych:** Wyczyszczenie pamięci podręcznej przeglądarki/Electron lub praca na innym komputerze w kawiarni kasuje cały dobowy plan baristów, pozostawiając jedynie tygodniową sumę w SQLite.

#### D. Ergonomia Ekranu 13"–14" (Gęstość i Czytelność)
- **12 kolumn głównych:** `Tydz. & Status`, `Daty`, `Dni`, `Plan TRX`, `Act TRX`, `Plan Godz.`, `Act RCP (h)`, `Grafik (h)`, `Plan TPLH`, `Act TPLH`, `H Plan`, `Logowania`.
- **Szerokość tabeli:** Przy standardowym skalowaniu 100% tabela wymaga co najmniej 1280 px szerokości. Na laptopie 1366 px po uwzględnieniu menu bocznego pojawia się poziomy pasek przewijania.
- **Brak Sticky Headers:** Przy przewijaniu tabeli w dół nagłówki kolumn znikają. Przy przewijaniu w prawo znika kolumna z numerem tygodnia (`W1`, `W2`), uniemożliwiając identyfikację wierszy.
- **Mikro-czcionki:** W podtabeli dniowej zastosowano czcionki o rozmiarach `8px`, `8.5px`, `9px` i `9.5px` (np. wiersze 510, 572, 1013, 1120). Na błyszczącej matrycy taniego laptopa biurowego przy świetle jarzeniówek teksty te są niemal nieczytelne dla zmęczonego wzroku kierownika.

#### E. Dostępność Klawiatury
- Brak nawigacji strzałkami pomiędzy wierszami.
- W polach podtabeli dniowej (`DLA BARISTÓW (Wpisz h)`, wiersz 1079) nie ma obsługi klawisza `Enter`, który przenosiłby kursor do kolejnego dnia (np. z wtorku na środę). Wprowadzenie 7 dni wymaga każdorazowo sięgania po touchpad.

---

### 2.3. `KpiSummaryCards.tsx` — Czytelność i Obciążenie Poznawcze

Komponent definiuje 3 karty podsumowania miesięcznego:
1. `Plan AOP na MSC`
2. `Wykonanie MTD`
3. `Rekomendacja HANW / Rozliczenie Robocizny`

#### Analiza Obciążenia Poznawczego (Cognitive Load):
1. **Przeładowanie liczbami (Raw Data Overload):**
   W 3 kartach skumulowano aż **14 surowych wskaźników liczbowych**: `planHoursTotal`, `target_tplh`, `plan_trx`, `avg_weekly_hours`, `ncBudgetTotal`, `weeks_count`, `surplusHours`, `surplusHoursPerWeek`, `actualHoursMtd`, `hoursDiffVsPlan`, `actualTrxMtd`, `trendPercent`, `nextWeekHanwFinal`, `deltaEarnedHours`.
   Brak wyraźnej hierarchii powoduje, że oko kierownika "błądzi" po kafelkach, szukając odpowiedzi na proste pytanie: *"Czy jesteśmy na plusie, czy na minusie?"*.
2. **Brak kluczowego wskaźnika: MTD TPLH:**
   Na Karcie 2 (*Wykonanie MTD*) zaprezentowano `actualHoursMtd` oraz `actualTrxMtd`, ale **nie pokazano bieżącego realnego wskaźnika TPLH (TRX / RCP)**! Store Manager musi dzielić te liczby w pamięci lub szukać wartości w stopce tabeli.
3. **Myląca etykieta "Korekta AOP":**
   Na Karcie 3 wyświetlana jest wartość `deltaEarnedHours` opisana jako `Korekta AOP: +X h` tuż obok `Limit na grafik W4: 410 h`. Kierownicy często interpretują ten zapis jako możliwość dołożenia `+X h` do najbliższego tygodnia, podczas gdy jest to pula na cały pozostały miesiąc.

---

### 2.4. `TrendIntelligencePanel.tsx` — Przejrzystość Silnika Uczenia Maszynowego

Panel przedstawia wyniki wielomodelowego zespołu predykcji popytu (Ensemble AI: AOP Anchor + Run-Rate EMA + Sezonowość YoY).

#### A. Żargon Statystyczny vs Język Operacyjny Starbucks
Komponent operuje pojęciami akademickimi:
- *"Wielomodelowy Zespół Predykcji (Ensemble AI)"*
- *"Kotwica AOP (Waga 35%)"*
- *"Krótki Run-Rate EMA (Waga 45%)"*
- *"Wypadkowa Dynamika (Velocity)"*
- *"Przedział Ufności TRX"*

Dla Store Managera pojęcia te stanowią "czarną skrzynkę" (Black Box). Panel nie odpowiada na fundamentalne pytanie operacyjne: **"Dlaczego?"**
- Zamiast podawać wagi modeli matematycznych, panel powinien wyjaśniać:
  *„Piątki i soboty w CH Janki generują o 18% wyższy popyt w godzinach 14:00–19:00. Zalecamy dodatkową zmianę Barista MIB (11:00–19:30).”*

#### B. Krytyczna Wada: Pozorny Wybór Strategii (Fasada UI)
Panel zawiera 3 atrakcyjne wizualnie karty strategii:
- 🛡️ *Konserwatywna (Floor-Safe)*
- ⚖️ *Zrównoważona (Balanced AI)*
- 🚀 *Wzrostowa (Growth)*

**Rzeczywistość w kodzie:**
W pliku `src/App.tsx` kliknięcie strategii wywołuje `setSelectedStrategy`, co aktualizuje wyłącznie pole `activeStrategy` w obiekcie podsumowania. 
W pliku `src/modules/labor-forecast/services/calculationEngine.ts` parametr `selectedStrategy` **nie jest w ogóle przyjmowany ani uwzględniany w kalkulacji `nextWeekHanwFinal`**!
Kierownik klika strategię *Growth* oczekując zwiększenia rekomendacji godzin na weekend, a w tabeli harmonogramu wartości nie zmieniają się ani o 0.1 h. Jest to błąd krytyczny podważający zaufanie użytkownika do systemu.

---

### 2.5. Układ Strony `LaborForecastView.tsx` i Speed-Dial Widget

W aktualnym widoku `LaborForecastView.tsx`:
- Zamiast `OperationalAlert` i `KpiSummaryCards` wdrożono tzw. **Hero Bar** (wiersze 128–252).
- Pasek Hero Bar próbuje zmieścić w jednej linii kontekst miesiąca, wskaźniki AOP, AGC, COL %, MTD TPLH, Floor Hours, Pulę Flex oraz przycisk strategii AI.
- Na ekranach o szerokości mniejszej niż 1600 px elementy paska zawijają się w 3–4 nieregularne rzędy, tworząc chaos wizualny.
- Pływający widget `LaborForecastWidget.tsx` (zielona syrena w prawym dolnym rogu) posiada menu rozwijane z przydatnymi skrótami (Flash Forecast, Fichajes, Wykresy), lecz w stanie spoczynku przysłania komórki podsumowania kolumny *Logowania* oraz stopkę tabeli na ekranach laptopów.

---

## 3. Rytm Planowania Tygodniowego i Poniedziałkowy Termin Publikacji

### 3.1. Przebieg "Czarnego Poniedziałku" Store Managera
Zgodnie z art. 129 § 3 Kodeksu Pracy grafik musi zostać opublikowany na co najmniej 7 dni przed rozpoczęciem okresu. Ponieważ tydzień w Starbucks trwa od wtorku do poniedziałku, **poniedziałek jest nienaruszalnym terminem publikacji grafiku na tydzień $W+2$**.

Harmonogram operacyjny poniedziałku:
1. **08:00 – 12:00:** Bieżąca obsługa kawiarni, poranny szczyt.
2. **12:00 – 14:00:** Sprawdzenie realizacji obecnego tygodnia ($W$). Tydzień $W$ trwa do godziny 21:00/22:00, więc oficjalne logowania Fichajes będą znane dopiero we wtorek rano.
3. **14:00 – 16:00:** Ostateczne ułożenie i weryfikacja grafiku na tydzień $W+2$ (startujący za 8 dni).
4. **Przed 17:00:** Publikacja grafiku w systemie MAPAL i wywieszenie na tablicy dla załogi.

### 3.2. Rola i Działanie Flash Forecast (Pre-closing Projection)
Moduł 1 posiada dedykowany mechanizm projekcji poniedziałkowej (`MondayProjectionModal.tsx`):
- Pobiera zaplanowane na poniedziałek godziny menedżerów z Modułu 2 ($H_{\text{MGR Today}}$).
- Uzupełnia godziny baristów do wyznaczonego celu tygodnia.
- Tymczasowo włącza bieżący tydzień jako zamknięty (`isClosed = true`, `isMondayProjected = true`), co stabilizuje wskaźnik MTD Velocity.

#### Punkty Tarcia i Ryzyka Operacyjne:
1. **Ręczne zgadywanie transakcji poniedziałku:** Modal Flash Forecast wyświetla domyślnie pełny plan AOP tygodnia. Jeśli poniedziałek zapowiada się deszczowy lub obroty z poprzednich 6 dni były niskie, SM musi ręcznie skalkulować przewidywany wynik TRX. Brakuje automatycznej podpowiedzi: *"Średni poniedziałek w tym miesiącu generował 1 450 TRX"*.
2. **Wtorkowe zastąpienie danych:** We wtorek rano po imporcie rzeczywistych logowań estymacja Flash Forecast automatycznie ustępuje danym z bazy. Jeżeli poniedziałek zamknął się wynikiem drastycznie odbiegającym od projekcji, cel na opublikowany już wczoraj grafik $W+2$ ulega przesunięciu, wywołując dysonans (grafik został zatwierdzony wczoraj przy celu 410h, a we wtorek system pokazuje rekomendację 395h).

---

## 4. Praktyczne Problemy Operacyjne Store Managera

### 4.1. Ślepota na Odchylenia w Trakcie Tygodnia (Mid-Week Blindness)
Najbardziej palący problem operacyjny zgłaszany przez kierowników:
- **Scenariusz:** W czwartek w CH Janki doszło do awarii zasilania lub gwałtownej śnieżycy. Sprzedaż we wtorek, środę i czwartek wyniosła zaledwie 50% planu.
- **Działanie SM:** Kierownik chce natychmiast sprawdzić, jak ściąć obsadę w piątek, sobotę i niedzielę, aby nie przekroczyć budżetu miesięcznego i uratować TPLH.
- **Zachowanie Modułu 1:** Ponieważ tydzień nie jest zakończony (`isClosed = false`), wpisanie cząstkowych transakcji i godzin w tabeli **nie przelicza wskaźnika MTD Velocity** ani nie koryguje puli godzin na pozostałe dni tygodnia. Silnik czeka do poniedziałkowego Flash Forecast lub wtorkowego zamknięcia.
- **Ocena:** Brak interaktywnego symulatora *"Mid-Week Pace & Recovery Tracker"* wymusza na kierowniku liczenie cięć na kartce papieru.

### 4.2. Specyfika CH Janki: Niedziele Handlowe vs Wolne
- Algorytm `enrichDailyCoverageWithFlex` (wiersze 237–255) poprawnie przypisuje 20% puli flex na Niedziele Handlowe i 0% na Niedziele Wolne (czysty Floor 32h).
- **Luka UX:** W tabeli głównej tygodnia informacja o tym, czy dany tydzień zawiera niedzielę handlową, jest ukryta — pojawia się dopiero po rozwinięciu podtabeli dniowej (`🛒 HANDL.` vs `WOLNA`). Kierownik patrząc na zagregowany wiersz tygodnia W3 nie wie, czy wyższa rekomendacja godzin wynika z ogólnego trendu, czy z faktu, że w tym tygodniu przypada niedziela handlowa.

### 4.3. Most Menedżerski (Manager Labor Bridge) i Kolizje Obsady
W oknie `ManagerLaborBridgeModal.tsx`:
- Prezentowana jest siatka 7 dni z weryfikacją obecności kierownika na otwarciu (`hasAm`) i zamknięciu (`hasPm`).
- Gdy system wykryje brak menedżera (czerwony badge `❌ Brak AM`), kierownik widzi ostrzeżenie, ale **nie może jednym kliknięciem przejść do edycji grafiku menedżerskiego z zachowaniem kontekstu tego dnia**.
- Przycisk nawigacji do Modułu 2 przełącza cały widok bez wskazania konkretnego pracownika czy zmiany.

---

## 5. Rekomendacje Usprawnień (Roadmapa & RFC)

### 5.1. Szybkie Zwycięstwa (Quick Wins — do wdrożenia natychmiast)

1. **Przywrócenie i Ujednolicenie Komponentów Decyzyjnych w `LaborForecastView.tsx`:**
   - Zastąpić przeładowany Hero Bar zintegrowanym panelem decyzyjnym łączącym zoptymalizowany `OperationalAlert` (w wersji kompaktowej) oraz czytelne 3 karty `KpiSummaryCards`.
   - Usunąć twardo zakodowane stałe (`372.1`, `417.3`, `+15h`) z `OperationalAlert.tsx` i zastąpić je wartościami dynamicznymi wyliczanymi z budżetu.

2. **Migracja `dailyBaristaHours` z `localStorage` do SQLite:**
   - Utworzyć dedykowaną tabelę w SQLite:
     ```sql
     CREATE TABLE IF NOT EXISTS weekly_daily_barista_hours (
       store_id TEXT NOT NULL,
       week_key TEXT NOT NULL,
       day_num INTEGER NOT NULL,
       barista_hours REAL NOT NULL,
       updated_at TEXT NOT NULL,
       PRIMARY KEY (store_id, week_key, day_num)
     );
     ```
   - Całkowicie wyeliminować podatność wycieku danych między kawiarniami w trybie Multi-Store.

3. **Uruchomienie Przycisku Importu Fichajes:**
   - Dodać wyraźny przycisk `📥 Importuj Raport MAPAL (Fichajes / KPI)` w nagłówku tabeli tygodniowej oraz w menu pływającego widgetu `LaborForecastWidget.tsx`, podpinając go pod istniejący stan `setIsImportModalOpen(true)`.

4. **Wdrożenie Działania Wyboru Strategii AI:**
   - Przekazać `selectedStrategy` do `CalculationEngine.calculateMonthlySummary`.
   - Powiązać wariant *Floor-Safe* ze sztywnym trzymaniem AOP / Floor, a wariant *Growth* z buforem szczytowym (`learnedOptimalBufferWeekly`), tak aby kliknięcie strategii natychmiast aktualizowało liczby w kolumnie *H Plan* tabeli.

---

### 5.2. Średnioterminowe Refaktoryzacje Ergonomiczne (Medium-Term Refactorings)

1. **Kompaktowy Tryb Tabeli na Ekrany 13" (Responsive Back-Office Mode):**
   - Dodanie klas `sticky top-0` dla nagłówka tabeli oraz `sticky left-0` dla kolumny *Tydzień & Status* z tłem dopasowanym do wiersza.
   - Wprowadzenie przełącznika widoku:
     - **Widok Operacyjny (Domyślny dla SM):** 7 kluczowych kolumn (`Tydzień`, `Daty`, `Act TRX`, `Act RCP`, `MGR`, `DLA BARISTÓW`, `Cel HANW`).
     - **Widok Finansowy (Pełny AOP):** dodatkowe kolumny TPLH, wagi i odchylenia procentowe.
   - Zwiększenie rozmiaru czcionek w podtabeli dniowej do minimum `11px` / `12px` z wyraźnym kontrastem.

2. **Pełna Obsługa Klawiatury (Excel-Like Fast Entry):**
   - Obsługa klawiszy `ArrowUp` / `ArrowDown` do nawigacji po wierszach tygodniowych.
   - W podtabeli dniowej obsługa klawisza `Enter` przechodzącego bezpośrednio do pola edycji kolejnego dnia tygodnia.
   - Skrót `Ctrl+Enter` zatwierdzający i zwijający podtabelę.

3. **Tryb Wprowadzania Godzin: "Tylko Barisci" vs "Suma Tygodnia":**
   - Umożliwienie kierownikowi wyboru trybu edycji:
     - Domyślnie: kierownik wpisuje godziny, które przydziela baristom (np. `264h`), a system automatycznie dodaje godziny menedżerów (np. `120h`), wyświetlając sumę `384h`.
     - Eliminuje to konieczność ręcznego dodawania menedżerów przy każdym planowaniu.

---

### 5.3. Innowacje Strategiczne (Long-Term Innovations)

1. **Śródtygodniowy Asystent Odchyleń (Mid-Week What-If Recalibrator):**
   - Wprowadzenie paska postępu bieżącego tygodnia:
     *Wtorek ➔ Środa ➔ Czwartek ➔ Piątek (Dziś) ➔ Sobota ➔ Niedziela ➔ Poniedziałek*.
   - Gdy kierownik zaimportuje raport cząstkowy (np. w piątek rano), system oblicza aktualne tempo tygodnia i wyświetla rekomendację na weekend:
     *„Sprzedaż Wt–Czw jest o 8% niższa od planu. Aby obronić tygodniowy TPLH 3.10, zdejmij 4h w sobotę i 4h w niedzielę (z puli Flex ponad 32h Floor).”*

2. **Operacyjny Asystent Językowy AI (Operational Explanation Engine):**
   - Zastąpienie wykresów wag statystycznych prostymi komunikatami operacyjnymi w terminologii Starbucks:
     *„Zalecenie na W3 (22.09): Rozpisz 288.0 h baristom. W sobotę spodziewany duży peak popołudniowy (CH Janki) — zaplanuj dodatkową zmianę Barista MID 11:00–19:30. Niedziela niehandlowa — obsada ściśle 32.0 h.”*

---

## 6. Podsumowanie Oceny Ergonomii i Użyteczności

| Obszar Audytu | Ocena (1–5) | Komentarz Operacyjny |
| :--- | :---: | :--- |
| **Architektura Wizualna** | **2.5 / 5** | Bardzo wysoki potencjał, lecz osierocenie `OperationalAlert` i przeładowanie Hero Bara obniżają wartość użytkową. |
| **Ergonomia Matrycy (Tabela)** | **3.0 / 5** | Bogata w dane, ale zbyt szeroka na laptopa 13", brak `sticky columns`, krytyczny błąd zapisu do `localStorage`. |
| **Rytm Poniedziałkowy** | **3.5 / 5** | Świetna koncepcja Flash Forecast i podziału W+1/W+2, wymagająca jednak automatyzacji podpowiedzi transakcji. |
| **Obciążenie Poznawcze (Cognitive Load)**| **2.0 / 5** | Nadmiar surowych liczb, żargon statystyczny zamiast operacyjnego, pozorne działanie wyboru strategii AI. |
| **Odporność na Odchylenia Śródtygodniowe** | **2.0 / 5** | Brak reakcji silnika MTD na cząstkowe dane z trwającego tygodnia. |
| **ŁĄCZNA OCENA ERGONOMII MODUŁU 1** | **2.6 / 5** | **Wymaga pilnego wdrożenia Quick Wins i zabezpieczenia persystencji bazy przed wdrożeniem produkcyjnym.** |

