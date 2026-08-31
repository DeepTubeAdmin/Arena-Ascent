# Tower Stack (2026-10)

A tribute to the classic arcade stacker machines. One button: SPACE (or click)
freezes the bouncing row over your stack. Blocks without support below are
chopped. Miss entirely and the run ends.

- Board: 15 columns, 20 rows visible (camera follows the tower). Rows start
  5-wide; the cap loses one block every 10 rows (5/4/3/2/1 at rows 1/11/21/
  31/41), and chopping can narrow you further.
- Speed: 5% faster every row (integer table), from 160ms/column down to a
  32ms/column floor around row 33 — 2-wide and 1-wide at floor speed are
  beyond human timing (hard cap 60 rows / 6 minutes).
- MINOR (row 20) and MAJOR (row 40) milestone lines pay bonuses (+500/+2000);
  the tower keeps going — no top, so scores form a skill continuum.
- Shot clock: 10 seconds per row. Hesitation ends the run (anti-stall).
- Scoring: overlap × (25 + row×12) per placement + milestone bonuses. Late
  rows pay many times more than early ones.
- ONE shared seed per round (identical bounce phases for every player);
  30-second instruction grace before row 1 moves; integer math, fixed 16ms
  steps; sub-step render interpolation (cosmetic) and throttled HUD per the
  performance rules.

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run.
