# Historia Zmian — Moduł 2: Managers Schedule (Grafik Managerski)

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module 2 (Managers Schedule).

---














## [v2.9.27] — 2026-11-22
- **Dopracowanie Funkcji Shift Hours, Wersjonowanie Czasowe i Przekazanie Zmiany (Handover Overlap)**:
  - **Wersjonowanie Czasowe Shift Hours (`effective_from_year`, `effective_from_month`)**:
    - Ustalanie profilu godzin i obsady kawiarni per rok z możliwością aktualizacji w trakcie roku (od wybranego miesiąca).
    - Ochrona wsteczna: przeszłe i zamknięte miesiące zachowują nienaruszone dane historyczne i oryginalne godziny dyżurów.
  - **Standardowa Długość Zmian Menedżerów (8h vs 9h)**:
    - Globalny i per-dzień parametr `shift_length_hours` określający nominalny czas trwania zmiany (8.0h, 8.5h, 9.0h).
    - Dynamiczne godziny: AM rozpoczyna się od otwarcia (`start_time`), a PM kończy na zamknięciu (`end_time`).
  - **Okno Przekazania Zmiany (Handover Overlap)**:
    - Automatyczne wyliczanie zakładki menedżerskiej pomiędzy końcem AM a początkiem PM wraz z podglądem na żywo w `WeeklyRequirementsModal`.
    - Weryfikacja minimalnej wymaganej zakładki (`min_handover_minutes`, domyślnie min. 60 min) z alertami w audycie grafiku i solverze AI.
  - **AutoScheduler AI & Tarcza Kodeksu Pracy**:
    - Generator AI przypisuje precyzyjne `custom_start_time`, `custom_end_time` oraz `hours` bazując na aktywnym profilu danego miesiąca.
    - Weryfikacja 11h odpoczynku dobowego uwzględnia faktyczne godziny otwarcia i zamknięcia.
  - **Panel Zarządzania Flotą (HQ Fleet Master Dashboard)**:
    - Centrala HQ ma bezpośredni dostęp do konfiguracji Shift Hours dla każdej kawiarni sieci w tabeli katalogu lokali.
  - **Akcja Dopasowania Szkicu (`db:adapt-schedule-to-weekly-requirements`)**:
    - Bezpieczna synchronizacja: zmiana profilu nie modyfikuje automatycznie zaplanowanych dyżurów bez zgody użytkownika; wprowadzono przycisk masowej adaptacji szkicu.

## [v2.9.25] — 2026-11-22
- **Faza II Rozwoju M2 (Core Enhancements): Zaznaczanie Blokowe, Boczny Panel TOR i Asystent Kryzysowy L4**:
  - **Zaznaczanie Blokowe (Range Selection) & Hurtowe Wypełnianie (`ManagerScheduleGrid`)**:
    - Wprowadzenie nawigacji zakresowej: `Shift + Strzałki` lub `Shift + Kliknięcie` zaznacza prostokątny blok komórek (np. 14 dni urlopu dla menedżera lub grupa menedżerów).
    - Hurtowe wypełnianie: wciśnięcie klawisza zmiany (np. `H`, `L4`, `OFF`, `AM`, `PM`) lub Enter z bufora Type-Ahead aplikuje zmianę do wszystkich zaznaczonych komórek z automatycznym przeliczeniem godzin i normy proporcjonalnej.
    - Klawisz `Delete` / `Backspace` hurtowo zeruje blok do `OFF`, a `Esc` natychmiast odznacza zakres.
    - Dedykowany wskaźnik HUD w stopce informujący o liczbie zaznaczonych komórek i pracowników.
  - **Boczny Panel Split-Screen TOR (`TorSplitDrawer`)**:
    - Nowy wsuwany z prawej strony panel kwartalnego rozliczenia TOR, dostępny pod przyciskiem `Split-Screen TOR (QX)` w nagłówku grafiku.
    - Możliwość podglądu bilansu kwartalnego, norm i godzin menedżerów na bieżąco podczas układania grafiku bez opuszczania widoku miesiąca.
    - Przełącznik kwartałów Q1–Q4 oraz szybkie przejście do pełnego widoku modułu TOR.
  - **Asystent Kryzysowy Zastępstw Awaryjnych & L4 (`L4CrisisModal`)**:
    - Dedykowany 1-klikowy asystent reagowania na nagłe zwolnienie lekarskie menedżera.
    - Silnik selekcji analizuje zespół i typuje najlepszego zastępcę według reguł: 1. Status `OFF` / `NC`, 2. 100% tarcza Kodeksu Pracy (odpoczynek 11h dobowy i 35h tygodniowy), 3. Wyrównanie luki etatowej w miesiącu (minimalizacja kosztownych nadgodzin).
    - Przycisk 1-Click "Obsadź": natychmiastowe oznaczenie chorego kodem `L4` i wstawienie dyżuru sali dla zastępcy.
    - Moduł kontaktu dystryktowego: generator gotowej treści SMS do sąsiednich kawiarni w sieci o wsparcie menedżerskie (`SUP`).
  - **Płynny Batching Solver AI (`autoSchedulerEngine.ts`)**:
    - Zmniejszenie wielkości partii solvera z 100 do 50 iteracji, eliminujące zacięcia pętli zdarzeń i podwajające częstotliwość odświeżania paska postępu generatora grafiku.
- **Faza I Rozwoju M2 (Quick Wins): Ergonomia Klawiatury, Floating Context Popover i Tarcza Styków KP**:
  - **Tarcza Przejść Miesięcznych KP (art. 151¹⁰ i 132 KP)**:
    - `autoSchedulerEngine.ts`: Rozszerzenie `prevMonthEmpStats` o parametr `consecutiveSundaysEnding` z poprzedniego miesiąca. Solver AI blokuje planowanie 1. lub 2. niedzieli pracującej w nowym miesiącu, jeśli menedżer przepracował już serię 2–3 niedziel na przełomie miesięcy, bezwzględnie chroniąc regułę 4. wolnej niedzieli.
    - `interStoreSupportEngine.ts`: Weryfikacja 11h odpoczynku dobowego na styku $M-1 \to D_1$ dla menedżerów delegowanych na wsparcie zewnętrznej kawiarni pierwszego dnia miesiąca.
  - **Lekki Popover Wyboru Zmiany z Kontekstem Dnia (`ShiftPickerPopover`)**:
    - Eliminacja pełnoekranowego zaciemnienia `bg-black/40 backdrop-blur` na rzecz subtelnego tła `bg-stone-900/20` z kliknięciem poza oknem zamykającym popover (`onClose`).
    - Bezpośredni podgląd obsady dnia (`otherManagersToday`) w nagłówku okna: Store Manager widzi kto jeszcze prowadzi zmianę (np. AM, PM, SUP) bez zamykania okna ani gubienia kontekstu.
  - **Klawiaturowy Bufor Type-Ahead dla Kodów Wieloliterowych (`ManagerScheduleGrid`)**:
    - Umożliwienie płynnego wpisywania z klawiatury kodów złożonych (`SAM`, `SPM`, `MID`, `AMN`, `PMN`, `SUP`, `MIB`, `NC`, `H`, `L4`, `OFF`) bez konieczności klikania myszą.
    - Wizualny wskaźnik wpisywanego bufora na aktywnej komórce (`{buffer}…`).
    - Klawisz `Enter` zatwierdza kod z bufora i automatycznie przeskakuje do kolejnego dnia (`Auto-Advance`), a `Delete` / `Backspace` usuwa znaki lub ustawia `OFF`.
  - **Live Delta Preview HUD w Stopce Siatki (`ManagerScheduleGrid`)**:
    - Wzbogacenie dolnego paska podsumowania o bieżący podgląd planowanych godzin menedżera do normy miesięcznej (z dynamicznym statusem bilansu `+/-X.Xh`) oraz dobowego stanu obsady Floor (czy spełniono minimum 1 AM + 1 PM).

## [v2.9.23] — 2026-11-22
- **Obsługa Dołączenia w Trakcie Kwartału i Proporcjonalna Norma Etatu (`effective_from`, art. 130 KP)**:
  - **Data objęcia stanowiska / zatrudnienia (`effective_from`)**: Możliwość wskazania konkretnego dnia rozpoczęcia pracy w oknie zarządzania zespołem (`ManagerTeamModal`) z natychmiastowym podglądem wyliczonej normy proporcjonalnej.
  - **Kalkulacja normy art. 130 KP (`ManagerScheduleEngine.calculateProportionalNorm`)**: Precyzyjne wyliczenie dni roboczych (poniedziałek–piątek z wyłączeniem świąt) od dnia startu do końca miesiąca z uwzględnieniem wymiaru etatu.
  - **Zabezpieczenie siatki grafiku (`ManagerScheduleGrid`)**: Dni przed dniem startu są wyszarzone (`—`), zablokowane przed edycją myszą i klawiaturą (`A`, `P`, `M`, `Enter`, `Delete`, wklejanie), z etykietą `Od {startDay}.{month}` w wierszu menedżera oraz bursztynową kropką w komórce normy.
  - **AutoScheduler AI**: Solver turniejowy respektuje `startDay` pracownika i nie planuje żadnych dyżurów przed dniem objęcia stanowiska, dążąc do wyliczonej normy proporcjonalnej.
  - **Integracja Kwartalna TOR (`TorEngine`, `TorView`)**:
    - Miesiące nieaktywne przed dołączeniem menedżera mają normę 0.0h i bilans 0.0h (`—`), bez obciążania pracownika fałszywymi niedogodzinami.
    - Miesiąc dołączenia rozlicza normę proporcjonalną (np. 88h od 16. listopada) z odznaką `od {startDay}.{month}` w komórce RCP.
    - Bilans kwartału TOTAL sumuje wyłącznie okres rzeczywistej pracy.
  - **Persystencja SQLite**: Kolumna `effective_from TEXT` w `manager_monthly_roster` z automatycznym resetowaniem do `null` przy propagacji na przyszłe miesiące (pełny etat 100% w kolejnych miesiącach).

## [v2.9.22] — 2026-11-22
- **Model Projekcji Kroczącej (Rolling Forecast) & Dniowe Odcięcie RCP w TOR**:
  - **Miesiąc bieżący (w toku)**: Wprowadzenie hybrydowego zasilania kolumny `RCP (h)` w widoku TOR (`TorEngine.calculateQuarterData`). Do ostatniego dnia zaimportowanego raportu Fichajes godziny pobierane są z rzeczywistych logowań RCP (`actualRcpByMonth`), a od kolejnego dnia do końca miesiąca doliczane są godziny zaplanowane w grafiku (`shifts`), eliminując sztuczne deficyty w trwającym miesiącu.
  - **Miesiąc zakończony (miniony)**: W przypadku zamkniętych miesięcy system odcina doliczanie godzin z planowanego grafiku po dniu odcięcia RCP. Jeśli wgrano raport tylko do połowy miesiąca, dni bez logowań traktowane są jako $0.0\text{ h}$, co wymusza dyscyplinę wgrania pełnego raportu za cały miesiąc z MAPAL.
  - **Kontrolki i statusy zasilania w nagłówku i tabeli TOR (`TorView`)**:
    - 🟢 `Pełne RCP` (`FULL_RCP`) — kompletne logowania z MAPAL za cały miesiąc.
    - 🟡 `RCP do {dzień}. + Grafik` (`ROLLING_PROJECTION`) — projekcja krocząca w bieżącym okresie.
    - 🔴 `Niepełne RCP (do {dzień}.) ⚠️` (`PARTIAL_RCP_CLOSED`) — alert o niepełnym raporcie w zakończonym miesiącu bez doliczania grafiku.
    - ⚪ `Plan z grafiku` (`PLAN_ONLY`) — miesiąc przyszły lub brak logowań.
  - Rozszerzenie kontraktu IPC `db:get-tor-quarter-data` o `maxRcpDayByMonth` (dokładny dzień odcięcia logowań w kawiarni).

## [v2.9.20] — 2026-11-22
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.19] — 2026-11-22
- **Cross-Store TOR Aggregation (Automatyczna Agregacja Międzykawiarniana w TOR)**:
  - Rozwiązano problem braku zaciągania grafików wprowadzonych w innej kawiarni (np. Kalisz w listopadzie) do kwartalnego rozliczenia TOR w innej lokalizacji (np. Zakopane).
  - Wdrożenie metody `getCrossStoreTorData` w `DatabaseManager` i obsługa w kanale IPC `db:get-tor-quarter-data`.
  - Automatyczne powiązanie pracownika we wszystkich bazach kawiarni (`store_*.db`) wg Global Partner ID, adresu email lub spójnego imienia i nazwiska (`matchesEmployeeIdentity`).
  - Przepisywanie identyfikatora na ID w bieżącej kawiarni i sumowanie godzin dyżurów w silniku `TorEngine` z obsługą wielokrotnych zmian w jednym dniu.
  - Dodanie odznaki `Sieć` i dedykowanego tooltipa w widoku `TorView` informującego o uwzględnieniu dyżurów z pozostałych lokali.

## [v2.9.18] — 2026-11-22
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.17] — 2026-11-22
- **Tarcza Integralności Historii i Usunięcia Przyszłe w Składzie Menedżerskim**:
  - **Blokada usuwania wstecz**: Usunięcie pracownika ze składu w minionych miesiącach kalendarzowych zostało bezwzględnie zablokowane dla Store Managera (wymaga uprawnień konta Master/Fleet Master).
  - **Kaskadowe usunięcie w przód**: Usunięcie pracownika z grafiku od wybranego miesiąca (np. grudzień) automatycznie czyści jego obecność we wszystkich kolejnych miesiącach (`manager_monthly_roster` oraz `manager_schedule_shifts`), pozostawiając miesiące wcześniejsze w 100% nienaruszone.
  - **Wskaźnik w `ManagerTeamModal`**: Wyróżnienie miesięcy archiwalnych z kłódką `Lock` na akcji usuwania oraz informacyjnym banerem o ochronie historii.
- **Globalny Rejestr Tożsamości Pracowników (Global Partner ID & Email)**:
  - Wprowadzenie pól `partner_id` (Starbucks Partner ID) oraz `email` (służbowy adres email AmRest) w tabelach `manager_employees` oraz `manager_monthly_roster`.
  - Powiązanie tożsamości globalnej dla Dawida Apela (`ID: 00106539`, `dawid.apel@amrest.eu`) we wszystkich bazach kawiarni (`store_${storeId}.db`).
  - Rozszerzenie interfejsu `ManagerTeamModal` o dedykowany pasek tożsamości pracownika z plakietką zweryfikowanego Partnera Globalnego (*Fleet Master / Global ID*).
  - Wzbogacenie parsera raportów MAPAL Fichajes o automatyczne dziedziczenie Partner ID i emaila.
- **Aprowizacja Godzin Zmian i Profilu Tygodnia w Silosach Firestore Kawiarni**:
  - Bezpośrednia synchronizacja 16 kanonicznych definicji zmian w `stores/{storeId}/meta/shift_configuration`.
  - Stały profil tygodniowy w chmurze `stores/{storeId}/meta/weekly_requirements` (2 MGR, Pn–So 07:00–22:30, Nd 08:00–21:00).
  - Automatyczna aprowizacja nowych kawiarni oraz codzienna autodiagnostyka i samonaprawa (auto-heal) w `CloudIntegrityScheduler`.
  - Włączenie tabel wymogów obecności do szyfrowanego skarbca `ScheduleVaultPayload`.

## [v2.9.16] — 2026-11-21
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.15] — 2026-11-21
- **Standardowy Profil Tygodnia (Godziny & 2 MGR) oraz Wykluczenie Non-Coverage (NC / T)**:
  - Tabela `manager_weekly_requirements` w SQLite ze stałym profilem tygodniowym kawiarni (8 dni: Pn–So, Nd wolna, Nd handlowa).
  - Domyślny profil sieci Starbucks: 2 MGR na sali (otwarcie + zamknięcie), Pn–So 07:00–22:30 (16h), Nd 08:00–21:00 (14h/16h).
  - Modal `WeeklyRequirementsModal` i przycisk *„Profil Tygodnia (2 MGR)”* w nagłówku oraz Speed-Dialu grafiku.
  - Opcja masowej propagacji w `DayRequirementsModal`: *„Zastosuj te godziny dla wszystkich dni [Dzień] w tym miesiącu”*.
  - **Bezwzględne wykluczenie Non-Coverage (`NC`, `T`, `TAM`, `TPM`, `BT`, `PRE`, `MEE`, `RET`) z obsady sali**:
    - `totalManagersWorking` zlicza wyłącznie zmiany operacyjne (Coverage). Menedżer na `NC` lub szkoleniu `T` nie zalicza wymogu 2 osób prowadzących.
    - Dedykowana fioletowa odznaka `+X NC` w wierszu *„Obsada (Dziennie)”* dla pełnej czytelności podziału Floor vs Non-Coverage.
  - Zasilenie silnika `AutoSchedulerEngine` (solver AI automatycznie czerpie wymogi ze standardowego profilu tygodnia).

## [v2.9.14] — 2026-11-21
- **Niestandardowe Wymogi Obecności Menedżerów per Dzień (Wigilia, Sylwester, Skrócone Dyżury)**:
  - Wdrożenie okna dialogowego `DayRequirementsModal` otwieranego bezpośrednio z nagłówka dnia na siatce grafiku.
  - Wprowadzony przedział definiuje bezpośrednio godziny dyżuru i obecności kierownika (np. 07:00–16:00 = 9.0h pracy), a nie godziny otwarcia kawiarni dla klientów.
  - Elastyczna liczba menedżerów: 1 menedżer (pojedyncza zmiana całodzienna), 2 menedżerów (AM+PM) lub 0 menedżerów (lokal zamknięty, np. Boże Narodzenie 25.12).
  - Tabela `manager_day_requirements` w SQLite wraz z obsługą IPC (`saveManagerDayRequirement`, `deleteManagerDayRequirement`).
  - Eliminacja fałszywych alarmów w wierszu obsady i podsumowaniach luki kadrowej dla dni o wymogu 1 MGR lub 0 MGR.
  - Wyróżniony 1-klik w `ShiftPickerPopover` do natychmiastowego dopasowania zmiany menedżera do wyliczonych godzin obecności dnia.

## [v2.9.13] — 2026-11-21
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.12] — 2026-11-21
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.11] — 2026-11-06
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.10] — 2026-11-06
- **Ochrona Grafiku przed Kolizjami (Feature F19)**: Integracja z Trzypoziomową Tarczą Kolizyjną (`CloudSnapshotService`) – zabezpieczenie ułożonego grafiku przed przypadkowym cofnięciem przez innego managera oraz obsługa autorytatywnego odświeżania przez `CloudRestoreNoticeModal`.

## [v2.9.9] — 2026-11-05
- Bieżąca synchronizacja i optymalizacje modułu.

## [v2.9.8] — 2026-11-05
- **Mechanizm Write-Through & Real-time Live Sync (Feature F18)**:
  - Wdrożenie repozytorium `ScheduleWriteThroughRepository` dla wszystkich operacji zapisu grafiku i składu menedżerów.
  - Natychmiastowy zapis lokalny w SQLite (0 ms latencji) połączony z asynchronicznym rozgłoszeniem zdarzenia do Google Cloud Firestore (`stores/{storeId}/realtime_events/`).
  - Automatyczny bufor awaryjny (Outbox Fallback) w `SyncEngine` przy braku sieci internetowej.
  - Wdrożenie `InboundSyncConsumer`: automatyczne replikowanie przychodzących z chmury zdarzeń do lokalnej bazy SQLite (`store_${id}.db`) z deduplikacją i powiadomieniami UI.
  - Pełna subskrypcja na żywo w `ManagerScheduleView` z automatycznym odświeżaniem siatki grafiku przy edycjach na innych stacjach roboczych w kawiarni.

## [v2.9.7] — 2026-11-05
- **Smart Swap Assistant AI (`smartSwapEngine.ts`, `ShiftPickerPopover.tsx`)**:
  - Dedykowana zakładka `✨ Smart Swap AI` w oknie wyboru zmiany umożliwiająca błyskawiczne znalezienie optymalnych zmienników z zespołu.
  - Obsługa zamian w ten sam dzień (Same-Day) oraz zamian krzyżowych z wyrównaniem (Cross-Day Balance Swap) gwarantujących $\Delta = 0.0$h w TOR.
  - Transparentne etykietowanie zamian z udziałem urlopów (`⚠️ Przesunięcie H`) i administracji (`📋 Przesunięcie NC`) przy zachowaniu twardej blokady dla zwolnień lekarskich `L4`.
- **AI Row Re-roll (`ManagerScheduleGrid.tsx`)**:
  - 1-klik optymalizacja całego wiersza menedżera z poziomu siatki grafiku za pomocą heurystyki minimalnej inwazji (Swap Chain).
  - Automatyczne rozwiązywanie kolizji KP i zaspokajanie deklaracji dyspozycyjności (`OFF`, `M`, `Z`) poprzez precyzyjne mikrozamiany z resztą zespołu.
- **Powiadomienia Toast**:
  - Płynny, pływający komponent powiadomień informujący o przeprowadzonych roszadach i statusie bilansów TOR.

## [v2.9.7] — 2026-11-02
- **Dostosowanie Floty**: Kompatybilność wsparcia międzykawiarnianego z nowym katalogiem floty i dynamicznym licznikiem jednostek.

## [v2.9.6] — 2026-11-02
- **Synchronizacja Architektury**: Uzupełniono specyfikację techniczną w `AGENTS.md` o moduł wsparcia międzykawiarnianego (`InterStoreSupportModal.tsx`, `interStoreSupportEngine.ts`) oraz stałe zmian (`constants/defaultShifts.ts`).
- **Korekta Parametrów AutoScheduler AI**: Ujednolicono w dokumentacji domyślną liczbę iteracji do 2 000 prób (`2k`) zgodnie z implementacją w `autoSchedulerEngine.ts`.
- **Systemowa Organizacja Stałych**: Utworzono `constants/index.ts` konsolidujący reguły KP (11h/35h, 4. niedziela), Floor 32h/224h oraz solver AI (2k).
- **Public API Barrel**: Zaktualizowano `index.ts` o pełny eksport `types` oraz `constants`.
- **Reguła Auto-Sync**: Wprowadzono bezwzględną regułę aktualizacji dokumentacji po modyfikacjach kodu.

## [v2.8.63] — 2026-10-24
- **Ergonomia Siatki Grafiku**: Przypięte kolumny (`sticky`) z nazwiskami i etatami menedżerów podczas horyzontalnego przewijania 31 dni.
- **Skróty Klawiaturowe M/S**: Szybkie przełączanie widoku Miesięcznego i Tygodniowego bez konieczności klikania myszą.
- **Ujednolicenie Norm TOR (H / L4)**: Wprowadzenie ścisłego wliczania godzin urlopu i chorobowego wyłącznie w dni robocze (art. 154² § 1 KP) oraz zerowanie w weekendy/święta.

## [v2.8.62] — 2026-10-19
- **AutoScheduling AI dla Osób w Szkoleniu**: Automatyczne uwzględnianie i planowanie zmian szkoleniowych (`TAM`/`TPM`) dla menedżerów w trakcie wdrożenia (`in_training`).

## [v2.8.58] — 2026-10-19
- **Autonomiczne Składy Miesięczne**: Rozszerzenie tabeli `manager_monthly_roster` o persystencję per kawiarnia, automatyczne klonowanie z miesiąca $M-1$ i edycję w `ManagerTeamModal`.

## [v2.8.30] — 2026-09-21
- **Katalog Zmian Starbucks**: Rozszerzenie listy zmian o specyficzne kody Starbucks (np. `PRE`, `MEE`, `BT`, `SAM`, `SPM`, `SUP`), blokada zmian niedzielnych w dni powszednie w `ShiftPickerPopover`.

## [v2.8.0] — 2026-09-15
- **AutoScheduling AI (2k prób)**: Autonomiczny generator grafiku menedżerskiego z zaawansowaną heurystyką, twardymi ograniczeniami Kodeksu Pracy (11h/35h, 4. niedziela), dyspozycjami i preferencjami zespołu.
- **Floating Speed-Dial Navigation Hub (`AutoScheduleWidget`)**: Pływający widget z radialnym wskaźnikiem normy miesiąca, TOR oraz skrótami do generatora AI.

## [v2.7.0] — 2026-09-12
- **Trzymiesięczny Okres Rozliczeniowy (TOR)**: Dedykowany widok kwartalny Q1–Q4 (`TorView.tsx`, `torEngine.ts`) z bilansowaniem nadgodzin i niedogodzin.
- **Integracja MAPAL Fichajes RCP**: Zasilanie kolumn godzin rzeczywistych prosto z zaimportowanych ewidencji odbić i detekcja kolizji z absencjami L4/H.

## [v1.0.0] — 2026-08-01
- **Siatka Grafiku Managerskiego**: Bazowa miesięczna matryca planowania, tarcza Kodeksu Pracy (art. 130, 132, 133 KP) i eksport Excel.
