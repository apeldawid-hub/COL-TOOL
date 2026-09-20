import * as XLSX from 'xlsx';
import { ManagerScheduleMonthData, TorQuarterData } from '../../../types';
import { formatManagerRole } from './managerScheduleEngine';

export class ManagerExcelExport {
  public static exportToExcel(data: ManagerScheduleMonthData): void {
    const wb = XLSX.utils.book_new();

    const headers1: string[] = ['Etat', 'MANAGER', 'Pozycja'];
    const headers2: string[] = ['', '', ''];

    for (const d of data.daySummaries) {
      headers1.push(String(d.day));
      headers2.push(d.dayName);
    }

    headers1.push('Dni OFF', 'Godziny wypracowane', 'Norma KP', 'Pokrycie %', 'Bilans (+/- h)');
    headers2.push('', '', '', '', '');

    const rows: (string | number)[][] = [];

    // Tytuł raportu
    rows.push([`GRAFIK MANAGERSKI - ${data.monthName.toUpperCase()} ${data.year}`]);
    rows.push([`Kawiarnia: 108120 SBX Warszawa Janki (Unit: 384)`]);
    rows.push([`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`]);
    rows.push([]); // Pusty wiersz

    // Nagłówki tabeli
    rows.push(headers1);
    rows.push(headers2);

    // Wiersze menedżerów
    for (const r of data.rows) {
      const rowData: (string | number)[] = [
        r.employee.contract_type,
        r.employee.name,
        formatManagerRole(r.employee.role)
      ];

      for (let day = 1; day <= data.totalDays; day++) {
        const s = r.shifts[day];
        rowData.push(s ? s.shift_code : 'OFF');
      }

      rowData.push(
        r.totalOffDays,
        r.totalWorkedHours,
        r.nominalHours,
        `${r.coveragePercent}%`,
        r.balanceHours >= 0 ? `+${r.balanceHours}` : `${r.balanceHours}`
      );

      rows.push(rowData);
    }

    // Wiersz Ważne wydarzenia
    rows.push([]);
    const eventsRow: (string | number)[] = ['Ważne wydarzenia', '', ''];
    for (const d of data.daySummaries) {
      eventsRow.push(d.eventText || '');
    }
    rows.push(eventsRow);

    // Wiersz Podsumowanie obsady (Liczba pracujących)
    const coverageRow: (string | number)[] = ['Obsada (Liczba menedżerów)', '', ''];
    for (const d of data.daySummaries) {
      coverageRow.push(d.totalManagersWorking);
    }
    rows.push(coverageRow);

    // Wiersz Otwarcia AM
    const openRow: (string | number)[] = ['Otwarcie (AM)', '', ''];
    for (const d of data.daySummaries) {
      openRow.push(d.openingManagers.join(', ') || 'BRAK');
    }
    rows.push(openRow);

    // Wiersz Zamknięcia PM
    const closeRow: (string | number)[] = ['Zamknięcie (PM)', '', ''];
    for (const d of data.daySummaries) {
      closeRow.push(d.closingManagers.join(', ') || 'BRAK');
    }
    rows.push(closeRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Szerokości kolumn
    const colWidths: { wch: number }[] = [
      { wch: 10 }, // Etat
      { wch: 24 }, // Manager
      { wch: 12 }, // Pozycja (SM, ASM, SSV)
    ];
    for (let i = 0; i < data.totalDays; i++) {
      colWidths.push({ wch: 6 }); // Kolumny dni
    }
    colWidths.push(
      { wch: 10 }, // Dni OFF
      { wch: 16 }, // Wypracowane
      { wch: 12 }, // Norma
      { wch: 12 }, // Pokrycie %
      { wch: 14 }  // Bilans
    );
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, `Grafik ${data.monthName}`);

    // Zapis pliku
    const fileName = `Grafik_Managerski_${data.monthName}_${data.year}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Eksport kwartalnego rozliczenia TOR do pliku Excel (.xlsx)
   */
  public static exportTorToExcel(tor: TorQuarterData): void {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [];

    // Tytuł
    rows.push([`Trzymiesięczny Okres Rozliczeniowy (TOR) — ${tor.quarterName} ${tor.year}`]);
    rows.push([`Kawiarnia 108120 SBX Warszawa Janki (Unit 18120)`]);
    rows.push([]);

    // Wiersz nagłówków nadrzędnych miesięcy
    const mHeader: (string | number)[] = ['MANAGER', 'ETAT'];
    tor.monthNames.forEach((mName, idx) => {
      mHeader.push(`--- ${mName.toUpperCase()} (Norma 100%: ${tor.monthNorms[idx]}h) ---`);
      mHeader.push('', '', '');
    });
    mHeader.push('--- PODSUMOWANIE KWARTAŁU ---', '', '', '', '');
    rows.push(mHeader);

    // Wiersz nagłówków kolumn
    const colHeader: (string | number)[] = ['MANAGER', 'ETAT'];
    tor.monthNames.forEach(() => {
      colHeader.push('RCP (h)', 'H (h)', 'L4 (h)', 'BILANS');
    });
    colHeader.push(
      tor.monthNames[0].substring(0, 3).toUpperCase(),
      tor.monthNames[1].substring(0, 3).toUpperCase(),
      tor.monthNames[2].substring(0, 3).toUpperCase(),
      'TOTAL BILANS',
      'STATUS'
    );
    rows.push(colHeader);

    // Wiersze menedżerów
    for (const r of tor.rows) {
      const rowVals: (string | number)[] = [r.employee.name, r.employee.contract_type];

      for (const m of r.months) {
        if (!m.isActiveInMonth) {
          rowVals.push('-', '-', '-', '-');
        } else {
          rowVals.push(
            m.rcpHours,
            m.hHours,
            m.l4Hours,
            m.balanceHours >= 0 ? `+${m.balanceHours}` : `${m.balanceHours}`
          );
        }
      }

      rowVals.push(
        r.months[0].isActiveInMonth ? (r.months[0].balanceHours >= 0 ? `+${r.months[0].balanceHours}` : `${r.months[0].balanceHours}`) : '-',
        r.months[1].isActiveInMonth ? (r.months[1].balanceHours >= 0 ? `+${r.months[1].balanceHours}` : `${r.months[1].balanceHours}`) : '-',
        r.months[2].isActiveInMonth ? (r.months[2].balanceHours >= 0 ? `+${r.months[2].balanceHours}` : `${r.months[2].balanceHours}`) : '-',
        r.quarterTotalBalance >= 0 ? `+${r.quarterTotalBalance} h` : `${r.quarterTotalBalance} h`,
        r.quarterStatus
      );

      rows.push(rowVals);
    }

    // Wiersz podsumowania zespołu
    rows.push([]);
    const summaryRow: (string | number)[] = ['PODSUMOWANIE ZESPOŁU', `${tor.rows.length} os.`];
    for (let i = 0; i < 3; i++) {
      let mRcp = 0;
      let mH_h = 0;
      let mL4_h = 0;
      let mBalance = 0;
      for (const r of tor.rows) {
        mRcp += r.months[i].rcpHours;
        mH_h += r.months[i].hHours;
        mL4_h += r.months[i].l4Hours;
        mBalance += r.months[i].balanceHours;
      }
      summaryRow.push(
        Number(mRcp.toFixed(1)),
        Number(mH_h.toFixed(1)),
        Number(mL4_h.toFixed(1)),
        Number(mBalance.toFixed(1))
      );
    }
    summaryRow.push('', '', '', `${tor.totalTeamBalance >= 0 ? '+' : ''}${tor.totalTeamBalance} h`, tor.totalTeamBalance >= 0 ? 'OK / Nadgodziny' : 'Niedogodziny');
    rows.push(summaryRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Szerokości kolumn dla arkusza TOR
    const colWidths: { wch: number }[] = [{ wch: 24 }];
    for (let i = 0; i < 3; i++) {
      colWidths.push({ wch: 8 }, { wch: 9 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 });
    }
    colWidths.push({ wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 14 });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, `TOR ${tor.quarterName.split(' ')[0]}`);

    const fileName = `TOR_${tor.quarterName.replace(/[^a-zA-Z0-9]/g, '_')}_${tor.year}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}

