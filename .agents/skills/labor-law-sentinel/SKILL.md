---
name: labor-law-sentinel
description: >-
  Ekspert od polskiego Kodeksu Pracy (art. 130, 132, 133, 151, 154 KP), reguł grafikowych Starbucks
  (Floor Hours 32h/dzień, kody zmian AM/PM/MIB/SUP, niedziele handlowe w CH Janki), silnika AutoSchedule AI
  oraz kwartalnego rozliczenia TOR (Trzymiesięczny Okres Rozliczeniowy).
---

# Strażnik Kodeksu Pracy & Grafik Managerski (Labor Law Sentinel)

Skill odpowiada za weryfikację poprawności grafiku menedżerskiego, ochronę przed karami Państwowej Inspekcji Pracy (PIP) oraz sterowanie silnikiem AutoScheduling AI w kawiarni `108120 SBX Warszawa Janki`.

---

## ⚖️ 1. Żelazne Reguły Polskiego Kodeksu Pracy (Tarcza KP)

1. **Odpoczynek Dobowy (art. 132 KP)**:
   - Pracownik musi mieć zapewnione minimum **11 godzin nieprzerwanego odpoczynku** w każdej dobie pracowniczej.
   - *Naruszenie krytyczne:* Po zmianie zamykającej `PM` (do 22:00) menedżer **nie może** rozpocząć pracy na otwarciu `AM` (od 6:00) następnego dnia (przerwa wynosi tylko 8h).
   - Weryfikacja obejmuje również przełomy miesięcy ($M-1 \rightarrow D_1$ oraz $D_{\text{last}} \rightarrow M+1$).

2. **Odpoczynek Tygodniowy (art. 133 KP)**:
   - W każdym tygodniu pracy pracownik musi mieć zapewnione minimum **35 godzin nieprzerwanego odpoczynku** (11h dobowego + 24h wolnego).

3. **Niedziele i Święta (Zasada 4 Niedzieli)**:
   - Pracownik pracujący w niedziele ma prawo do **co najmniej jednej wolnej niedzieli na 4 tygodnie** (maksymalnie 3 pracujące niedziele z rzędu).
   - W niedziele i święta (np. 1.11, 25.12) w kawiarni Janki obowiązuje limit **dokładnie 2 menedżerów (1x `AMN` + 1x `PMN`)** — bezwzględny zakaz dublowania otwarć/zamknięć.

4. **Wymiar Czasu Pracy i Święta (art. 130 § 2 KP)**:
   - Każde święto przypadające w innym dniu niż niedziela obniża miesięczny wymiar czasu pracy o 8 godzin.
   - Baza norm obejmuje lata 2016–2036 (`manager_monthly_norms`).

5. **Urlopy (H) i Chorobowe (L4) per Wymiar Etatu (art. 154² § 1 KP)**:
   - Godziny urlopu i L4 naliczają się **wyłącznie w dni robocze** (pn-pt lub zgodnie z normą dobową pracownika):
     - Pełny etat (1.0): $8.0\text{ h}$,
     - Trzy czwarte etatu (0.75): $6.0\text{ h}$,
     - Pół etatu (0.50): $4.0\text{ h}$.
   - W weekendy i święta zaliczenie wynosi $0.0\text{ h}$.
   - **Reguła pierwszeństwa (art. 166 KP):** L4 w trakcie urlopu natychmiast anuluje zużycie dni urlopowych i zalicza godziny wyłącznie jako chorobowe.

6. **Publikacja Grafiku (art. 129 § 3 KP)**:
   - Grafik musi zostać podany do wiadomości pracowników na co najmniej **7 dni przed rozpoczęciem** okresu rozliczeniowego.
   - System blokuje edycję po zamrożeniu i rejestruje wszelkie zmiany post-publikacyjne.

---

## 📋 2. Katalog Kodów Zmian Starbucks

| Kod Zmiany | Godziny Pracy | Czas (h) | Charakterystyka |
| :--- | :--- | :--- | :--- |
| `AM` | 06:00 – 14:30 | 8.0 h (+30 min przerwy) | Otwarcie kawiarni (dni powszednie i soboty) |
| `PM` | 13:30 – 22:00 | 8.0 h (+30 min przerwy) | Zamknięcie kawiarni (dni powszednie i soboty) |
| `MID` | 09:00 – 17:30 | 8.0 h (+30 min przerwy) | Zmiana środkowa (szczyt popołudniowy) |
| `MIB` | 11:00 – 19:30 | 8.0 h (+30 min przerwy) | Zmiana wsparcia baru w szczycie |
| `AMN` | 08:00 – 16:30 | 8.0 h (+30 min przerwy) | Otwarcie w niedziele i wybrane święta |
| `PMN` | 13:30 – 22:00 | 8.0 h (+30 min przerwy) | Zamknięcie w niedziele i wybrane święta |
| `SUP` | Elastyczne | 8.0 h | Wsparcie innej kawiarni (wlicza się do etatu menedżera, ale **nie** do obsady lokalu Janki) |
| `SAM` / `SPM`| 06:00-14:30 / 13:30-22:00 | 8.0 h | Wsparcie zewnętrzne na otwarciu / zamknięciu |
| `OFF` | — | 0.0 h | Dzień wolny |
| `H` | Norma dobowa | $8\text{h} \times \text{etat}$ | Płatny urlop wypoczynkowy (tylko dni robocze) |
| `L4` | Norma dobowa | $8\text{h} \times \text{etat}$ | Zwolnienie lekarskie (tylko dni robocze) |

---

## 🧠 3. Silnik AutoScheduling AI (20 000 prób) i Negocjacje

Gdy uruchamiany jest generator automatycznego grafiku (`AutoSchedulerEngine`):
1. **Dociążenie etatów do 100%**: Bilans $\pm 0.9\text{ h}$ na koniec miesiąca dla każdego członka zespołu.
2. **Kolejność priorytetów**:
   - Twarde zakazy Kodeksu Pracy (11h, 35h, 4. niedziela).
   - Ochrona Floor Hours (1x AM + 1x PM każdego dnia).
   - Dyspozycje zgłoszone przez menedżerów (`FULL`, `AM`, `PM`, `OFF`).
3. **Asystent Kompromisów**:
   - W przypadku pata obsadowego silnik generuje gotowe propozycje zamian z rekompensatą i teksty wiadomości SMS/WhatsApp do skopiowania jednym kliknięciem.

---

## 📊 4. Trzymiesięczny Okres Rozliczeniowy (TOR)

W widoku `TorView`:
- Agregacja kwartalna (Q1: Sty-Mar, Q2: Kwi-Cze, Q3: Lip-Wrz, Q4: Paź-Gru).
- Podział per miesiąc: **Norma (h)**, **Godziny Przepracowane (h)**, **Urlop H (h)**, **Chorobowe L4 (h)**, **Bilans**.
- Status kwartału: `OK`, `Nadgodziny (+)` lub `Niedogodziny (-)`.
