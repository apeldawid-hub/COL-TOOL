---
name: m1
description: Moduł 1: TPLH Forecast & Labor Balancing — planowanie AOP, MTD Velocity, Floor 224h, Pula Flex, mosty Split-Week i Flash Forecast poniedziałku.
---

# /m1 — TPLH Forecast & Labor Balancing

Gdy użytkownik wywołuje `/m1`:
1. Zawęź kontekst operacyjny do katalogu: `src/modules/labor-forecast/`.
2. Zapoznaj się z aktualnymi algorytmami w `src/modules/labor-forecast/AGENTS.md`.
3. Pamiętaj o standardach:
   - Nienaruszalna baza Floor: **224.0 h/pełny tydzień** (32.0 h/dzień).
   - Wszystkie godziny ponad bazę tworzą **Pulę Flex**.
   - W poniedziałek silnik stosuje **Flash Forecast** domykający tydzień bieżący do MTD Velocity.
4. Po modyfikacji kodu bezwzględnie zaktualizuj `src/modules/labor-forecast/AGENTS.md` oraz zarejestruj wpis w `src/modules/labor-forecast/CHANGELOG.md`.
