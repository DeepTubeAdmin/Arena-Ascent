// Duck Run — deterministic simulation core (2026-09).
//
// A tribute to "Twisted System" (Fuzion Frenzy, Xbox 2001): you run a
// spiralling track while cooling rods sweep at you. LOW rods you JUMP; HIGH
// rods you DUCK. The track accelerates relentlessly.
//
// Faithful to the original's core rule: a hit does NOT end the run — it knocks
// you backward toward the edge. You can take 6 hits and keep running; the 7th
// puts you in the water and the run is over.
//
// ONE shared seed per round: every player faces the identical rod schedule.
// Integer math only; same inputs → same result, always.

import { makePRNG, randInt } from "../../shared/prng";
import type { InputEvent } from "../../shared/types";

export const STEP_MS = 16;                     // fixed timestep
export const MAX_STEPS = 22500;                // 6-minute hard cap (unreachable)
export const GRACE_STEPS = 375;                // 6s practice: no rods
export const WAVE_STEPS = 625;                 // difficulty wave = 10s
export const X_SPAWN = 12000;                  // rod spawn distance (units)
export const PLAYER_W = 600;                   // player hitbox width (units)
export const OB_W = 700;                       // rod width (units)
export const JUMP_STEPS = 30;                  // airborne 480ms per jump
export const BASE_SPEED = 60;                  // units/step at wave 0
export const MAX_HITS = 7;                     // 7th hit = in the water

export type ObKind = 0 | 1;                    // 0 = LOW (jump), 1 = HIGH (duck)
export interface Obstacle { spawnStep: number; kind: ObKind; }

/** Exponential speed table: x1.12 per 10s wave, integer arithmetic.
    Roughly doubles each minute; reaction windows fall below human limits
    (~107ms) by minute five, so no one survives much past that. */
export function buildWaveSpeeds(): number[] {
  const waves = Math.ceil(MAX_STEPS / WAVE_STEPS) + 1;
  const v: number[] = [BASE_SPEED];
  for (let i = 1; i < waves; i++) v.push(Math.floor((v[i - 1] * 112) / 100));
  return v;
}
const WAVE_SPEEDS = buildWaveSpeeds();

export function speedAt(step: number): number {
  return WAVE_SPEEDS[Math.min(WAVE_SPEEDS.length - 1, Math.floor(step / WAVE_STEPS))];
}
export function waveAt(step: number): number {
  return Math.floor(step / WAVE_STEPS);
}

/** Precompute the full rod schedule from the seed. Same seed → same run for
    every player. Gaps tighten as waves rise, on top of the speed ramp. */
export function buildObstacles(seed: string): Obstacle[] {
  const rng = makePRNG("duck-run:" + seed);
  const obs: Obstacle[] = [];
  let step = GRACE_STEPS;                       // 6s of open track first
  while (step < MAX_STEPS) {
    const w = waveAt(step);
    obs.push({ spawnStep: step, kind: (randInt(rng, 0, 1) as ObKind) });
    const gapMin = Math.max(34, 110 - w * 3);
    const gapMax = Math.max(50, 170 - w * 4);
    step += randInt(rng, gapMin, gapMax);
  }
  return obs;
}

export interface RunState {
  step: number;
  alive: boolean;
  score: number;
  cleared: number;      // rods successfully jumped/ducked
  hits: number;         // rods taken to the face (7th ends the run)
  jumpUntil: number;    // airborne while step < jumpUntil
  ducking: boolean;
  nextSpawn: number;    // index into schedule
  active: { x: number; kind: ObKind; spawnStep: number; resolved: boolean }[];
  lastHitStep: number;  // for the knockback render flash (-1 = none)
  deathStep: number;    // -1 while alive
}

export function initState(): RunState {
  return { step: 0, alive: true, score: 0, cleared: 0, hits: 0, jumpUntil: -1,
           ducking: false, nextSpawn: 0, active: [], lastHitStep: -1, deathStep: -1 };
}

export function bucketInputs(log: InputEvent[]): Map<number, InputEvent[]> {
  const m = new Map<number, InputEvent[]>();
  for (const e of log) {
    const s = Math.max(0, Math.min(MAX_STEPS - 1, Math.floor(e.t / STEP_MS)));
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(e);
  }
  return m;
}

export function airborne(st: RunState): boolean { return st.step < st.jumpUntil; }

/** Advance exactly one step: inputs, then spawning, motion, resolution.
    Pure w.r.t. (schedule, inputs) — no wall clock, no RNG, no floats. */
export function stepState(st: RunState, schedule: Obstacle[], inputs: InputEvent[]) {
  if (!st.alive || st.step >= MAX_STEPS) { st.step++; return; }

  for (const e of inputs) {
    if (e.type !== "key") continue;
    const action = (e.data as any)?.action;
    if (action === "jump" && !airborne(st) && !st.ducking) {
      st.jumpUntil = st.step + JUMP_STEPS;
    } else if (action === "duckDown" && !airborne(st)) {
      st.ducking = true;
    } else if (action === "duckUp") {
      st.ducking = false;
    }
  }

  // spawn
  while (st.nextSpawn < schedule.length && schedule[st.nextSpawn].spawnStep === st.step) {
    const o = schedule[st.nextSpawn];
    st.active.push({ x: X_SPAWN, kind: o.kind, spawnStep: o.spawnStep, resolved: false });
    st.nextSpawn++;
  }

  // move, resolve, retire
  const v = speedAt(st.step);
  const w = waveAt(st.step);
  for (let i = st.active.length - 1; i >= 0; i--) {
    const o = st.active[i];
    o.x -= v;

    // Resolve ONCE, the first step the rod overlaps the player.
    if (!o.resolved && o.x < PLAYER_W && o.x + OB_W > 0) {
      o.resolved = true;
      const safe = o.kind === 0 ? airborne(st) : st.ducking;
      if (safe) {
        // cleared — late rods pay far more than early ones
        st.cleared++;
        st.score += 40 + w * 12;
      } else {
        // HIT: knocked backward toward the water. Not fatal until the 7th.
        st.hits++;
        st.lastHitStep = st.step;
        st.ducking = false;
        st.jumpUntil = -1;          // stumble: reset air/duck state
        if (st.hits >= MAX_HITS) {
          st.alive = false;
          st.deathStep = st.step;
          st.step++;
          return;
        }
      }
    }
    if (o.x + OB_W <= 0) st.active.splice(i, 1);
  }

  st.score += 1; // survival: 1 point per step lived
  st.step++;
}

/** Authoritative re-simulation: the server's score comes from here. */
export function simulate(seed: string, log: InputEvent[]): RunState {
  const schedule = buildObstacles(seed);
  const buckets = bucketInputs(log);
  const st = initState();
  while (st.alive && st.step < MAX_STEPS) {
    stepState(st, schedule, buckets.get(st.step) ?? []);
  }
  return st;
}
