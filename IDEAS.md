# Pomysły Rozwojowe (Inspiracje od Twórców AI)

Notatki z przeglądu rozwiązań pod kątem Starbucks Operations Suite (COL Tool: TPLH & Grafik Managerski):

### 1. Weryfikacja Kodeksu Pracy i Reguł Obsady przez Lekki Model (LLM)
- **Źródła / Inspiracje:** David Ondrej, overment
- **Koncepcja:** Przekazywanie wygenerowanej siatki grafiku w JSON/tabeli do małego modelu (np. Claude 3.5 Haiku / Gemini Flash), który w 2 sekundy weryfikuje odpoczynek dobowy (11h), odpoczynek tygodniowy (35h), 4. niedzielę wolną i zgodność z normą etatu.
- **Zastosowanie w projekcie:** Moduł *Managers Schedule* – automatyczny audytor grafiku przed publikacją w W+1/W+2.

### 2. Inteligentny Parser i Analityk Raportów Zewnętrznych (MAPAL Fichajes / AOP)
- **Źródła / Inspiracje:** Robert Szewczyk, The AI Advantage
- **Koncepcja:** Zamiast sztywnych skryptów importu podatnych na zmiany układu arkuszy, asystent analizujący zrzuty z systemów kasowych/kadrowych i wychwytujący anomalie.
- **Zastosowanie w projekcie:** Moduł *TPLH Forecast* – automatyczne podsumowanie: *"W czwartek odchylenie -4.2h od earned labor, trend MTD na poziomie 98%"*.

### 3. Zwięzłe Podsumowania Operacyjne dla Store Managera (One-Click Briefing)
- **Źródła / Inspiracje:** Biznes z AI (Paweł Lewiński), Jan Gulczyński
- **Koncepcja:** Szablon generujący cotygodniowy lub comiesięczny raport zarządczy w zwięzłej tabeli na bazie danych z lokalnej bazy SQLite.
- **Zastosowanie w projekcie:** Błyskawiczny raport gotowy do wysłania do kierownictwa kawiarni lub zespołu managerskiego.
