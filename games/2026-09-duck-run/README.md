# Duck Run (2026-09)

Jump the low walls (UP / W / Space). Duck the high bars (DOWN / S, hold).
One lane, one life, exponentially accelerating obstacles.

- ONE shared seed per round: identical obstacle schedule for every player.
- 6-second practice stretch with no obstacles (keys shown on screen).
- Speed ×1.12 every 10 seconds (integer table): casual players fall inside
  two minutes; reaction windows drop below human limits (~107ms) by ~5 min,
  making longer survival impossible by design.
- Scoring: +1 per step survived, + (40 + wave×12) per obstacle cleared —
  late-game obstacles pay many times more than early ones.
- Integer math, fixed 16ms timestep, 6-minute hard cap (unreachable).

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run and
score. The obstacle schedule is precomputed from the seed before any input is
read; RNG consumption never depends on player behavior.
