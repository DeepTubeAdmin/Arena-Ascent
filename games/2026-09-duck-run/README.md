# Duck Run (2026-09)

A tribute to **Twisted System** (Fuzion Frenzy, Xbox 2001). Jump the LOW green
rods (UP / W / Space). Duck the HIGH blue rods (DOWN / S). The track
accelerates relentlessly.

**Both actions are timed.** A jump holds you airborne 480ms; a duck holds you
low 576ms and then you stand back up automatically — holding the key does NOT
extend it (no duck-camping under every high rod). Release-and-press to duck
again; releasing early stands you up early. Ducking takes timing, exactly like
jumping.

**Faithful core rule:** a hit does NOT end your run — it knocks you backward
toward the water. You survive 6 hits; the 7th puts you in the drink. The HUD's
FOOTING pips show what's left.

- ONE shared seed per round: identical rod schedule for every player.
- 6-second practice stretch with no rods (controls + rules shown on screen).
- Speed x1.12 every 10 seconds (integer table): roughly doubles each minute;
  reaction windows drop below human limits (~107ms) by ~5 minutes.
- Spacing is RELATIVE to travel time (~2.5 rods on screen), not a fixed step
  count — fixed gaps would thin the track out as speed rises. A floor of
  MIN_GAP_STEPS keeps every rod individually answerable.
- Scoring: +1 per step survived, +(40 + wave x12) per rod cleared — late rods
  pay many times more than early ones, so surviving the ramp is what wins.
- Integer math, fixed 16ms timestep, 6-minute hard cap (unreachable).
- Rendering uses sub-step interpolation (cosmetic only) and a throttled React
  HUD, per the performance requirements in ADDING_A_MONTHLY_GAME.md.

Deterministic contract: `simulate(seed, inputLog)` reproduces the exact run.
The rod schedule is precomputed from the seed before any input is read.
