// src/services/firebaseDocsService.ts
import { STARBUCKS_STORES_CATALOG } from '../constants/starbucksStores';
import { DEFAULT_SHIFT_DEFINITIONS } from '../modules/managers-schedule/constants/defaultShifts';
import { logger } from './logger';

export interface CloudOperationalDoc {
  id: string;
  category: 'labor_law' | 'shift_templates' | 'nc_standards' | 'calendar' | 'stores' | 'checklists';
  title: string;
  description: string;
  piiFree: boolean;
  notStarbucksMarked: boolean;
  itemCount: number;
  lastUpdated: string;
  data: any;
}

export interface CloudDocsSyncResult {
  success: boolean;
  exportedCount: number;
  docs: Array<{ id: string; title: string; status: 'synced' | 'failed'; error?: string }>;
  timestamp: string;
}

const FIREBASE_PROJECT_ID = 'starbucks-ops-suite';
const FIRESTORE_COLLECTION = 'cloud_operational_docs';
const STORAGE_CACHE_KEY = 'sbx_firebase_cloud_docs_cache';

export class FirebaseDocsService {
  /**
   * Generuje zbiór w 100% zanonimizowanych dokumentów operacyjnych
   * BEZ imion, nazwisk, stawek, grafików i bez zastrzeżonych dokumentów wewnętrznych
   */
  public static getSanitizedOperationalDocs(): CloudOperationalDoc[] {
    const timestamp = new Date().toISOString();

    // 1. DOKUMENT: Normy Kodeksu Pracy RP (2016-2036) — publiczne dane prawne
    const polishLaborNormsData = {
      description: 'Oficjalne nominały czasu pracy, dni robocze i wolne w Polsce (art. 130 Kodeksu Pracy)',
      legalBasis: 'Ustawa z dnia 26 czerwca 1974 r. – Kodeks pracy (Dz.U. z 2023 r. poz. 1465)',
      standardFullTimeDailyHours: 8.0,
      standardWeeklyHours: 40.0,
      minRestDailyHours: 11.0,
      minRestWeeklyHours: 35.0,
      tradingSundaysAnnualCount: 7,
      sampleNorms: [
        { year: 2026, month: 1, workingDays: 20, normHours: 160.0, holidaysCount: 2 },
        { year: 2026, month: 2, workingDays: 20, normHours: 160.0, holidaysCount: 0 },
        { year: 2026, month: 3, workingDays: 22, normHours: 176.0, holidaysCount: 0 },
        { year: 2026, month: 4, workingDays: 21, normHours: 168.0, holidaysCount: 1 },
        { year: 2026, month: 5, workingDays: 20, normHours: 160.0, holidaysCount: 2 },
        { year: 2026, month: 6, workingDays: 21, normHours: 168.0, holidaysCount: 1 },
        { year: 2026, month: 7, workingDays: 23, normHours: 184.0, holidaysCount: 0 },
        { year: 2026, month: 8, workingDays: 20, normHours: 160.0, holidaysCount: 1 },
        { year: 2026, month: 9, workingDays: 22, normHours: 176.0, holidaysCount: 0 },
        { year: 2026, month: 10, workingDays: 22, normHours: 176.0, holidaysCount: 0 },
        { year: 2026, month: 11, workingDays: 20, normHours: 160.0, holidaysCount: 2 },
        { year: 2026, month: 12, workingDays: 21, normHours: 168.0, holidaysCount: 2 },
      ]
    };

    // 2. DOKUMENT: Standardowe Szablony Zmian Operacyjnych (bez przypisań personalnych)
    const sanitizedShifts = DEFAULT_SHIFT_DEFINITIONS.map(s => ({
      code: s.code,
      name: s.name,
      hours: s.hours,
      start_time: s.start_time,
      end_time: s.end_time,
      is_nc: s.is_nc,
      is_absence: s.is_absence,
      category: s.category,
      is_sunday_only: s.is_sunday_only,
    }));

    // 3. DOKUMENT: Standardy Budżetu Non-Coverage (Zarządzanie & Utrzymanie)
    const ncStandardsData = [
      { id: 'admin_management', name: 'Zarządzanie Operacyjne & Grafik', category: 'Zarządzanie', standardMonthlyHours: 20.0, mandatory: true },
      { id: 'onboarding_training', name: 'Podstawowe Szkolenie Stanowiskowe', category: 'Rozwój', standardMonthlyHours: 12.0, mandatory: true },
      { id: 'inventory_control', name: 'Miesięczna Inwentaryzacja & Kontrola Strat', category: 'Operacje', standardMonthlyHours: 6.0, mandatory: true },
      { id: 'safety_maintenance', name: 'Konserwacja Maszyn & Deep Cleaning', category: 'Czystość', standardMonthlyHours: 8.0, mandatory: true },
      { id: 'crew_meeting', name: 'Zebranie Operacyjne Załogi', category: 'Zespół', standardMonthlyHours: 4.0, mandatory: false },
    ];

    // 4. DOKUMENT: Uniwersalne Checklisty Bezpieczeństwa i Procedur Kawiarni
    const genericChecklists = [
      {
        id: 'chk_opening',
        title: 'Uniwersalna Checklista Otwarcia Kawiarni',
        items: [
          'Weryfikacja kodów alarmowych i stanu plomb obiektu',
          'Uruchomienie ekspresów ciśnieniowych i młynków (kontrola ciśnienia i temperatury bojlerów)',
          'Odczyt i zapis temperatur w lodówkach podblatowych i witrynach chłodniczych (zakres 1°C - 4°C)',
          'Kontrola czystości stacji mycia rąk i dozowników środków dezynfekujących',
          'Weryfikacja przygotowania stacji barowej, syropów, filtrów i czystego lodu',
          'Poranna kalibracja młynków do espresso (czas ekstrakcji 18-23s)',
          'Gotowość kaset fiskalnych i terminali płatniczych przed otwarciem drzwi'
        ]
      },
      {
        id: 'chk_closing',
        title: 'Uniwersalna Checklista Zamknięcia Kawiarni',
        items: [
          'Rozliczenie kas i bezpieczny transfer raportów dobowych',
          'Chemiczne mycie grup ekspresu (proszek Cafiza/odpowiednik, ślepe sitko)',
          'Dokładne mycie i dezynfekcja dysz spieniających mleko',
          'Opróżnienie, umycie i osuszenie pojemników na ziarna kawy (hoppery)',
          'Kontrola i dezynfekcja kostkarki do lodu oraz zlewów barowych',
          'Wyrzucenie fusów kawowych i bezpieczna utylizacja odpadów',
          'Sprawdzenie zamknięcia lodówek, wyłączenie oświetlenia i uzbrojenie alarmu'
        ]
      },
      {
        id: 'chk_haccp_sanepid',
        title: 'Procedury Kontroli HACCP & Standardów Sanitarnych',
        items: [
          'Codzienny rejestr temperatur w łańcuchu chłodniczym (2 razy dziennie)',
          'Zasada FIFO (First In, First Out) przy wykładaniu ciast, kanapek i nabiału',
          'Prawidłowe oznakowanie dat przydatności otwartych opakowań (kodowanie datownikiem)',
          'Prawidłowa segregacja ściereczek barowych (osobne do dysz mleka, baru i stolików)',
          'Wymiana wody i środków dezynfekujących na stacji mycia w wyznaczonych cyklach'
        ]
      }
    ];

    // 5. DOKUMENT: Ogólny Katalog Placówek (bez danych obrotu i osób)
    const storeDirectory = STARBUCKS_STORES_CATALOG.map(s => ({
      mpk: s.mpk,
      unitCode: s.unitCode,
      name: s.name,
      city: s.city,
      district: s.district,
      address: s.address,
      type: s.type,
    }));

    return [
      {
        id: 'polish_labor_law_norms',
        category: 'labor_law',
        title: 'Nominały Czasu Pracy & Kodeks Pracy RP',
        description: 'Oficjalne normy miesięczne, dni robocze, święta państwowe i limity dobowe art. 130 KP.',
        piiFree: true,
        notStarbucksMarked: true,
        itemCount: polishLaborNormsData.sampleNorms.length,
        lastUpdated: timestamp,
        data: polishLaborNormsData
      },
      {
        id: 'standard_shift_definitions',
        category: 'shift_templates',
        title: 'Katalog Standardowych Zmian Operacyjnych',
        description: 'Uniwersalne szablony godzinowe otwarć, zamknięć, wsparć i przerw bez przypisań personalnych.',
        piiFree: true,
        notStarbucksMarked: true,
        itemCount: sanitizedShifts.length,
        lastUpdated: timestamp,
        data: sanitizedShifts
      },
      {
        id: 'non_coverage_standards',
        category: 'nc_standards',
        title: 'Standardy i Limity Budżetowe Non-Coverage',
        description: 'Miesięczne godziny gwarantowane na administrację, inwentaryzacje, BHP i głębokie czyszczenie.',
        piiFree: true,
        notStarbucksMarked: true,
        itemCount: ncStandardsData.length,
        lastUpdated: timestamp,
        data: ncStandardsData
      },
      {
        id: 'operational_checklists_haccp',
        category: 'checklists',
        title: 'Uniwersalne Checklisty Kawiarni & HACCP',
        description: 'Procedury otwarcia, zamknięcia lokalu, kalibracji maszyn oraz kontroli sanitarnej Sanepid.',
        piiFree: true,
        notStarbucksMarked: true,
        itemCount: genericChecklists.length,
        lastUpdated: timestamp,
        data: genericChecklists
      },
      {
        id: 'store_network_directory',
        category: 'stores',
        title: 'Ogólny Wykaz Jednostek Kawiarnianych w Polsce',
        description: 'Wykaz numerów MPK, kodów jednostek, miast i adresów bez danych finansowych.',
        piiFree: true,
        notStarbucksMarked: true,
        itemCount: storeDirectory.length,
        lastUpdated: timestamp,
        data: storeDirectory
      }
    ];
  }

  /**
   * Eksportuje zanonimizowane dokumenty do Firebase Firestore przez REST API
   */
  public static async exportSanitizedDocsToFirebase(): Promise<CloudDocsSyncResult> {
    const docs = this.getSanitizedOperationalDocs();
    const results: Array<{ id: string; title: string; status: 'synced' | 'failed'; error?: string }> = [];

    for (const doc of docs) {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${doc.id}`;
      
      const payload = {
        fields: {
          docId: { stringValue: doc.id },
          category: { stringValue: doc.category },
          title: { stringValue: doc.title },
          description: { stringValue: doc.description },
          piiFree: { booleanValue: doc.piiFree },
          notStarbucksMarked: { booleanValue: doc.notStarbucksMarked },
          itemCount: { integerValue: String(doc.itemCount) },
          lastUpdated: { stringValue: doc.lastUpdated },
          jsonData: { stringValue: JSON.stringify(doc.data) },
        }
      };

      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          results.push({ id: doc.id, title: doc.title, status: 'synced' });
        } else {
          const errBody = await res.json().catch(() => ({}));
          results.push({ id: doc.id, title: doc.title, status: 'failed', error: errBody.error?.message || `HTTP ${res.status}` });
        }
      } catch (e: any) {
        results.push({ id: doc.id, title: doc.title, status: 'failed', error: e.message || 'Błąd sieci' });
      }
    }

    // Zapisz lokalnie w pamięci podręcznej jako kopię zapasową
    try {
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(docs));
    } catch (_) {}

    const successCount = results.filter(r => r.status === 'synced').length;

    logger.info('FIREBASE', `Wyeksportowano ${successCount}/${docs.length} zanonimizowanych dokumentów do Firebase Firestore`, {
      results
    });

    return {
      success: successCount > 0,
      exportedCount: successCount,
      docs: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Pobiera listę dokumentów z Firebase Firestore
   */
  public static async fetchCloudDocs(): Promise<CloudOperationalDoc[]> {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.documents || !Array.isArray(data.documents)) {
        return this.getCachedDocs();
      }

      const parsed: CloudOperationalDoc[] = data.documents.map((d: any) => {
        const f = d.fields || {};
        let parsedData = null;
        try {
          if (f.jsonData?.stringValue) {
            parsedData = JSON.parse(f.jsonData.stringValue);
          }
        } catch (_) {}

        return {
          id: f.docId?.stringValue || d.name.split('/').pop(),
          category: f.category?.stringValue || 'checklists',
          title: f.title?.stringValue || 'Dokument Chmurowy',
          description: f.description?.stringValue || '',
          piiFree: f.piiFree?.booleanValue ?? true,
          notStarbucksMarked: f.notStarbucksMarked?.booleanValue ?? true,
          itemCount: parseInt(f.itemCount?.integerValue || '0', 10),
          lastUpdated: f.lastUpdated?.stringValue || new Date().toISOString(),
          data: parsedData,
        };
      });

      // Zaktualizuj pamięć podręczną
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(parsed));
      } catch (_) {}

      return parsed;
    } catch (err) {
      console.warn('⚠️ [FirebaseDocs] Pobieranie z Firestore nie powiodło się, używam pamięci lokalnej:', err);
      return this.getCachedDocs();
    }
  }

  /**
   * Zwraca dokumenty z lokalnej pamięci podręcznej (offline fallback)
   */
  public static getCachedDocs(): CloudOperationalDoc[] {
    try {
      const stored = localStorage.getItem(STORAGE_CACHE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_) {}

    return this.getSanitizedOperationalDocs();
  }
}
