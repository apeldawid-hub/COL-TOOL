# Wytyczne Green AI i Oszczędzania Tokenów (Token Optimization)

Dokument określa bezwzględne reguły optymalizacji zużycia kontekstu i energii obliczeniowej (Green AI) dla każdego agenta AI operującego w repozytorium.

---

## ⚡ 1. Całkowity brak lania wody (Zero Fluff)
- **Zero powitań i uprzejmościowych wstępów:** Zakaz form typu "Chętnie pomogę", "Jasne, oto rozwiązanie", "Cześć".
- **Zero parafrazowania zapytania:** Zakaz powtarzania lub streszczania polecenia użytkownika przed odpowiedzią.
- **Zero zbędnych podsumowań i formułek końcowych:** Zakaz "Mam nadzieję, że to pomogło", "Daj znać w razie pytań" i rozwlekłych podsumowań. Przejdź natychmiast do meritum.

## 🎯 2. Maksymalna zwięzłość (High Information Density)
- Format odpowiedzi: preferowane punkty (bullet points), telegraficzny styl, wysoka gęstość informacji.
- Zero zbędnej teorii: przy pytaniach o kod dostarczaj bezpośrednie rozwiązanie bez akademickich wykładów i tłumaczenia podstaw, chyba że użytkownik o to wyraźnie zapyta.

## 🧹 3. Higiena narzędzi (Tool Hygiene & Context Conservation)
- **Zakaz zrzucania całych dużych plików do kontekstu:** Zawsze stosuj selektywne czytanie (`StartLine`, `EndLine`, `grep`, `head`, `tail`).
- **Filtracja wyjścia poleceń terminalowych:** Ograniczaj rozmiar logów komend przez filtry (`| grep`, `| head -n 30`), by nie zapychać okna kontekstu.
- **Minimalizacja wywołań:** Unikaj powtarzalnych i nadmiarowych operacji I/O.

## ✂️ 4. Precyzyjne edycje punktowe (Targeted Edits)
- Zawsze preferuj edycje punktowe (`edit_file`) zamiast przepisywania całych plików (`write_file`), o ile plik nie jest tworzony od nowa.
- Zmieniaj wyłącznie minimalny niezbędny blok kodu, zachowując nienaruszone otoczenie.

## 🛑 5. Zasada szybkiego błędu (Fail Fast & Clarify)
- **Fail Fast:** Po 1 nieudanym wywołaniu narzędzia natychmiast zmień podejście, zamiast ponawiać tę samą błędną próbę.
- **Brak zgadywania na zapas:** W razie braku kluczowych danych zadaj 1 krótkie, konkretne pytanie zamiast spekulować i generować wielowariantowe odpowiedzi.

---

👉 Główny rejestr architektoniczny i operacyjny projektu: **[AGENTS.md](./AGENTS.md)**
