# Starbucks Operations Suite (Desktop Application)

Nowoczesna aplikacja desktopowa wspierająca zarządzanie operacyjne kawiarnią **108120 SBX Warszawa Janki** (Kod lokalu: `384`).

---

## 🧭 Architektura Modułowa

Aplikacja składa się z dedykowanych, autonomicznych modułów operacyjnych z przełącznikiem w nagłówku:

### 1. [Moduł 1: TPLH Forecast & Labor Balancing](./src/modules/labor-forecast/README.md)
- Prognozowanie robocizny i transakcji na bazie planów AOP (2021–2036).
- Predykcja MTD Trend Velocity i wyliczanie wypracowanego budżetu robocizny (Earned Labor).
- Ochrona Floor Hours: **32.0 h/dzień (272.0 h/tydzień)**.
- Import raportów MAPAL Fichajes oraz przeglądarka ewidencji logowań z podwójnym widokiem i 2-arkuszowym eksportem Excel.
- Rytm planowania poniedziałkowego (W+1 opublikowany, W+2 docelowy).

### 2. [Moduł 2: Managers Schedule — Grafik Managerski](./src/modules/managers-schedule/README.md)
- Interaktywna matryca miesięczna dla zespołu zarządzającego kawiarni (SM, ASM, SSV).
- Szybki selektor 25 kodów zmian Starbucks z podziałem na *Coverage*, *Non-Coverage*, *Dni wolne/urlopy* i *Dyspozycje*.
- Automatyczny kalkulator Kodeksu Pracy (dni robocze, norma etatu, required OFF days, święta ruchome, art. 130 § 2 KP).
- Dynamiczny bilans godzin (+/- h), licznik dni wolnych `OFF` oraz wskaźnik bezpieczeństwa obsady (AM / PM).
- Wiersz ważnych wydarzeń operacyjnych (promocje, audyty, wsparcia).
- Zarządzanie zespołem oraz generator eksportu do Excela (`.xlsx`).

---

## 🛠️ Stos Technologiczny

- **Desktop Framework**: Electron 34+
- **Bundler & Dev Server**: Vite 8+
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Baza Danych**: SQLite (`sql.js` WebAssembly) z trwałą persystencją w `data/tplh_forecast.db`
- **Import/Eksport**: SheetJS (`xlsx`)

---

## 🚀 Uruchamianie

```bash
# Instalacja zależności
npm install

# Uruchomienie aplikacji w trybie deweloperskim
npm run dev

# Kompilacja produkcyjna
npm run build
```

---

## 📚 Dokumentacja dla Agentów AI

- **Główny rejestr architektoniczny**: [AGENTS.md](./AGENTS.md)
- **Instrukcje Modułu 1**: [src/modules/labor-forecast/AGENTS.md](./src/modules/labor-forecast/AGENTS.md)
- **Instrukcje Modułu 2**: [src/modules/managers-schedule/AGENTS.md](./src/modules/managers-schedule/AGENTS.md)
