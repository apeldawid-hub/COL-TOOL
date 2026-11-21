---
name: anti-slop
description: >-
  Audytor jakości kodu, promptów, tekstów i UI (AI Slop Detector & Quality Gate).
  Eliminuje martwy kod, połykane wyjątki, niepotrzebne console.log, frazesy językowe LLM,
  emojiozę oraz generyczne szablony interfejsu w Starbucks Operations Suite.
---

# 🛡️ AI Slop Detector & Quality Gate (COL Tool)

Ten skill definiuje bezwzględne reguły audytu przed wprowadzaniem zmian w kodzie, dokumentacji i interfejsie platformy **Starbucks Operations Suite**.
Chroni projekt przed typowymi zanieczyszczeniami generowanymi przez modele językowe.

---

## 1. Audyt Kodu i Logiki (Quality Gate)

Przed zatwierdzeniem zmian w kodzie TypeScript/React:

1. **Brak Połkniętych Błędów:**
   * ❌ `try { ... } catch (e) {}` lub ignorowanie błędów bez zgłoszenia.
   * ✅ Jawne logowanie błędu przez systemowy logger lub bezpieczny fallback z powiadomieniem użytkownika.
2. **Brak Pustych Stubów i Martwego Kodu:**
   * ❌ Pozostawianie `// TODO: implement later`, pustych funkcji zwracających `null` lub atrap `mockData` w kodzie produkcyjnym.
3. **Czystość Telemetryczna i Konsolowa:**
   * ❌ Pozostawianie debugowych `console.log(...)` w komponentach i serwisach.
   * ✅ Stosowanie ustrukturyzowanego loggera aplikacji (`src/services/logger.ts`).
4. **Typowanie TypeScript:**
   * ❌ Bezwzględny zakaz nadużywania typu `any` i ignorowania błędów kompilacji za pomocą `@ts-ignore` bez krytycznego uzasadnienia.
5. **Punktowe Diffy:**
   * Zakaz reformatowania całych plików i zmieniania importów niezwiązanych z realizowanym zadaniem.

---

## 2. Audyt Tekstu i Komunikatów (Zero-Fluff Standard)

1. **Zakazany Słownik Frazesów (AI Vocabulary Clichés):**
   * ❌ Zakazane słowa: `delve`, `tapestry`, `beacon`, `testament`, `pivotal`, `game-changer`, `overarching`, `plethora`, `multifaceted`, `harnessing`, `revolutionize`.
   * ❌ Puste wstępy: *"Warto zauważyć, że..."*, *"W dzisiejszym dynamicznie rozwijającym się środowisku..."*, *"Podsumowując powyższe..."*.
2. **Zasada Zero-Yapping (Maksymalna Gęstość):**
   * Przejście natychmiast do meritum od pierwszej linijki odpowiedzi.
   * Brak powtarzania pytań użytkownika ani formułek typu *"Chętnie pomogę"*.
3. **Język Operacyjny Starbucks:**
   * Komunikaty w aplikacji i alerty muszą posługiwać się żargonem kawiarni (Floor Hours, Flex, MTD Velocity, Split-Week, TRX, TPLH, SM/ASM/SSV, TOR, kody zmian AM/PM/MIB/SUP), a nie technicznymi kodami błędów SQL czy wyjątkami JavaScript.
4. **Brak Emojiozy:**
   * Zakaz dekorowania każdego punktu listy emotikonami (`🚀`, `✨`, `💡`, `🔥`). Dozwolone wyłącznie czytelne ikony w interfejsie (`lucide-react`).

---

## 3. Audyt UI i Ergonomii Zaplecza (UI Anti-Slop)

Interfejs COL Tool projektowany jest do pracy na laptopie w warunkach zaplecza kawiarni:

1. **Zakaz AI Gradient Slop:**
   * ❌ Fioletowo-różowe gradienty, rozmyte tła glassmorphism utrudniające czytanie tabel, pulsujące cienie.
   * ✅ Wyrazisty, profesjonalny design operacyjny Starbucks (zielenie korporacyjne, stonowany dark/light mode, wysoki kontrast).
2. **Gęstość Informacyjna vs Szablonowe Karty:**
   * ❌ Generyczne puste kafelki z pojedynczą ikoną na środku.
   * ✅ Zwarte tabele z danymi, czytelne matryce grafiku, precyzyjne wskaźniki KPI (TPLH, Floor, godziny).
3. **Dostępność Klawiatury i Focus:**
   * Każde pole edycji w tabeli grafiku i planera musi mieć czytelny stan aktywacji (`focus-visible`) i obsługiwać szybkie wprowadzanie danych z klawiatury numerycznej.
