# Target Rush (2026-08)

Click the targets before they vanish. 30 seconds, one attempt.

- ONE shared seed per round: every entrant faces the exact same target
  schedule. No player gets a luckier layout.
- DIFFICULTY RAMP: starts forgiving, escalates continuously. Targets shrink
  (r 34–64 → 18–30), live shorter (0.72–1.28s → 0.32–0.51s), and arrive
  faster as the 30 seconds progress. Early targets sort casual players; the
  final seconds separate the elite.
- Scoring per hit: 100 base + 2/step speed bonus (remaining lifetime)
  + 10 × combo streak (cap 10) + difficulty bonus (up to +200 late-game).
- Miss (empty click or expired target): combo resets.
- Integer scoring, fixed 16ms timestep, ~1875 steps.

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run and
score. The full target schedule is precomputed from the seed before any input
is read, so RNG consumption never depends on player behavior.
