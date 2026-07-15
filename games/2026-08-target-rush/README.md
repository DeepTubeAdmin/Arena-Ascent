# Target Rush (2026-08)

Click the targets before they vanish. 30 seconds, one attempt.

- One target on screen at a time, spawn schedule fully derived from the seed.
- Hit: 100 base + 2/step speed bonus (remaining lifetime) + 10 x combo streak (cap 10).
- Miss (empty click or expired target): combo resets.
- Integer scoring, fixed 16ms timestep, ~1875 steps.

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run and
score. The full target schedule is precomputed from the seed before any input
is read, so RNG consumption never depends on player behavior.
