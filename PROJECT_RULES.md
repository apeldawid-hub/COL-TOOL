# PROJECT_RULES.md — Kodeks Zasad Projektu Starbucks Operations Suite

Niniejszy dokument definiuje nienaruszalne zasady współpracy, podział ról oraz standardy jakości w dwuetapowym modelu pracy nad projektem.

---

## 🤝 1. Dwuetapowy Model Pracy

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     ETAP 1: PLANOWANIE          │       │     ETAP 2: REALIZACJA          │
│     (Antigravity)               │  ───> │     (VS Code + Claude Copilot)  │
│                                 │       │                                 │
│ • Architektura i kierunki       │       │ • Pisanie kodu i testów         │
│ • Spisywanie planu w PLAN.md    │       │ • Samonaprawianie (npm test)    │
│ • Rozbijanie na małe kroki      │       │ • Oznaczanie zadań [x]          │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

1. **Antigravity (Architekt & Partner Koncepcyjny):**
   - Ustala z użytkownikiem wizję, wymagania biznesowe i wygląd interfejsu.
   - Tworzy lub aktualizuje precyzyjny plan działania w pliku `PLAN.md`.
2. **VS Code + Claude (Inżynier Implementacyjny):**
   - Realizuje po kolei zadania z `PLAN.md`.
   - Pisze kod, zabezpiecza go testami automatycznymi, naprawia wszelkie błędy we własnym zakresie i aktualizuje stan planu.

---

## 👤 2. Złota Zasada Komunikacji z Użytkownikiem

- **Użytkownik jest osobą w 100% nietechniczną.** Nie czyta kodu, nie analizuje plików i nie debuguje błędów.
- **Ocena projektu odbywa się wyłącznie w interfejsie graficznym (UI)** oraz poprzez weryfikację, czy program zachowuje się tak, jak powinien.
- **Zakaz żargonu programistycznego:** Nie piszemy o nazwach plików, modułach, hookach czy zapytaniach SQL.
- **Maksymalna zwięzłość:** Każde podsumowanie prac musi zamknąć się w **2–3 prostych, zrozumiałych zdaniach** opisujących, co użytkownik zyskał w interfejsie i jak może to sprawdzić.

---

## 🛡️ 3. Tarcza Bezpieczeństwa i Samonaprawianie (Self-Healing)

1. **Zabezpieczenie kalkulacji testami jednostkowymi:**
   - Żadna funkcja licząca godziny, koszty, budżety czy weryfikująca reguły nie może powstać bez automatycznego testu w `tests/unit/`.
   - Błędy w obliczeniach muszą być wyłapywane przez komputer, zanim użytkownik zobaczy program.
2. **Całkowity zakaz typu `any`:**
   - Kod w TypeScript musi być w 100% bezpieczny typologicznie.
3. **Pętla samonaprawiania przed oddaniem pracy:**
   - Asystent wykonujący zadanie ma obowiązek uruchomić:
     - `npm test` — testy jednostkowe
     - `npm run check` — weryfikacja typów i integralności projektu
   - Jeśli cokolwiek nie działa, asystent **sam naprawia błąd** przed przekazaniem programu użytkownikowi.

---

## ☕ 4. Nienaruszalne Standardy Biznesowe Starbucks

1. **Baza Floor Hours:**
   - Absolutne minimum: **32.0 godziny dziennie** (1 Kierownik + 1 Barista rano, 1 Kierownik + 1 Barista po południu).
   - Tygodniowa nienaruszalna baza wynosi **224.0 godziny**. Grafik kawiarni nie może spaść poniżej tej wartości.
2. **Izolacja Budżetu Szkoleń:**
   - Szkolenia baristów (zmiany T1–T10) to Non-Coverage — nie pomniejszają one bazy Floor Hours.
3. **Ochrona Danych Użytkownika:**
   - Baza danych SQLite użytkownika (`~/Library/Application Support/Starbucks Operations Suite/`) jest nienaruszalna. Aktualizacje programu nigdy nie mogą usunąć danych kawiarni.
   - Żadne dane operacyjne, nazwiska pracowników ani hasła nie mogą trafić do repozytorium Git.
