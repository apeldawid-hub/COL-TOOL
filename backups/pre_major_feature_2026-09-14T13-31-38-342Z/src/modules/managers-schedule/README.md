# Moduł 2: Managers Schedule — Grafik Managerski (Starbucks)

Autonomiczny moduł planowania i bilansowania miesięcznego grafiku pracy zespołu kierowniczego kawiarni **108120 SBX Warszawa Janki**.

---

## 🎯 Główne Funkcjonalności

1. **Miesięczna Matryca Grafiku (Dni 1–30/31)**:
   - Dedykowany widok tabelaryczny z dniami miesiąca i dniami tygodnia.
   - Wyróżnienie weekendów (Sobota, Niedziela) oraz świąt ustawowo wolnych od pracy.
   - Przypięte kolumny menedżerów (po lewej) oraz podsumowań norm i bilansów (po prawej).
2. **Szybki Wybór Zmian (Shift Picker Popover)**:
   - Kliknięcie w dowolną komórkę otwiera okno wyboru zmiany z kafelkami pogrupowanymi na:
     - 🟢 **Coverage (Sala & Bar)**: `AM`, `PM`, `SAM`, `SPM`, `AMN`, `PMN`, `SUP`, `MIB`, `AMB`, `PMB`, `MI4`
     - 🟣 **Non-Coverage (Zadania SM/SSV)**: `NC`, `PRE`, `BT`, `TAM`, `TPM`, `RET`, `T`, `MEE`
     - ⚪ **Dni Wolne & Urlopy**: `OFF`, `H` (Urlop), `L4` (Chorobowe)
     - 📋 **Dyspozycje**: `M` (Rano), `Z` (Wieczór), `FULL` (Pełna)
3. **Automatyczne Rozliczanie Kodeksu Pracy (KP)**:
   - Automatyczne wyznaczanie dni roboczych, wymaganych dni wolnych i normy godzinowej dla każdego wymiaru etatu (`FULL`, `0.75`, `0.5`, `0.25`).
   - Dynamiczny licznik godzin wypracowanych, dni `OFF` oraz salda bilansu (+/- h).
4. **🛡️ Tarcza Kodeksu Pracy (Weryfikacja 4 Norm Prawnych)**:
   - **Min. 11h odpoczynku dobowego** (art. 132 KP): blokada planowania zmian porannych po nocnych bez 11h przerwy.
   - **Min. 35h odpoczynku tygodniowego** (art. 133 KP): kontrola ciągłości wypoczynku (zakaz 7 dni ciągłej pracy).
   - **Maks. 12h pracy w dobie** (art. 135 KP): ochrona maksymalnego wymiaru dobowego.
   - **Maks. 3 pracujące niedziele z rzędu** (art. 151^10 KP): obowiązek wolnej niedzieli co najmniej raz na 4 tygodnie.
   - Dedykowany modal inspekcji `Tarcza KP` z opisem naruszeń i podpowiedzią rozwiązań.
5. **Wskaźnik Bezpieczeństwa Obsady (AM / PM)**:
   - Weryfikacja czy w każdym dniu kawiarnia ma zapewnionego kierownika otwierającego (`AM`) oraz zamykającego (`PM`).
   - Czerwone diody ostrzegawcze w przypadku braku obsady.
5. **Wiersz Ważne Wydarzenia**:
   - Możliwość wprowadzania i edycji notatek operacyjnych per dzień (np. wsparcia w innych kawiarniach, audyty, premiery produktów).
6. **Zarządzanie Zespołem**:
   - Okno `Zespół Menedżerski` pozwala na dodawanie pracowników, zmianę etatów, reordering oraz aktywację/deaktywację.
7. **⚙️ Katalog i Konfiguracja Zmian (Shift Config)**:
   - Zarządzanie katalogiem kodów zmian Starbucks, nazwami, godzinami pracy i kategoriami.
   - **☀️ Zasada Niedzieli**: Zmiany ze słowem "Niedziela" lub flagą *Tylko Niedziela* (np. `AMN`, `PMN`) są aktywne wyłącznie w niedziele i zablokowane do wyboru w dni powszednie.
8. **🏢 Zmiany Support (`SUP`) i Obsada Kawiarni**:
   - Zmiany `SUP` (wsparcie w innej kawiarni) wliczają się do wypracowanych godzin menedżera (8.0h), ale są automatycznie wyłączone z obsady sali/kawiarni macierzystej w Jankach.
9. **🔒 Historia Wersji i Reguła Publikacji 7 Dni (art. 129 § 3 KP)**:
   - Zapisywanie migawek grafiku (`draft`) i możliwość powrotu do poprzednich wersji w fazie planowania.
   - Dokładnie na 7 dni przed 1. dniem miesiąca grafik zostaje zamrożony jako wersja oficjalna (`published`), a cofanie do starszych wersji roboczych zostaje zablokowane.
   - Każda późniejsza zmiana rejestrowana jest w audycie jako **Modyfikacja po publikacji** (`post_publication_edit`).
10. **🚨 Pre-flight Walidacja KP przed Zmianą Kafelka**:
    - Próba przypisania zmiany naruszającej normy (np. odpoczynek < 11h, praca > 12h, 4. niedziela) natychmiast wyświetla okno ostrzegawcze z komunikatem *"Niezgodne z Kodeksem Pracy"* i wyczerpującym uzasadnieniem prawnym.
11. **⏱️ Klikalny Kafelek Normy i Baza Norm KP na -10/+10 Lat (2016–2036)**:
    - Baza danych zawiera pre-seeding oficjalnych polskich norm Kodeksu Pracy dla 252 miesięcy (2016–2036).
    - Kafelek `Norma Miesiąca` w nagłówku jest w pełni interaktywny i pozwala na natychmiastową edycję normy roboczej/godzinowej danego miesiąca z opcją przywrócenia wartości ustawowych.
12. **🏥 Urlop (H) i Chorobowe (L4) zależne od wymiaru etatu (oraz reguła weekendowa)**:
    - Urlop `H` i zwolnienie lekarskie `L4` zaliczają pracownikowi dobowy wymiar etatu ($8.0\text{h} \times \text{etat}$, np. 6h dla 0.75, 4h dla 0.50) **wyłącznie w dni robocze**.
    - Zgodnie z art. 154² § 1 Kodeksu Pracy w weekendy (soboty, niedziele) oraz święta państwowe urlop `H` oraz chorobowe `L4` **nie generują godzin do etatu ($0.0\text{h}$)**, a w oknie wyboru zmiany kafelki prezentują `0h (Weekend / Święto — bez godzin)`.
    - Nieobecności L4 oraz H nie są liczone do fizycznej obsady sali kawiarni (`totalManagersWorking`).
13. **🛒 Kalendarz Dni Wolnych od Pracy i Niedziel Handlowych na Matrycy**:
    - Silnik wylicza 7 ustawowych niedziel handlowych w Polsce w każdym roku (art. 7 ustawy o ograniczeniu handlu).
    - W nagłówku matrycy grafiku dodano dedykowany wiersz **STATUS** z etykietami:
      - `ŚWIĘTO` (🇵🇱 czerwony badge dla świąt państwowych).
      - `🛒 HANDL.` (szmaragdowy pulsujący badge dla niedziel handlowych).
      - `WOLNA` (bursztynowy badge dla niedziel niehandlowych).
      - `SOB` (dla sobót) i `Praca` (dla dni roboczych).
    - Komórki matrycy posiadają eleganckie cieniowanie tła w zależności od typu dnia.
    - Pomiędzy kafelkami KPI a grafikiem dodano baner podsumowania kalendarza z konkretnymi datami niedziel handlowych i świąt państwowych.
14. **📊 TOR — Trzymiesięczny Okres Rozliczeniowy (Widok Kwartalny Q1–Q4)**:
    - Zgodnie z art. 129 § 1 KP i arkuszem referencyjnym `TOR`, moduł oferuje dedykowany widok kwartalny rozliczający 3 miesiące w czystym, 3-kolumnowym układzie godzinowym:
      - Zestawienie: `ETAT` (zbiorczo przy menedżerze), dla każdego miesiąca dokładnie 3 kolumny godzinowe: `RCP (h)` (dyżury na sali), `H (h)` (urlopy), `L4 (h)` (chorobowe) oraz `BILANS` (+/- h względem normy).
      - **Reguła pierwszeństwa L4 nad H (art. 166 KP)**: Zachorowanie w trakcie urlopu zalicza godziny do kolumny `L4`, a nie `H`.
      - Saldo kwartału i wyznaczanie statusu: `OK` (zrównoważony), `nadgodziny` (nadpracowanie), `niedogodziny` (deficyt).
      - Dedykowany eksport arkusza TOR do pliku `.xlsx`.
15. **🔗 Inspekcja Kodeksu Pracy na Przejściach Między Miesiącami**:
    - Weryfikacja 11h odpoczynku dobowego między ostatnim dniem poprzedniego miesiąca a 1. dniem bieżącego, oraz między końcem bieżącego a początkiem kolejnego.
    - Uwzględnianie ciągłości serii 35h odpoczynku tygodniowego oraz kolejnych pracujących niedziel przechodzących przez granicę miesiąca.
16. **Eksport do Microsoft Excel (.xlsx)**:
    - Dedykowane generatory plików Excel dla Grafiku Miesięcznego oraz Trzymiesięcznego Okresu Rozliczeniowego (TOR).
17. **📋 Zbiorcza Matryca Dyspozycyjności i Inteligentny Import z Excela**:
    - Dedykowany widok tabelaryczny `Matryca Dyspozycji` na dany miesiąc dla całego zespołu menedżerskiego.
    - Szybka edycja pojedynczych komórek: cykliczne przełączanie 1-klikiem (`OFF` ➔ `M` ➔ `Z` ➔ `FULL`) lub klawisze <kbd>M</kbd>, <kbd>Z</kbd>, <kbd>F</kbd>, <kbd>O</kbd>.
    - **Smart Clipboard Paste**: możliwość skopiowania z pliku Excel menedżerów wiersza lub całej tabeli i wklejenia (`Ctrl+V`), z automatycznym mapowaniem polskich i angielskich oznaczeń.
    - Atomowy transakcyjny zapis zbiorczy w bazie SQLite.
18. **🔒 Blokada Edycji Zamkniętych / Przeszłych Miesięcy (`isMonthClosed`)**:
    - Miesiące przeszłe względem aktualnego czasu systemowego zostają automatycznie zamrożone w trybie tylko do odczytu (archiwum).
    - Zablokowana możliwość klikania i przypisywania zmian w komórkach grafiku, edycji notatek i wydarzeń operacyjnych, wprowadzania i importu dyspozycji oraz modyfikacji normy miesiąca.
19. **⚡ Integracja RCP z Modułem TPLH Forecast i Detekcja Kolizji RCP vs L4 / H**:
    - **Automatyczne zasilanie z systemu MAPAL**: Kolumna `RCP (h)` w widoku TOR oraz grafiku jest bezpośrednio zasilana zarejestrowanymi godzinami z tabeli `labor_actuals_log`.
    - **Wszystkie kawiarnie (w tym wsparcia)**: Dla menedżerów uwzględniane są dyżury z kawiarni Janki (384) oraz wsparcia w innych jednostkach Starbucks (SAM, SPM, SUP), bez zaburzania Floor Hours Modułu 1.
    - **Nieedytowalność RCP**: Zarejestrowany czas pracy jest zabezpieczony przed ręczną edycją i oznaczony w widoku TOR zieloną kontrolką statusu.
    - **Detekcja kolizji MAPAL vs Grafik**: System automatycznie identyfikuje przypadki, gdy pracownik logował się do pracy w dniu, w którym zaplanowano absencję (`L4` lub `H`).
    - **Sygnalizacja i Pre-flight**:
      - Baner ostrzegawczy nad kalendarzem z liczbą wykrytych kolizji,
      - Pulsująca ikona `⚡` oraz złota obwódka w komórce danego dnia na matrycy grafiku,
      - Okno dialogowe pre-flight przy próbie manualnego przypisania L4 lub H na zarejestrowane godziny,
      - Dedykowany modal `RcpAbsenceConflictDialog` z pełnym raportem kolizji i rekomendacjami dla Store Managera.
    - Oznaczenie kłódką i etykietą `🔒 Miesiąc zamknięty (Tylko do odczytu)` w pasku kontrolnym.

---

## 📦 Zależności i Uruchomienie

Moduł jest włączany w aplikacji za pomocą przycisku `Grafik Managerski` w górnym pasku nawigacji.

```bash
# Uruchomienie deweloperskie
npm run dev

# Kompilacja produkcyjna
npm run build
```

Szczegółowe wytyczne techniczne dla agentów AI znajdują się w pliku [AGENTS.md](./AGENTS.md).
