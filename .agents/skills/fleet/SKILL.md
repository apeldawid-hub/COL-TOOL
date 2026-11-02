---
name: fleet
description: Flota & Multilokalowość — przełącznik lokali (Store Switcher), rejestr kawiarni, separacja baz danych store_${safeId}.db i Fleet Master.
---

# /fleet — Zarządzanie Flotą Kawiarni (Fleet Management)

Gdy użytkownik wywołuje `/fleet`:
1. Zawęź kontekst do: `src/services/storeService.ts`, `src/components/admin/FleetMasterDashboard.tsx`, `src/constants/starbucksStores.ts`.
2. Zapoznaj się z regułami izolacji kawiarni w `docs/CLOUD_AND_FLEET_ARCHITECTURE.md`.
3. Pamiętaj o standardach:
   - Każda kawiarnia posiada autonomiczny plik bazy `store_${safeId}.db`.
   - Zmiana kawiarni na stacji roboczej jest chroniona przez `ProfilePolicyService`.
4. Po modyfikacji kodu sprawdź kompilację i zaktualizuj rejestr wersji.
