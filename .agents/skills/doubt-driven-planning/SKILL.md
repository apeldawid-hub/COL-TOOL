---
name: doubt-driven-planning
description: >-
  Przemyślana inżynieria i weryfikacja założeń przed implementacją (Doubt-Driven Development & Spec-First Engineering)
  inspirowana addyosmani/agent-skills. Wymusza postawę adwersarza, badanie blast radius, weryfikację norm Kodeksu Pracy,
  wzorców P&L i granic zaufania przed jakąkolwiek modyfikacją kodu w Starbucks Operations Suite.
---

# 🧠 Doubt-Driven Planning & Thoughtful Engineering (COL Tool)

Skill definiuje procedurę krytycznej weryfikacji założeń i zdyscyplinowanego planowania przed przystąpieniem do modyfikacji kodu źródłowego, algorytmów obliczeniowych, bazy danych czy reguł grafiku w **Starbucks Operations Suite**.

Wzorzec eliminuje typowe wady autonomicznych agentów: nadmierną pewność siebie (overconfidence), dryf kontekstu oraz ciche wprowadzanie błędnych założeń w newralgicznych obszarach (Kodeks Pracy, finanse P&L, synchronizacja Multi-Tenant).

---

## 🔄 Pętla Przemyślanej Inżynierii (5-Step Loop)

Każda nietrywialna zmiana w silnikach (`calculationEngine`, `managerScheduleEngine`, `torEngine`, `syncService`) musi przejść przez 5-fazowy cykl:

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌───────────┐      ┌──────────┐
│  CLAIM  │ ───> │  DOUBT  │ ───> │  SPEC   │ ───> │ IMPLEMENT │ ───> │  VERIFY  │
│ Założenia    │ │ (Adwersarz) │ │ Kontrakt    │ │ Punktowo    │ │ npm run check │
└─────────┘      └─────────┘      └─────────┘      └───────────┘      └──────────┘
```

---

## 1. Faza CLAIM (Wyodrębnienie Założeń i Twierdzeń)
Przed dotknięciem kodu agent formułuje zwięzłe twierdzenia:
* **CLAIM:** Co zakładamy o istniejącym kodzie, typach TypeScript, IPC Electrona lub zachowaniu środowiska?
* **IMPACT / BLAST RADIUS:** Co ulegnie awarii, jeśli założenie jest błędne? (np. rozjechanie grafiku, błąd w bilansie TOR, rozbieżność w narzucie ZUS, wyciek danych między kawiarniami).
* **EVIDENCE:** W którym pliku i linii kodu znajduje się dowód potwierdzający to założenie (link `file:///...`)?

---

## 2. Faza DOUBT (Postawa Adwersarza — Biased to Disprove)
Agent przyjmuje rolę recenzenta nastawionego na obalenie założeń w 4 kluczowych domenach:
1. **Reguły Kodeksu Pracy i Operacyjne Starbucks:**
   - Czy zmiana nie narusza bazy **Floor Hours 32.0h/dzień (224h/tydzień)**?
   - Czy nie dochodzi do złamania art. 132 KP (11h dobowego odpoczynku) lub 133 KP (35h tygodniowego odpoczynku)?
   - Czy poprawnie obsłużono 4. wolną niedzielę w miesiącu i status niedzieli handlowej?
2. **Finanse P&L i Zaokrąglenia:**
   - Czy wzory uwzględniają narzut ZUS 19.48% i odrębne stawki UoP vs UZ?
   - Czy dzielenie przez zero w TPLH ($\text{TRX} / \text{Godziny}$) jest bezpiecznie zabezpieczone?
   - Czy nie dochodzi do kumulacji błędów zmiennoprzecinkowych (floating-point drift)?
3. **Multi-Tenant Silo i Bezpieczeństwo Danych:**
   - Czy operacja jest ściśle przypisana do `stores/{storeId}/...`?
   - Czy lokalna baza SQLite (`store_${safeId}.db`) w `Application Support` nie jest narażona na korupcję danych?
4. **Zasada Green AI i Minimalnej Ingerencji:**
   - Czy planujemy punktową edycję (`edit_file`), czy nadmiarowe przepisywanie całych plików?

---

## 3. Faza SPEC (Specyfikacja Kontraktu Przed Kodowaniem)
Przed napisaniem implementacji agent precyzuje:
* Dokładne nazwy plików i lokalizacje.
* Interfejsy i sygnatury TypeScript (jawne typowanie, zakaz `any`).
* Obsługę błędów (jawne logowanie w loggerze aplikacji, zakaz cichego połykania wyjątków).
* **Kryteria Akceptacji (Acceptance Criteria):** Jakie 2-3 twarde warunki muszą zostać spełnione, by uznać zadanie za wykonane?

---

## 4. Faza IMPLEMENT (Inkrementalna Implementacja & Reconcile)
* Realizacja ściśle według specyfikacji z Fazy 3.
* W razie napotkania nieprzewidzianej trudności — **STOP**. Agent natychmiast uzgadnia wątpliwość zamiast stosować maskujące obejścia.
* Zmiana wyłącznie minimalnego niezbędnego bloku kodu.

---

## 5. Faza VERIFY & AUTO-SYNC (Bramka Jakościowa i Dokumentacyjna)
1. **Pre-flight Gate:** Uruchomienie `npm run check` (weryfikacja schematów IPC, typów TypeScript i automatyczna naprawa wpisów).
2. **Reguła 0.2 `AGENTS.md`:** Natychmiastowa aktualizacja:
   - `AGENTS.md` modyfikowanego modułu,
   - `src/modules/{modul}/CHANGELOG.md`,
   - `VERSION_HISTORY.md` (jeśli dotyczy wydania/patcha).
