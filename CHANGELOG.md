# ☕ Dziennik Zmian — Starbucks Operations Suite (108120 Janki)

Dokument prowadzony automatycznie przez **Agenta Dziennika Zmian** (`scripts/changelog-agent.js`).
Zawiera pełną chronologię aktualizacji platformy desktopowej, wprowadzonych funkcji, tarczy Kodeksu Pracy i optymalizacji SQLite.

---

## [v2.8.44] — 2026-09-28: Zaawansowane Filtrowanie & Sortowanie Logowań MAPAL Fichajes
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Wielowymiarowe filtrowanie pracowników (wyszukiwanie tekstowe, dropdown alfabetyczny z sumą godzin, podział na MGR/Barista)**
- **Precyzyjne filtrowanie dat (szybki wybór konkretnego dnia tygodnia lub zakres dat od-do z natychmiastowym przeliczaniem sumy)**
- **Filtr lokalu (108120 Janki vs wsparcia w innych kawiarniach) oraz interaktywne sortowanie tabeli (po dacie, pracowniku, godzinach)**
- **Automatyczne podsumowanie na żywo dla widoku przefiltrowanego oraz bezpieczna edycja i usuwanie wpisów po unikalnych ID**

### ✨ Nowe Funkcje (Features):
- `[labor_forecast]` Nowy panel filtrów weryfikacji logowań MAPAL Fichajes: wyszukiwarka, wybór pracownika z licznikami wpisów/godzin, filtr ról i lokali
- `[labor_forecast]` Filtrowanie dat z dedykowanymi polami Data od / Data do oraz szybkim wyborem pojedynczego dnia ze statystykami

### ⚡ Usprawnienia & Ergonomia (UI/UX):
- `[labor_forecast]` Klikalne sortowanie kolumn (Data, Pracownik, Godziny) z wskaźnikami kierunku oraz podsumowanie godzin i pracowników w widoku przefiltrowanym

---

## [v2.8.43] — 2026-09-27: Inteligentny Parser Raportu Dziennego KPI Actual & Podgląd Weryfikacyjny
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Automatyczny parser dziennych raportów sprzedaży i robocizny dzień po dniu (Net Sales, TRX, AGC, Delivery, Godziny, TPLH)**
- **Pełnoekranowy podgląd weryfikacyjny z możliwością edycji i natychmiastowym przeliczaniem metryk (AGC, TPLH)**
- **Automatyczna agregacja tygodniowa W1–W5 i zasilenie bazy SQLite (daily_kpi_actuals_log, weekly_actual_trx, aop_plans)**

### ✨ Nowe Funkcje (Features):
- `[labor_forecast]` Wykrywanie i parsowanie dziennych raportów wykonania KPI (wyodrębnianie dat, sprzedaży netto, transakcji, godzin i dostaw)

### ⚡ Usprawnienia & Ergonomia (UI/UX):
- `[labor_forecast]` Interaktywny panel weryfikacji raportu dziennego w ImportModal z kafelkami podsumowania, badges agregacji tygodniowej W1-W5 i edycją wierszy

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Dedykowana tabela SQLite daily_kpi_actuals_log oraz automatyczna aktualizacja rzeczywistych wartości w weekly_actual_trx i aop_plans

---

## [v2.8.42] — 2026-09-27: Integracja Finansowa AOP 2026: Sprzedaż (Sales), Średni Paragon (AGC) & Prognoza % COL
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Zasilenie bazy SQLite aop_plans kompletnym oficjalnym rachunkiem P&L AOP 2026 (Sales, TRX, AGC, COL PLN, COL %)**
- **Dwuwymiarowa analiza operacyjno-finansowa w Labor Forecast (TRX & TPLH obok Sprzedaży, AGC i % COL)**
- **Dynamiczna kalkulacja estymowanego obrotu MTD (Sales) i prognozowanego udziału robocizny (% COL) dla kawiarni**

### ✨ Nowe Funkcje (Features):
- `[labor_forecast]` Rozszerzenie bazy aop_plans oraz nasion o planowaną sprzedaż, średni paragon AGC (np. 28,01 zł we wrześniu) oraz budżet COL PLN i % COL
- `[labor_forecast]` Wzbogacenie Hero Bara Modułu 1 o metryki finansowe AOP (Sprzedaż, AGC, COL %) oraz predykcję wyniku finansowego w oparciu o ułożony grafik

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Automatyczna migracja i synchronizacja SQLite dla kolumn plan_agc, actual_agc, plan_col_pln, plan_col_percent

---

## [v2.8.41] — 2026-09-27: Predykcja Zespołowa (Ensemble AI) & Dekompozycja Niedziel Handlowych
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Wielomodelowy Zespół Predykcji (Ensemble AI): Kotwica AOP (35-65%) + Krótki Run-Rate (30-50%) + Sezonowość YoY (15-35%)**
- **Przedziały ufności prognozy TRX (min … expected … max) oraz wypracowanego budżetu godzin (Floor-Safe, Balanced, Growth)**
- **Operacyjna dekompozycja Niedziel Handlowych vs Niehandlowych w CH Janki (20% puli flex w handlowe vs zamrożenie Floor 32h w niehandlowe)**
- **Samouczące się wagi dni tygodnia (EMA) i dynamiczne badge'e 🛒 HANDL. / WOLNA na siatce dobowej i mostku menedżerskim**

### ✨ Nowe Funkcje (Features):
- `[labor_forecast]` Nowa karta Wielomodelowego Zespołu Predykcji (Ensemble Multi-Model Forecast) w panelu Inteligencji Predykcyjnej z podziałem wag i przedziałem ufności TRX
- `[labor_forecast]` Dekompozycja Niedziel Handlowych na bazie ustawy o handlu: automatyczna alokacja 20% flex w niedziele handlowe i zamrożenie na Floor 32h w niedziele niehandlowe

### ⚡ Usprawnienia & Ergonomia (UI/UX):
- `[labor_forecast]` Samouczące się wagi dni tygodnia z wykładniczą średnią kroczącą (EMA) oraz dynamiczne badge'e 🛒 HANDL. / WOLNA w tabeli i mostku dyżurów
- `[labor_forecast]` Eliminacja syndromu zimnego startu na początku miesiąca poprzez dynamiczne łączenie planu AOP z historyczną sezonowością bliźniaczą YoY

---

## [v2.8.40] — 2026-09-27: Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Precyzyjne skalowanie interfejsu (70% – 135%) w dedykowanej zakładce Skalowanie & Wygląd**
- **Skróty klawiszowe Cmd/Ctrl +/-/0 i presety wyświetlaczy (MacBook 13", 24"-27", 4K)**
- **Autodiagnostyka integralności SQLite PRAGMA integrity_check i defragmentacja VACUUM**
- **Automatyczny nadzór nad kopiami zapasowymi (>7 dni) z alertem w belce głównej**

### ✨ Nowe Funkcje (Features):
- Dedykowana zakładka Skalowanie & Wygląd w oknie Ustawień z płynnym suwakiem 70%–135% i sandboxem podglądu na żywo
- `[database]` Inspektor zdrowia bazy SQLite: PRAGMA integrity_check, pomiar stron freelist, licznik 15 tabel i zrzutów Czarnej Skrzynki
- `[database]` 1-klik defragmentacja i kompaktowanie bazy VACUUM + PRAGMA optimize z automatyczną kopią ratunkową pre_vacuum

### ⚡ Usprawnienia & Ergonomia (UI/UX):
- Natywna integracja zoomService z webFrame.setZoomFactor w Electronie — idealna ostrość tekstu i ikon SVG bez rozmycia i podwójnego zoomu

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Ciągły monitoring wieku ostatniej kopii zapasowej — generowanie pilnego zadania To-Do oraz pulsującego ostrzeżenia w Headerze przy braku kopii przez 7 dni

---

## [v2.8.39] — 2026-09-27: Centrum Powiadomień, Szablony Resend & Samouczek Kawiarni
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Wielokanałowe powiadomienia desktopowe i e-mailowe z chmurą Resend API**
- **Studio Szablonów Powiadomień dla publikacji grafiku, kolizji RCP i norm KP**
- **Interaktywny 6-scenowy samouczek i przewodnik pilotażu operacyjnego lokalu**
- **Panel telemetryczny floty urządzeń Firebase Firestore (widok deweloperski)**

### ✨ Nowe Funkcje (Features):
- Centrum Powiadomień z obsługą alertów Kodeksu Pracy, terminu publikacji 7 dni oraz kolizji RCP vs L4/H
- Wysyłka e-mail powiadomień przez Resend API z podglądem HTML szablonów Starbucks Dark Gold
- Interaktywny samouczek pilotażu kawiarni z przewodnikiem po TPLH, grafiku menedżerskim i ustawieniach
- Baza floty urządzeń i instalacji Firebase Firestore dla zdalnego monitoringu stabilności (dostęp Dev/Admin)

---

## [v2.8.30] — 2026-09-21: Katalog Zmian Starbucks, Poprawki Wynagrodzeń & Elastyczne Godziny
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Elastyczny czas trwania zmian (MID, SUP, SAM, SPM, NC) per zmiana oraz presety katalogu**
- **Dostosowywanie przedziału czasowego (Od – Do) ze sprawdzaniem odpoczynku 11h KP**
- **Pełna obsługa zmian wsparciowych ze wszystkich kawiarni w dystrykcie**

### ✨ Nowe Funkcje (Features):
- `[managers_schedule]` Dostosowywanie godzin zmian elastycznych w popoverze (4h–12h) z wizualizacją w siatce grafiku

### ⚡ Usprawnienia & Ergonomia (UI/UX):
- `[managers_schedule]` Dynamiczny stepper godzin rozpoczęcia i zakończenia zmiany z przeliczaniem wymiaru dobowego

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Weryfikacja odpoczynku 11h Kodeksu Pracy z uwzględnieniem niestandardowych godzin rozpoczęcia i zakończenia

### 🐛 Poprawki Błędów (Fixes):
- Precyzyjne uwzględnianie indywidualnych stawek godzinowych i etatu w wyliczeniach kosztów pracy menedżerów

---

## [v2.8.0] — 2026-09-15: AutoScheduling AI, Speed-Dial Hub & Asystent Negocjacji z Zespołem
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Silnik AutoScheduling AI (20 000 symulacji Monte Carlo) generujący kompletny grafik w <150 ms**
- **Asystent kompromisów i negocjacji grafiku z gotowymi szablonami wiadomości WhatsApp/SMS**
- **Pływające menu nawigacyjne Starbucks Speed-Dial Hub i czysty układ panoramiczny**
- **Asystent Wsparcia Międzykawiarnianego dla bezpiecznego oddawania nadwyżek godzin**

### ✨ Nowe Funkcje (Features):
- `[managers_schedule]` AutoScheduling AI: automatyczne dociążenie etatów do 100% z błędem poniżej 1h na pracownika
- `[managers_schedule]` Asystent Negocjacji z Zespołem: detekcja patów obsadowych i generowanie 3 wariantów kompromisowych
- `[managers_schedule]` Pływające logo Starbucks z rozwijanym menu Speed-Dial i szybkim przełącznikiem miesięcy
- `[managers_schedule]` Asystent Wsparcia Międzykawiarnianego dla lokali 323, 341, 756, 327 z ochroną obsady Janki

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Twarda ochrona limitów niedzielnych i świątecznych: zakaz podwójnych otwarć/zamknięć, transfer godzin na bar

---

## [v2.7.0] — 2026-09-12: Trzymiesięczny Okres Rozliczeniowy TOR & Integracja RCP MAPAL
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Kwartalne rozliczenie menedżerów TOR Q1–Q4 z podziałem na RCP, H, L4 i Bilans**
- **Automatyczna detekcja kolizji RCP vs L4/H ze specjalnym oznaczeniem ostrzegawczym**
- **Zabezpieczenie przed manipulacją: nieedytowalna kolumna rzeczywistego czasu pracy RCP**
- **Nawigacja klawiaturą po siatce grafiku z pre-flight walidacją Kodeksu Pracy**

### ✨ Nowe Funkcje (Features):
- `[managers_schedule]` Widok kwartalnego rozliczenia czasu pracy menedżerów TOR (Q1–Q4) z saldem i dedykowanym eksportem Excel
- `[managers_schedule]` Szybkie wprowadzanie zmian z klawiatury (A, P, O, H, L, Delete) z natychmiastową weryfikacją norm

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Reguła pierwszeństwa L4 nad urlopem wypoczynkowym H zgodnie z art. 166 Kodeksu Pracy
- Automatyczne pobieranie logowań MAPAL Fichajes ze wszystkich kawiarni dla menedżerów wspierających

---

## [v2.6.0] — 2026-09-08: Zintegrowana Platforma Operacyjna (Release v2.0)
*Autor: Dawid Apel & Antigravity Agent*

### 🌟 Główne Atuty Wydania:
- **Integracja Modułu 1 (TPLH Forecast) z Modułem 2 (Grafik Managerski)**
- **Dwukierunkowy Manager Labor Bridge przenoszący godziny kierowników do budżetu tygodnia**
- **Baza 252 miesięcy oficjalnych norm Kodeksu Pracy (2016–2036)**
- **System automatycznych kopii zapasowych SQLite z rotacją 15 migawek**

### ✨ Nowe Funkcje (Features):
- `[labor_forecast]` Dwukierunkowy most robocizny: import godzin kierowników i wyliczanie puli baristów w każdym tygodniu
- `[managers_schedule]` Autonomiczne składy miesięczne menedżerów z auto-dziedziczeniem struktury zespołu z poprzedniego miesiąca

### 🛡️ Tarcza Kodeksu Pracy & Baza SQLite:
- Tarcza Kodeksu Pracy: 11h odpoczynku dobowego, 35h odpoczynku tygodniowego i max 12h czasu pracy
- Automatyczne backupy SQLite przed publikacją wersji, importem MAPAL i startem programu

---
