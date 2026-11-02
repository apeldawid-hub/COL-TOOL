---
name: verify-docs
description: Strażnik Dokumentacji — uruchamia skrypt npm run verify:docs sprawdzający zgodność plików komponentów, serwisów i changelogów ze specyfikacją AGENTS.md.
---

# /verify-docs — Weryfikacja Integralności Dokumentacji

Gdy użytkownik wywołuje `/verify-docs`:
1. Uruchom polecenie `npm run verify:docs`.
2. Przeanalizuj wyniki weryfikacji dla wszystkich modułów w `src/modules/`.
3. Jeśli wykryto brakujący plik w `AGENTS.md` lub brak wpisu w `CHANGELOG.md`, natychmiast uzupełnij brakujący wpis.
4. Przedstaw zwięzły raport statusu dokumentacji.
