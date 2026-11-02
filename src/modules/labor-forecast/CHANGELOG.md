# Historia Zmian — Moduł 1: TPLH Forecast & Labor Balancing

Rejestr zmian, aktualizacji algorytmicznych i usprawnień technicznych wprowadzanych w Module 1 (TPLH Forecast & Labor Balancing).

---

## [v2.9.6] — 2026-11-02
- **Harmonizacja Bazy Floor**: Zaktualizowano dokumentację techniczną do nienaruszalnego standardu 224.0h/tydzień (32.0h/dzień: 1 MGR + 1 Barista rano i wieczorem).
- **Synchronizacja Drzewa Komponentów**: Uzupełniono specyfikację techniczną o `LaborForecastView.tsx`, `ManagerLaborBridgeModal.tsx`, `MondayProjectionModal.tsx` oraz `LaborForecastWidget.tsx`.
- **Systemowa Organizacja Stałych**: Utworzono dedykowany moduł stałych domenowych `constants/index.ts` (Floor 32h/224h, progi TPLH, niedziele handlowe).
- **Public API Barrel**: Zaktualizowano `index.ts` o pełny eksport `types` oraz `constants`.
- **Reguła Auto-Sync**: Wprowadzono bezwzględną regułę ciągłej aktualizacji dokumentacji po każdej modyfikacji kodu.

## [v2.8.63] — 2026-10-24
- **Korekta Bazy Mostów Split-Week (224.0h)**: Wyrównano normę pełnego tygodnia na przełomie miesięcy do standardu 224.0h (7 dni × 32.0h/dzień) w `calculationEngine.ts`.
- **Eliminacja Stałej 272.0h**: Zastąpienie przestarzałego progu 272.0h wartością 224.0h w mostach przełomu miesięcy.

## [v2.8.52] — 2026-09-28
- **Autonomiczny Flash Forecast Poniedziałku**: Wprowadzono estymację domknięcia trwającego tygodnia W w poniedziałek (przed spłynięciem pełnych logowań z MAPAL Fichajes we wtorek).
- **Stabilizacja MTD Velocity**: Tydzień bieżący z estymacją poniedziałkową stabilizuje MTD, zapobiegając fałszywym skokom rekomendacji HANW na tydzień docelowy W+2.
- **Interfejs Flash Forecast**: Dodano badge'e `🔮 Pn: +Xh est.` oraz dedykowany modal `MondayProjectionModal`.

## [v2.8.51] — 2026-09-28
- **Eliminacja Zawyżonych Godzin Otwartego Tygodnia**: Korekta proporcjonalnego rozdziału wypracowanego budżetu na otwarte tygodnie miesiąca.

## [v2.8.45] — 2026-09-28
- **Integracja Dobowych Danych KPI**: Wyświetlanie rzeczywistych godzin i transakcji z podziałem na dni tygodnia (Daily KPI + MAPAL Fichajes).

## [v2.8.41] — 2026-09-27
- **Predykcja Zespołowa (Ensemble AI)**: Zintegrowany model łączący średnie historyczne, wagi dniowe oraz wzorce niedziel handlowych.

## [v2.0.0] — 2026-09-08
- **Manager Labor Bridge**: Dwukierunkowa integracja z Modułem 2 (Grafik Managerski) — zaplanowane godziny menedżerów automatycznie pomniejszają pulę dla baristów (`Remaining Barista Pool`).
- **Split-Week Cross-Month Bridge**: Obsługa tygodni cząstkowych z przełomu miesięcy w cyklu wtorek–poniedziałek.

## [v1.0.0] — 2026-08-01
- **Silnik AOP i MTD Velocity**: Bazowe planowanie budżetu robocizny, rozbicie tygodniowe W1–W5 i rekomendacja HANW.
