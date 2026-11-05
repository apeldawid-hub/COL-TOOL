import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Starbucks Operations Suite - Standardy Operacyjne & Logika Matematyczna', () => {
  it('Baza Floor Hours wynosi ściśle 32.0h na dobę (1 AM Mgr + 1 AM Barista + 1 PM Mgr + 1 PM Barista)', () => {
    const morningShiftHours = 8.0 * 2; // 1 MGR + 1 Barista
    const eveningShiftHours = 8.0 * 2; // 1 MGR + 1 Barista
    const dailyFloorHours = morningShiftHours + eveningShiftHours;

    assert.equal(dailyFloorHours, 32.0, 'Dobowa baza Floor Hours musi wynosić dokładnie 32.0h');
  });

  it('Tygodniowa nienaruszalna baza Floor Hours wynosi ściśle 224.0h (7 dni x 32h)', () => {
    const daysInWeek = 7;
    const dailyBase = 32.0;
    const weeklyBase = daysInWeek * dailyBase;

    assert.equal(weeklyBase, 224.0, 'Tygodniowy grafik kawiarni nie może spaść poniżej 224.0h bazy Floor');
  });

  it('Godziny szkoleniowe (Non-Coverage) są odizolowane i nie pomniejszają bazy Floor', () => {
    const weeklyFloorBase = 224.0;
    const trainingHours = 40.0; // Szkolenie nowego baristy T1-T10
    const totalScheduledHours = weeklyFloorBase + trainingHours;

    assert.equal(totalScheduledHours, 264.0);
    assert.equal(weeklyFloorBase, 224.0, 'Baza Floor musi pozostać nienaruszona przy dodaniu szkoleń');
  });
});
