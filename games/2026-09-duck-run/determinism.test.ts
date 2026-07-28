import { describe, it, expect } from "vitest";
import {
  simulate, buildObstacles, GRACE_STEPS, STEP_MS, MAX_HITS,
  X_SPAWN, OB_W, speedAt, MIN_GAP_STEPS,
} from "./sim";
import type { InputEvent } from "../../shared/types";

const SEED = "test-seed-duck";

function scriptedRun(n = 6): InputEvent[] {
  // React correctly to the first n rods of THIS seed's schedule.
  const schedule = buildObstacles(SEED);
  const log: InputEvent[] = [];
  for (const o of schedule.slice(0, n)) {
    const actMs = (o.spawnStep + 60) * STEP_MS;
    if (o.kind === 0) log.push({ t: actMs, type: "key", data: { action: "jump" } });
    else {
      log.push({ t: actMs, type: "key", data: { action: "duckDown" } });
      log.push({ t: actMs + 900, type: "key", data: { action: "duckUp" } });
    }
  }
  return log;
}

describe("duck run determinism", () => {
  it("same seed + same inputs → identical result", () => {
    const log = scriptedRun();
    const a = simulate(SEED, log);
    const b = simulate(SEED, log);
    expect(a.score).toBe(b.score);
    expect(a.deathStep).toBe(b.deathStep);
    expect(a.cleared).toBe(b.cleared);
    expect(a.hits).toBe(b.hits);
  });

  it("different seed → different schedule", () => {
    const a = buildObstacles(SEED).map((o) => o.spawnStep).join(",");
    const b = buildObstacles(SEED + "x").map((o) => o.spawnStep).join(",");
    expect(a).not.toBe(b);
  });

  it("no rods during the practice grace period", () => {
    expect(buildObstacles(SEED)[0].spawnStep).toBeGreaterThanOrEqual(GRACE_STEPS);
  });

  it("tampered input timing changes the outcome", () => {
    const log = scriptedRun();
    const shifted = log.map((e) => ({ ...e, t: e.t + 700 }));
    const a = simulate(SEED, log);
    const b = simulate(SEED, shifted);
    expect(a.score !== b.score || a.deathStep !== b.deathStep).toBe(true);
  });

  it("survives 6 hits and dies on the 7th (Twisted System rule)", () => {
    const st = simulate(SEED, []); // do nothing: eat every rod
    expect(st.alive).toBe(false);
    expect(st.hits).toBe(MAX_HITS);
    // died on the 7th rod, not the 1st
    const schedule = buildObstacles(SEED);
    expect(st.deathStep).toBeGreaterThanOrEqual(schedule[MAX_HITS - 1].spawnStep);
  });

  it("keeps ~2+ rods on screen through the early/mid game", () => {
    // Spacing is relative to travel time, so density must NOT thin out as the
    // track accelerates. Checked over the window where nearly all runs happen.
    const schedule = buildObstacles(SEED);
    for (let i = 0; i < schedule.length - 1; i++) {
      const step = schedule[i].spawnStep;
      if (step > 5000) break;                       // first ~80 seconds
      const gap = schedule[i + 1].spawnStep - step;
      const travel = Math.floor((X_SPAWN + OB_W) / speedAt(step));
      const onScreen = travel / gap;
      expect(onScreen).toBeGreaterThan(1.9);
    }
  });

  it("never spaces rods closer than a jump can recover", () => {
    // Sub-jump gaps would make survival depend on the seed's rod sequence
    // rather than skill — a chance element, which the design rules forbid.
    const schedule = buildObstacles(SEED);
    for (let i = 0; i < schedule.length - 1; i++) {
      expect(schedule[i + 1].spawnStep - schedule[i].spawnStep)
        .toBeGreaterThanOrEqual(MIN_GAP_STEPS);
    }
  });

  it("clearing rods beats eating them", () => {
    const active = simulate(SEED, scriptedRun(6));
    const passive = simulate(SEED, []);
    expect(active.cleared).toBeGreaterThan(0);
    expect(active.score).toBeGreaterThan(passive.score);
  });
});
