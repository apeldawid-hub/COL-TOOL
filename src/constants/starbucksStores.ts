// src/constants/starbucksStores.ts

export interface StarbucksStore {
  id: string;              // MPK lub unikalny kod (np. '108120')
  name: string;            // Pełna oficjalna nazwa lokalu
  shortName: string;       // Krótka nazwa wyświetlana w nagłówku i badge'ach
  unitCode: string;        // Kod jednostki operacyjnej (Unit Code)
  mpk: string;             // Kod MPK do rozliczeń i ewidencji
  city: string;            // Miasto
  district: string;        // Dystrykt operacyjny Starbucks
  address: string;         // Adres lokalu
  type: 'Mall' | 'Street' | 'Drive-Thru' | 'Office' | 'Travel';
  isCustom?: boolean;      // Czy dodana ręcznie przez użytkownika
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Usuwa polskie znaki diakrytyczne dla bezbłędnego wyszukiwania (np. "lodz" -> "lodz", "Łódź" -> "lodz")
 */
export function normalizeDiacritics(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l');
}

/**
 * Główny katalog domyślnych lokali platformy.
 * Ograniczony do aktywnych jednostek flotowych z możliwością dynamicznej edycji i rozbudowy.
 */
export const STARBUCKS_STORES_CATALOG: StarbucksStore[] = [
  {
    id: '108120',
    name: '108120 SBX Warszawa Janki',
    shortName: '108120 Janki',
    unitCode: '18120',
    mpk: '108120',
    city: 'Warszawa / Janki',
    district: 'Dystrykt Warszawa',
    address: 'pl. Szwedzki 20, 05-090 Janki (Centrum Handlowe Janki)',
    type: 'Mall',
  },
  {
    id: '108170',
    name: '108170 SBX Kalisz Galeria Amber',
    shortName: '108170 Kalisz Amber',
    unitCode: '18170',
    mpk: '108170',
    city: 'Kalisz',
    district: 'Dystrykt Zachód',
    address: 'ul. Górnośląska 82, 62-800 Kalisz (Galeria Amber)',
    type: 'Mall',
  },
];
