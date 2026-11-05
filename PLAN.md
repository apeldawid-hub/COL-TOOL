# PLAN.md — Aktualny Plan Działań

> **Tryb pracy:** Ten plik jest mostem między planowaniem w Antigravity a realizacją w VS Code (Claude).  
> Claude w VS Code realizuje zadania krok po kroku, oznaczając postęp `[x]`.

---

## 🎯 Główny Cel Bieżącego Etapu
Wdrożenie i przetestowanie nowego, dwuetapowego modelu pracy oraz przygotowanie środowiska pod kolejne ulepszenia interfejsu i funkcji.

---

## 📊 Status Realizacji
- [x] **Zadanie 1:** Konfiguracja szybkiego środowiska testów jednostkowych (`npm test`) z wzorcowym testem standardów Starbucks.
- [x] **Zadanie 2:** Weryfikacja pierwszego uruchomienia w VS Code i pętli samonaprawiania przez Claude.
- [ ] **Zadanie 3:** [Miejsce na kolejne zadanie biznesowe / usprawnienie UI zaplanowane w Antigravity].

---

## 📝 Szczegółowy Zakres Zadań

### Zadanie 1: Przygotowanie fundamentu testów i instrukcji
- **Zakres:** Dodanie polecenia `npm test` do błyskawicznego testowania, utworzenie reguł projektu i instrukcji dla Claude.
- **Weryfikacja automatyczna:** Polecenie `npm test` oraz `npm run check` przechodzą na zielono w <2 sekundy.
- **Dla użytkownika:** Wszystkie reguły projektu są spisane, a komputer automatycznie pilnuje poprawności obliczeń.
- **Status:** `[x]` Ukończone

---

### Zadanie 2: Test pętli samonaprawiania w VS Code
- **Zakres:** Uruchomienie Claude w VS Code, odczytanie niniejszego pliku `PLAN.md` oraz wykonanie testowego sprawdzenia środowiska poleceniem `npm test`.
- **Weryfikacja automatyczna:** Claude potwierdza pomyślne wykonanie `npm test` oraz `npm run check`.
- **Co sprawdzasz w UI / w aplikacji:** Claude potwierdza gotowość do pracy w 2-3 prostych zdaniach bez używania żargonu programistycznego.
- **Instrukcja dla Claude:** Po przeczytaniu instrukcji oznacz Zadanie 2 jako `[x]` i zgłoś użytkownikowi gotowość na kolejne zadania.
- **Status:** `[x]` Ukończone — testy i kontrola projektu zakończone pomyślnie

---

### Zadanie 3: [Kolejna funkcja / ekran w aplikacji]
- **Zakres:** Do zdefiniowania w Antigravity podczas kolejnej rozmowy planistycznej.
- **Weryfikacja automatyczna:** Obowiązkowy test jednostkowy w `tests/unit/`.
- **Co zobaczysz w UI:** [Dokładny opis wyglądu i zachowania nowego elementu na ekranie].
- **Status:** `[ ]` Oczekuje na plan

---

## 💡 Podpowiedź dla Claude w VS Code
1. Wybierasz zawsze **pierwsze niezrealizowane zadanie** `[ ]`.
2. Tworzysz kod i obowiązkowo test jednostkowy w `tests/unit/`.
3. Uruchamiasz `npm test` oraz `npm run check`.
4. Jeśli jest błąd — sam go naprawiasz, aż oba polecenia będą zielone.
5. Zmieniasz status zadania w tym pliku na `[x]`.
6. Piszesz użytkownikowi w 2–3 zdaniach, co zrobiono i jak może to zobaczyć w programie.
