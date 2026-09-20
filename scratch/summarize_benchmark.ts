import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmark_results_jan_aug_2026.json'), 'utf-8'));

console.log('=== ZESTAWIENIE GLOBALNE 8 MIESIĘCY (STYCZEŃ - SIERPIEŃ 2026) ===');

let totalHistH = 0;
let totalAiH = 0;
let totalHistClosings = 0;
let totalAiClosings = 0;
let totalHistMids = 0;
let totalAiMids = 0;
let totalHistConsecutiveOff = 0;
let totalAiConsecutiveOff = 0;
let totalHistIsolatedOff = 0;
let totalAiIsolatedOff = 0;
let totalHistViolations = 0;
let totalAiViolations = 0;

// Analiza per pracownik (np. Gabi, Kamil, Aleksandra, Dawid)
const empClosingHist: Record<string, number> = {};
const empClosingAi: Record<string, number> = {};
const empBalanceDeltas: Record<string, number[]> = {};

data.forEach((m: any) => {
  totalHistH += m.historical.totalHours;
  totalAiH += m.ai.totalHours;
  totalHistClosings += m.historical.closingCount;
  totalAiClosings += m.ai.closingCount;
  totalHistMids += m.historical.midCount;
  totalAiMids += m.ai.midCount;
  totalHistConsecutiveOff += m.historical.consecutiveOffBlocks;
  totalAiConsecutiveOff += m.ai.consecutiveOffBlocks;
  totalHistIsolatedOff += m.historical.isolatedSingleOff;
  totalAiIsolatedOff += m.ai.isolatedSingleOff;
  totalHistViolations += (m.historical.violations11h + m.historical.violations35h + m.historical.violationsSunday);
  totalAiViolations += m.ai.violationsCount;

  m.historical.empStats.forEach((e: any) => {
    empClosingHist[e.name] = (empClosingHist[e.name] || 0) + e.closings;
  });

  m.ai.empStats.forEach((e: any) => {
    empClosingAi[e.name] = (empClosingAi[e.name] || 0) + e.closings;
    if (!empBalanceDeltas[e.name]) empBalanceDeltas[e.name] = [];
    empBalanceDeltas[e.name].push(e.balance);
  });
});

console.log(`Łączne zaplanowane godziny: Historyczne = ${totalHistH}h vs AI = ${totalAiH}h (Delta: +${Number((totalAiH - totalHistH).toFixed(1))}h dociążenia do pełnych norm etatowych)`);
console.log(`Pakiety wypoczynkowe 2x OFF: Historyczne = ${totalHistConsecutiveOff} vs AI = ${totalAiConsecutiveOff}`);
console.log(`Pojedyncze rozbite OFF (izolowane): Historyczne = ${totalHistIsolatedOff} vs AI = ${totalAiIsolatedOff}`);
console.log(`Zmiany środkowe (MID/MIB): Historyczne = ${totalHistMids} vs AI = ${totalAiMids}`);
console.log('\n--- ROZKŁAD ZAMKNIĘĆ (PM) PER MENEDŻER (8 MIESIĘCY) ---');
Object.keys(empClosingHist).forEach(name => {
  console.log(`${name.padEnd(25)}: Historycznie = ${String(empClosingHist[name]).padStart(2)} PM  |  AI = ${String(empClosingAi[name] || 0).padStart(2)} PM`);
});

console.log('\n--- PRECYZJA BILANSU GODZINOWEGO AI (ODCHYLENIA OD NORMY ETATU) ---');
Object.keys(empBalanceDeltas).forEach(name => {
  const deltas = empBalanceDeltas[name];
  const avg = Number((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1));
  console.log(`${name.padEnd(25)}: Średnia delta m/m = ${avg > 0 ? '+' : ''}${avg}h  (Wartości: ${deltas.join(', ')})`);
});
