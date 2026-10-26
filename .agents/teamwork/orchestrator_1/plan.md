# Project Execution Plan: Starbucks Operations Suite Hardening

## Overview
Comprehensive audit, multi-store architecture scaling (100+ stores), hybrid per-store AES-256-GCM cloud encryption, and local-to-cloud migration bridge with 100% data parity.

## Dual-Track Architecture
- **E2E Testing Track**: Autonomous test suite creation covering Tiers 1-4 (>=11*N + max(5, N/2) tests), producing `TEST_INFRA.md` and `TEST_READY.md`.
- **Implementation Track**: 
  - Survey Phase: 3 Explorers map exact inventory of hardcoded defaults, multi-store architecture, encryption requirements, and migration points. Synthesize into `PROJECT.md`.
  - Milestone 1: Deep Codebase Audit & Elimination of Mock/Hardcoded Data & AI Artifacts + Store Onboarding Flow.
  - Milestone 2: Scalable Multi-Store Architecture (100+ Stores Support, SQLite `store_${id}.db` isolation, zero leakage).
  - Milestone 3: Hybrid Per-Store AES-256-GCM Cloud Encryption & Firestore Tenant Rules Isolation.
  - Milestone 4: Local-to-Cloud Migration Bridge & Data Parity Verification.
  - Final Milestone: Pass 100% E2E Test Suite (Tiers 1-4) & Adversarial Coverage Hardening (Tier 5).

## Iteration & Verification Pattern
Each implementation milestone executes:
1. Explorer: analyzes code, constraints, failure output, defines fix/implementation strategy.
2. Worker: genuine implementation, runs build & unit tests.
3. Reviewers (2): independent code review, completeness, edge cases, build/test pass.
4. Challengers (2): stress-test, adversarial input validation, empirical verification.
5. Forensic Auditor: strict integrity check against cheating, hardcoding, dummy mocks. (Hard binary veto).
6. Gate: all criteria must pass before advancing.

## Success Criteria
- 0 occurrences of hardcoded store codes ('18120', '108120', '384') as logic fallbacks.
- 0 placeholder AI filler texts, fake employee records, or mock financial numbers in production UI.
- Fresh app launch with empty profile displays store onboarding.
- Multi-store isolation for 100+ stores with SQLite `store_${id}.db`.
- Client-side AES-256-GCM encryption for sensitive financial and HR payloads before Firestore writes.
- Firestore Security Rules enforce tenant isolation (`request.auth.token.storeId == storeId`).
- Local-to-Cloud Migration Bridge with 100% parity verification.
- `npm run build` succeeds cleanly.
