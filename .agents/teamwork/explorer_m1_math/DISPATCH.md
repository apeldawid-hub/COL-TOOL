## 2026-10-24T00:27:43Z
From: 03bbd3fb-1f39-425e-8127-f2a22610fd5f
Priority: MESSAGE_PRIORITY_HIGH

You are the Math & Forecasting Auditor (explorer_m1_math) for Module 1: Labor Forecast.
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math

MANDATORY FIRST STEP:
Read the authoritative user request at:
/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md (specifically the request from 2026-10-24T00:24:38Z).

Also read project operational context:
- /Users/dawidapel/COL Tool/AGENTS.md
- /Users/dawidapel/COL Tool/src/modules/labor-forecast/AGENTS.md
- Relevant domain skills:
  /Users/dawidapel/COL Tool/.agents/skills/col-finance/SKILL.md
  /Users/dawidapel/COL Tool/.agents/skills/integrity-sentinel/SKILL.md

STRICT CONSTRAINT:
You are in DESIGN/AUDIT MODE. Do NOT create or modify any code files in src/ or electron/. Read only! All your outputs must be written to your working directory.

MISSION:
Conduct an exhaustive mathematical, algorithmic, and statistical audit of Module 1:
1. Examine `src/modules/labor-forecast/services/calculationEngine.ts`, `src/modules/labor-forecast/services/trendLearningEngine.ts`, and related types/services.
2. Evaluate AOP day weighting ($W_i$) across the Tuesday–Monday Starbucks business cycles:
   - How are weekly sales distributed across days? Is Tuesday-Monday properly aligned with Starbucks fiscal week?
   - How does historical weighting react to shifts in trading patterns?
3. Evaluate MTD Velocity prediction, temporal states (`past`, `current`, `future`), and Earned Labor Budget calculations:
   - Mathematical formula for MTD velocity projection.
   - Transition logic between past actuals, current in-flight period, and future plan.
   - Earned Labor Budget (HANW vs target TPLH, SPLH, productivity curves).
4. Evaluate absolute enforcement of the Floor Hours rule (32.0 h/day, 224.0 h/week base):
   - 1 MGR + 1 Barista AM (8h+8h) + 1 MGR + 1 Barista PM (8h+8h) = 32h/day.
   - Flex Pool distribution: How are excess hours allocated across peak days (Friday, Saturday, trading Sunday)?
   - Does any calculation allow floor hours to be violated (e.g. low sales dropping hours below 32.0h)?
5. Evaluate Monday Flash Forecast (Pre-closing projection) and seamless Tuesday transition:
   - How does Monday forecast estimate remaining hours before final EOD actuals?
   - How does the system transition to the new fiscal week on Tuesday morning?
6. Evaluate numeric edge cases with concrete calculations:
   - Negative budget deltas (actual labor exceeding earned budget).
   - Zero TRX or zero sales days (holidays/closures vs divide-by-zero risks).
   - Extreme sales spikes (~250% norm in CH Janki trading Sundays).
   - Rounding discrepancies (integer vs float hours, fractional baristas).
   - Under-floor HANW Raw scenarios.
   - Missing Monday MAPAL actuals.

OUTPUT:
Write your full findings and evidence to `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math/report_m1_math.md`.
Also write `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math/handoff.md` and `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m1_math/progress.md`.
Finally, notify me with `send_message` summarizing your findings and linking to your report.
