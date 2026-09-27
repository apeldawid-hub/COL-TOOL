# Reguła IDE: Zawsze Zapisuj Zmiany w Centralnym Rejestrze Wydań (VERSION_HISTORY.md)

## 📌 Żelazna Reguła dla Wszystkich Agentów AI w tym IDE

Wszelkie prace programistyczne, poprawki błędów, nowe widoki, algorytmy oraz wydania patchów OTA w repozytorium **Starbucks Operations Suite** **MUSZĄ zostać odnotowane w jednym, centralnym rejestrze wydań**:
👉 **[VERSION_HISTORY.md](../../VERSION_HISTORY.md)**

### Zasady Postępowania:
1. **Jedno Centralne Miejsce:** Użytkownik i zespół chcą w dowolnej chwili otworzyć jeden plik [VERSION_HISTORY.md](../../VERSION_HISTORY.md) w katalogu głównym i natychmiast zobaczyć, co dokładnie wprowadziła każda wersja (np. `v2.8.40`, `v2.8.39`...).
2. **Obowiązek Aktualizacji:** Po zakończeniu implementacji zadania lub podbiciu wersji w `package.json`, agent ma obowiązek dopisać punktory z wykonanymi pracami do [VERSION_HISTORY.md](../../VERSION_HISTORY.md).
3. **Struktura wpisu:**
   - Numer wersji i data (`[vX.Y.Z] — YYYY-MM-DD`)
   - Tytuł wersji
   - Główne atuty (🌟 Co Wprowadziliśmy)
   - Zmodyfikowane kluczowe pliki
4. **Współpraca ze Skillem:** Agent może aktywować skill `version-tracker` (`.agents/skills/version-tracker/SKILL.md`) lub skorzystać z CLI `npm run changelog`.
