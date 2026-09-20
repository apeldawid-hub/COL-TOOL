import { StandardShiftTemplate, SkillCheckType, SkillCheckCriterion } from '../types';

export const FIRST_30_SHIFTS: StandardShiftTemplate[] = [
  {
    shift_code: 'T1',
    day_offset: 0,
    title: 'Rozpoczęcie, First Sip & BHP',
    default_start_time: '09:00',
    default_end_time: '13:30',
    barista_hours_t: 4.5,
    trainer_hours_t: 0.0,
    sm_hours_t: 2.0,
    station: 'Store Manager / Gabinet',
    program: 'first_30',
    description: 'Pierwszy dzień w kawiarni, powitanie przez SM, degustacja kawy First Sip, instruktaż BHP, oprowadzenie po lokalu i standardy bezpieczeństwa żywności Sanepid.',
    learning_topics: [
      'Witaj w Starbucks & First Sip tasting',
      'Misja i Wartości Starbucks',
      'Szkolenie wstępne BHP i Sanepid',
      'Oprowadzenie po kawiarni i zapleczu',
      'Zapoznanie z grafikiem i podręcznikiem Baristy'
    ]
  },
  {
    shift_code: 'T2',
    day_offset: 1,
    title: 'Kultura Starbucks & Standardy Serwisu',
    default_start_time: '09:00',
    default_end_time: '13:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 2.0,
    sm_hours_t: 0.0,
    station: 'Sala / Lobby',
    program: 'first_30',
    description: 'Wprowadzenie do Customer Connection, standardy czystości, nawiązywanie kontaktu z gośćmi i pierwsze kroki z Trenerem Baristów.',
    learning_topics: [
      'Nawiązywanie kontaktu z gośćmi (Customer Connection)',
      'Standardy czystości i bezpieczeństwa stanowisk',
      'Obsługa stolików i lobby kawiarni',
      'Przegląd menu podstawowego i ziaren kawy'
    ]
  },
  {
    shift_code: 'T3',
    day_offset: 2,
    title: 'Fundamenty & Customer Support (CS)',
    default_start_time: '09:00',
    default_end_time: '13:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 1.75,
    sm_hours_t: 0.0,
    station: 'Customer Support Cycle',
    program: 'first_30',
    description: 'Nauka cyklu Customer Support (CS Cycle), parzenie kawy przelewowej (Brewed Coffee), uzupełnianie zapasów i utrzymanie rytmu kawiarni.',
    learning_topics: [
      'Cykl Customer Support (timer, zapasy, lobby)',
      'Parzenie kawy z ekspresu przelewowego Bun / Curtis',
      'Przygotowanie syropów, posypek i baz napojowych',
      'Utrzymanie porządku na stacji mlecznej i barze'
    ]
  },
  {
    shift_code: 'T4',
    day_offset: 3,
    title: 'Coffee Midpoint Check-In & Degustacja',
    default_start_time: '10:00',
    default_end_time: '14:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 1.0,
    sm_hours_t: 0.5,
    station: 'Tasting Table / CS',
    program: 'first_30',
    description: 'Półmetek pierwszego tygodnia: prowadzona degustacja kawy (4 kroki: Wąchanie, Siorbanie, Lokalizacja, Opis) oraz spotkanie check-in ze Store Managerem.',
    learning_topics: [
      'Cztery kroki degustacji kawy (Aroma, Acidity, Body, Flavor)',
      'Różnice między stopniami palenia: Blonde, Medium, Dark',
      'Wpisy do Paszportu Kawowego (Coffee Passport)',
      'Midpoint Check-In z SM — ocena postępów i feedback'
    ]
  },
  {
    shift_code: 'T5',
    day_offset: 4,
    title: 'Stacja Kasy (POS) i Jedzenie (Food)',
    default_start_time: '08:30',
    default_end_time: '12:30',
    barista_hours_t: 4.0,
    trainer_hours_t: 2.0,
    sm_hours_t: 0.0,
    station: 'Stacja Kasy / Witryna Food',
    program: 'first_30',
    description: 'Standardy przyjmowania zamówień, obsługa kasy POS, program Starbucks Rewards, podgrzewanie jedzenia w piecach Merrychef / TurboChef.',
    learning_topics: [
      'Standard obsługi na kasie (Connect, Deliver, Discover)',
      'Nawigacja w systemie kasowym POS i aplikacja Starbucks Rewards',
      'Standardy podgrzewania ciast i kanapek (FIFO, piece)',
      'Obsługa płatności kartą, gotówką i voucherami'
    ]
  },
  {
    shift_code: 'T6',
    day_offset: 7,
    title: 'Espresso Bar PM & Skill Check #1',
    default_start_time: '14:00',
    default_end_time: '19:15',
    barista_hours_t: 5.25,
    trainer_hours_t: 3.0,
    sm_hours_t: 0.25,
    station: 'Espresso Bar (Mastrena II)',
    program: 'first_30',
    description: 'Intensywna praca na ekspresie Mastrena II: ekstrakcja espresso, 5-krokowa rutyna spieniania mleka, napoje gorące oraz oficjalny Milk Steaming & Espresso Skill Check.',
    learning_topics: [
      'Kalibracja i ekstrakcja z ekspresu Mastrena II (czas shotów)',
      'Rutyna spieniania mleka (Milk Steaming Routine - 5 kroków)',
      'Kompozycja: Latte, Cappuccino, Flat White, Caramel Macchiato',
      'Oficjalny Skill Check #1: Espresso Bar & Technika Mleczna'
    ]
  },
  {
    shift_code: 'T7',
    day_offset: 8,
    title: 'Cold Bar Station & Skill Check #2',
    default_start_time: '13:00',
    default_end_time: '17:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 2.0,
    sm_hours_t: 0.25,
    station: 'Cold Bar (Frappuccino / Blending)',
    program: 'first_30',
    description: 'Przygotowanie napojów mrożonych: cała gama Frappuccino Blended Beverage, Refresha (10x shake w shakerze), Iced Latte, Cold Brew oraz Skill Check #2.',
    learning_topics: [
      'Rutyna napojów Frappuccino (kroki pompek, lód, baza, blendowanie)',
      'Shaker Routine: Starbucks Refresha i Iced Teas (10x wstrząśnięcie)',
      'Serwowanie Cold Brew i Iced Espresso',
      'Oficjalny Skill Check #2: Cold Bar Station'
    ]
  },
  {
    shift_code: 'T8',
    day_offset: 9,
    title: 'Zintegrowane Przygotowanie Napojów',
    default_start_time: '10:00',
    default_end_time: '14:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 0.0,
    sm_hours_t: 0.0,
    station: 'Main Bar / Hot & Cold',
    program: 'first_30',
    description: 'Praca na barze w tandemie. Trener Baristów wspiera z pozycji regularnej zmiany (Coverage), ugruntowanie pewności siebie i sekwencjonowania zamówień.',
    learning_topics: [
      'Sekwencjonowanie napojów (Beverage Sequencing - 2 napoje naraz)',
      'Zarządzanie kolejką kubków i biletów naklejanych',
      'Komunikacja na barze (Calling & Repeating orders)',
      'Pewność i tempo przygotowywania napojów'
    ]
  },
  {
    shift_code: 'T9',
    day_offset: 10,
    title: 'Support, MOP (Mobile Order) & Delivery',
    default_start_time: '11:00',
    default_end_time: '15:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 1.5,
    sm_hours_t: 0.0,
    station: 'Hand-off Plane / MOP & Delivery',
    program: 'first_30',
    description: 'Wydawanie napojów gościom, obsługa zamówień mobilnych MOP i kurierów dostawczych (UberEats, Wolt, Glovo), radzenie sobie ze specjalnymi modyfikacjami.',
    learning_topics: [
      'Stacja wydawania napojów (Hand-off Plane)',
      'Specjalne modyfikacje i alergeny (mleka roślinne, syropy SF)',
      'Obsługa zamówień Delivery i Mobilnych (MOP)',
      'Rozwiązywanie problemów gości z uśmiechem (Make It Right)'
    ]
  },
  {
    shift_code: 'T10',
    day_offset: 11,
    title: 'Następny Rozdział, Egzamin Końcowy & Certyfikacja',
    default_start_time: '12:00',
    default_end_time: '13:30',
    barista_hours_t: 1.5,
    trainer_hours_t: 1.0,
    sm_hours_t: 0.5,
    station: 'Gabinet SM / Sala',
    program: 'first_30',
    description: 'Finalne podsumowanie programu First 30. Weryfikacja kryteriów certyfikacji przez Store Managera, uroczyste wręczenie Zielonej Przypinki Baristy (Green Pin) i Certyfikatu.',
    learning_topics: [
      'Podsumowanie 30-dniowego planu treningowego',
      'Final Check z Store Managerem i Trenerem',
      'Wręczenie Zielonej Przypinki Baristy Starbucks i certyfikatu',
      'Planowanie kolejnego etapu: ścieżka Barista 90'
    ]
  }
];

export const BARISTA_90_SHIFTS: StandardShiftTemplate[] = [
  {
    shift_code: 'B90-1',
    day_offset: 60,
    title: 'Barista 90 Check-In & Warsztat Relacji',
    default_start_time: '10:00',
    default_end_time: '12:00',
    barista_hours_t: 2.0,
    trainer_hours_t: 0.0,
    sm_hours_t: 0.75,
    station: 'Gabinet SM / Lobby',
    program: 'barista_90',
    description: 'Podsumowanie pierwszych 90 dni pracy. Warsztat de-eskalacji sytuacji trudnych, radzenie sobie z uprzedzeniami i budowanie głębszych więzi z gośćmi.',
    learning_topics: [
      'Świadomość uprzedzeń i inkluzywna kawiarnia (Inclusive Space)',
      'Techniki de-eskalacji trudnych sytuacji i konfliktów (LATTE method)',
      '90-Dniowy formalny wywiad rozwojowy z Store Managerem',
      'Cele indywidualne na kolejne 3 miesiące'
    ]
  }
];

export const BARISTA_180_SHIFTS: StandardShiftTemplate[] = [
  {
    shift_code: 'B180-1',
    day_offset: 150,
    title: 'Barista 180 Check-In & Coffee Academy 200',
    default_start_time: '09:00',
    default_end_time: '13:00',
    barista_hours_t: 4.0,
    trainer_hours_t: 0.0,
    sm_hours_t: 0.5,
    station: 'Bar & Tasting Area',
    program: 'barista_180',
    description: 'Osiągnięcie poziomu zaawansowanego po 6 miesiącach pracy. Moduł Coffee Academy 200, doskonałość operacyjna i przygotowanie do roli Barista Trener.',
    learning_topics: [
      'Coffee Academy 200: regiony upraw, procesy myte i naturalne',
      'Doskonałość rzemiosła latte art (serce, rozeta, tulipan)',
      'Półroczny formalny przegląd kompetencji i satysfakcji',
      'Aspiracja do programu Barista Trainer / SSV'
    ]
  }
];

export const BARISTA_TRAINER_SHIFTS: StandardShiftTemplate[] = [
  {
    shift_code: 'BT-1',
    day_offset: 0,
    title: 'Warsztat Modelu Nauczania & Trening Trenera',
    default_start_time: '09:00',
    default_end_time: '12:30',
    barista_hours_t: 3.5, // W tym przypadku to godziny kandydata na trenera
    trainer_hours_t: 0.0,
    sm_hours_t: 2.25,
    station: 'Gabinet SM / Sala Szkoleniowa',
    program: 'barista_trainer',
    description: 'Certyfikacja na Barista Trenera. Opanowanie 4-etapowego modelu nauczania dorosłych Starbucks (Przygotowanie, Prezentacja, Ćwiczenie, Follow-up).',
    learning_topics: [
      'Model Nauczania Starbucks (Prepare, Present, Practice, Follow-up)',
      'Udzielanie konstruktywnego feedbacku i docenianie (Green Apron Cards)',
      'Zarządzanie czasem i materiałami nowego pracownika',
      'Skill Check Modelu Nauczania prowadzony przez Store Managera'
    ]
  }
];

export const STANDARD_SKILL_CHECKS: Record<SkillCheckType, { title: string; subtitle: string; criteria: SkillCheckCriterion[] }> = {
  milk_steaming: {
    title: 'Milk Steaming Routine Check',
    subtitle: 'Weryfikacja 5 kroków spieniania mleka i mikropianki (Kryteria Starbucks Standard)',
    criteria: [
      {
        id: 'ms_1',
        category: 'Krok 1: Wlewanie',
        label: 'Prawidłowa ilość świeżego mleka',
        description: 'Mleko wlane z lodówki do właściwej kreski w dzbanku (Short/Tall/Grande/Venti) bez nadmiaru.',
        isPassed: true
      },
      {
        id: 'ms_2',
        category: 'Krok 2: Napowietrzanie',
        label: 'Kontrola czasu napowietrzania (Aeration)',
        description: 'Głowica dyszy tuż pod powierzchnią: 1-3 sekundy dla Latte/Mocha, 6-8 sekund dla puszystego Cappuccino. Delikatny dźwięk papieru.',
        isPassed: true
      },
      {
        id: 'ms_3',
        category: 'Krok 3: Wirowanie',
        label: 'Tworzenie wiru (Vortex) i temperatura',
        description: 'Dzbanek oparty stabilnie, dysza tworzy płynny wir bez bąbli. Automatyczne wyłączenie przy optymalnej temperaturze (ok. 65°C / 150°F).',
        isPassed: true
      },
      {
        id: 'ms_4',
        category: 'Krok 4: Dezynfekcja',
        label: 'Natychmiastowe przetarcie i przedmuchanie',
        description: 'Przetarcie dyszy parowej dedykowaną wilgotną ściereczką barową i przedmuchanie (purge) przez 2 sekundy natychmiast po wyjęciu dzbanka.',
        isPassed: true
      },
      {
        id: 'ms_5',
        category: 'Krok 5: Polerowanie',
        label: 'Polerowanie mleka i gładka mikropianka',
        description: 'Uderzenie dzbankiem o blat w celu usunięcia pęcherzy powietrza, delikatne zatoczenie kół (polerowanie) do uzyskania lśniącej tafli mokrej farby.',
        isPassed: true
      }
    ]
  },
  espresso_bar: {
    title: 'Espresso Bar Skill Check #1',
    subtitle: 'Praktyczny test przygotowania 4 wzorcowych napojów kawowych na barze gorącym',
    criteria: [
      {
        id: 'eb_1',
        category: 'Caffe Latte',
        label: 'Przygotowanie Tall Caffe Latte',
        description: 'Prawidłowy czas ekstrakcji pojedynczego shota espresso, wlanie aksamitnego mleka z mikropianką o grubości ok. 1 cm na wierzchu.',
        isPassed: true
      },
      {
        id: 'eb_2',
        category: 'Cappuccino',
        label: 'Przygotowanie Tall Cappuccino',
        description: 'Lekki kubek, pianka stanowi ok. 50% objętości napoju, wyraźny pierścień kawowy i aksamitna gęsta piana.',
        isPassed: true
      },
      {
        id: 'eb_3',
        category: 'Caramel Macchiato',
        label: 'Przygotowanie Grande Caramel Macchiato',
        description: 'Syrop waniliowy (o 1 pompkę mniej niż standard), spienione mleko, podwójny shot nalany na wierzch (oznaczone espresso) oraz precyzyjna kratka sosu karmelowego 7x7 z dwoma okręgami.',
        isPassed: true
      },
      {
        id: 'eb_4',
        category: 'Flat White',
        label: 'Przygotowanie Short / Tall Flat White',
        description: 'Shoty Ristretto, pełnotłuste mleko spienione z mikro-pęcherzykami, precyzyjne nalewanie z góry i biała kropka pianki na środku ciemnej cremy.',
        isPassed: true
      }
    ]
  },
  cold_beverage: {
    title: 'Cold Beverage Station Skill Check #2',
    subtitle: 'Praktyczny test przygotowania napojów mrożonych, shakerowanych i blended',
    criteria: [
      {
        id: 'cb_1',
        category: 'Frappuccino',
        label: 'Przygotowanie Caramel Frappuccino',
        description: 'Zachowana prawidłowa kolejność: pompki Frap Roast, mleko do dolnej kreski, wlanie do blendera, syrop karmelowy, miarka lodu, baza Coffee Base, program 1, bita śmietana i polewa.',
        isPassed: true
      },
      {
        id: 'cb_2',
        category: 'Cold Brew / Iced Latte',
        label: 'Przygotowanie Iced Caffe Latte & Cold Brew',
        description: 'Shoty nalane do szklanki/kubka, mleko do górnej kreski, dopełnienie lodem z zachowaniem 1 cm odstępu od rantu kubka bez rozchlapywania.',
        isPassed: true
      },
      {
        id: 'cb_3',
        category: 'Refresha / Shaker',
        label: 'Rutyna shakera: Strawberry Acai / Cool Lime',
        description: 'Użycie shakera: baza sokowa do kreski, woda/napój kokosowy, owoce liofilizowane, lód, zamknięcie i energiczne wstrząśnięcie dokładnie 10 razy przed nalaniem.',
        isPassed: true
      },
      {
        id: 'cb_4',
        category: 'Pianki Cold Foam',
        label: 'Przygotowanie Cappuccino Freddo / Cold Foam',
        description: 'Użycie dzbanka Cold Foam Vitamix, odmierzenie 100ml mleka odtłuszczonego, wybór programu 4, gęsta puszysta pianka utrzymująca się na powierzchni kawy.',
        isPassed: true
      }
    ]
  },
  teaching_model: {
    title: 'Teaching Model Skill Check (Barista Trener)',
    subtitle: 'Weryfikacja kompetencji trenerskich wg 4-etapowego Modelu Nauczania Starbucks',
    criteria: [
      {
        id: 'tm_1',
        category: 'Krok 1: Przygotowanie (Prepare)',
        label: 'Gotowość stanowiska i budowanie komfortu',
        description: 'Trener przygotował wcześniej stanowisko i materiały szkoleniowe, stworzył przyjazną atmosferę i wyjaśnił cel lekcji nowemu pracownikowi.',
        isPassed: true
      },
      {
        id: 'tm_2',
        category: 'Krok 2: Prezentacja (Present)',
        label: 'Demonstracja wzorcowego standardu',
        description: 'Trener wykonuje zadanie krok po kroku, tłumacząc "dlaczego" robimy to w określony sposób, operując oficjalnym nazewnictwem Starbucks.',
        isPassed: true
      },
      {
        id: 'tm_3',
        category: 'Krok 3: Ćwiczenie (Practice)',
        label: 'Samodzielne wykonanie przez baristę',
        description: 'Barista wykonuje ćwiczenie samodzielnie, trener obserwuje w skupieniu, nie przerywając bez potrzeby, dając przestrzeń na naukę na błędach.',
        isPassed: true
      },
      {
        id: 'tm_4',
        category: 'Krok 4: Follow-up',
        label: 'Wzmacniający feedback i docenienie',
        description: 'Trener zadaje pytania sprawdzające zrozumienie, podsumowuje postępy, przekazuje konstruktywne uwagi i docenia zaangażowanie (np. Green Apron Card).',
        isPassed: true
      }
    ]
  },
  completion_check: {
    title: 'Weryfikacja Końcowa First 30 & Certyfikacja Baristy',
    subtitle: 'Formalne kryteria zatwierdzenia przez Store Managera przed dopuszczeniem do samodzielnej pracy',
    criteria: [
      {
        id: 'cc_1',
        category: 'Wymóg 1: Szkolenie Teoretyczne',
        label: '100% zrealizowanego materiału w podręczniku',
        description: 'Barista ukończył wszystkie moduły w Podręczniku Baristy oraz e-learningu, w tym moduły bezpieczeństwa i standardów marki.',
        isPassed: true
      },
      {
        id: 'cc_2',
        category: 'Wymóg 2: Bar Gorący',
        label: 'Pozytywny wynik Espresso Bar Skill Check',
        description: 'Zdany praktyczny test z rutyny spieniania mleka i przygotowania klasycznych napojów espresso z wynikiem minimum 80%.',
        isPassed: true
      },
      {
        id: 'cc_3',
        category: 'Wymóg 3: Bar Zimny & Kasa',
        label: 'Pozytywny wynik Cold Beverage & POS Check',
        description: 'Płynna obsługa kasowa, wysoka kultura Customer Connection, zdany test stacji zimnej Refresha & Frappuccino.',
        isPassed: true
      },
      {
        id: 'cc_4',
        category: 'Wymóg 4: Akceptacja SM',
        label: 'Podpis Store Managera & Zielona Przypinka',
        description: 'Ukończony 30-dniowy wywiad podsumowujący, akceptacja SM w systemie, nadanie tytułu Certyfikowanego Baristy i wręczenie zielonej przypinki.',
        isPassed: true
      }
    ]
  }
};
