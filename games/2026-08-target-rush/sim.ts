// Target Rush — deterministic simulation core.
// Pure function of (seed, inputLog). Shared verbatim by:
//   - Game.tsx (live play in the browser)
//   - module.ts (authoritative server-side scoring)
//   - ReplayView.tsx (operator replay)
// Rules of the file: no Math.random, no Date.now, integer math for score,
// fixed timestep. All randomness flows from the seeded PRNG, and the full
// target schedule is precomputed from the seed BEFORE any input is read, so
// RNG consumption can never depend on what the player did.

import { makePRNG, randInt } from "../../shared/prng";
import type { InputEvent } from "../../shared/types";

export const GAME_MS = 30_000;
export const STEP_MS = 16;
export const TOTAL_STEPS = Math.ceil(GAME_MS / STEP_MS); // 1875
export const ARENA = 1000; // logical coordinate space: 0..1000 square

export interface Target {
  spawnStep: number;
  despawnStep: number; // exclusive; target is active on [spawnStep, despawnStep)
  x: number;
  y: number;
  r: number;
}

export interface RushState {
  step: number;
  score: number;
  hits: number;
  misses: number;
  combo: number; // consecutive hits, capped
  /** index of the earliest target not yet resolved (hit or expired) */
  cursor: number;
  /** per-target resolution: 0 = pending, 1 = hit, 2 = expired */
  resolved: Uint8Array;
  /** step at which each hit landed (for replay/red-flag analysis); -1 if not hit */
  hitStep: Int32Array;
}

const COMBO_CAP = 10;

/** Precompute the full target schedule for a seed. Same seed → same schedule.
    DIFFICULTY RAMP: the game starts forgiving and escalates continuously —
    targets get smaller, live shorter, and arrive faster as time progresses.
    Early targets sort casual players; late targets separate the elite.
    All integer math; progress is measured in thousandths of the game. */
export function buildTargets(seed: string): Target[] {
  const rng = makePRNG("target-rush:" + seed);
  const targets: Target[] = [];
  let step = randInt(rng, 20, 45); // first spawn ~0.3–0.7s in
  while (step < TOTAL_STEPS) {
    // 0 → 1000 as the game progresses (integer thousandths)
    const prog = Math.floor((step * 1000) / TOTAL_STEPS);
    // lifetime: 45–80 steps early → 20–32 steps late (0.72–1.28s → 0.32–0.51s)
    const lifeMin = 45 - Math.floor((prog * 25) / 1000);
    const lifeMax = 80 - Math.floor((prog * 48) / 1000);
    // radius: 34–64 early → 18–30 late (big easy discs → small precise dots)
    const rMin = 34 - Math.floor((prog * 16) / 1000);
    const rMax = 64 - Math.floor((prog * 34) / 1000);
    // gap between targets: 12–28 steps early → 6–12 late (relentless endgame)
    const gapMin = 12 - Math.floor((prog * 6) / 1000);
    const gapMax = 28 - Math.floor((prog * 16) / 1000);

    const lifetime = randInt(rng, lifeMin, lifeMax);
    const r = randInt(rng, rMin, rMax);
    const x = randInt(rng, 80, ARENA - 80);
    const y = randInt(rng, 80, ARENA - 80);
    targets.push({ spawnStep: step, despawnStep: step + lifetime, x, y, r });
    step += lifetime + randInt(rng, gapMin, gapMax);
  }
  return targets;
}

export function initState(seed: string): RushState {
  const targets = buildTargets(seed);
  return {
    step: 0,
    score: 0,
    hits: 0,
    misses: 0,
    combo: 0,
    cursor: 0,
    resolved: new Uint8Array(targets.length),
    hitStep: new Int32Array(targets.length).fill(-1),
  };
}

/** The target active at a given step, or null. (Targets never overlap.) */
export function activeTargetAt(targets: Target[], state: RushState, step: number): number {
  for (let i = state.cursor; i < targets.length; i++) {
    const t = targets[i];
    if (t.spawnStep > step) return -1;
    if (state.resolved[i] === 0 && step >= t.spawnStep && step < t.despawnStep) return i;
  }
  return -1;
}

/**
 * Advance the sim by exactly ONE fixed step, applying this step's inputs.
 * Mutates and returns state. Pure w.r.t. (state, targets, inputs).
 */
export function stepState(
  state: RushState,
  targets: Target[],
  inputsThisStep: InputEvent[]
): RushState {
  const step = state.step;

  // 1) Expire any pending target whose window has passed.
  while (state.cursor < targets.length) {
    const i = state.cursor;
    if (state.resolved[i] !== 0) {
      state.cursor++;
      continue;
    }
    if (targets[i].despawnStep <= step) {
      state.resolved[i] = 2; // expired unhit
      state.combo = 0;
      state.cursor++;
      continue;
    }
    break;
  }

  // 2) Apply clicks, in order.
  for (const ev of inputsThisStep) {
    if (ev.type !== "click") continue;
    const x = ev.data.x as number;
    const y = ev.data.y as number;
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue; // reject non-integer coords
    if (x < 0 || x > ARENA || y < 0 || y > ARENA) continue;

    const idx = activeTargetAt(targets, state, step);
    if (idx >= 0) {
      const t = targets[idx];
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) {
        // HIT: base 100 + speed bonus (2/step of remaining lifetime)
        //      + combo bonus + difficulty bonus (late targets pay more —
        //      up to +200 at the very end of the ramp)
        const remaining = t.despawnStep - step;
        const prog = Math.floor((step * 1000) / TOTAL_STEPS);
        state.score += 100 + remaining * 2 + state.combo * 10 + Math.floor(prog / 5);
        state.hits += 1;
        state.combo = Math.min(state.combo + 1, COMBO_CAP);
        state.resolved[idx] = 1;
        state.hitStep[idx] = step;
        continue;
      }
    }
    // MISS: clicked empty space or outside the target
    state.misses += 1;
    state.combo = 0;
  }

  state.step = step + 1;
  return state;
}

/** Bucket an input log by fixed step. Inputs beyond the game window are dropped. */
export function bucketInputs(inputLog: InputEvent[]): Map<number, InputEvent[]> {
  const buckets = new Map<number, InputEvent[]>();
  for (const ev of inputLog) {
    if (typeof ev.t !== "number" || ev.t < 0 || ev.t >= GAME_MS) continue;
    const step = Math.floor(ev.t / STEP_MS);
    const arr = buckets.get(step);
    if (arr) arr.push(ev);
    else buckets.set(step, [ev]);
  }
  // Stable order within a step: by timestamp (ties keep log order — sort is stable).
  for (const arr of buckets.values()) arr.sort((a, b) => a.t - b.t);
  return buckets;
}

/** Run the whole game: (seed, inputLog) → final state. THE authoritative path. */
export function simulate(seed: string, inputLog: InputEvent[]): RushState {
  const targets = buildTargets(seed);
  const buckets = bucketInputs(inputLog);
  const state = initState(seed);
  for (let step = 0; step < TOTAL_STEPS; step++) {
    stepState(state, targets, buckets.get(step) ?? []);
  }
  return state;
}
