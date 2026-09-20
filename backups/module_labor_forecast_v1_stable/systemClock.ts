/**
 * System Clock Service — Autonomiczny silnik zegara i kalendarza systemowego
 * 
 * Zapewnia pełną świadomość czasu systemowego (rok, miesiąc, dzień, godzina, minuta, sekunda)
 * dla silnika obliczeniowego, logiki biznesowej oraz audytu transakcji.
 * Nie jest bezpośrednio renderowany w widoku (niewidoczny dla użytkownika), 
 * lecz działa w tle aplikacji.
 */

export interface SystemTimeState {
  date: Date;
  year: number;
  monthIndex: number;      // 0-11
  monthName: string;       // 'Styczeń', 'Luty', ..., 'Wrzesień'
  dayOfMonth: number;      // 1-31
  dayOfWeek: string;       // 'Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'
  dayOfWeekFull: string;   // 'Poniedziałek', 'Wtorek', ...
  hours: number;           // 0-23
  minutes: number;         // 0-59
  seconds: number;         // 0-59
  timeString: string;      // 'HH:mm:ss'
  dateString: string;      // 'YYYY-MM-DD'
  timestamp: string;       // 'YYYY-MM-DD HH:mm:ss'
  isoString: string;       // ISO 8601
}

const MONTH_NAMES_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const DAYS_SHORT_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
const DAYS_FULL_PL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

export class SystemClock {
  private static listeners: Set<(time: SystemTimeState) => void> = new Set();
  private static intervalId: any = null;
  private static cachedState: SystemTimeState = SystemClock.createTimeState(new Date());

  /**
   * Tworzy zunifikowaną strukturę stanu czasu systemowego
   */
  public static createTimeState(date: Date = new Date()): SystemTimeState {
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const monthName = MONTH_NAMES_PL[monthIndex] || 'Wrzesień';
    const dayOfMonth = date.getDate();
    const dayOfWeekIdx = date.getDay();
    const dayOfWeek = DAYS_SHORT_PL[dayOfWeekIdx];
    const dayOfWeekFull = DAYS_FULL_PL[dayOfWeekIdx];
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const pad = (n: number) => String(n).padStart(2, '0');
    const timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    const dateString = `${year}-${pad(monthIndex + 1)}-${pad(dayOfMonth)}`;
    const timestamp = `${dateString} ${timeString}`;

    return {
      date,
      year,
      monthIndex,
      monthName,
      dayOfMonth,
      dayOfWeek,
      dayOfWeekFull,
      hours,
      minutes,
      seconds,
      timeString,
      dateString,
      timestamp,
      isoString: date.toISOString(),
    };
  }

  /**
   * Zwraca aktualny stan czasu systemowego
   */
  public static now(): SystemTimeState {
    return SystemClock.createTimeState(new Date());
  }

  /**
   * Inicjalizuje taktowanie zegara w tle (aktualizacja co sekundę)
   */
  public static init(): void {
    if (SystemClock.intervalId) return;

    SystemClock.cachedState = SystemClock.createTimeState(new Date());
    SystemClock.intervalId = setInterval(() => {
      SystemClock.cachedState = SystemClock.createTimeState(new Date());
      SystemClock.listeners.forEach((listener) => listener(SystemClock.cachedState));
    }, 1000);
  }

  /**
   * Subskrypcja na zmiany czasu (np. dla hooków React)
   */
  public static subscribe(listener: (time: SystemTimeState) => void): () => void {
    SystemClock.listeners.add(listener);
    // Wywołaj natychmiast z aktualnym stanem
    listener(SystemClock.cachedState);

    if (!SystemClock.intervalId) {
      SystemClock.init();
    }

    return () => {
      SystemClock.listeners.delete(listener);
    };
  }

  /**
   * Sprawdza, czy bieżący czas systemowy przypada na dany tydzień kalendarzowy (np. 08.09 - 14.09, rok 2026)
   */
  public static isCurrentWeek(dateFromStr: string, dateToStr: string, year: number): boolean {
    if (!dateFromStr || !dateToStr || dateFromStr === '-' || dateToStr === '-') return false;
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      if (year !== currentYear) return false;

      const [d1, m1] = dateFromStr.split('.').map((s) => parseInt(s, 10));
      const [d2, m2] = dateToStr.split('.').map((s) => parseInt(s, 10));

      const start = new Date(year, m1 - 1, d1, 0, 0, 0, 0);
      const end = new Date(year, m2 - 1, d2, 23, 59, 59, 999);

      return now >= start && now <= end;
    } catch {
      return false;
    }
  }

  /**
   * Określa czasową relację tygodnia względem czasu systemowego:
   * - 'past' — tydzień minął przed bieżącą datą
   * - 'current' — trwa w bieżącej chwili
   * - 'future' — przypada w przyszłości
   */
  public static getWeekTemporalStatus(
    dateFromStr: string,
    dateToStr: string,
    year: number
  ): 'past' | 'current' | 'future' {
    if (!dateFromStr || !dateToStr || dateFromStr === '-' || dateToStr === '-') return 'future';
    try {
      const now = new Date();
      const currentYear = now.getFullYear();

      if (year < currentYear) return 'past';
      if (year > currentYear) return 'future';

      const [d1, m1] = dateFromStr.split('.').map((s) => parseInt(s, 10));
      const [d2, m2] = dateToStr.split('.').map((s) => parseInt(s, 10));

      const start = new Date(year, m1 - 1, d1, 0, 0, 0, 0);
      const end = new Date(year, m2 - 1, d2, 23, 59, 59, 999);

      if (now > end) return 'past';
      if (now < start) return 'future';
      return 'current';
    } catch {
      return 'future';
    }
  }

  /**
   * Określa czasową relację całego miesiąca względem czasu systemowego:
   * - 'past' — miniony miesiąc
   * - 'current' — bieżący miesiąc
   * - 'future' — przyszły miesiąc
   */
  public static getMonthTemporalStatus(
    year: number,
    monthName: string
  ): 'past' | 'current' | 'future' {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth(); // 0-11
    const monthIdx = MONTH_NAMES_PL.indexOf(monthName);
    if (monthIdx === -1) return 'future';

    if (year < currentYear) return 'past';
    if (year > currentYear) return 'future';
    if (monthIdx < currentMonthIdx) return 'past';
    if (monthIdx > currentMonthIdx) return 'future';
    return 'current';
  }

  /**
   * Wyznacza termin najbliższego poniedziałku (dzień planowania grafiku)
   */
  public static getNextPlanningMonday(fromDate: Date = new Date()): {
    mondayDate: Date;
    formattedDate: string; // '14.09'
    daysUntil: number;     // 0 jeśli dziś jest poniedziałek, inaczej 1-6
    isToday: boolean;
  } {
    const d = new Date(fromDate);
    const dayOfWeek = d.getDay(); // 0 = Nd, 1 = Pn, 2 = Wt, ..., 5 = Pt, 6 = Sob
    let daysToAdd = (1 - dayOfWeek + 7) % 7;
    const target = new Date(d);
    target.setDate(d.getDate() + daysToAdd);

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      mondayDate: target,
      formattedDate: `${pad(target.getDate())}.${pad(target.getMonth() + 1)}`,
      daysUntil: daysToAdd,
      isToday: daysToAdd === 0,
    };
  }
}

// Inicjalizacja zegara przy starcie modułu
SystemClock.init();
