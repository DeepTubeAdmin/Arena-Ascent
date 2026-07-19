import { describe, it, expect } from "vitest";
import { simulate, buildObstacles, GRACE_STEPS, STEP_MS } from "./sim";
import type { InputEvent } from "../../shared/types";

const SEED = "test-seed-duck";

function scriptedRun(): InputEvent[] {
  // React to the first few obstacles of THIS seed's schedule with correct moves.
  const schedule = buildObstacles(SEED);
  const log: InputEvent[] = [];
  for (const o of schedule.slice(0, 6)) {
    const actMs = (o.spawnStep + 60) * STEP_MS; // ~1s after spawn (early waves travel ~3.2s)
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
  });

  it("different seed → different schedule", () => {
    const a = buildObstacles(SEED).map((o) => o.spawnStep).join(",");
    const b = buildObstacles(SEED + "x").map((o) => o.spawnStep).join(",");
    expect(a).not.toBe(b);
  });

  it("no obstacles during the practice grace period", () => {
    const first = buildObstacles(SEED)[0];
    expect(first.spawnStep).toBeGreaterThanOrEqual(GRACE_STEPS);
  });

  it("tampered input timing changes the outcome", () => {
    const log = scriptedRun();
    const shifted = log.map((e) => ({ ...e, t: e.t + 700 }));
    const a = simulate(SEED, log);
    const b = simulate(SEED, shifted);
    expect(a.score !== b.score || a.deathStep !== b.deathStep).toBe(true);
  });

  it("doing nothing dies at the first obstacle", () => {
    const st = simulate(SEED, []);
    expect(st.alive).toBe(false);
    expect(st.deathStep).toBeGreaterThanOrEqual(GRACE_STEPS);
  });
});
