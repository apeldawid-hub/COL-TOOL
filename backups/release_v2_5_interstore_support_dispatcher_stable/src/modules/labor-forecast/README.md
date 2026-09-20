# Moduł 1: TPLH Forecast & Labor Balancing (Starbucks)

Autonomiczny moduł prognozowania robocizny, transakcji oraz bezpiecznego balansowania godzin kawiarni **108120 SBX Warszawa Janki** (Kod jednostki: 384).

---

## 🎯 Główne Funkcjonalności

1. **Planowanie Bazowe AOP (2021–2036)**:
   - Miesięczne i roczne budżety robocizny wyliczane ze wzoru $\text{TRX} / \text{Cel TPLH}$.
   - Automatyczne rozbicie na tygodnie biznesowe (W1–W5) w cyklu wtorek–poniedziałek z wagami dniowymi.
2. **Silnik Predykcyjny Trend Velocity (MTD)**:
   - Analiza tempa realizacji sprzedaży w zamkniętych tygodniach miesiąca.
   - Dynamiczna prognoza końcowa sprzedaży i wypracowanego budżetu robocizny (Earned Labor).
3. **Złota Reguła Bezpieczeństwa Floor Hours**:
   - Blokada spadku grafiku poniżej poziomu bezpieczeństwa: **32.0 h/dzień** (Pn–Sob 40h, Nd 32h -> **272.0 h/tydzień**).
   - Inteligentne alerty operacyjne dla Store Managera (SM) i District Managera (DM).
4. **Ewidencja Logowań MAPAL Fichajes**:
   - Bezpośredni import plików raportów `.xls` i `.xlsx` z systemu MAPAL.
   - Podgląd z podwójnym widokiem: *Lista Zmian* oraz *Zestawienie Pracowników*.
   - Wielopoziomowe filtry i dwuarkuszowy eksport do Excela.
5. **Rytm Planowania Poniedziałkowego (Planning Cadence)**:
   - Automatyczne wyznaczanie tygodnia opublikowanego (W+1) oraz docelowego tygodnia planowania (W+2).
   - Licznik dni pozostałych do poniedziałkowego zatwierdzenia grafiku.
6. **Integracja z Grafikiem Managerskim (Manager Labor Bridge)**:
   - **Kalkulator Puli Baristów**: Odliczenie godzin zaplanowanych dla kierowników od rekomendacji HANW / Planu AOP ($H_{\text{Barista Pool}} = \text{Target} - H_{\text{MGR}}$).
   - **Asystent w kolumnie Grafik (h)**: Podział ułożonego grafiku na $H_{\text{MGR}}$ + $H_{\text{BAR}}$ oraz przycisk szybkiego dodawania godzin MGR.
   - **Inspekcja Floor Hours i obsady AM/PM (`ManagerLaborBridgeModal`)**: Dobowa kontrola obecności kierowników na otwarciach i zamknięciach oraz deficyt baristyczny do minimum 32.0 h/dzień.
   - **Kontrola budżetu Non-Coverage**: Weryfikacja godzin administracyjnych kierowników z limitem `nc_rules`.

---

## 📦 Zależności i Uruchomienie

Moduł jest włączany w głównym oknie aplikacji za pomocą przełącznika `TPLH Forecast` w nagłówku.

```bash
# Uruchomienie deweloperskie
npm run dev

# Kompilacja produkcyjna
npm run build
```

Szczegółowe wytyczne techniczne dla agentów AI znajdują się w pliku [AGENTS.md](./AGENTS.md).
