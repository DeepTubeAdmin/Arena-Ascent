# Tower Stack (2026-10)

A tribute to the classic arcade stacker machines. One button: SPACE (or click)
freezes the bouncing row over your stack. Blocks without support below are
chopped. Miss entirely and the run ends.

- Board: 7 columns. Rows start 3-wide; the cap drops to 2 at row 4 and 1 at
  row 10 (as in the arcade), and chopping can narrow you further.
- Speed: ~7% faster every row (integer table), from 160ms/column down to a
  32ms/column floor — 1-wide at floor speed is beyond human timing (~row 40
  practical ceiling; hard cap at 60 rows / 6 minutes).
- MINOR (row 11) and MAJOR (row 15) milestone lines pay bonuses (+500/+2000),
  then the tower keeps going — unlike the arcade there is no top, so scores
  form a skill continuum instead of tying at "reached the prize row."
- Shot clock: 8 seconds per row. Hesitation ends the run (anti-stall — a
  tournament attempt cannot idle).
- Scoring: overlap × (25 + row×12) per placement + milestone bonuses. Late
  rows pay many times more than early ones.
- ONE shared seed per round (identical bounce phases for every player);
  6-second instruction grace before row 1 moves; integer math, fixed 16ms
  steps; sub-step render interpolation (cosmetic) and throttled HUD per the
  performance rules.

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run.
