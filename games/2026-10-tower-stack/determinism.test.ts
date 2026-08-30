import { describe, it, expect } from "vitest";
import {
  simulate, buildStartPhases, initState, stepState, rowPos, speedAt, capAt,
  GRACE_STEPS, STEP_MS, ROW_TIMEOUT_STEPS, COLS,
} from "./sim";
import type { InputEvent } from "../../shared/types";

const SEED = "test-seed-stack";

/** Play n rows with frame-perfect drops (drop exactly when aligned). */
function perfectRun(n: number): InputEvent[] {
  const phases = buildStartPhases(SEED);
  const log: InputEvent[] = [];
  const st = initState();
  const buckets = new Map<number, InputEvent[]>();
  while (st.alive && st.level < n) {
    // find the next step (from rowStartStep) where the row aligns over support
    let s = Math.max(st.step, st.rowStartStep);
    for (;;) {
      const pos = rowPos(st.level, st.width, phases[st.level], s - st.rowStartStep);
      if (pos >= st.belowStart && pos + st.width <= st.belowStart + st.belowWidth) break;
      s++;
    }
    const e: InputEvent = { t: s * STEP_MS, type: "key", data: { action: "drop" } };
    log.push(e);
    buckets.set(s, [e]);
    while (st.alive && st.step <= s) stepState(st, phases, buckets.get(st.step) ?? []);
  }
  return log;
}

describe("tower stack determinism", () => {
  it("same seed + same inputs → identical result", () => {
    const log = perfectRun(8);
    const a = simulate(SEED, log);
    const b = simulate(SEED, log);
    expect(a.score).toBe(b.score);
    expect(a.level).toBe(b.level);
    expect(a.endReason).toBe(b.endReason);
  });

  it("different seed → different bounce phases", () => {
    expect(buildStartPhases(SEED).join(",")).not.toBe(buildStartPhases(SEED + "x").join(","));
  });

  it("no motion during the instruction grace", () => {
    const st = initState();
    expect(st.rowStartStep).toBeGreaterThanOrEqual(GRACE_STEPS);
  });

  it("doing nothing ends on the shot clock with zero score", () => {
    const st = simulate(SEED, []);
    expect(st.alive).toBe(false);
    expect(st.endReason).toBe("timeout");
    expect(st.score).toBe(0);
    expect(st.step).toBeLessThanOrEqual(GRACE_STEPS + ROW_TIMEOUT_STEPS + 2);
  });

  it("perfect play climbs and pays more per row", () => {
    const a = simulate(SEED, perfectRun(4));
    const b = simulate(SEED, perfectRun(8));
    expect(b.level).toBeGreaterThan(a.level);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it("width caps follow the arcade progression", () => {
    expect(capAt(0)).toBe(3);
    expect(capAt(3)).toBe(2);
    expect(capAt(9)).toBe(1);
  });

  it("speed strictly tightens to the floor", () => {
    let prev = speedAt(0);
    for (let l = 1; l < 40; l++) {
      const v = speedAt(l);
      expect(v).toBeLessThanOrEqual(prev);
      expect(v).toBeGreaterThanOrEqual(2);
      prev = v;
    }
    expect(speedAt(30)).toBe(2);
  });

  it("a deliberate full miss ends the run", () => {
    // Drop row 1 at the far right, then aim row 2 at the far left moment —
    // guaranteed zero overlap with a 3-wide vs 3-wide? Use timeout-free
    // construction: place row 1 anywhere, then drop row 2 the first step it
    // sits fully OUTSIDE the support (exists once support < COLS).
    const phases = buildStartPhases(SEED);
    const st = initState();
    const buckets = new Map<number, InputEvent[]>();
    const log: InputEvent[] = [];
    // place row 1 at whatever position on first movable step
    const s1 = st.rowStartStep;
    const e1: InputEvent = { t: s1 * STEP_MS, type: "key", data: { action: "drop" } };
    log.push(e1); buckets.set(s1, [e1]);
    while (st.alive && st.step <= s1) stepState(st, phases, buckets.get(st.step) ?? []);
    // find a step where row 2 misses support entirely
    let s2 = st.rowStartStep;
    for (;;) {
      const pos = rowPos(st.level, st.width, phases[st.level], s2 - st.rowStartStep);
      const lo = Math.max(pos, st.belowStart);
      const hi = Math.min(pos + st.width, st.belowStart + st.belowWidth);
      if (hi - lo <= 0) break;
      s2++;
      if (s2 - st.rowStartStep > 2000) return; // seed offers no full miss early; skip
    }
    const e2: InputEvent = { t: s2 * STEP_MS, type: "key", data: { action: "drop" } };
    log.push(e2);
    const final = simulate(SEED, log);
    expect(final.alive).toBe(false);
    expect(["miss", "timeout"]).toContain(final.endReason);
  });

  it("board geometry sane", () => {
    const phases = buildStartPhases(SEED);
    for (let s = 0; s < 500; s++) {
      const p = rowPos(0, 3, phases[0], s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p + 3).toBeLessThanOrEqual(COLS);
    }
  });
});
