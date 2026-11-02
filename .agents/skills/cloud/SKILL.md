---
name: cloud
description: Chmura & Synchronizacja — architektura Multi-Tenant Silo stores/{storeId}/..., kolejka sync_outbox, szyfrowanie AES-256 i synchronizacja z Firestore.
---

# /cloud — Chmura i Synchronizacja Danych

Gdy użytkownik wywołuje `/cloud`:
1. Zawęź kontekst do: `src/services/sync/`, `firestore.rules`, `electron/security/`.
2. Zapoznaj się z wytycznymi w `docs/CLOUD_AND_FLEET_ARCHITECTURE.md` oraz `docs/DATA_FLOW.md`.
3. Pamiętaj o standardach:
   - Architektura Silo: `stores/{storeId}/...` (bezwzględny zakaz płaskich kolekcji).
   - Mechanizm Local-First Outbox: transakcyjny zapis w SQLite + cichy push do chmury w tle.
   - Szyfrowanie ładunków wrażliwych kluczem AES-256 kawiarni.
4. Zaktualizuj historię zmian w `docs/CLOUD_AND_FLEET_ARCHITECTURE.md` po modyfikacjach chmurowych.
