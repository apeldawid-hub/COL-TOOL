---
name: fichajes-pipeline
description: >-
  Integrator i audytor ewidencji logowań MAPAL Fichajes, planów AOP P&L i danych RCP. Odpowiada za import
  arkuszy Excel (.xlsx, .xlsm), wykrywanie kolizji RCP vs absencje L4/H, zasilanie nieedytowalnych kolumn
  godzin rzeczywistych oraz poniedziałkową projekcję Flash Forecast.
---

# Integrator Danych & Audytor MAPAL Fichajes (Fichajes Pipeline)

Skill odpowiada za bezbłędny przepływ danych pomiędzy zewnętrznymi systemami korporacyjnymi Starbucks/AmRest (raporty MAPAL Fichajes, P&L AOP) a bazą danych SQLite aplikacji.

---

## 📥 1. Format i Obsługa Raportów MAPAL Fichajes

1. **Źródło Danych**:
   - Eksporty tygodniowe i miesięczne z systemu MAPAL w formacie `.xlsx` / `.xls` umieszczane w folderze `IMPORT/`.
2. **Zakres Danych**:
   - Imię i nazwisko pracownika,
   - Data i godziny odbić na kasie (start, przerwa, koniec),
   - Czas rzeczywisty przepracowany (RCP) per zmiana i kawiarnia (w tym godziny wsparcia `SUP` w innych lokalach).
3. **Zasada Nienaruszalności Kolumny RCP**:
   - Kolumna `RCP (h)` w Grafiku Menedżerskim (Moduł 2) oraz Kalkulatorze COL (Moduł 4) jest zasilana wyłącznie z systemu Fichajes i **jest trwale zablokowana przed ręczną edycją** przez użytkownika.

---

## ⚡ 2. Detekcja Kolizji RCP vs Absencje (L4 / Urlop H)

Gdy importowane są nowe logowania Fichajes, silnik wykonuje automatyczny audyt kolizji:
- **Scenariusz kolizyjny:** Pracownik ma w grafiku wpisany urlop `H` lub zwolnienie lekarskie `L4`, a w pliku MAPAL pojawia się zarejestrowany czas pracy w tym samym dniu.
- **Reakcja systemu:**
  - W grafiku pojawia się pulsujący badge ostrzegawczy `⚡`.
  - Wyświetlany jest dialog `RcpAbsenceConflictDialog` ze szczegółami kolizji.
  - Zgodnie z prawem i standardami Starbucks: godziny z Fichajes mają pierwszeństwo operacyjne, a Store Manager otrzymuje rekomendację skorygowania wniosku urlopowego lub statusu ZUS.

---

## 🔮 3. Poniedziałkowy Flash Forecast (Pre-closing Projection)

W poniedziałek (dzień układania grafiku W+2), zanim zjadą wieczorne logowania MAPAL za ostatni dzień trwającego tygodnia:
1. System automatycznie domyka tydzień predykcją:
   - Godziny menedżerów pobierane są z grafiku Modułu 2 ($H_{\text{MGR}}$).
   - Godziny baristów dopełniają cel tygodnia:
     $$H_{\text{Bar}} = \max(0, \text{Cel} - \text{RCP}_{6\text{ dni}} - H_{\text{MGR}})$$
   - Transakcje szacowane są z planu AOP ($\text{Plan TRX} - \text{TRX}_{6\text{ dni}}$).
2. Tydzień oznaczany jest statusem `🔮 Pn est.` i włączany do MTD Velocity.
3. We wtorek po zaimportowaniu pliku Fichajes estymacja płynnie ustępuje rzeczywistym odbiciom.

---

## 🌉 4. Split-Week Cross-Month Bridge (Przełomy Miesięcy)

Gdy tydzień biznesowy (wtorek–poniedziałek) przekracza granicę miesięcy kalendarzowych:
- Silnik scala dni końcówki starego miesiąca (trailing) i początku nowego (leading) w spójny 7-dniowy grafik.
- Weryfikuje ochronę dobowego Floor Hours (32h) na styku miesięcy.
