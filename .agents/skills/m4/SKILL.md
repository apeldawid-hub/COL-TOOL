---
name: m4
description: Moduł 4: COL Calculator — controlling kosztów robocizny, 6 arkuszy Excel Replica, narzuty ZUS 19.48%, rezerwa urlopowa, What-If P&L.
---

# /m4 — COL Calculator (Cost of Labor Suite)

Gdy użytkownik wywołuje `/m4`:
1. Zawęź kontekst operacyjny do katalogu: `src/modules/col-calculator/`.
2. Zapoznaj się z formułami w `src/modules/col-calculator/AGENTS.md`.
3. Pamiętaj o standardach:
   - Model 3 Filarów: AOP, Target, Estymacja MTD.
   - Narzuty ZUS pracodawcy: 19.48% od wynagrodzeń zasadniczych i premii UoP.
   - Formuły: Total COL %, TPLH Total, TPLH Coverage.
4. Po modyfikacji kodu zaktualizuj `src/modules/col-calculator/AGENTS.md` oraz `src/modules/col-calculator/CHANGELOG.md`.
