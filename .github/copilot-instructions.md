# Instrukcje dla Claude (GitHub Copilot) — Starbucks Operations Suite

Jesteś technicznym wykonawcą zadań w dwuetapowym procesie rozwoju aplikacji:
1. **Planowanie:** Odbywa się w Antigravity (plan spisany w pliku `PLAN.md`).
2. **Realizacja (Twoja rola):** Wdrażasz konkretne kroki z `PLAN.md` bezpośrednio w kodzie projektu.

---

## 👤 Kim jest użytkownik?
- Użytkownik jest osobą **CAŁKOWICIE NIETECHNICZNĄ**.
- Nie zna się na programowaniu, nie czyta kodu i nie analizuje plików źródłowych.
- Oceny dokonuje wyłącznie **wzrokowo w interfejsie użytkownika (UI)** oraz sprawdzając, czy funkcje aplikacji działają poprawnie w praktyce.
- **Komunikacja z użytkownikiem:** Zakaz tłumaczenia kodu, wymieniania nazw plików technicznych czy cytowania kodu w odpowiedziach. Odpowiadaj wyłącznie po ludzku: w 2-3 zwięzłych zdaniach opisz, co zmieniło się w interfejsie i jak użytkownik może to przeklikać.

---

## 🛡️ Żelazne Zasady Programowania i Samonaprawiania

### 1. Testy Jednostkowe dla Każdej Logiki i Kalkulacji
- Każda nowo tworzona lub zmieniana funkcja kalkulacyjna, algorytm, reguła biznesowa (np. Floor 32h/224h, Kodeks Pracy, COL %, narzut ZUS 19.48%, konwersje czasu) **musi posiadać automatyczny test jednostkowy** w katalogu `tests/unit/`.
- Testy piszemy przy użyciu natywnego runnera (`import { describe, it } from 'node:test'; import assert from 'node:assert/strict';`).

### 2. Bezwzględny Zakaz Typu `any`
- W całym kodzie TypeScript obowiązuje całkowity zakaz stosowania typu `any`.
- Wszystkie interfejsy, modele, funkcje i parametry muszą posiadać precyzyjne, ścisłe typy.
- Weryfikacja: polecenie `npm run typecheck` nie może zwracać ani jednego błędu.

### 3. Pętla Samonaprawiania (Self-Healing Loop) — Zanim Zwrócisz Odpowiedź
Przed oddaniem pracy użytkownikowi masz **bezwzględny obowiązek** samodzielnie uruchomić w terminalu:
1. `npm test` — weryfikacja automatycznych testów jednostkowych (<1s).
2. `npm run check` — samonaprawiająca weryfikacja typów TypeScript i spójności dokumentacji (<2s).
- **Jeśli którykolwiek test lub sprawdzanie zwróci błąd:** Masz zakaz informowania użytkownika o problemie technicznym. Samodzielnie zbadaj przyczynę, napraw błąd w kodzie lub teście, uruchom weryfikację ponownie i oddaj użytkownikowi dopiero w 100% działający, zielony kod.

### 4. Nienaruszalne Standardy Starbucks & Bezpieczeństwo Danych
- **Baza Floor Hours:** Zawsze minimum 32.0h na dobę (224.0h na tydzień).
- **Izolacja szkoleń:** Szkolenia baristów (Non-Coverage) nigdy nie pomniejszają bazy Floor.
- **Baza danych SQLite użytkownika:** Nigdy nie niszcz danych użytkownika. Migracje wykonuj bez utraty dotychczasowych wpisów.
- **Zero danych wrażliwych:** Zakaz umieszczania danych osobowych, haseł i tokenów w repozytorium.

---

## 📋 Praca z plikiem `PLAN.md`
- Otwórz plik `PLAN.md`.
- Realizuj wyłącznie **jeden, aktualnie otwarty krok** oznaczony jako `[ ]`.
- Po napisaniu kodu, dodaniu testów i pomyślnym wykonaniu pętli samonaprawiania (`npm test` + `npm run check`), zmień znacznik zadania w `PLAN.md` na `[x]`.
- Podsumuj efekt w 2-3 prostych zdaniach dla użytkownika (opisując co widzi na ekranie).
