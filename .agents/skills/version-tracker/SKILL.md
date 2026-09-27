---
name: version-tracker
description: >-
  Rejestruje i spisuje w jednym centralnym miejscu (VERSION_HISTORY.md) wszystkie zmiany,
  nowe funkcje, usprawnienia i poprawki wprowadzane w każdej wersji aplikacji Starbucks Operations Suite.
  Używaj tego agenta zawsze przy wdrażaniu nowej funkcji, mikropatchu OTA, zmianie wersji w package.json
  lub gdy użytkownik pyta o historię wprowadzonych zmian.
---

# Agent Rejestru Wersji (Version Tracker Agent)

Agent odpowiada za **jedno centralne miejsce**, w którym zapisywana jest pełna historia tego, co wprowadziliśmy w każdej wersji platformy:
👉 **[VERSION_HISTORY.md](../../VERSION_HISTORY.md)**

---

## 🎯 Obowiązki i Zadania Agenta

1. **Jedyne Źródło Prawdy (Single Source of Truth):**
   - Każda zmiana kodu, modyfikacja UI, poprawka algorytmów Kodeksu Pracy, optymalizacja bazy danych czy publikacja nowego patcha OTA (`npm run patch`) **musi zostać odnotowana w [VERSION_HISTORY.md](../../VERSION_HISTORY.md)**.
   
2. **Kiedy Agent MUSI zostać aktywowany:**
   - Przed lub tuż po publikacji nowego patcha (`v2.8.X`).
   - Po zakończeniu implementacji nowej funkcji (np. dodanie skalowania UI, nowe widoki, integracja z zewnętrznym API).
   - Na wyraźne polecenie użytkownika (np. "dopisz co zrobiliśmy", "zaktualizuj rejestr wersji", "co doszło w v2.8.40?").

3. **Format Wpisu w `VERSION_HISTORY.md`:**
   Każde wydanie musi posiadać:
   - **Nagłówek wersji i data:** `### [vX.Y.Z] — YYYY-MM-DD`
   - **Tytuł wydania:** zwięzłe podsumowanie celu wersji (np. *Skalowanie Interfejsu (UI Zoom) & Autodiagnostyka Bazy SQLite*).
   - **Autorzy:** np. *Dawid Apel & Antigravity Agent*
   - **Kluczowe Atuty (🌟 Co Wprowadziliśmy):** punktory z pogrubionymi tytułami i opisem korzyści operacyjnych.
   - **Kategorie Zmian:**
     - `✨ Nowe Funkcje (Features)`
     - `⚡ Usprawnienia & Ergonomia (UI/UX)`
     - `🛡️ Tarcza Kodeksu Pracy & Baza SQLite`
     - `🐛 Poprawki Błędów (Fixes)`
   - **Zmodyfikowane Pliki (📁 Zmodyfikowane Pliki):** lista kluczowych plików źródłowych.
   - **Wpis w Spisie Treści:** dodanie wiersza na początku tabeli wydań w `VERSION_HISTORY.md`.

---

## 🛠️ Procedura Krok po Kroku dla Agenta

### Krok 1: Weryfikacja bieżącej wersji
Sprawdź numer wersji w pliku `package.json` oraz najnowszy wpis w [VERSION_HISTORY.md](../../VERSION_HISTORY.md).

### Krok 2: Analiza wprowadzonych zmian
Jeśli pracowałeś nad kodem w bieżącej sesji lub istnieją nieudokumentowane commity:
```bash
git diff HEAD~1 --stat
git log -n 5 --oneline
```
Zidentyfikuj:
- Jakie moduły zostały dotknięte (`labor-forecast`, `managers-schedule`, `col-calculator`, `trainings`, `system`, `electron`)?
- Jakie nowe komponenty, serwisy lub tabele bazy danych powstały?
- Jakie problemy lub błędy zostały rozwiązane?

### Krok 3: Zapis w `VERSION_HISTORY.md`
Otwórz [VERSION_HISTORY.md](../../VERSION_HISTORY.md) i dodaj nowy wpis na samej górze sekcji szczegółowej oraz zaktualizuj tabelę spisu treści.

### Krok 4: Synchronizacja z kodem aplikacji
Upewnij się, że wpis trafił również do:
1. `src/constants/changelog.ts` (dzięki czemu Store Manager widzi zmiany bezpośrednio w oknie aktualizacji w programie).
2. Pliku publicznego `CHANGELOG.md` (można uruchomić `npm run changelog:generate`).

### Krok 5: Automatyczny pomocnik CLI
Możesz również skorzystać ze skryptu pomocniczego:
```bash
node scripts/changelog-agent.js add --version X.Y.Z --title "Tytuł" --notes "Zmiana 1; Zmiana 2"
```

---

## 🔒 Reguła Bezpieczeństwa
Podobnie jak w `AGENTS.md`, rejestr wersji zawiera **WYŁĄCZNIE OPIS KODU I FUNKCJI PROGRAMU**. Bezwzględny zakaz wpisywania danych wrażliwych (danych osobowych pracowników, numerów PESEL, stawek poufnych, haseł ani zawartości lokalnych baz danych).
