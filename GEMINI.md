# Wytyczne Green AI i Oszczędzania Tokenów (Token Optimization)

Dokument określa bezwzględne reguły optymalizacji zużycia kontekstu i energii obliczeniowej (Green AI) dla każdego agenta AI operującego w repozytorium.

---

## ⚡ 1. Całkowity brak lania wody (Zero Fluff)
- **Zero powitań i uprzejmościowych wstępów:** Zakaz form typu "Chętnie pomogę", "Jasne, oto rozwiązanie", "Cześć".
- **Zero parafrazowania zapytania:** Zakaz powtarzania lub streszczania polecenia użytkownika przed odpowiedzią.
- **Zero zbędnych podsumowań i formułek końcowych:** Zakaz "Mam nadzieję, że to pomogło", "Daj znać w razie pytań" i rozwlekłych podsumowań. Przejdź natychmiast do meritum.

## 🎯 2. Maksymalna zwięzłość (High Information Density)
- Format odpowiedzi: preferowane punkty (bullet points), telegraficzny styl, wysoka gęstość informacji.
- Zero zbędnej teorii: przy pytaniach o kod dostarczaj bezpośrednie rozwiązanie bez akademickich wykładów i tłumaczenia podstaw, chyba że użytkownik o to wyraźnie zapyta.

## 🧹 3. Higiena narzędzi (Tool Hygiene & Context Conservation)
- **Zakaz zrzucania całych dużych plików do kontekstu:** Zawsze stosuj selektywne czytanie (`StartLine`, `EndLine`, `grep`, `head`, `tail`).
- **Filtracja wyjścia poleceń terminalowych:** Ograniczaj rozmiar logów komend przez filtry (`| grep`, `| head -n 30`), by nie zapychać okna kontekstu.
- **Minimalizacja wywołań:** Unikaj powtarzalnych i nadmiarowych operacji I/O.

## ✂️ 4. Precyzyjne edycje punktowe (Targeted Edits)
- Zawsze preferuj edycje punktowe (`edit_file`) zamiast przepisywania całych plików (`write_file`), o ile plik nie jest tworzony od nowa.
- Zmieniaj wyłącznie minimalny niezbędny blok kodu, zachowując nienaruszone otoczenie.

## 🛑 5. Zasada szybkiego błędu (Fail Fast & Clarify)
- **Fail Fast:** Po 1 nieudanym wywołaniu narzędzia natychmiast zmień podejście, zamiast ponawiać tę samą błędną próbę.
- **Brak zgadywania na zapas:** W razie braku kluczowych danych zadaj 1 krótkie, konkretne pytanie zamiast spekulować i generować wielowariantowe odpowiedzi.

## 📝 6. Bezwzględna synchronizacja dokumentacji (Documentation Auto-Sync)
- Po każdej zmianie w jakimkolwiek module, usłudze, bazie danych, API lub interfejsie użytkownika, agent **musi natychmiast zaktualizować**:
  1. `AGENTS.md` w danym module (`src/modules/{module}/AGENTS.md`) — struktura, algorytmy, parametry.
  2. `CHANGELOG.md` danego modułu (`src/modules/{module}/CHANGELOG.md`) — rejestr wprowadzonych zmian.
  3. Swój plik `.agents/skills/{skill}/SKILL.md` (w razie wpływu na zakres obowiązków).
  4. Główny rejestr wersji `VERSION_HISTORY.md` przy publikacji zmian.

## ⚡ 7. Błyskawiczne Prefiksy i Etykiety w Czacie (`/` oraz `?`)
Agent natychmiast rozpoznaje skróty w promptach użytkownika i zawęża kontekst:
- **Wykonanie zadania (`/` lub `[...]`):**
  - `/m1` lub `[M1]` ➔ **Moduł 1: TPLH & Robocizna** (`src/modules/labor-forecast/`)
  - `/m2` lub `[M2]` ➔ **Moduł 2: Grafik Managerski** (`src/modules/managers-schedule/`)
  - `/m3` lub `[M3]` ➔ **Moduł 3: Szkolenia** (`src/modules/trainings/`)
  - `/m4` lub `[M4]` ➔ **Moduł 4: COL Calculator** (`src/modules/col-calculator/`)
  - `/cloud` lub `[Cloud]` ➔ **Chmura Firestore & Outbox Sync** (`src/services/sync/`)
  - `/fleet` lub `[Fleet]` ➔ **Flota & Przełącznik Kawiarni** (`src/services/storeService.ts`)
  - `/auth` lub `[Auth]` ➔ **Bezpieczeństwo, OTP & Hardware ID** (`src/context/AuthContext.tsx`)
  - `/core` lub `[Core]` ➔ **Electron & SQLite** (`electron/`)
  - `/ota` lub `[OTA]` ➔ **Mikropatche & Aktualizacje** (`scripts/publish-patch.js`)
- **Pytanie / Inspekcja (`?`):**
  - `?m1`, `?m2`, `?m3`, `?m4`, `?cloud` itp. ➔ natychmiastowa analiza, audyt i podsumowanie bez wprowadzania zmian w kodzie.

---

👉 Główny rejestr architektoniczny i operacyjny projektu: **[AGENTS.md](./AGENTS.md)**
