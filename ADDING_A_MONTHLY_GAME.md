# How to Add Next Month's Game

A step-by-step guide for building a new monthly tournament game that drops into the
platform with zero changes to contracts, payments, auth, lobby, settlement, or the
replay viewer.

The platform is game-agnostic. It handles wallets, entry fees, the live window, the
single-attempt session, input streaming, on-chain settlement, and replay playback.
Your job each month is to supply **one game that is a deterministic function of a
seed and an input log.** If you honor that contract, everything else just works.

---

## The one rule that governs everything

> **Given the same `seed` and the same `inputLog`, the game must reproduce the
> exact same run and the exact same score — every time, on any machine.**

This determinism is what makes three things possible at once:

- **Authoritative scoring** — the server re-derives the score from scratch, so a
  cheating client can't submit a fake score (the score is *derived*, never *trusted*).
- **Replay** — the operator re-runs the winning session from stored data before
  paying out.
- **Fairness** — every entrant plays a game generated from a seed, reproducible and
  auditable.

If determinism breaks, scoring and replay both break. Everything below exists to
protect it.

---

## What you deliver each month

Three code pieces plus one registration entry:

1. **A shared simulation core** (`sim.ts`) — the deterministic game logic, a pure
   function of `(seed, inputs)`. Used by BOTH the browser and the server.
2. **A React game component** (`Game.tsx`) — mounts at the platform's game slot,
   runs the sim for live play, and emits input events. Rendering + input only.
3. **A GameModule** (`module.ts`) — wraps the sim for the backend: `computeScore`
   and `buildReplay`.
4. **A round registration** — a config/DB entry pointing a round at this module's
   `id`.

Directory convention:

```
/games/2026-08-tunnel-runner/
  sim.ts        # deterministic core (shared)
  Game.tsx      # frontend component (mount point)
  module.ts     # backend GameModule (computeScore + buildReplay)
  assets/       # bundled, no runtime fetches
  README.md     # one-line description + scoring rules
```

---

## The interfaces you implement

All shared types live in `/shared`. Do not redefine them locally — import them so
client and server agree on what a log means.

```typescript
// --- provided by the platform, in /shared ---

interface InputEvent {
  t: number;          // ms since game start (game-relative, NOT wall-clock)
  type: string;       // "keydown", "pointermove", "tap", etc.
  data: Record<string, unknown>;  // e.g. { key: "ArrowLeft" } or { x, y }
}

interface RunSummary {
  endedAt: number;    // game-relative ms when the run ended
  reason: "completed" | "died" | "timeout";
}

interface ScoreResult {
  score: number;      // the authoritative number that ranks players
  detail?: Record<string, unknown>;  // optional breakdown for transparency
}

interface ReplayArtifact {
  seed: string;
  inputLog: InputEvent[];
  // any extra metadata your replay viewer needs; keep it serializable
  meta?: Record<string, unknown>;
}

// what the frontend game component receives from the shell:
interface GameProps {
  seed: string;
  onInput: (event: InputEvent) => void;
  onReady: () => void;
  onComplete: (summary: RunSummary) => void;
}

// what the backend imports for the month:
interface GameModule {
  id: string;
  computeScore(inputLog: InputEvent[], seed: string): Promise<ScoreResult>;
  buildReplay(inputLog: InputEvent[], seed: string): Promise<ReplayArtifact>;
}
```

---

## Step 1 — Write the deterministic simulation core (`sim.ts`)

This is the heart of the month's work. Model the game as a **fixed-timestep
simulation** that advances in discrete steps, consuming inputs stamped to those
steps. The same code runs in the browser (for live play) and on the server (for
scoring and replay).

```typescript
// sim.ts — shared by client and server

const STEP_MS = 16;  // fixed timestep; sim advances in 16ms increments

// Seeded PRNG — the ONLY source of randomness allowed anywhere in the game.
// (mulberry32 shown; any deterministic, seedable PRNG is fine.)
function makePRNG(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameState {
  step: number;
  score: number;
  alive: boolean;
  // ... all game-relevant state (positions, obstacles, etc.)
}

export function initState(seed: string): { state: GameState; rng: () => number } {
  const rng = makePRNG(seed);
  const state: GameState = { step: 0, score: 0, alive: true };
  // seed-driven level generation goes here, using rng()
  return { state, rng };
}

// Advance the sim by exactly one fixed step, applying any inputs for this step.
// MUST be pure w.r.t. (state, inputsThisStep, rng) — no Date.now(), no Math.random().
export function stepState(
  state: GameState,
  inputsThisStep: InputEvent[],
  rng: () => number
): GameState {
  // apply inputs, advance physics with integer/fixed-point math, update score
  // return the new state
  return state;
}

// Run the whole game from seed + full input log → final state.
// This is what BOTH scoring and replay build on.
export function simulate(seed: string, inputLog: InputEvent[]): GameState {
  const { state, rng } = initState(seed);
  let s = state;
  let cursor = 0;
  const totalSteps = /* derive from window length, e.g. */ Math.ceil(30_000 / STEP_MS);

  for (let step = 0; step < totalSteps && s.alive; step++) {
    const stepStartMs = step * STEP_MS;
    const stepEndMs = stepStartMs + STEP_MS;
    const inputsThisStep: InputEvent[] = [];
    while (cursor < inputLog.length && inputLog[cursor].t < stepEndMs) {
      inputsThisStep.push(inputLog[cursor]);
      cursor++;
    }
    s = { ...s, step };
    s = stepState(s, inputsThisStep, rng);
  }
  return s;
}
```

The key discipline: **all game state derives from the seed and the input log,
stepped at a fixed rate.** Nothing else may influence the outcome.

---

## Step 2 — Write the frontend game component (`Game.tsx`)

The shell hands you `seed` and callbacks. You run the sim for live play, render it,
capture the player's input, and emit an `InputEvent` for every meaningful action.
You do **not** report a trusted score.

```tsx
// Game.tsx — mounts at the platform game slot
import { useEffect, useRef } from "react";
import { initState, stepState, GameState } from "./sim";

const STEP_MS = 16;

export default function Game({ seed, onInput, onReady, onComplete }: GameProps) {
  const stateRef = useRef<GameState | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const { state } = initState(seed);
    stateRef.current = state;
    onReady();                       // tell the shell we're loaded; shell gates start
    startRef.current = performance.now();

    let raf = 0;
    let lastStep = -1;

    const loop = (now: number) => {
      const elapsed = now - startRef.current;         // game-relative time
      const targetStep = Math.floor(elapsed / STEP_MS);

      // advance the sim in fixed steps up to the current wall-clock position
      while (lastStep < targetStep && stateRef.current?.alive) {
        lastStep++;
        stateRef.current = stepState(stateRef.current!, /*inputs buffered for this step*/ [], /* rng from init */ () => 0);
      }

      // render stateRef.current here (canvas/DOM) — display-only local score is fine

      if (stateRef.current && !stateRef.current.alive) {
        onComplete({ endedAt: elapsed, reason: "died" });
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const onKey = (e: KeyboardEvent) => {
      const ev: InputEvent = {
        t: performance.now() - startRef.current,       // game-relative ms
        type: "keydown",
        data: { key: e.key },
      };
      onInput(ev);            // stream to the shell → backend stores it
      // also buffer locally so the live sim applies it this step
    };

    window.addEventListener("keydown", onKey);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [seed]);

  return <canvas /* your render target */ />;
}
```

Component rules:

- **Seed everything from `seed`.** No `Math.random()`, no `Date.now()` in game logic.
- **Emit an `InputEvent` for every meaningful action** with a game-relative `t`.
  The log is the only record; anything not emitted didn't happen.
- **Never send a trusted score.** A local display score is fine for the player, but
  the backend recomputes the real one.
- **Self-contained.** No network calls, bundle all assets, rely only on `GameProps`.
- **Wait for the shell's start gate** after `onReady()` — the shell synchronizes the
  live window start.

---

## Step 3 — Write the backend GameModule (`module.ts`)

Thin wrapper over the shared sim. `computeScore` re-simulates and returns the
authoritative score. `buildReplay` packages what the replay viewer needs.

```typescript
// module.ts — imported by the backend for this round
import { simulate } from "./sim";

export const TunnelRunnerModule: GameModule = {
  id: "2026-08-tunnel-runner",

  async computeScore(inputLog, seed) {
    const finalState = simulate(seed, inputLog);   // re-derive from scratch
    return {
      score: finalState.score,
      detail: { steps: finalState.step, survived: finalState.alive },
    };
  },

  async buildReplay(inputLog, seed) {
    return { seed, inputLog, meta: { id: "2026-08-tunnel-runner" } };
  },
};
```

Because `computeScore` re-runs the same `simulate()` the client used, the server's
score is authoritative and a tampered client score is simply never accepted.

---

## Step 4 — Register the game for a round

Point the round at your module's `id` (config or admin dashboard, per the platform's
round-creation flow). No other wiring. The shell loads `Game.tsx` at the mount point;
the backend loads the matching `GameModule` for scoring and replay.

---

## Determinism checklist (run through this before shipping every month)

These are the things that silently break determinism. Verify each:

- [ ] **No `Math.random()` anywhere in game logic** — all randomness flows from the
      seeded PRNG.
- [ ] **No `Date.now()` / `performance.now()` inside the sim** — wall-clock is only
      used to decide *how many fixed steps* to advance, never inside game state.
- [ ] **Fixed timestep, not frame-rate-dependent.** The sim steps in constant
      increments; a 30fps and 144fps machine produce identical results.
- [ ] **Integer / fixed-point math for anything affecting score.** Avoid
      accumulating floats where drift could change the outcome across machines.
- [ ] **Input log is complete.** Everything that affects the run is either derived
      from the seed or captured as an `InputEvent`. Nothing relies on unrecorded
      state.
- [ ] **`simulate(seed, log)` gives the same score on client and server.** Test this
      explicitly (see below).

---

## Required test before you ship (determinism harness)

Add one test per game that proves client and server agree:

```typescript
// determinism.test.ts
import { simulate } from "./sim";

test("same seed + same log → identical score, repeatably", () => {
  const seed = "test-seed-123";
  const log = loadFixtureInputLog();          // a recorded sample run
  const a = simulate(seed, log).score;
  const b = simulate(seed, log).score;
  expect(a).toBe(b);                          // repeatable
  // and pin the expected value so regressions are caught:
  expect(a).toBe(EXPECTED_SCORE_FOR_FIXTURE);
});
```

Also run the recorded log through the **stub pipeline end-to-end** on Arbitrum
Sepolia before the real event: create a test round → enter with two wallets →
go live → submit the recorded input logs → confirm `computeScore` ranks them →
settle → replay the winning run in the operator console → confirm it plays back
identically → pay out. This is your monthly dry run.

---

## The bot tension (design each game aware of it)

Deterministic, replayable games are, by nature, the **most automatable** ones — a
script can read the game state and play near-perfectly. Determinism is required by
the infrastructure, so you cannot design it away. Instead:

- **Design for perceptual judgment / continuous control over frame-perfect timing.**
  Games decided by reading an ambiguous situation and choosing well resist bots
  better than games decided by hitting an exact millisecond.
- **Rely on the mandatory human replay review as the backstop.** Before any payout,
  the operator watches the winning run; a bot's input log looks inhumanly regular
  (impossibly consistent timing, no micro-variance). This is why the replay step is
  non-negotiable — it's what keeps determinism from becoming a cheating vector.

Both facts are true at once: the platform requires determinism, and human review is
what makes that safe. Build each month's game holding both in mind.

---

## Quick reference — the monthly checklist

1. [ ] Create `/games/YYYY-MM-name/`.
2. [ ] Write `sim.ts` — fixed-timestep, seed-driven, integer-math, pure.
3. [ ] Write `Game.tsx` — runs the sim, emits `InputEvent`s, no trusted score.
4. [ ] Write `module.ts` — `computeScore` + `buildReplay` over the sim.
5. [ ] Bundle assets under `assets/` (no runtime fetches).
6. [ ] Pass the determinism checklist + determinism test.
7. [ ] Register the round against the module `id`.
8. [ ] Run the full dry run on Arbitrum Sepolia with the stub pipeline.
9. [ ] Confirm replay plays back identically in the operator console.
10. [ ] Ship. Keep the game logic private until the live window opens.
