# Task Assignment: Module 4 Codebase & Mathematical Specification Survey

## Identity
- Role: Module 4 Specification Miner
- Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4
- Parent: Orchestrator 3 (/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_3)

## Mandatory Reading
- ORIGINAL_REQUEST.md: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md (Pay special attention to ## Follow-up — 2026-10-24T00:44:10Z)
- Project rules: /Users/dawidapel/COL Tool/AGENTS.md
- Module 4 specifications: /Users/dawidapel/COL Tool/src/modules/col-calculator/AGENTS.md
- Skill col-finance: /Users/dawidapel/COL Tool/.agents/skills/col-finance/SKILL.md

## Objective
Thoroughly explore and document the current state of Module 4 (COL Calculator / Cost of Labor Suite):
1. Inspect all files in `src/modules/col-calculator/` (services, components, types, hooks, utils, tests).
2. Detail the exact mathematical specifications of the 3-Pillar Model (AOP, Target, MTD Estimation).
3. Enumerate all 66 Starbucks/AmRest indicators, formulas, inputs, outputs, and units.
4. Detail the labor economics & social contributions:
   - ZUS overheads: 16.93% employer social contributions, FP/FGŚP 2.55%, PFRON 200 PLN/FTE.
   - Separation across MGR, Crew UoP (employment contract with statutory minimum wage safeguards 2025/2026), and Crew UZ (mandate contracts with hourly rates).
   - Holiday accrual (Rezerwa urlopowa, 21-day divisor).
   - Clothing allowance (0.85 PLN/h crew, lump sum MGR).
   - Bonus matrices for SM, ASM, SSV.
   - Delivery order costs (14 PLN/order).
5. Identify current implementation gaps, missing formulas, or skeletal placeholders in `src/modules/col-calculator/`.

## Output Requirements
- Write your comprehensive survey report to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4/report.md`.
- Write your handoff summary to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4/handoff.md`.
- Send completion message to Orchestrator 3 via `send_message`.

## 2026-10-24T00:47:18Z
From: Orchestrator 3 (e0e90d1c-21db-4fb1-b71d-37affcea30eb)
Message: Read /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4/DISPATCH.md and /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md.
Perform a thorough investigation of the current state of Module 4 (COL Calculator / Cost of Labor Suite) in src/modules/col-calculator/, src/modules/col-calculator/AGENTS.md, src/modules/col-calculator/services/, and related files.
Document all 66 indicators, 3-Pillar mathematical formulas, ZUS breakdowns, holiday accruals, bonus matrices, delivery drops, and existing codebase gaps.
Write your detailed report to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4/report.md and your handoff summary to /Users/dawidapel/COL Tool/.agents/teamwork/explorer_survey_m4/handoff.md.
Send a completion message back to Orchestrator 3 (e0e90d1c-21db-4fb1-b71d-37affcea30eb).
