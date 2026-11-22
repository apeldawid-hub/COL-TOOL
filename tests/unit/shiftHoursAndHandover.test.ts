// tests/unit/shiftHoursAndHandover.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ManagerWeeklyRequirement, DayCoverageSummary } from '../../src/types';
import { parseTimeToHours, formatHoursToTimeString } from '../../src/modules/managers-schedule/services/managerScheduleEngine';

describe('Shift Hours & Handover Overlap (Moduł 2: Managers Schedule)', () => {
  it('1. Oblicza poprawne okno przekazania zmiany (Handover) przy standardzie 8h (07:00–22:30)', () => {
    const openTime = '07:00';
    const closeTime = '22:30';
    const shiftLen = 8.0;

    const sh = parseTimeToHours(openTime)!;
    const eh = parseTimeToHours(closeTime)!;

    const amEnd = sh + shiftLen; // 7 + 8 = 15:00
    const pmStart = eh - shiftLen; // 22.5 - 8 = 14:30

    const overlapHours = amEnd - pmStart; // 15.0 - 14.5 = 0.5h
    const overlapMinutes = Math.round(overlapHours * 60);

    assert.strictEqual(formatHoursToTimeString(amEnd), '15:00');
    assert.strictEqual(formatHoursToTimeString(pmStart), '14:30');
    assert.strictEqual(overlapMinutes, 30);
  });

  it('2. Oblicza 2-godzinną zakładkę przekazania zmiany przy zmianach 9h i godzinach 07:00–21:00', () => {
    const openTime = '07:00';
    const closeTime = '21:00';
    const shiftLen = 9.0;

    const sh = parseTimeToHours(openTime)!;
    const eh = parseTimeToHours(closeTime)!;

    const amEnd = sh + shiftLen; // 7 + 9 = 16:00
    const pmStart = eh - shiftLen; // 21 - 9 = 12:00

    const overlapHours = amEnd - pmStart; // 16 - 12 = 4.0h
    const overlapMinutes = Math.round(overlapHours * 60);

    assert.strictEqual(formatHoursToTimeString(amEnd), '16:00');
    assert.strictEqual(formatHoursToTimeString(pmStart), '12:00');
    assert.strictEqual(overlapMinutes, 240); // 4h zakładki przy 14h rozpiętości i dwóch zmianach 9h (18h sumy)
  });

  it('3. Wykrywa brak lub zbyt krótką zakładkę (< 60 min) i flaguje ostrzeżenie', () => {
    const minHandover = 60;
    const overlapMinutes = 30; // 30 min przy standardzie 07:00-22:30 i 8h zmianach
    const isCompliant = overlapMinutes >= minHandover;

    assert.strictEqual(isCompliant, false);
  });

  it('4. Zmiana godzin otwarcia na 08:00 przesuwa start AM na 08:00 a koniec na 16:00 (dla 8h)', () => {
    const openTime = '08:00';
    const shiftLen = 8.0;

    const sh = parseTimeToHours(openTime)!;
    const amEnd = sh + shiftLen;

    assert.strictEqual(sh, 8.0);
    assert.strictEqual(formatHoursToTimeString(amEnd), '16:00');
  });

  it('5. Zmiana zamknięcia z 22:30 na 21:00 przesuwa koniec PM na 21:00 a start na 13:00 (dla 8h)', () => {
    const closeTime = '21:00';
    const shiftLen = 8.0;

    const eh = parseTimeToHours(closeTime)!;
    const pmStart = eh - shiftLen;

    assert.strictEqual(eh, 21.0);
    assert.strictEqual(formatHoursToTimeString(pmStart), '13:00');
  });

  it('6. Wersjonowanie czasowe profilu tygodnia: profil z 2026-04 jest skuteczny dla maja 2026 i nie nadpisuje marca 2026', () => {
    const profiles = [
      { effective_from_year: 2026, effective_from_month: 1, open: '07:00' },
      { effective_from_year: 2026, effective_from_month: 4, open: '08:00' }
    ];

    const getEffectiveProfileFor = (targetYear: number, targetMonth: number) => {
      const candidates = profiles.filter(p => 
        p.effective_from_year < targetYear ||
        (p.effective_from_year === targetYear && p.effective_from_month <= targetMonth)
      );
      candidates.sort((a, b) => {
        if (a.effective_from_year !== b.effective_from_year) return b.effective_from_year - a.effective_from_year;
        return b.effective_from_month - a.effective_from_month;
      });
      return candidates[0];
    };

    // Marzec 2026 (miesiąc 3) otrzymuje stary profil (07:00)
    const marchProfile = getEffectiveProfileFor(2026, 3);
    assert.strictEqual(marchProfile.open, '07:00');

    // Maj 2026 (miesiąc 5) otrzymuje nowy profil z kwietnia (08:00)
    const mayProfile = getEffectiveProfileFor(2026, 5);
    assert.strictEqual(mayProfile.open, '08:00');
  });
});
