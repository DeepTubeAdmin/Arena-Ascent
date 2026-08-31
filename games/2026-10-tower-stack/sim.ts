// Tower Stack — deterministic simulation core (2026-10).
// A tribute to the classic arcade stacker machines: a row of blocks bounces
// across a 15-column board; press to freeze it; blocks without support below
// are chopped off; miss entirely and the run ends. The row starts 5 wide and
// loses a block every 10 levels; speed compounds every row; unlike the arcade
// there is no top — the tower continues until skill runs out.
//
// ONE shared seed per round: identical motion pattern for every player.
// Integer math only; same inputs → same result, always.

import { makePRNG, randInt } from "../../shared/prng";
import type { InputEvent } from "../../shared/types";

export const STEP_MS = 16;
export const MAX_STEPS = 22500;          // 6-minute hard cap
export const GRACE_STEPS = 1875;         // 30s: read the instructions, row parked
export const COLS = 15;                  // board width
export const MAX_LEVELS = 60;            // structural cap (unreachable)
export const ROW_TIMEOUT_STEPS = 625;    // 10s shot clock per row — hesitation ends the run

/** Width cap by level: 5-wide to start, one block narrower every 10 levels
    (5 / 4 / 3 / 2 / 1 at levels 0 / 10 / 20 / 30 / 40+). */
export function capAt(level: number): number {
  return Math.max(1, 5 - Math.floor(level / 10));
}

/** Steps per one-column move, by level: 10 (160ms) shrinking 5%/row to a
    floor of 2 (32ms/column, reached ~level 32). Integer table. */
export function buildSpeeds(): number[] {
  const out: number[] = [];
  let milli = 10000;
  for (let i = 0; i < MAX_LEVELS + 1; i++) {
    out.push(Math.max(2, Math.floor(milli / 1000)));
    milli = Math.floor((milli * 95) / 100);
  }
  return out;
}
const SPEEDS = buildSpeeds();
export function speedAt(level: number): number {
  return SPEEDS[Math.min(SPEEDS.length - 1, level)];
}

/** Per-level start phase for the bounce pattern, from the shared seed. */
export function buildStartPhases(seed: string): number[] {
  const rng = makePRNG("tower-stack:" + seed);
  const phases: number[] = [];
  for (let i = 0; i < MAX_LEVELS + 1; i++) {
    phases.push(randInt(rng, 0, 2 * (COLS - 1) - 1)); // widest period bound
  }
  return phases;
}

/** Leftmost column of a `width`-wide row, `stepsInRow` steps after the row
    started, ping-ponging across the board. Pure integer function. */
export function rowPos(level: number, width: number, phase: number, stepsInRow: number): number {
  const span = COLS - width;               // rightmost leftmost-position
  if (span <= 0) return 0;
  const period = 2 * span;
  const cell = (Math.floor(stepsInRow / speedAt(level)) + (phase % period)) % period;
  return cell <= span ? cell : period - cell;
}

export interface StackState {
  step: number;
  alive: boolean;
  score: number;
  level: number;        // current row being aimed (0-based; row N = level N)
  width: number;        // current moving row's width
  belowStart: number;   // support row: leftmost col
  belowWidth: number;   // support row: width (0 only before any placement? no — base floor)
  rowStartStep: number; // when the current row began moving
  placed: { start: number; width: number }[]; // history for rendering/replay
  perfect: number;      // full-overlap placements
  endReason: "" | "miss" | "timeout" | "cap";
}

export function initState(): StackState {
  return {
    step: 0, alive: true, score: 0, level: 0, width: capAt(0),
    belowStart: 0, belowWidth: COLS,      // the floor supports everything
    rowStartStep: GRACE_STEPS,            // row 1 starts moving after the grace
    placed: [], perfect: 0, endReason: "",
  };
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

/** Resolve a drop (or shot-clock expiry) at the current step. */
function resolveDrop(st: StackState, phases: number[]) {
  const pos = rowPos(st.level, st.width, phases[st.level], st.step - st.rowStartStep);
  const lo = Math.max(pos, st.belowStart);
  const hi = Math.min(pos + st.width, st.belowStart + st.belowWidth);
  const overlap = Math.max(0, hi - lo);

  if (overlap === 0) {
    st.alive = false;
    st.endReason = "miss";
    return;
  }
  if (overlap === st.width) st.perfect++;
  st.placed.push({ start: lo, width: overlap });
  // Placement pay scales hard with height: late rows are worth many times
  // early ones, so surviving the speed ramp is what wins.
  st.score += overlap * (25 + st.level * 12);
  if (st.level === 19) st.score += 500;    // MINOR line (row 20)
  if (st.level === 39) st.score += 2000;   // MAJOR line (row 40)

  st.level++;
  if (st.level >= MAX_LEVELS) { st.alive = false; st.endReason = "cap"; return; }
  st.belowStart = lo;
  st.belowWidth = overlap;
  st.width = Math.min(capAt(st.level), overlap);
  st.rowStartStep = st.step + 1;
}

/** Advance exactly one step. Pure w.r.t. (phases, inputs). */
export function stepState(st: StackState, phases: number[], inputs: InputEvent[]) {
  if (!st.alive || st.step >= MAX_STEPS) { st.step++; return; }

  if (st.step >= GRACE_STEPS) {
    let dropped = false;
    for (const e of inputs) {
      if (e.type === "key" && (e.data as any)?.action === "drop" && !dropped) {
        dropped = true;
        resolveDrop(st, phases);
        if (!st.alive) { st.step++; return; }
      }
    }
    // Shot clock: a row left bouncing too long ends the run. Anti-stall —
    // a tournament attempt cannot idle indefinitely.
    if (!dropped && st.step - st.rowStartStep >= ROW_TIMEOUT_STEPS) {
      st.alive = false;
      st.endReason = "timeout";
      st.step++;
      return;
    }
  }
  st.step++;
}

/** Authoritative re-simulation: the server's score comes from here. */
export function simulate(seed: string, log: InputEvent[]) {
  const phases = buildStartPhases(seed);
  const buckets = bucketInputs(log);
  const st = initState();
  while (st.alive && st.step < MAX_STEPS) {
    stepState(st, phases, buckets.get(st.step) ?? []);
  }
  if (st.alive) { st.alive = false; st.endReason = "timeout"; }
  return st;
}
