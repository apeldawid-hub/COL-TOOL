# Kopia Zapasowa Platformy: Starbucks Operations Suite (v2.2 Stable)
- **Data i godzina**: 14.09.2026, 14:29:08
- **Wersja**: Release v2.2 Seasonal AI Learning & Labor Optimization Stable
- **Kawiarnia**: 108120 SBX Warszawa Janki (Unit Code: 384)
- **Liczba skopiowanych plików**: 142
- **Łączny rozmiar danych**: 15.09 MB
- **Kopia SQLite w rejestrze db_backups**: `tplh_forecast_2026-09-14_14-29-08_release_v2_2_seasonal_learning_stable.db`

## 🌟 Stan Modułów w Wersji v2.2:
1. **Moduł 1: 📊 TPLH Forecast & Labor Balancing (v1.2 Stable)**
   - Pełna baza AOP (2021–2036) i logowania MAPAL Fichajes z 89 tygodni (2024–2026, 4 346 wpisów).
   - **Ciągłe uczenie maszynowe trendów rocznych i sezonowości AOP (bez sztywnych reguł)**:
     - Dynamiczna wieloletnia agregacja per miesiąc (`monthAggregation`).
     - Identyfikacja miesięcy szczytowych (Maj–Sierpień, +4.7% ponad plan AOP ze średnim TPLH 6.94).
     - Wyuczona empirycznie obsada optymalna: bufor szczytowy **+13.6h flex/tydzień** (dociążenie sobót do 56.7h i piątków do 48h) vs dyscyplina bazy Floor (32h/d = 224h/tydz.) w miesiącach spowolnienia.
     - Pełna tolerancja na nieuzupełnione plany AOP na lata wstecz i natychmiastowe adaptowanie się po wpisaniu nowych danych.
   - Flash Forecast poniedziałkowy (Pre-closing projection W+2).
   - Pula Baristów, Manager Labor Bridge oraz Cross-Month Bridge scalający tygodnie przełomowe.

2. **Moduł 2: 🗓️ Managers Schedule — Grafik Managerski (v1.0 Active)**
   - 9 miesięcy kompletnych grafików (Styczeń – Wrzesień 2026) zaimportowanych z arkuszy XLSM.
   - Baza norm miesięcznych KP na 20 lat (2016–2036).
   - Pełna Tarcza Kodeksu Pracy z pre-flight walidacją naruszeń.
   - Autonomiczny skład miesięczny (`manager_monthly_roster`) i bezpieczne wyliczanie TOR.
   - Własne godziny i przedziały czasowe zmian (Od-Do) z synchronizacją w popoverze.
   - Obsługa zmian Support z innych kawiarni z bazą zdrobnień (`NICKNAME_MAP`).
   - Rejestr wersji grafiku, blokady miesięcy zamkniętych i menedżer kopii SQLite (`BackupManager`).

## 🔄 Instrukcja Przywrócenia (Rollback):
W razie potrzeby przywrócenia aplikacji do tego stanu:
1. Skopiuj zawartość `src/` oraz `electron/` z tego folderu do katalogu głównego projektu.
2. Nadpisz plik `data/tplh_forecast.db` plikiem `tplh_forecast.db` z tego folderu lub użyj pliku `tplh_forecast_2026-09-14_14-29-08_release_v2_2_seasonal_learning_stable.db` w menu kopii zapasowych.
