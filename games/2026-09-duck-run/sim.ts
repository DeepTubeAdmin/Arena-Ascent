// Duck Run — deterministic simulation core (2026-09).
//
// One lane. Obstacles rush at the player: LOW walls (jump over them, UP) and
// HIGH bars (duck under them, DOWN). Speed grows exponentially — the run is
// survivable by anyone for the first minute and by nobody past ~5 minutes.
// One shared seed per round: every player faces the identical obstacle
// schedule. Integer math only; same inputs → same result, always.

import { makePRNG, randInt } from "../../shared/prng";
import type { InputEvent } from "../../shared/types";

export const STEP_MS = 16;                     // fixed timestep
export const MAX_STEPS = 22500;                // 6-minute hard cap (unreachable)
export const GRACE_STEPS = 375;                // 6s practice: no obstacles
export const WAVE_STEPS = 625;                 // difficulty wave = 10s
export const X_SPAWN = 12000;                  // obstacle spawn distance (units)
export const PLAYER_W = 600;                   // player hitbox width (units)
export const OB_W = 700;                       // obstacle width (units)
export const JUMP_STEPS = 30;                  // airborne for 480ms per jump
export const BASE_SPEED = 60;                  // units/step at wave 0

export type ObKind = 0 | 1;                    // 0 = LOW (jump), 1 = HIGH (duck)
export interface Obstacle { spawnStep: number; kind: ObKind; }

/** Exponential speed table: ×1.12 every 10s wave, integer arithmetic.
    ~doubles each minute; ~107ms reaction windows by minute five. */
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

/** Precompute the full obstacle schedule from the seed. Same seed → same run
    for every player. Gaps tighten as waves rise (on top of the speed ramp). */
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
  cleared: number;
  jumpUntil: number;    // airborne while step < jumpUntil
  ducking: boolean;
  nextSpawn: number;    // index into schedule
  active: { x: number; kind: ObKind; spawnStep: number }[];
  deathStep: number;    // -1 while alive
}

export function initState(): RunState {
  return { step: 0, alive: true, score: 0, cleared: 0, jumpUntil: -1,
           ducking: false, nextSpawn: 0, active: [], deathStep: -1 };
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

/** Advance exactly one step. Inputs for this step are applied first, then
    physics, spawning, collision, scoring. Pure w.r.t. (schedule, inputs). */
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
    st.active.push({ x: X_SPAWN, kind: o.kind, spawnStep: o.spawnStep });
    st.nextSpawn++;
  }

  // move + collide + clear
  const v = speedAt(st.step);
  const w = waveAt(st.step);
  for (let i = st.active.length - 1; i >= 0; i--) {
    const o = st.active[i];
    o.x -= v;
    const overlapping = o.x < PLAYER_W && o.x + OB_W > 0;
    if (overlapping) {
      const safe = o.kind === 0 ? airborne(st) : st.ducking;
      if (!safe) {
        st.alive = false;
        st.deathStep = st.step;
        st.step++;
        return;
      }
    }
    if (o.x + OB_W <= 0) {
      // survived it — late obstacles pay far more than early ones
      st.cleared++;
      st.score += 40 + w * 12;
      st.active.splice(i, 1);
    }
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
