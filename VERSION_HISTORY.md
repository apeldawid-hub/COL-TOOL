# ☕ Starbucks Operations Suite — Centralny Rejestr Historii Wydań i Wersji
> **Plik Główny Projektu (Jedyne Źródło Prawdy):** Ten dokument jest automatycznie aktualizowany przez agenta IDE (`.agents/skills/version-tracker/`) przy każdej zmianie, mikropatchu i publikacji wydania.

---

## 📑 Spis Treści Wydań

| Wersja | Data | Tytuł Wydania | Typ | Status |
| :--- | :--- | :--- | :---: | :---: |
| **[v2.8.52](#v2.8.52--2026-09-28)** | 2026-09-28 | Autonomiczny Flash Forecast Poniedziałku (Trend MTD, Historia Poniedziałków i Auto-Domknięcie Godzin) | `patch` | 🚀 Opublikowana |
| **[v2.8.51](#v2.8.51--2026-09-28)** | 2026-09-28 | Eliminacja Zawyżonych Godzin Otwartego Tygodnia i Utrzymanie Realnego Trendu TPLH (7.33) | `patch` | 🚀 Opublikowana |
| **[v2.8.50](#v2.8.50--2026-09-28)** | 2026-09-28 | Korekta Formuły Prognozowanego TPLH i Zużycia Godzin na Koniec Miesiąca | `patch` | 🚀 Opublikowana |
| **[v2.8.49](#v2.8.49--2026-09-28)** | 2026-09-28 | Dwupoziomowe Podsumowanie Miesiąca w Tabeli Tygodniowej (MTD + Estymacja AI) | `patch` | 🚀 Opublikowana |
| **[v2.8.48](#v2.8.48--2026-09-28)** | 2026-09-28 | Korekta Podsumowania Miesiąca w Tabeli Tygodniowej (Rozliczenie vs Plan MTD) | `patch` | 🚀 Opublikowana |
| **[v2.8.45](#v2.8.45--2026-09-28)** | 2026-09-28 | Integracja Rzeczywistych Danych Dobowych (Daily KPI & Fichajes) w Dobowym Rozkładzie Tygodnia | `patch` | 🚀 Opublikowana |
| **[v2.8.44](#v2.8.44--2026-09-28)** | 2026-09-28 | Zaawansowane Filtrowanie & Sortowanie Logowań MAPAL Fichajes | `patch` | 🚀 Opublikowana |
| **[v2.8.43](#v2.8.43--2026-09-27)** | 2026-09-27 | Inteligentny Parser Raportu Dziennego KPI Actual & Podgląd Weryfikacyjny | `patch` | 🚀 Opublikowana |
| **[v2.8.42](#v2.8.42--2026-09-27)** | 2026-09-27 | Integracja Finansowa AOP 2026: Sprzedaż (Sales), Średni Paragon (AGC) & Prognoza % COL | `patch` | 🚀 Opublikowana |
| **[v2.8.41](#v2.8.41--2026-09-27)** | 2026-09-27 | Predykcja Zespołowa (Ensemble AI) & Dekompozycja Niedziel Handlowych | `patch` | 🚀 Opublikowana |
| **[v2.8.40](#v2.8.40--2026-09-27)** | 2026-09-27 | Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite | `patch` | 🚀 Opublikowana |
| **[v2.8.39](#v2.8.39--2026-09-27)** | 2026-09-27 | Centrum Powiadomień, Szablony Resend & Samouczek Kawiarni | `patch` | 🚀 Opublikowana |
| **[v2.8.30](#v2.8.30--2026-09-21)** | 2026-09-21 | Katalog Zmian Starbucks, Poprawki Wynagrodzeń & Elastyczne Godziny | `patch` | 🚀 Opublikowana |
| **[v2.8.0](#v2.8.0--2026-09-15)** | 2026-09-15 | AutoScheduling AI, Speed-Dial Hub & Asystent Negocjacji z Zespołem | `minor` | 🚀 Opublikowana |
| **[v2.7.0](#v2.7.0--2026-09-12)** | 2026-09-12 | Trzymiesięczny Okres Rozliczeniowy TOR & Integracja RCP MAPAL | `minor` | 🚀 Opublikowana |
| **[v2.6.0](#v2.6.0--2026-09-08)** | 2026-09-08 | Zintegrowana Platforma Operacyjna (Release v2.0) | `major` | 🚀 Opublikowana |

---

## Szczegółowa Historia Wydań

### [v2.8.52] — 2026-09-28
**Tytuł:** Autonomiczny Flash Forecast Poniedziałku (Trend MTD, Historia Poniedziałków i Auto-Domknięcie Godzin)  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- W pełni autonomiczny Flash Forecast poniedziałku bez konieczności manualnego wpisywania wartości przez Store Managera
- Inteligentna estymacja transakcji na poniedziałek w oparciu o realny trend poniedziałków tego miesiąca (śr. ~302 TRX) i wagę dobową z historii
- Automatyczne domykanie godzin na poniedziałek z twardą ochroną Floor Hours (min. 32.0h/dobę) i obsadą menedżerską z Modułu 2
- Bezobsługowe zastąpienie estymacji po wgraniu zamykającego raportu tygodniowego (suma miesiąca natychmiast aktualizuje się do wartości faktycznych)

#### ✨ Nowe Funkcje:
- Autonomiczny silnik estymacji Flash Forecast dla poniedziałku zasilany dobowymi danymi sprzedaży i historią poniedziałków

#### ⚡ Usprawnienia & Ergonomia:
- Automatyczne domykanie obsady baristycznej do Floor Hours i grafiku tygodnia bez konieczności otwierania okna dialogowego
- Natychmiastowe przejście z trybu estymacji na rzeczywiste wykonanie po imporcie raportu zamykającego tydzień

---

### [v2.8.51] — 2026-09-28
**Tytuł:** Eliminacja Zawyżonych Godzin Otwartego Tygodnia i Utrzymanie Realnego Trendu TPLH (7.33)  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Eliminacja podwójnego doliczania godzin grafiku do otwartych tygodni (prognoza oparta w 100% na rzeczywistej wydajności MTD TPLH 7.33)
- Precyzyjna estymacja faktycznego zużycia godzin na koniec miesiąca (~1456h zamiast zawyżonych 1699h) oraz końcowego wskaźnika TPLH (7.33 zamiast zaniżonych 6.28)
- Ścisła klasyfikacja zamkniętych tygodni posiadających dane z raportów (wykluczenie ich z puli otwartych tygodni estymowanych)

#### 🐛 Poprawki Błędów:
- Prognoza robocizny dla pozostałych dni miesiąca bazuje na wypracowanej wydajności MTD TPLH (np. 7.33), zachowując spójność wyniku końcowego

---

### [v2.8.50] — 2026-09-28
**Tytuł:** Korekta Formuły Prognozowanego TPLH i Zużycia Godzin na Koniec Miesiąca  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Korekta matematyczna prognozowanego końcowego TPLH (prognoza oparta o iloraz estymowanych transakcji i prognozowanych godzin robocizny zamiast sztywnego budżetu AOP 6.70)
- Prezentacja prognozy faktycznego zużycia godzin na koniec miesiąca (Est. Zużycie h) oraz wypracowanego bezpiecznego TPLH (np. 7.33 przy dotychczasowym tempie)
- Wyraźne rozróżnienie pomiędzy dopuszczalnym limitem AOP (Earned Labor Budget) a realnie prognozowanym wynikiem operacyjnym

#### 🐛 Poprawki Błędów:
- Prognozowany TPLH w stopce podsumowania odzwierciedla realny wynik końcowy przy utrzymaniu bieżącego tempa (np. 7.33) zamiast tautologicznego celu AOP 6.70

---

### [v2.8.49] — 2026-09-28
**Tytuł:** Dwupoziomowe Podsumowanie Miesiąca w Tabeli Tygodniowej (MTD + Estymacja AI)  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Prezentacja obu kluczowych perspektyw w stopce tabeli tygodniowej: twarde dane zrealizowane MTD oraz estymacja na koniec miesiąca z uwzględnieniem trendu AI (Ensemble Forecast)
- Estymacja pełnego miesiąca dla Transakcji (Est. MSC TRX vs AOP), Budżetu Robocizny (Est. Budżet Earned Labor vs AOP) oraz docelowego TPLH (Est. TPLH vs AOP)
- Wyraźne oznaczenia wizualne ze statusem MTD (W1–W4) i fioletowymi plakietkami predykcji AI

#### ✨ Nowe Funkcje:
- Stopka Podsumowania Miesiąca prezentuje równolegle zrealizowane MTD oraz prognozę całego miesiąca opartą na trendzie i AI

---

### [v2.8.48] — 2026-09-28
**Tytuł:** Korekta Podsumowania Miesiąca w Tabeli Tygodniowej (Rozliczenie vs Plan MTD)  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Eliminacja fałszywego odchylenia ujemnego w stopce tabeli (porównywanie rzeczywistych tygodni wyłącznie z planem tych samych zaraportowanych tygodni MTD zamiast całego miesiąca)
- Precyzyjne etykiety rozliczenia: vs Plan MTD dla miesięcy w toku oraz vs AOP dla miesięcy w 100% zamkniętych

#### 🐛 Poprawki Błędów:
- Odchylenia ACT TRX, ACT RCP (H) i ACT TPLH w stopce tabeli porównują sumę rzeczywistą do planu zaraportowanych tygodni MTD

---

### [v2.8.45] — 2026-09-28
**Tytuł:** Integracja Rzeczywistych Danych Dobowych (Daily KPI & Fichajes) w Dobowym Rozkładzie Tygodnia  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Zastąpienie sztucznego szacowania wagami bezpośrednim odczytem rzeczywistych dobowych transakcji TRX z raportu dziennego KPI
- Pobieranie prawdziwych dobowych godzin pracy (RCP) z bazy ewidencji MAPAL Fichajes per konkretny dzień
- Wizualne rozróżnienie twardych danych z raportów vs estymacji wagowej z oznaczeniem [est.] dla dni przyszłych

#### ✨ Nowe Funkcje:
- Nowe handlery IPC pobierające dobowe rekordy z daily_kpi_actuals_log i labor_actuals_log dla całego miesiąca

#### ⚡ Usprawnienia & Ergonomia:
- Tabela dobowego rozkładu tygodnia (W1-W5) prezentuje rzeczywiste TRX i rzeczywiste godziny RCP zamiast sztucznych proporcji wagowych

---

### [v2.8.44] — 2026-09-28
**Tytuł:** Zaawansowane Filtrowanie & Sortowanie Logowań MAPAL Fichajes  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Wielowymiarowe filtrowanie pracowników (wyszukiwanie tekstowe, dropdown alfabetyczny z sumą godzin, podział na MGR/Barista)
- Precyzyjne filtrowanie dat (szybki wybór konkretnego dnia tygodnia lub zakres dat od-do z natychmiastowym przeliczaniem sumy)
- Filtr lokalu (108120 Janki vs wsparcia w innych kawiarniach) oraz interaktywne sortowanie tabeli (po dacie, pracowniku, godzinach)
- Automatyczne podsumowanie na żywo dla widoku przefiltrowanego oraz bezpieczna edycja i usuwanie wpisów po unikalnych ID

#### ✨ Nowe Funkcje:
- Nowy panel filtrów weryfikacji logowań MAPAL Fichajes: wyszukiwarka, wybór pracownika z licznikami wpisów/godzin, filtr ról i lokali
- Filtrowanie dat z dedykowanymi polami Data od / Data do oraz szybkim wyborem pojedynczego dnia ze statystykami

#### ⚡ Usprawnienia & Ergonomia:
- Klikalne sortowanie kolumn (Data, Pracownik, Godziny) z wskaźnikami kierunku oraz podsumowanie godzin i pracowników w widoku przefiltrowanym

---

### [v2.8.43] — 2026-09-27
**Tytuł:** Inteligentny Parser Raportu Dziennego KPI Actual & Podgląd Weryfikacyjny  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Automatyczny parser dziennych raportów sprzedaży i robocizny dzień po dniu (Net Sales, TRX, AGC, Delivery, Godziny, TPLH)
- Pełnoekranowy podgląd weryfikacyjny z możliwością edycji i natychmiastowym przeliczaniem metryk (AGC, TPLH)
- Automatyczna agregacja tygodniowa W1–W5 i zasilenie bazy SQLite (daily_kpi_actuals_log, weekly_actual_trx, aop_plans)

#### ✨ Nowe Funkcje:
- Wykrywanie i parsowanie dziennych raportów wykonania KPI (wyodrębnianie dat, sprzedaży netto, transakcji, godzin i dostaw)

#### ⚡ Usprawnienia & Ergonomia:
- Interaktywny panel weryfikacji raportu dziennego w ImportModal z kafelkami podsumowania, badges agregacji tygodniowej W1-W5 i edycją wierszy

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Dedykowana tabela SQLite daily_kpi_actuals_log oraz automatyczna aktualizacja rzeczywistych wartości w weekly_actual_trx i aop_plans

---

### [v2.8.42] — 2026-09-27
**Tytuł:** Integracja Finansowa AOP 2026: Sprzedaż (Sales), Średni Paragon (AGC) & Prognoza % COL  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Zasilenie bazy SQLite aop_plans kompletnym oficjalnym rachunkiem P&L AOP 2026 (Sales, TRX, AGC, COL PLN, COL %)
- Dwuwymiarowa analiza operacyjno-finansowa w Labor Forecast (TRX & TPLH obok Sprzedaży, AGC i % COL)
- Dynamiczna kalkulacja estymowanego obrotu MTD (Sales) i prognozowanego udziału robocizny (% COL) dla kawiarni

#### ✨ Nowe Funkcje:
- Rozszerzenie bazy aop_plans oraz nasion o planowaną sprzedaż, średni paragon AGC (np. 28,01 zł we wrześniu) oraz budżet COL PLN i % COL
- Wzbogacenie Hero Bara Modułu 1 o metryki finansowe AOP (Sprzedaż, AGC, COL %) oraz predykcję wyniku finansowego w oparciu o ułożony grafik

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Automatyczna migracja i synchronizacja SQLite dla kolumn plan_agc, actual_agc, plan_col_pln, plan_col_percent

---

### [v2.8.41] — 2026-09-27
**Tytuł:** Predykcja Zespołowa (Ensemble AI) & Dekompozycja Niedziel Handlowych  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Wielomodelowy Zespół Predykcji (Ensemble AI): Kotwica AOP (35-65%) + Krótki Run-Rate (30-50%) + Sezonowość YoY (15-35%)
- Przedziały ufności prognozy TRX (min … expected … max) oraz wypracowanego budżetu godzin (Floor-Safe, Balanced, Growth)
- Operacyjna dekompozycja Niedziel Handlowych vs Niehandlowych w CH Janki (20% puli flex w handlowe vs zamrożenie Floor 32h w niehandlowe)
- Samouczące się wagi dni tygodnia (EMA) i dynamiczne badge'e 🛒 HANDL. / WOLNA na siatce dobowej i mostku menedżerskim

#### ✨ Nowe Funkcje:
- Nowa karta Wielomodelowego Zespołu Predykcji (Ensemble Multi-Model Forecast) w panelu Inteligencji Predykcyjnej z podziałem wag i przedziałem ufności TRX
- Dekompozycja Niedziel Handlowych na bazie ustawy o handlu: automatyczna alokacja 20% flex w niedziele handlowe i zamrożenie na Floor 32h w niedziele niehandlowe

#### ⚡ Usprawnienia & Ergonomia:
- Samouczące się wagi dni tygodnia z wykładniczą średnią kroczącą (EMA) oraz dynamiczne badge'e 🛒 HANDL. / WOLNA w tabeli i mostku dyżurów
- Eliminacja syndromu zimnego startu na początku miesiąca poprzez dynamiczne łączenie planu AOP z historyczną sezonowością bliźniaczą YoY

---

### [v2.8.40] — 2026-09-27
**Tytuł:** Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Precyzyjne skalowanie interfejsu (70% – 135%) w dedykowanej zakładce Skalowanie & Wygląd
- Skróty klawiszowe Cmd/Ctrl +/-/0 i presety wyświetlaczy (MacBook 13", 24"-27", 4K)
- Autodiagnostyka integralności SQLite PRAGMA integrity_check i defragmentacja VACUUM
- Automatyczny nadzór nad kopiami zapasowymi (>7 dni) z alertem w belce głównej

#### ✨ Nowe Funkcje:
- Dedykowana zakładka Skalowanie & Wygląd w oknie Ustawień z płynnym suwakiem 70%–135% i sandboxem podglądu na żywo
- Inspektor zdrowia bazy SQLite: PRAGMA integrity_check, pomiar stron freelist, licznik 15 tabel i zrzutów Czarnej Skrzynki
- 1-klik defragmentacja i kompaktowanie bazy VACUUM + PRAGMA optimize z automatyczną kopią ratunkową pre_vacuum

#### ⚡ Usprawnienia & Ergonomia:
- Natywna integracja zoomService z webFrame.setZoomFactor w Electronie — idealna ostrość tekstu i ikon SVG bez rozmycia i podwójnego zoomu

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Ciągły monitoring wieku ostatniej kopii zapasowej — generowanie pilnego zadania To-Do oraz pulsującego ostrzeżenia w Headerze przy braku kopii przez 7 dni

---

### [v2.8.39] — 2026-09-27
**Tytuł:** Centrum Powiadomień, Szablony Resend & Samouczek Kawiarni  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Wielokanałowe powiadomienia desktopowe i e-mailowe z chmurą Resend API
- Studio Szablonów Powiadomień dla publikacji grafiku, kolizji RCP i norm KP
- Interaktywny 6-scenowy samouczek i przewodnik pilotażu operacyjnego lokalu
- Panel telemetryczny floty urządzeń Firebase Firestore (widok deweloperski)

#### ✨ Nowe Funkcje:
- Centrum Powiadomień z obsługą alertów Kodeksu Pracy, terminu publikacji 7 dni oraz kolizji RCP vs L4/H
- Wysyłka e-mail powiadomień przez Resend API z podglądem HTML szablonów Starbucks Dark Gold
- Interaktywny samouczek pilotażu kawiarni z przewodnikiem po TPLH, grafiku menedżerskim i ustawieniach
- Baza floty urządzeń i instalacji Firebase Firestore dla zdalnego monitoringu stabilności (dostęp Dev/Admin)

---

### [v2.8.30] — 2026-09-21
**Tytuł:** Katalog Zmian Starbucks, Poprawki Wynagrodzeń & Elastyczne Godziny  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Elastyczny czas trwania zmian (MID, SUP, SAM, SPM, NC) per zmiana oraz presety katalogu
- Dostosowywanie przedziału czasowego (Od – Do) ze sprawdzaniem odpoczynku 11h KP
- Pełna obsługa zmian wsparciowych ze wszystkich kawiarni w dystrykcie

#### ✨ Nowe Funkcje:
- Dostosowywanie godzin zmian elastycznych w popoverze (4h–12h) z wizualizacją w siatce grafiku

#### ⚡ Usprawnienia & Ergonomia:
- Dynamiczny stepper godzin rozpoczęcia i zakończenia zmiany z przeliczaniem wymiaru dobowego

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Weryfikacja odpoczynku 11h Kodeksu Pracy z uwzględnieniem niestandardowych godzin rozpoczęcia i zakończenia

#### 🐛 Poprawki Błędów:
- Precyzyjne uwzględnianie indywidualnych stawek godzinowych i etatu w wyliczeniach kosztów pracy menedżerów

---

### [v2.8.0] — 2026-09-15
**Tytuł:** AutoScheduling AI, Speed-Dial Hub & Asystent Negocjacji z Zespołem  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Silnik AutoScheduling AI (20 000 symulacji Monte Carlo) generujący kompletny grafik w <150 ms
- Asystent kompromisów i negocjacji grafiku z gotowymi szablonami wiadomości WhatsApp/SMS
- Pływające menu nawigacyjne Starbucks Speed-Dial Hub i czysty układ panoramiczny
- Asystent Wsparcia Międzykawiarnianego dla bezpiecznego oddawania nadwyżek godzin

#### ✨ Nowe Funkcje:
- AutoScheduling AI: automatyczne dociążenie etatów do 100% z błędem poniżej 1h na pracownika
- Asystent Negocjacji z Zespołem: detekcja patów obsadowych i generowanie 3 wariantów kompromisowych
- Pływające logo Starbucks z rozwijanym menu Speed-Dial i szybkim przełącznikiem miesięcy
- Asystent Wsparcia Międzykawiarnianego dla lokali 323, 341, 756, 327 z ochroną obsady Janki

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Twarda ochrona limitów niedzielnych i świątecznych: zakaz podwójnych otwarć/zamknięć, transfer godzin na bar

---

### [v2.7.0] — 2026-09-12
**Tytuł:** Trzymiesięczny Okres Rozliczeniowy TOR & Integracja RCP MAPAL  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Kwartalne rozliczenie menedżerów TOR Q1–Q4 z podziałem na RCP, H, L4 i Bilans
- Automatyczna detekcja kolizji RCP vs L4/H ze specjalnym oznaczeniem ostrzegawczym
- Zabezpieczenie przed manipulacją: nieedytowalna kolumna rzeczywistego czasu pracy RCP
- Nawigacja klawiaturą po siatce grafiku z pre-flight walidacją Kodeksu Pracy

#### ✨ Nowe Funkcje:
- Widok kwartalnego rozliczenia czasu pracy menedżerów TOR (Q1–Q4) z saldem i dedykowanym eksportem Excel
- Szybkie wprowadzanie zmian z klawiatury (A, P, O, H, L, Delete) z natychmiastową weryfikacją norm

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Reguła pierwszeństwa L4 nad urlopem wypoczynkowym H zgodnie z art. 166 Kodeksu Pracy
- Automatyczne pobieranie logowań MAPAL Fichajes ze wszystkich kawiarni dla menedżerów wspierających

---

### [v2.6.0] — 2026-09-08
**Tytuł:** Zintegrowana Platforma Operacyjna (Release v2.0)  
**Autorzy:** Dawid Apel & Antigravity Agent  

#### 🌟 Co Wprowadziliśmy:
- Integracja Modułu 1 (TPLH Forecast) z Modułem 2 (Grafik Managerski)
- Dwukierunkowy Manager Labor Bridge przenoszący godziny kierowników do budżetu tygodnia
- Baza 252 miesięcy oficjalnych norm Kodeksu Pracy (2016–2036)
- System automatycznych kopii zapasowych SQLite z rotacją 15 migawek

#### ✨ Nowe Funkcje:
- Dwukierunkowy most robocizny: import godzin kierowników i wyliczanie puli baristów w każdym tygodniu
- Autonomiczne składy miesięczne menedżerów z auto-dziedziczeniem struktury zespołu z poprzedniego miesiąca

#### 🛡️ Kodeks Pracy & Baza SQLite:
- Tarcza Kodeksu Pracy: 11h odpoczynku dobowego, 35h odpoczynku tygodniowego i max 12h czasu pracy
- Automatyczne backupy SQLite przed publikacją wersji, importem MAPAL i startem programu

---

*Rejestr prowadzony przez Agenta Dziennika Zmian (`.agents/skills/version-tracker/`). Jednostka: 108120 SBX Warszawa Janki.*
