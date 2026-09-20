import * as xlsxModule from 'xlsx';
import fs from 'fs';
import { DatabaseManager } from '../database/db';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

export interface ImportResult {
  success: boolean;
  importedCount: number;
  replacedCount?: number;
  minDate?: string;
  maxDate?: string;
  message: string;
}

export class MapalParser {
  /**
   * Parsowanie i idempotentny import pliku raportu MAPAL (.xls / .xlsx)
   */
  public static async parseAndImport(
    fileBufferOrPath: Buffer | string
  ): Promise<ImportResult> {
    try {
      let buffer: Buffer;

      if (typeof fileBufferOrPath === 'string') {
        buffer = fs.readFileSync(fileBufferOrPath);
      } else {
        buffer = fileBufferOrPath;
      }

      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return { success: false, importedCount: 0, message: 'Brak arkuszy w wybranym pliku Excel.' };
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
      });

      if (rawRows.length < 8) {
        return {
          success: false,
          importedCount: 0,
          message: 'Plik nie zawiera oczekiwanych danych logowań (mniej niż 8 wierszy).'
        };
      }

      const dbManager = DatabaseManager.getInstance();
      const db = dbManager.getDb();

      // Pobranie menedżerów kawiarni Janki w celu uwzględnienia ich godzin również z innych lokali (wsparcia)
      const managerNames: string[] = [];
      try {
        const mgrStmt = db.prepare('SELECT name FROM manager_employees WHERE is_active = 1');
        while (mgrStmt.step()) {
          const row = mgrStmt.getAsObject();
          if (row.name) {
            managerNames.push(String(row.name).trim());
          }
        }
        mgrStmt.free();
      } catch (e) {
        console.warn('Nie udało się pobrać listy menedżerów:', e);
      }

      const normalizeName = (str: string): string[] => {
        return str
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[,.-]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
          .sort();
      };

      const matchesManagerName = (excelEmpName: string, mgrName: string): boolean => {
        const tokensExcel = normalizeName(excelEmpName);
        const tokensMgr = normalizeName(mgrName);
        if (tokensExcel.length === 0 || tokensMgr.length === 0) return false;
        return tokensMgr.every(t => tokensExcel.includes(t));
      };

      // Parser czyta dane od wiersza 8 (indeks 7), omijając nagłówki w wierszu 6 i pusty wiersz 7
      const validRecords: Array<{
        date: string;
        year: number;
        month: string;
        week: string;
        week_key: string;
        day_of_week: string;
        employee: string;
        category: string;
        contract_type: string;
        computable_time: number;
        unit_code: string;
        unit_name: string;
      }> = [];

      const datesFound: string[] = [];

      const monthNames = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];
      const daysMap = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];

      for (let r = 7; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length < 9) continue;

        // Kolumny według formatu eksportu MAPAL Fichajes:
        // index 14: Unit ('108120 SBX Warszawa Janki')
        // index 13: Business Unit Code ('384')
        // index 8:  Computable Time (godziny pracy)
        // index 5:  Business Day (data)
        // index 2:  Employee
        // index 3:  Category
        // index 4:  Contract Type
        const unitName = String(row[14] || '');
        const unitCode = String(row[13] || '');
        const empName = String(row[2] || '').trim();

        const isJanki = unitName.includes('108120') || 
                        unitName.toLowerCase().includes('janki') || 
                        unitCode.includes('384');

        const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

        // Uwzględniamy wszystkie logowania z lokalu Janki ORAZ logowania naszych menedżerów z dowolnych lokali
        if (!isJanki && !isManager) continue;

        // Konwersja daty (obsługa liczby serial z Excela lub stringa)
        const dateVal = row[5];
        let dateNormalized = '';
        let year = 2026;
        let monthIdx = 8;
        let dayOfMonth = 1;
        let dayOfWeek = 'Pn';

        if (typeof dateVal === 'number') {
          const parsed = XLSX.SSF.parse_date_code(dateVal);
          if (parsed) {
            year = parsed.y;
            monthIdx = parsed.m - 1;
            dayOfMonth = parsed.d;
            dateNormalized = `${year}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
            const jsDate = new Date(year, monthIdx, dayOfMonth);
            dayOfWeek = daysMap[jsDate.getDay()];
          }
        } else if (typeof dateVal === 'string') {
          const dateStr = dateVal.trim();
          if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              dateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              const jsDate = new Date(dateNormalized);
              year = jsDate.getFullYear();
              monthIdx = jsDate.getMonth();
              dayOfMonth = jsDate.getDate();
              dayOfWeek = daysMap[jsDate.getDay()];
            }
          } else if (dateStr.includes('-')) {
            dateNormalized = dateStr;
            const jsDate = new Date(dateNormalized);
            year = jsDate.getFullYear();
            monthIdx = jsDate.getMonth();
            dayOfMonth = jsDate.getDate();
            dayOfWeek = daysMap[jsDate.getDay()];
          }
        }

        if (!dateNormalized) continue;

        const compTimeRaw = row[8];
        const compTime = typeof compTimeRaw === 'number' 
          ? compTimeRaw 
          : parseFloat(String(compTimeRaw || '0').replace(',', '.'));

        if (isNaN(compTime) || compTime <= 0) continue;

        const category = String(row[3] || '').trim();
        const contractType = String(row[4] || '').trim();
        const month = monthNames[monthIdx] || 'Wrzesień';

        // Dopasowanie tygodnia w miesiącu (W1..W5/W6)
        let weekNum = 'W1';
        if (dayOfMonth > 28) weekNum = 'W5';
        else if (dayOfMonth > 21) weekNum = 'W4';
        else if (dayOfMonth > 14) weekNum = 'W3';
        else if (dayOfMonth > 7) weekNum = 'W2';

        const weekKey = `${year}_${month}_${weekNum}`;

        datesFound.push(dateNormalized);
        validRecords.push({
          date: dateNormalized,
          year,
          month,
          week: weekNum,
          week_key: weekKey,
          day_of_week: dayOfWeek,
          employee: empName,
          category,
          contract_type: contractType,
          computable_time: Number(compTime.toFixed(2)),
          unit_code: unitCode || '384',
          unit_name: unitName || '108120 SBX Warszawa Janki'
        });
      }

      if (validRecords.length === 0) {
        return {
          success: false,
          importedCount: 0,
          message: 'W wybranym raporcie nie znaleziono żadnych wpisów dla kawiarni 108120 SBX Warszawa Janki (kod: 384).'
        };
      }

      datesFound.sort();
      const minDate = datesFound[0];
      const maxDate = datesFound[datesFound.length - 1];

      // Sprawdzenie ile dotychczasowych wpisów istnieje w bazie dla tego zakresu dat
      let previousCount = 0;
      try {
        const countStmt = db.prepare(`
          SELECT COUNT(*) as cnt FROM labor_actuals_log 
          WHERE (unit_code = '384' OR unit_name LIKE '%108120%')
            AND date >= ? AND date <= ?
        `);
        countStmt.bind([minDate, maxDate]);
        if (countStmt.step()) {
          const row = countStmt.getAsObject();
          previousCount = Number(row.cnt || 0);
        }
        countStmt.free();
      } catch (e) {
        console.warn('Nie udało się pobrać liczby poprzednich wpisów:', e);
      }

      // Idempotencja: usunięcie wcześniejszych wpisów dla lokalu 384 w danym przedziale dat
      const deleteStmt = db.prepare(`
        DELETE FROM labor_actuals_log 
        WHERE (unit_code = '384' OR unit_name LIKE '%108120%')
          AND date >= ? AND date <= ?
      `);
      deleteStmt.run([minDate, maxDate]);
      deleteStmt.free();

      // Usunięcie również wpisów z obcych lokali dla menedżerów w tym przedziale dat
      for (const mName of managerNames) {
        const tokens = normalizeName(mName);
        for (const token of tokens) {
          if (token.length >= 4) {
            const delMgrStmt = db.prepare(`
              DELETE FROM labor_actuals_log
              WHERE unit_code != '384'
                AND date >= ? AND date <= ?
                AND UPPER(employee) LIKE ?
            `);
            delMgrStmt.run([minDate, maxDate, `%${token.toUpperCase()}%`]);
            delMgrStmt.free();
          }
        }
      }

      // Wstawienie nowych rekordów
      const insertStmt = db.prepare(`
        INSERT INTO labor_actuals_log
        (date, year, month, week, week_key, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const rec of validRecords) {
        insertStmt.run([
          rec.date,
          rec.year,
          rec.month,
          rec.week,
          rec.week_key,
          rec.day_of_week,
          rec.employee,
          rec.category,
          rec.contract_type,
          rec.computable_time,
          rec.unit_code,
          rec.unit_name
        ]);
      }
      insertStmt.free();

      dbManager.persist();

      const message = previousCount > 0
        ? `Pomyślnie zaktualizowano logowania: zastąpiono ${previousCount} dotychczasowych wpisów i zapisano ${validRecords.length} aktualnych rekordów dla kawiarni Janki (zakres: ${minDate} – ${maxDate}).`
        : `Pomyślnie zaimportowano ${validRecords.length} nowych logowań dla kawiarni Janki w zakresie od ${minDate} do ${maxDate}.`;

      return {
        success: true,
        importedCount: validRecords.length,
        replacedCount: previousCount,
        minDate,
        maxDate,
        message
      };
    } catch (err: any) {
      console.error('Błąd importu MAPAL:', err);
      return {
        success: false,
        importedCount: 0,
        message: `Błąd przetwarzania raportu: ${err.message || String(err)}`
      };
    }
  }
}
