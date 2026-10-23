---
name: ota-patch-publisher
description: >-
  Inżynier wydań i automatycznych mikropatchy Over-The-Air (OTA). Weryfikuje kompilację TypeScript/Vite,
  podbija wersję w package.json, aktualizuje rejestr wydań (VERSION_HISTORY.md) i publikuje lekki pakiet zip
  (~1.1 MB) bezpośrednio na GitHub Releases (npm run patch) w 3-5 sekund.
---

# Inżynier Wydań & Mikropatchy OTA (OTA Patch Publisher)

Skill odpowiada za bezawaryjne, ultra-szybkie wdrażanie poprawek i nowych funkcji na komputery w kawiarniach bez konieczności instalowania pełnego instalatora DMG.

---

## ⚡ 1. Mikropatch OTA (`npm run patch`) vs Pełny Instalator DMG

| Cecha | ⚡ Mikropatch OTA (`npm run patch`) | 📦 Pełny Instalator DMG (`npm run publish:mac`) |
| :--- | :--- | :--- |
| **Rozmiar** | ~1.16 MB (paczka ZIP z kodem `dist/`) | ~85 MB (pełna kompilacja Electron + macOS) |
| **Czas publikacji** | **3 – 5 sekund** | 2 – 4 minuty |
| **Kiedy stosować?** | **Domyślnie dla każdej poprawki:** UI, algorytmy, Kodeks Pracy, nowe widoki, naprawa błędów. | **Tylko na wyraźne życzenie użytkownika:** np. aktualizacja bibliotek natywnych Electrona lub ikon systemowych. |
| **Baza danych** | Bezpieczna, nienaruszalna w `Application Support` | Bezpieczna, nienaruszalna w `Application Support` |

---

## 🛠️ 2. Procedura Publikacji Krok po Kroku

Przed opublikowaniem nowej wersji agent wykonuje następującą procedurę kontrolną:

### Krok 1: Weryfikacja Jakości i Kompilacji (Pre-flight QA)
```bash
npm run build
```
Kompilator TypeScript (`tsc`) oraz bundler `vite` muszą zakończyć pracę z kodem wyjścia `0` (brak jakichkolwiek błędów składni lub typowania).

### Krok 2: Podbicie Wersji
Zwiększenie numeru patcha w `package.json` (np. z `v2.8.42` na `v2.8.43`) oraz w `src/version.ts`.

### Krok 3: Udokumentowanie Zmian (Version Tracker)
1. Dodanie wpisu na początku `VERSION_HISTORY.md` (tytuł, data, główne atuty, zmodyfikowane pliki).
2. Zaktualizowanie struktury w `src/constants/changelog.ts` (aby kierownicy widzieli opis w oknie aktualizacji w programie).
3. Wygenerowanie publicznego `CHANGELOG.md` (`npm run changelog:generate`).

### Krok 4: Wysłanie Patcha na GitHub Releases
```bash
npm run patch
```
Skrypt automatycznie:
- Pakuje zoptymalizowane pliki `dist/` do archiwum `sos-patch-X.X.X.zip`,
- Generuje sumę kontrolną SHA-256,
- Wysyła paczkę do GitHub Releases wraz z opisem z changeloga,
- Aktualizuje plik wskaźnikowy `latest-patch.json`.

---

## 🔒 3. Bezpieczeństwo i Izolacja Danych
Wdrożenie mikropatcha OTA nigdy nie modyfikuje pliku bazy danych SQLite użytkownika (`tplh_forecast.db`), gwarantując ciągłość pracy kawiarni.
