# Kopia Zapasowa: Release v2.3 Clean Panoramic Layout & Floating Starbucks Speed-Dial

**Data utworzenia**: 2026-09-15
**Katalog**: `backups/release_v2_3_clean_layout_speed_dial_stable/`

---

### 🌟 Kluczowe Usprawnienia i Architektura Tej Wersji

1. **Widżety i Kafelki KPI na Dole**:
   - Karty metryk (Norma Miesiąca, Godziny Zespołu, Średnie Pokrycie, Min. Dni Wolnych, Obsada AM/PM, Kodeks Pracy) zostały przeniesione pod główną siatkę grafiku, dzięki czemu grafik startuje bezpośrednio od góry ekranu.

2. **Zwięzły Kalendarz Miesiąca na Samej Górze**:
   - Na samej górze widoku znajduje się wyłącznie przejrzysty pasek informacyjny: Dni robocze, Dni wolne, Niedziele Handlowe (`🛒 DD.MM`) oraz Święta państwowe (`🇵🇱 DD.MM Nazwa`).

3. **Floating Starbucks Speed-Dial Navigation Hub (`AutoScheduleWidget.tsx`)**:
   - Pływające logo Starbucks w prawym dolnym rogu z rozwijanym menu mini-ikonek:
     - Nawigacja miesięcy (`‹` LM, `[ Wrzesień 2026 ]` MTD, `›` NM).
     - Szybkie akcje: `Auto AI` (20 000 prób solvera z radialnym wskaźnikiem zegarowym), `Dyspo` (Zbiorcza matryca i Smart Paste), `TOR` (Szybki toggle Grafik ↔ TOR), `Wersje` (Historia i publikacja 7 dni KP), `Eksport .xlsx` oraz `Odśwież`.

4. **100% Full-Width Panoramic Workspace**:
   - Rozszerzenie całego kontenera roboczego do pełnej szerokości ekranu (`w-full max-w-none`) bez zbędnych marginesów i toolbarów.
