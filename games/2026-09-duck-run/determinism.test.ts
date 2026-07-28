import { describe, it, expect } from "vitest";
import { simulate, buildObstacles, GRACE_STEPS, STEP_MS, MAX_HITS } from "./sim";
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

  it("clearing rods beats eating them", () => {
    const active = simulate(SEED, scriptedRun(6));
    const passive = simulate(SEED, []);
    expect(active.cleared).toBeGreaterThan(0);
    expect(active.score).toBeGreaterThan(passive.score);
  });
});
