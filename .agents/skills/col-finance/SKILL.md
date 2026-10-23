---
name: col-finance
description: >-
  Kontroler finansowy P&L i kosztów pracy Starbucks (Cost of Labor Suite - Moduł 4). Zarządza modelem
  trzech filarów (AOP, Cel, Estymacja MTD), formułami TOTAL COL %, TPLH Coverage/Total, narzutem ZUS 19.48%,
  symulacjami What-If oraz rozliczeniem załogi UoP i UZ.
---

# Kontroler Finansowy & Kosztów Pracy (COL Finance)

Skill odpowiada za analizę rentowności, kontrolę budżetu robocizny (Cost of Labor) oraz przygotowywanie raportów zarządczych dla Store Managera (SM) i District Managera (DM).

---

## 🏛️ 1. Model Trzech Filarów Finansowych

1. **🏛️ AOP (Roczny Plan Finansowy Centrali)**:
   - Oficjalny budżet jednostki `18120 Janki`: `Sales AOP`, `TRX AOP`, `TPLH AOP`, `Budżet Robocizny PLN` oraz `COL % AOP`.
2. **🎯 TARGET (Operacyjny Plan Miesiąca SM)**:
   - Cel sprzedaży i transakcji ustalony przez Store Managera.
   - Zaplanowane godziny menedżerów z grafiku (Moduł 2) oraz godziny załogi (UoP / UZ).
   - Wyliczenie `Target COL PLN` i `Target COL %`.
3. **⚡ ESTYMACJA (Dynamiczna Prognoza Domknięcia MTD)**:
   - Predykcja wykonania miesiąca na podstawie rzeczywistych transakcji, sprzedaży i logowań RCP.
   - Monitorowanie odchylenia vs AOP:
     $$\Delta_{\text{COL \%}} = \text{COL \% Estymacja} - \text{COL \% AOP}$$

---

## 🧮 2. Formuły Matematyczne i Wskaźniki Efektywności

### A. Wskaźniki Główne
- **TOTAL COL %**:
  $$\text{TOTAL COL \%} = \frac{\text{Całkowity Koszt Robocizny (PLN)}}{\text{Sprzedaż Netto (PLN)}} \times 100\%$$
- **TPLH Total (Transactions Per Labor Hour)**:
  $$\text{TPLH}_{\text{Total}} = \frac{\text{Liczba Transakcji}}{\text{Godziny Przepracowane (Menedżerowie + Załoga)}}$$
- **TPLH Coverage**:
  $$\text{TPLH}_{\text{Coverage}} = \frac{\text{Liczba Transakcji}}{\text{Godziny Pracy} - \text{Urlopy (H)} - \text{Szkolenia Non-Coverage}}$$

### B. Struktura Kosztów Płacowych
- **Narzut Pracodawcy (ZUS)**: **19.48%** (emerytalne 9.76%, rentowe 6.50%, wypadkowe, FP i FGŚP).
- **Załoga (Crew)**:
  - Umowa o Pracę (UoP): stawka brutto + ZUS 19.48% + rezerwa urlopowa.
  - Umowa Zlecenie (UZ / Studenci do 26 r.ż.): stawka godzinowa brutto = netto (zwolnienie z PIT i ZUS).
- **Menedżerowie**:
  - Dedykowane stawki godzinowe per rola (SM, ASM, SSV),
  - Premie kwartalne i bonusy za realizację wskaźników AOP.

---

## 🔬 3. Symulator Scenariuszy "What-If"

Przed podjęciem decyzji o dodaniu godzin lub cięciach w grafiku silnik umożliwia symulację:
- O ile wzrośnie `COL %`, jeśli dodamy 20 godzin baristycznych w weekend?
- Jaka musi być sprzedaż w piątek, aby utrzymać planowany cel `TPLH` przy pełnej obsadzie?
- Jaki wpływ na wynik finansowy ma zastąpienie zmiany menedżerskiej zmianą baristy?
