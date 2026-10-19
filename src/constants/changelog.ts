// src/constants/changelog.ts
/**
 * Starbucks Operations Suite — Dziennik Zmian & Rejestr Historii Wydań
 * Zarządzany automatycznie przez Agenta Dziennika Zmian (scripts/changelog-agent.js)
 */

export type ChangelogCategory = 'feature' | 'enhancement' | 'fix' | 'compliance' | 'database';

export interface ChangelogItem {
  type: ChangelogCategory;
  description: string;
  module?: 'labor_forecast' | 'managers_schedule' | 'trainings' | 'col_calculator' | 'system' | 'database' | 'all';
}

export interface ReleaseEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'major' | 'minor' | 'patch';
  highlights: string[];
  items: ChangelogItem[];
  author?: string;
}

export const APP_CHANGELOG: ReleaseEntry[] = [
  {
    version: '2.8.58',
    date: '2026-10-19',
    title: 'Naprawa Zapisu i Propagacji Składu Zespołu w Nowej Kawiarni & Integracja ManagerTeamModal',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Naprawa zapisu składu zespołu kierowniczego w Ustawieniach oraz dedykowanym modalu składu (ManagerTeamModal)',
      'Brakujący alias IPC saveManagerEmployees w preload.ts oraz obsługa obu nazw kanałów zapisu w UI',
      'Weryfikacja istnienia pracownika w tabeli manager_employees i automatyczne generowanie unikalnych ID przy braku rekordu w nowo utworzonej kawiarni',
      'Bezpośredni dostęp do zarządzania składem zespołu z poziomu siatki grafiku (ManagerScheduleGrid) oraz pływającego widgetu bocznego (AutoScheduleWidget)',
      'Automatyczna propagacja składu zespołu na cały bieżący rok kalendarzowy w nowo utworzonych kawiarniach'
    ],
    items: [
      {
        type: 'fix',
        description: 'Usunięcie błędu uniemożliwiającego zapis nowego zespołu przez brak aliasu saveManagerEmployees w preload.ts.',
        module: 'managers_schedule',
      },
      {
        type: 'fix',
        description: 'Zabezpieczenie operacji INSERT vs UPDATE w DatabaseManager.saveMonthlyRoster dla nowo dodanych pracowników w nowej bazie SQLite.',
        module: 'database',
      },
      {
        type: 'feature',
        description: 'Podpięcie ManagerTeamModal z przyciskiem Skład w nagłówku kolumny Menedżerowie i pustym stanie tabeli w ManagerScheduleGrid.',
        module: 'managers_schedule',
      },
      {
        type: 'enhancement',
        description: 'Szybki dostęp do składu zespołu z poziomu pływającego menu Starbucks Schedule Hub (AutoScheduleWidget).',
        module: 'managers_schedule',
      },
      {
        type: 'enhancement',
        description: 'Automatyczna propagacja nowo zdefiniowanego składu na pozostałe miesiące roku przy pierwszym zapisie w czystej kawiarni.',
        module: 'managers_schedule',
      },
    ],
  },
  {
    version: '2.8.57',
    date: '2026-10-18',
    title: 'Autonomiczne Bazy Danych SQLite per Kawiarnia (Multi-Store Database Engine & Czysty Start Nowych Jednostek)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Pełna separacja fizycznych baz danych SQLite per kawiarnia (store_*.db) z bezpiecznym zachowaniem danych kawiarni Janki (tplh_forecast.db)',
      'Automatyczna inicjalizacja czystej, nowej bazy danych przy pierwszym przełączeniu lub dodaniu nowej kawiarni Starbucks',
      'Wyposażenie nowej kawiarni w uniwersalne normy Kodeksu Pracy RP (2016-2036), kalendarz tygodni biznesowych i standardowe szablony zmian przy całkowicie czystym zespole i grafiku',
      'Błyskawiczne przełączanie w locie (Hot Database Switch) przez kanał IPC Electrona z zachowaniem integralności i natychmiastowym zapisem transakcyjnym na dysku'
    ],
    items: [
      {
        type: 'database',
        description: 'Silnik switchStoreDatabase w DatabaseManagerze przełączający pliki baz danych w locie i tworzący nową bazę dla nowo dodanych kawiarni.',
        module: 'database',
      },
      {
        type: 'feature',
        description: 'Integracja z preload.ts i main.ts za pomocą kanałów IPC store:switch-database i store:get-current-db-info.',
        module: 'system',
      },
      {
        type: 'feature',
        description: 'Reaktywna obsługa przełączania bazy danych w StoreService i StoreContext wraz ze wskaźnikami statusu bazy w StoreSwitcherModal.',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Zachowanie stuprocentowej kompatybilności wstecznej dla kawiarni 108120 Janki (istniejące dane w tplh_forecast.db nienaruszone).',
        module: 'database',
      },
    ],
  },
  {
    version: '2.8.56',
    date: '2026-10-18',
    title: 'Odciążenie Aplikacji & Biblioteka Dokumentów Operacyjnych w Firebase (100% Bez PII)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Odciążenie aplikacji i synchronizacja uniwersalnych szablonów oraz dokumentów operacyjnych z bazą Firebase Firestore',
      '100% gwarancji prywatności (Zero PII): całkowite wykluczenie danych osobowych, nazwisk, stawek oraz zastrzeżonych materiałów Starbucks',
      'Nowy modal Biblioteki Dokumentów Chmury (CloudDocumentsModal) z podglądem danych, tarczą ochronną i pobieraniem on-demand',
      'Optymalizacja paczki mikropatcha OTA — redukcja rozmiaru z ~24 MB do ~1.15 MB dzięki eliminacji zduplikowanych folderów'
    ],
    items: [
      {
        type: 'feature',
        description: 'Serwis FirebaseDocsService odpowiadający za generowanie, sanitizację i bezpieczny eksport zanonimizowanych dokumentów do Firestore.',
        module: 'system',
      },
      {
        type: 'feature',
        description: 'Nowy komponent CloudDocumentsModal ze wskaźnikami braku PII, podglądem dokumentów operacyjnych i synchronizacją chmurową.',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Przycisk szybkiego dostępu do dokumentów chmurowych z poziomu Ustawień Systemu (UnifiedSettingsModal).',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Optymalizacja skryptu publish-patch.js i procesu budowania: paczka hot-patch OTA odchudzona o ponad 95%.',
        module: 'system',
      },
    ],
  },
  {
    version: '2.8.54',
    date: '2026-10-18',
    title: 'Wielolokalowość: Przełącznik Kawiarni Starbucks (Store Switcher) & Katalog Jednostek w Polsce',
    type: 'minor',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Błyskawiczne przełączanie aktywnej kawiarni w całym systemie z poziomu nagłówka, paska bocznego, ustawień i ekranu logowania',
      'Bogaty katalog oficjalnych kawiarni Starbucks w Polsce (Warszawa, Kraków, Wrocław, Poznań, Trójmiasto, Katowice, Łódź, Szczecin) z kodami MPK, Unit Code i adresami',
      'Możliwość dodawania własnych, spersonalizowanych kawiarni ze stałą persystencją w localStorage i bazie SQLite',
      'Nowy modal StoreSwitcherModal z wyszukiwarką czasu rzeczywistego i filtrami miast'
    ],
    items: [
      {
        type: 'feature',
        description: 'Nowy komponent StoreSwitcherModal umożliwiający błyskawiczny wybór i przełączanie kawiarni Starbucks z podglądem kodów MPK i Unit Code.',
        module: 'system',
      },
      {
        type: 'feature',
        description: 'Reaktywny kontekst StoreContext i serwis StoreService z obsługą synchronizacji z bazą SQLite i zdarzeń systemowych.',
        module: 'system',
      },
      {
        type: 'feature',
        description: 'Katalog starbucksStores zawierający jednostki Starbucks w Polsce z podziałem na miasta, dystrykty i typy lokali.',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Interaktywny przycisk kawiarni w nagłówku aplikacji (Header) oraz na pasku bocznym (Sidebar) w trybie rozwiniętym i zwiniętym.',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Dedykowana sekcja zarządzania kawiarnią w Ustawieniach Systemowych (UnifiedSettingsModal) oraz wsparcie w Kreatorze Początkowym (Onboarding).',
        module: 'system',
      },
      {
        type: 'enhancement',
        description: 'Dynamiczne przełączanie kawiarni bezpośrednio na ekranie logowania (LoginView) oraz w arkuszu DANE (ColDaneSheet).',
        module: 'col_calculator',
      },
    ],
  },
  {
    version: '2.8.52',
    date: '2026-09-28',
    title: 'Autonomiczny Flash Forecast Poniedziałku (Trend MTD, Historia Poniedziałków i Auto-Domknięcie Godzin)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'W pełni autonomiczny Flash Forecast poniedziałku bez konieczności manualnego wpisywania wartości przez Store Managera',
      'Inteligentna estymacja transakcji na poniedziałek w oparciu o realny trend poniedziałków tego miesiąca (śr. ~302 TRX) i wagę dobową z historii',
      'Automatyczne domykanie godzin na poniedziałek z twardą ochroną Floor Hours (min. 32.0h/dobę) i obsadą menedżerską z Modułu 2',
      'Bezobsługowe zastąpienie estymacji po wgraniu zamykającego raportu tygodniowego (suma miesiąca natychmiast aktualizuje się do wartości faktycznych)'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Autonomiczny silnik estymacji Flash Forecast dla poniedziałku zasilany dobowymi danymi sprzedaży i historią poniedziałków'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Automatyczne domykanie obsady baristycznej do Floor Hours i grafiku tygodnia bez konieczności otwierania okna dialogowego'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Natychmiastowe przejście z trybu estymacji na rzeczywiste wykonanie po imporcie raportu zamykającego tydzień'
      }
    ]
  },
  {
    version: '2.8.51',
    date: '2026-09-28',
    title: 'Eliminacja Zawyżonych Godzin Otwartego Tygodnia i Utrzymanie Realnego Trendu TPLH (7.33)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Eliminacja podwójnego doliczania godzin grafiku do otwartych tygodni (prognoza oparta w 100% na rzeczywistej wydajności MTD TPLH 7.33)',
      'Precyzyjna estymacja faktycznego zużycia godzin na koniec miesiąca (~1456h zamiast zawyżonych 1699h) oraz końcowego wskaźnika TPLH (7.33 zamiast zaniżonych 6.28)',
      'Ścisła klasyfikacja zamkniętych tygodni posiadających dane z raportów (wykluczenie ich z puli otwartych tygodni estymowanych)'
    ],
    items: [
      {
        type: 'fix',
        module: 'labor_forecast',
        description: 'Prognoza robocizny dla pozostałych dni miesiąca bazuje na wypracowanej wydajności MTD TPLH (np. 7.33), zachowując spójność wyniku końcowego'
      }
    ]
  },
  {
    version: '2.8.50',
    date: '2026-09-28',
    title: 'Korekta Formuły Prognozowanego TPLH i Zużycia Godzin na Koniec Miesiąca',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Korekta matematyczna prognozowanego końcowego TPLH (prognoza oparta o iloraz estymowanych transakcji i prognozowanych godzin robocizny zamiast sztywnego budżetu AOP 6.70)',
      'Prezentacja prognozy faktycznego zużycia godzin na koniec miesiąca (Est. Zużycie h) oraz wypracowanego bezpiecznego TPLH (np. 7.33 przy dotychczasowym tempie)',
      'Wyraźne rozróżnienie pomiędzy dopuszczalnym limitem AOP (Earned Labor Budget) a realnie prognozowanym wynikiem operacyjnym'
    ],
    items: [
      {
        type: 'fix',
        module: 'labor_forecast',
        description: 'Prognozowany TPLH w stopce podsumowania odzwierciedla realny wynik końcowy przy utrzymaniu bieżącego tempa (np. 7.33) zamiast tautologicznego celu AOP 6.70'
      }
    ]
  },
  {
    version: '2.8.49',
    date: '2026-09-28',
    title: 'Dwupoziomowe Podsumowanie Miesiąca w Tabeli Tygodniowej (MTD + Estymacja AI)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Prezentacja obu kluczowych perspektyw w stopce tabeli tygodniowej: twarde dane zrealizowane MTD oraz estymacja na koniec miesiąca z uwzględnieniem trendu AI (Ensemble Forecast)',
      'Estymacja pełnego miesiąca dla Transakcji (Est. MSC TRX vs AOP), Budżetu Robocizny (Est. Budżet Earned Labor vs AOP) oraz docelowego TPLH (Est. TPLH vs AOP)',
      'Wyraźne oznaczenia wizualne ze statusem MTD (W1–W4) i fioletowymi plakietkami predykcji AI'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Stopka Podsumowania Miesiąca prezentuje równolegle zrealizowane MTD oraz prognozę całego miesiąca opartą na trendzie i AI'
      }
    ]
  },
  {
    version: '2.8.48',
    date: '2026-09-28',
    title: 'Korekta Podsumowania Miesiąca w Tabeli Tygodniowej (Rozliczenie vs Plan MTD)',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Eliminacja fałszywego odchylenia ujemnego w stopce tabeli (porównywanie rzeczywistych tygodni wyłącznie z planem tych samych zaraportowanych tygodni MTD zamiast całego miesiąca)',
      'Precyzyjne etykiety rozliczenia: vs Plan MTD dla miesięcy w toku oraz vs AOP dla miesięcy w 100% zamkniętych'
    ],
    items: [
      {
        type: 'fix',
        module: 'labor_forecast',
        description: 'Odchylenia ACT TRX, ACT RCP (H) i ACT TPLH w stopce tabeli porównują sumę rzeczywistą do planu zaraportowanych tygodni MTD'
      }
    ]
  },
  {
    version: '2.8.45',
    date: '2026-09-28',
    title: 'Integracja Rzeczywistych Danych Dobowych (Daily KPI & Fichajes) w Dobowym Rozkładzie Tygodnia',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Zastąpienie sztucznego szacowania wagami bezpośrednim odczytem rzeczywistych dobowych transakcji TRX z raportu dziennego KPI',
      'Pobieranie prawdziwych dobowych godzin pracy (RCP) z bazy ewidencji MAPAL Fichajes per konkretny dzień',
      'Wizualne rozróżnienie twardych danych z raportów vs estymacji wagowej z oznaczeniem [est.] dla dni przyszłych'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Nowe handlery IPC pobierające dobowe rekordy z daily_kpi_actuals_log i labor_actuals_log dla całego miesiąca'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Tabela dobowego rozkładu tygodnia (W1-W5) prezentuje rzeczywiste TRX i rzeczywiste godziny RCP zamiast sztucznych proporcji wagowych'
      }
    ]
  },
  {
    version: '2.8.44',
    date: '2026-09-28',
    title: 'Zaawansowane Filtrowanie & Sortowanie Logowań MAPAL Fichajes',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Wielowymiarowe filtrowanie pracowników (wyszukiwanie tekstowe, dropdown alfabetyczny z sumą godzin, podział na MGR/Barista)',
      'Precyzyjne filtrowanie dat (szybki wybór konkretnego dnia tygodnia lub zakres dat od-do z natychmiastowym przeliczaniem sumy)',
      'Filtr lokalu (108120 Janki vs wsparcia w innych kawiarniach) oraz interaktywne sortowanie tabeli (po dacie, pracowniku, godzinach)',
      'Automatyczne podsumowanie na żywo dla widoku przefiltrowanego oraz bezpieczna edycja i usuwanie wpisów po unikalnych ID'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Nowy panel filtrów weryfikacji logowań MAPAL Fichajes: wyszukiwarka, wybór pracownika z licznikami wpisów/godzin, filtr ról i lokali'
      },
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Filtrowanie dat z dedykowanymi polami Data od / Data do oraz szybkim wyborem pojedynczego dnia ze statystykami'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Klikalne sortowanie kolumn (Data, Pracownik, Godziny) z wskaźnikami kierunku oraz podsumowanie godzin i pracowników w widoku przefiltrowanym'
      }
    ]
  },
  {
    version: '2.8.43',
    date: '2026-09-27',
    title: 'Inteligentny Parser Raportu Dziennego KPI Actual & Podgląd Weryfikacyjny',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Automatyczny parser dziennych raportów sprzedaży i robocizny dzień po dniu (Net Sales, TRX, AGC, Delivery, Godziny, TPLH)',
      'Pełnoekranowy podgląd weryfikacyjny z możliwością edycji i natychmiastowym przeliczaniem metryk (AGC, TPLH)',
      'Automatyczna agregacja tygodniowa W1–W5 i zasilenie bazy SQLite (daily_kpi_actuals_log, weekly_actual_trx, aop_plans)'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Wykrywanie i parsowanie dziennych raportów wykonania KPI (wyodrębnianie dat, sprzedaży netto, transakcji, godzin i dostaw)'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Interaktywny panel weryfikacji raportu dziennego w ImportModal z kafelkami podsumowania, badges agregacji tygodniowej W1-W5 i edycją wierszy'
      },
      {
        type: 'database',
        module: 'database',
        description: 'Dedykowana tabela SQLite daily_kpi_actuals_log oraz automatyczna aktualizacja rzeczywistych wartości w weekly_actual_trx i aop_plans'
      }
    ]
  },
  {
    version: '2.8.42',
    date: '2026-09-27',
    title: 'Integracja Finansowa AOP 2026: Sprzedaż (Sales), Średni Paragon (AGC) & Prognoza % COL',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Zasilenie bazy SQLite aop_plans kompletnym oficjalnym rachunkiem P&L AOP 2026 (Sales, TRX, AGC, COL PLN, COL %)',
      'Dwuwymiarowa analiza operacyjno-finansowa w Labor Forecast (TRX & TPLH obok Sprzedaży, AGC i % COL)',
      'Dynamiczna kalkulacja estymowanego obrotu MTD (Sales) i prognozowanego udziału robocizny (% COL) dla kawiarni'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Rozszerzenie bazy aop_plans oraz nasion o planowaną sprzedaż, średni paragon AGC (np. 28,01 zł we wrześniu) oraz budżet COL PLN i % COL'
      },
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Wzbogacenie Hero Bara Modułu 1 o metryki finansowe AOP (Sprzedaż, AGC, COL %) oraz predykcję wyniku finansowego w oparciu o ułożony grafik'
      },
      {
        type: 'database',
        module: 'database',
        description: 'Automatyczna migracja i synchronizacja SQLite dla kolumn plan_agc, actual_agc, plan_col_pln, plan_col_percent'
      }
    ]
  },
  {
    version: '2.8.41',
    date: '2026-09-27',
    title: 'Predykcja Zespołowa (Ensemble AI) & Dekompozycja Niedziel Handlowych',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Wielomodelowy Zespół Predykcji (Ensemble AI): Kotwica AOP (35-65%) + Krótki Run-Rate (30-50%) + Sezonowość YoY (15-35%)',
      'Przedziały ufności prognozy TRX (min … expected … max) oraz wypracowanego budżetu godzin (Floor-Safe, Balanced, Growth)',
      'Operacyjna dekompozycja Niedziel Handlowych vs Niehandlowych w CH Janki (20% puli flex w handlowe vs zamrożenie Floor 32h w niehandlowe)',
      'Samouczące się wagi dni tygodnia (EMA) i dynamiczne badge\'e 🛒 HANDL. / WOLNA na siatce dobowej i mostku menedżerskim'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Nowa karta Wielomodelowego Zespołu Predykcji (Ensemble Multi-Model Forecast) w panelu Inteligencji Predykcyjnej z podziałem wag i przedziałem ufności TRX'
      },
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Dekompozycja Niedziel Handlowych na bazie ustawy o handlu: automatyczna alokacja 20% flex w niedziele handlowe i zamrożenie na Floor 32h w niedziele niehandlowe'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Samouczące się wagi dni tygodnia z wykładniczą średnią kroczącą (EMA) oraz dynamiczne badge\'e 🛒 HANDL. / WOLNA w tabeli i mostku dyżurów'
      },
      {
        type: 'enhancement',
        module: 'labor_forecast',
        description: 'Eliminacja syndromu zimnego startu na początku miesiąca poprzez dynamiczne łączenie planu AOP z historyczną sezonowością bliźniaczą YoY'
      }
    ]
  },
  {
    version: '2.8.40',
    date: '2026-09-27',
    title: 'Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Precyzyjne skalowanie interfejsu (70% – 135%) w dedykowanej zakładce Skalowanie & Wygląd',
      'Skróty klawiszowe Cmd/Ctrl +/-/0 i presety wyświetlaczy (MacBook 13", 24"-27", 4K)',
      'Autodiagnostyka integralności SQLite PRAGMA integrity_check i defragmentacja VACUUM',
      'Automatyczny nadzór nad kopiami zapasowymi (>7 dni) z alertem w belce głównej'
    ],
    items: [
      {
        type: 'feature',
        module: 'system',
        description: 'Dedykowana zakładka Skalowanie & Wygląd w oknie Ustawień z płynnym suwakiem 70%–135% i sandboxem podglądu na żywo'
      },
      {
        type: 'enhancement',
        module: 'system',
        description: 'Natywna integracja zoomService z webFrame.setZoomFactor w Electronie — idealna ostrość tekstu i ikon SVG bez rozmycia i podwójnego zoomu'
      },
      {
        type: 'feature',
        module: 'database',
        description: 'Inspektor zdrowia bazy SQLite: PRAGMA integrity_check, pomiar stron freelist, licznik 15 tabel i zrzutów Czarnej Skrzynki'
      },
      {
        type: 'feature',
        module: 'database',
        description: '1-klik defragmentacja i kompaktowanie bazy VACUUM + PRAGMA optimize z automatyczną kopią ratunkową pre_vacuum'
      },
      {
        type: 'compliance',
        module: 'system',
        description: 'Ciągły monitoring wieku ostatniej kopii zapasowej — generowanie pilnego zadania To-Do oraz pulsującego ostrzeżenia w Headerze przy braku kopii przez 7 dni'
      }
    ]
  },
  {
    version: '2.8.39',
    date: '2026-09-27',
    title: 'Centrum Powiadomień, Szablony Resend & Samouczek Kawiarni',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Wielokanałowe powiadomienia desktopowe i e-mailowe z chmurą Resend API',
      'Studio Szablonów Powiadomień dla publikacji grafiku, kolizji RCP i norm KP',
      'Interaktywny 6-scenowy samouczek i przewodnik pilotażu operacyjnego lokalu',
      'Panel telemetryczny floty urządzeń Firebase Firestore (widok deweloperski)'
    ],
    items: [
      {
        type: 'feature',
        module: 'system',
        description: 'Centrum Powiadomień z obsługą alertów Kodeksu Pracy, terminu publikacji 7 dni oraz kolizji RCP vs L4/H'
      },
      {
        type: 'feature',
        module: 'system',
        description: 'Wysyłka e-mail powiadomień przez Resend API z podglądem HTML szablonów Starbucks Dark Gold'
      },
      {
        type: 'feature',
        module: 'all',
        description: 'Interaktywny samouczek pilotażu kawiarni z przewodnikiem po TPLH, grafiku menedżerskim i ustawieniach'
      },
      {
        type: 'feature',
        module: 'system',
        description: 'Baza floty urządzeń i instalacji Firebase Firestore dla zdalnego monitoringu stabilności (dostęp Dev/Admin)'
      }
    ]
  },
  {
    version: '2.8.30',
    date: '2026-09-21',
    title: 'Katalog Zmian Starbucks, Poprawki Wynagrodzeń & Elastyczne Godziny',
    type: 'patch',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Elastyczny czas trwania zmian (MID, SUP, SAM, SPM, NC) per zmiana oraz presety katalogu',
      'Dostosowywanie przedziału czasowego (Od – Do) ze sprawdzaniem odpoczynku 11h KP',
      'Pełna obsługa zmian wsparciowych ze wszystkich kawiarni w dystrykcie'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Dostosowywanie godzin zmian elastycznych w popoverze (4h–12h) z wizualizacją w siatce grafiku'
      },
      {
        type: 'enhancement',
        module: 'managers_schedule',
        description: 'Dynamiczny stepper godzin rozpoczęcia i zakończenia zmiany z przeliczaniem wymiaru dobowego'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Weryfikacja odpoczynku 11h Kodeksu Pracy z uwzględnieniem niestandardowych godzin rozpoczęcia i zakończenia'
      },
      {
        type: 'fix',
        module: 'col_calculator',
        description: 'Precyzyjne uwzględnianie indywidualnych stawek godzinowych i etatu w wyliczeniach kosztów pracy menedżerów'
      }
    ]
  },
  {
    version: '2.8.0',
    date: '2026-09-15',
    title: 'AutoScheduling AI, Speed-Dial Hub & Asystent Negocjacji z Zespołem',
    type: 'minor',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Silnik AutoScheduling AI (20 000 symulacji Monte Carlo) generujący kompletny grafik w <150 ms',
      'Asystent kompromisów i negocjacji grafiku z gotowymi szablonami wiadomości WhatsApp/SMS',
      'Pływające menu nawigacyjne Starbucks Speed-Dial Hub i czysty układ panoramiczny',
      'Asystent Wsparcia Międzykawiarnianego dla bezpiecznego oddawania nadwyżek godzin'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'AutoScheduling AI: automatyczne dociążenie etatów do 100% z błędem poniżej 1h na pracownika'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Asystent Negocjacji z Zespołem: detekcja patów obsadowych i generowanie 3 wariantów kompromisowych'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Pływające logo Starbucks z rozwijanym menu Speed-Dial i szybkim przełącznikiem miesięcy'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Asystent Wsparcia Międzykawiarnianego dla lokali 323, 341, 756, 327 z ochroną obsady Janki'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Twarda ochrona limitów niedzielnych i świątecznych: zakaz podwójnych otwarć/zamknięć, transfer godzin na bar'
      }
    ]
  },
  {
    version: '2.7.0',
    date: '2026-09-12',
    title: 'Trzymiesięczny Okres Rozliczeniowy TOR & Integracja RCP MAPAL',
    type: 'minor',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Kwartalne rozliczenie menedżerów TOR Q1–Q4 z podziałem na RCP, H, L4 i Bilans',
      'Automatyczna detekcja kolizji RCP vs L4/H ze specjalnym oznaczeniem ostrzegawczym',
      'Zabezpieczenie przed manipulacją: nieedytowalna kolumna rzeczywistego czasu pracy RCP',
      'Nawigacja klawiaturą po siatce grafiku z pre-flight walidacją Kodeksu Pracy'
    ],
    items: [
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Widok kwartalnego rozliczenia czasu pracy menedżerów TOR (Q1–Q4) z saldem i dedykowanym eksportem Excel'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Reguła pierwszeństwa L4 nad urlopem wypoczynkowym H zgodnie z art. 166 Kodeksu Pracy'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Szybkie wprowadzanie zmian z klawiatury (A, P, O, H, L, Delete) z natychmiastową weryfikacją norm'
      },
      {
        type: 'database',
        module: 'managers_schedule',
        description: 'Automatyczne pobieranie logowań MAPAL Fichajes ze wszystkich kawiarni dla menedżerów wspierających'
      }
    ]
  },
  {
    version: '2.6.0',
    date: '2026-09-08',
    title: 'Zintegrowana Platforma Operacyjna (Release v2.0)',
    type: 'major',
    author: 'Dawid Apel & Antigravity Agent',
    highlights: [
      'Integracja Modułu 1 (TPLH Forecast) z Modułem 2 (Grafik Managerski)',
      'Dwukierunkowy Manager Labor Bridge przenoszący godziny kierowników do budżetu tygodnia',
      'Baza 252 miesięcy oficjalnych norm Kodeksu Pracy (2016–2036)',
      'System automatycznych kopii zapasowych SQLite z rotacją 15 migawek'
    ],
    items: [
      {
        type: 'feature',
        module: 'labor_forecast',
        description: 'Dwukierunkowy most robocizny: import godzin kierowników i wyliczanie puli baristów w każdym tygodniu'
      },
      {
        type: 'feature',
        module: 'managers_schedule',
        description: 'Autonomiczne składy miesięczne menedżerów z auto-dziedziczeniem struktury zespołu z poprzedniego miesiąca'
      },
      {
        type: 'compliance',
        module: 'managers_schedule',
        description: 'Tarcza Kodeksu Pracy: 11h odpoczynku dobowego, 35h odpoczynku tygodniowego i max 12h czasu pracy'
      },
      {
        type: 'database',
        module: 'system',
        description: 'Automatyczne backupy SQLite przed publikacją wersji, importem MAPAL i startem programu'
      }
    ]
  }
];

/**
 * Zwraca najnowszy wpis w dzienniku zmian
 */
export function getLatestRelease(): ReleaseEntry {
  return APP_CHANGELOG[0];
}

/**
 * Zwraca historię wydań dla konkretnej wersji
 */
export function getReleaseByVersion(version: string): ReleaseEntry | undefined {
  const cleanVer = version.replace(/^v/, '');
  return APP_CHANGELOG.find((r) => r.version === cleanVer);
}

/**
 * Zwraca sformatowany tekst Markdown dla danej wersji
 */
export function formatReleaseMarkdown(entry: ReleaseEntry): string {
  let md = `## [v${entry.version}] — ${entry.date}: ${entry.title}\n\n`;

  if (entry.highlights && entry.highlights.length > 0) {
    md += `### 🌟 Kluczowe Zmiany:\n`;
    entry.highlights.forEach((h) => {
      md += `- ${h}\n`;
    });
    md += `\n`;
  }

  const features = entry.items.filter((i) => i.type === 'feature');
  const enhancements = entry.items.filter((i) => i.type === 'enhancement');
  const compliance = entry.items.filter((i) => i.type === 'compliance' || i.type === 'database');
  const fixes = entry.items.filter((i) => i.type === 'fix');

  if (features.length > 0) {
    md += `### ✨ Nowe Funkcje:\n`;
    features.forEach((f) => {
      const modPrefix = f.module && f.module !== 'all' && f.module !== 'system' ? `**[${f.module}]** ` : '';
      md += `- ${modPrefix}${f.description}\n`;
    });
    md += `\n`;
  }

  if (enhancements.length > 0) {
    md += `### ⚡ Usprawnienia & Optymalizacje:\n`;
    enhancements.forEach((e) => {
      const modPrefix = e.module && e.module !== 'all' && e.module !== 'system' ? `**[${e.module}]** ` : '';
      md += `- ${modPrefix}${e.description}\n`;
    });
    md += `\n`;
  }

  if (compliance.length > 0) {
    md += `### 🛡️ Kodeks Pracy & Baza SQLite:\n`;
    compliance.forEach((c) => {
      md += `- ${c.description}\n`;
    });
    md += `\n`;
  }

  if (fixes.length > 0) {
    md += `### 🐛 Poprawki Błędów:\n`;
    fixes.forEach((fx) => {
      md += `- ${fx.description}\n`;
    });
    md += `\n`;
  }

  return md;
}
