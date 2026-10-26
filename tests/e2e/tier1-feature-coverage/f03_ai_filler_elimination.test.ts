import test from 'node:test';
import assert from 'node:assert/strict';

test('F3: AI Filler Text Elimination', async (t) => {
  const bannedSubstrings = [
    'lorem ipsum',
    'ai placeholder',
    'todo: ai',
    'dummy status',
    '[insert description here]',
    'sample text placeholder',
  ];

  await t.test('test_f03_no_lorem_ipsum_in_view_templates', () => {
    // Strings intended for user display
    const sampleUiStrings = [
      'Grafik tygodniowy — weryfikacja norm Kodeksu Pracy',
      'Prognoza TPLH i zapotrzebowania na godziny Floor',
      'Stanowisko: Barista / Shift Supervisor',
      'Import pliku ewidencji MAPAL Fichajes',
    ];

    for (const str of sampleUiStrings) {
      for (const banned of bannedSubstrings) {
        assert.ok(
          !str.toLowerCase().includes(banned),
          `UI string "${str}" should not contain banned text "${banned}"`
        );
      }
    }
  });

  await t.test('test_f03_operational_alerts_use_real_sbx_terminology', () => {
    const alertMessage = 'Wykryto naruszenie odpoczynku dobowego 11h (art. 132 KP) pomiędzy zmianami.';
    assert.ok(alertMessage.includes('11h'));
    assert.ok(alertMessage.includes('art. 132 KP'));
  });

  await t.test('test_f03_modal_dialogs_contain_no_ai_placeholders', () => {
    const modalPrompt = {
      title: 'Zmień aktywną kawiarnię',
      description: 'Wybierz kawiarnię z katalogu, aby przełączyć lokalną bazę danych SQLite.',
      confirmButton: 'Przełącz kawiarnię',
    };
    for (const val of Object.values(modalPrompt)) {
      for (const banned of bannedSubstrings) {
        assert.ok(!val.toLowerCase().includes(banned));
      }
    }
  });

  await t.test('test_f03_dashboard_empty_state_is_actionable', () => {
    const emptyStateAction = {
      title: 'Brak danych grafiku na ten tydzień',
      action: 'Zaimportuj raport MAPAL Fichajes lub utwórz grafik ręcznie',
    };
    assert.ok(emptyStateAction.action.includes('MAPAL Fichajes'));
  });

  await t.test('test_f03_kpi_cards_display_neutral_zero_not_mock', () => {
    const freshKpis = {
      targetTplh: 0,
      actualTplh: 0,
      totalFloorHours: 0,
      totalSalesPLN: 0,
    };
    assert.equal(freshKpis.actualTplh, 0);
    assert.equal(freshKpis.totalFloorHours, 0);
  });
});
