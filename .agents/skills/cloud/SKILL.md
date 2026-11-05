---
name: cloud
description: Chmura & Synchronizacja — architektura Multi-Tenant Silo stores/{storeId}/..., model Cloud-First z replikacją w czasie rzeczywistym i lustrem SQLite (Feature F18), kolejka sync_outbox, szyfrowanie AES-256 i synchronizacja z Firestore.
---

# /cloud — Chmura i Synchronizacja Danych

Gdy użytkownik wywołuje `/cloud`:
1. Zawęź kontekst do: `src/services/sync/`, `firestore.rules`, `electron/security/`.
2. Zapoznaj się z wytycznymi w `docs/CLOUD_AND_FLEET_ARCHITECTURE.md` oraz `docs/DATA_FLOW.md`.
3. Pamiętaj o standardach:
   - **Architektura Silo**: `stores/{storeId}/...` (bezwzględny zakaz płaskich kolekcji).
   - **Model Cloud-First Real-Time (Feature F18)**:
     - Kanał zdarzeń per lokal: `/stores/{storeId}/realtime_events/{eventId}`.
     - Transport czasu rzeczywistego `CloudRealtimeTransport` z filtrowaniem echa (`originDeviceId`).
     - Wzorzec Write-Through: `ScheduleWriteThroughRepository` (zapis lokalny SQLite + rozgłoszenie do Firestore + Outbox Fallback).
     - Inbound Sync Mirror: `InboundSyncConsumer` replikujący przychodzące zmiany z chmury do lokalnego pliku `store_${id}.db`.
   - **Odporność Offline**: Transakcyjny zapis w SQLite + kolejka Outbox w `SyncEngine` przy braku sieci.
   - **Szyfrowanie**: Szyfrowanie ładunków wrażliwych kluczem AES-256 kawiarni z powiązaniem kontekstowym AAD.
4. Zaktualizuj historię zmian w `docs/CLOUD_AND_FLEET_ARCHITECTURE.md` po modyfikacjach chmurowych.
