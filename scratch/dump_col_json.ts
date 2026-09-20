import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer' });

const calcSheet = wb.Sheets['CALCULATOR'];

// Managers (Rows 3..17)
const managers: any[] = [];
for (let r = 3; r <= 17; r++) {
  const name = calcSheet[`I${r}`]?.v;
  if (!name && !calcSheet[`P${r}`]?.v && !calcSheet[`L${r}`]?.v) continue;
  managers.push({
    row: r,
    name: name ? String(name).trim() : '',
    position: calcSheet[`J${r}`]?.v ? String(calcSheet[`J${r}`]?.v).trim() : '',
    contractRatio: Number(calcSheet[`K${r}`]?.v || 0),
    baseSalary: Number(calcSheet[`L${r}`]?.v || 0),
    planWorkHours: Number(calcSheet[`M${r}`]?.v || 0),
    planSickHours: Number(calcSheet[`N${r}`]?.v || 0),
    planHolidayHours: Number(calcSheet[`O${r}`]?.v || 0),
    planBonus: Number(calcSheet[`P${r}`]?.v || 0),
    isDisability: calcSheet[`Q${r}`]?.v === 'Tak',
    estWorkHours: Number(calcSheet[`S${r}`]?.v || 0),
    estSickHours: Number(calcSheet[`T${r}`]?.v || 0),
    estHolidayHours: Number(calcSheet[`U${r}`]?.v || 0),
    estBonus: Number(calcSheet[`V${r}`]?.v || 0),
    storeCostRatio: Number(calcSheet[`W${r}`]?.v ?? 1),
    // Target calculations
    targetBasicSalary: Number(calcSheet[`AB${r}`]?.v || 0),
    targetBonus: Number(calcSheet[`AC${r}`]?.v || 0),
    targetSocialIns: Number(calcSheet[`AD${r}`]?.v || 0),
    targetFgspFp: Number(calcSheet[`AE${r}`]?.v || 0),
    targetEquivalent: Number(calcSheet[`AF${r}`]?.v || 0),
    targetPfron: Number(calcSheet[`AG${r}`]?.v || 0),
    targetCompBen: Number(calcSheet[`AH${r}`]?.v || 0),
    targetJpaAccrual: Number(calcSheet[`AI${r}`]?.v || 0),
    targetColTotal: Number(calcSheet[`AJ${r}`]?.v || 0),
    // Est calculations
    estBasicSalary: Number(calcSheet[`AY${r}`]?.v || 0),
    estBonusOut: Number(calcSheet[`AZ${r}`]?.v || 0),
    estSocialIns: Number(calcSheet[`BA${r}`]?.v || 0),
    estFgspFp: Number(calcSheet[`BB${r}`]?.v || 0),
    estEquivalent: Number(calcSheet[`BC${r}`]?.v || 0),
    estPfron: Number(calcSheet[`BD${r}`]?.v || 0),
    estCompBen: Number(calcSheet[`BE${r}`]?.v || 0),
    estJpaAccrual: Number(calcSheet[`BF${r}`]?.v || 0),
    estColTotal: Number(calcSheet[`BG${r}`]?.v || 0)
  });
}

// Crew UoP (Rows 22..40)
const crewUop: any[] = [];
for (let r = 22; r <= 40; r++) {
  const name = calcSheet[`I${r}`]?.v;
  if (!name && !calcSheet[`K${r}`]?.v) continue;
  crewUop.push({
    row: r,
    name: name ? String(name).trim() : '',
    position: calcSheet[`J${r}`]?.v ? String(calcSheet[`J${r}`]?.v).trim() : '',
    contractRatio: Number(calcSheet[`K${r}`]?.v || 0),
    hourlyRate: Number(calcSheet[`L${r}`]?.v || 0),
    planWorkHours: Number(calcSheet[`M${r}`]?.v || 0),
    planSickHours: Number(calcSheet[`N${r}`]?.v || 0),
    planHolidayHours: Number(calcSheet[`O${r}`]?.v || 0),
    isDisability: calcSheet[`Q${r}`]?.v === 'Tak',
    estWorkHours: Number(calcSheet[`S${r}`]?.v || 0),
    estSickHours: Number(calcSheet[`T${r}`]?.v || 0),
    estHolidayHours: Number(calcSheet[`U${r}`]?.v || 0),
    estBonus: Number(calcSheet[`V${r}`]?.v || 0),
    targetBasicSalary: Number(calcSheet[`AB${r}`]?.v || 0),
    targetSocialIns: Number(calcSheet[`AD${r}`]?.v || 0),
    targetFgspFp: Number(calcSheet[`AE${r}`]?.v || 0),
    targetEquivalent: Number(calcSheet[`AF${r}`]?.v || 0),
    targetPfron: Number(calcSheet[`AG${r}`]?.v || 0),
    targetColTotal: Number(calcSheet[`AJ${r}`]?.v || 0),
    estBasicSalary: Number(calcSheet[`AY${r}`]?.v || 0),
    estSocialIns: Number(calcSheet[`BA${r}`]?.v || 0),
    estFgspFp: Number(calcSheet[`BB${r}`]?.v || 0),
    estEquivalent: Number(calcSheet[`BC${r}`]?.v || 0),
    estPfron: Number(calcSheet[`BD${r}`]?.v || 0),
    estColTotal: Number(calcSheet[`BG${r}`]?.v || 0)
  });
}

// Crew UZ (Rows 44..65)
const crewUz: any[] = [];
for (let r = 44; r <= 65; r++) {
  const name = calcSheet[`I${r}`]?.v;
  if (!name && !calcSheet[`L${r}`]?.v) continue;
  crewUz.push({
    row: r,
    name: name ? String(name).trim() : '',
    position: calcSheet[`J${r}`]?.v ? String(calcSheet[`J${r}`]?.v).trim() : '',
    hourlyRate: Number(calcSheet[`L${r}`]?.v || 0),
    planWorkHours: Number(calcSheet[`M${r}`]?.v || 0),
    estWorkHours: Number(calcSheet[`S${r}`]?.v || 0),
    bonus: Number(calcSheet[`V${r}`]?.v || 0),
    targetColTotal: Number(calcSheet[`AJ${r}`]?.v || 0),
    estColTotal: Number(calcSheet[`BG${r}`]?.v || 0)
  });
}

// Other costs (Rows 67..76)
const otherCosts: any[] = [];
for (let r = 67; r <= 76; r++) {
  const label = calcSheet[`I${r}`]?.v;
  otherCosts.push({
    row: r,
    label: label ? String(label).trim() : '',
    planVal: Number(calcSheet[`P${r}`]?.v || 0),
    estVal: Number(calcSheet[`S${r}`]?.v || 0),
    targetColTotal: Number(calcSheet[`AJ${r}`]?.v || 0),
    estColTotal: Number(calcSheet[`BG${r}`]?.v || 0),
    extra: {
      J: calcSheet[`J${r}`]?.v,
      K: calcSheet[`K${r}`]?.v,
      L: calcSheet[`L${r}`]?.v,
      M: calcSheet[`M${r}`]?.v,
      N: calcSheet[`N${r}`]?.v,
      T: calcSheet[`T${r}`]?.v
    }
  });
}

const extracted = {
  managers,
  crewUop,
  crewUz,
  otherCosts
};

fs.writeFileSync('scratch/extracted_col_defaults.json', JSON.stringify(extracted, null, 2));
console.log('Successfully dumped defaults:');
console.log(`- Managers: ${managers.length}`);
console.log(`- Crew UoP: ${crewUop.length}`);
console.log(`- Crew UZ: ${crewUz.length}`);
console.log(`- Other costs: ${otherCosts.length}`);
