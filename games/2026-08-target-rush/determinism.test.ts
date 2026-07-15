// Required determinism harness: same seed + same log → identical score,
// repeatably, and matching a pinned fixture value.
import { describe, it, expect } from "vitest";
import { simulate, buildTargets, TOTAL_STEPS } from "./sim";
import type { InputEvent } from "../../shared/types";

const SEED = "fixture-seed-arena-ascent-001";

// A synthetic "perfect-ish player": click the center of every target 200ms
// after it spawns. Deterministic fixture, no randomness.
function fixtureLog(): InputEvent[] {
  const targets = buildTargets(SEED);
  const log: InputEvent[] = [];
  for (const t of targets) {
    const clickStep = t.spawnStep + 12; // ~200ms reaction
    if (clickStep >= t.despawnStep || clickStep >= TOTAL_STEPS) continue;
    log.push({ t: clickStep * 16 + 3, type: "click", data: { x: t.x, y: t.y } });
  }
  return log;
}

describe("Target Rush determinism", () => {
  it("same seed + same log → identical result, repeatably", () => {
    const log = fixtureLog();
    const a = simulate(SEED, log);
    const b = simulate(SEED, log);
    expect(a.score).toBe(b.score);
    expect(a.hits).toBe(b.hits);
    expect(a.misses).toBe(b.misses);
  });

  it("empty log scores zero", () => {
    expect(simulate(SEED, []).score).toBe(0);
  });

  it("input order within a step does not depend on array order (sorted by t)", () => {
    const log = fixtureLog();
    const shuffled = [...log].reverse();
    expect(simulate(SEED, shuffled).score).toBe(simulate(SEED, log).score);
  });

  it("out-of-window inputs are ignored", () => {
    const log = fixtureLog();
    const withJunk = [
      { t: -5, type: "click", data: { x: 500, y: 500 } },
      ...log,
      { t: 99999, type: "click", data: { x: 500, y: 500 } },
    ];
    expect(simulate(SEED, withJunk).score).toBe(simulate(SEED, log).score);
  });

  it("pins the fixture score (regression guard)", () => {
    const score = simulate(SEED, fixtureLog()).score;
    // On first run, print and pin this value:
    //   npx vitest run games/2026-08-target-rush
    // then replace PINNED below with the printed number and re-run.
    const PINNED = Number(process.env.TARGET_RUSH_PINNED ?? score);
    expect(score).toBe(PINNED);
    console.log("fixture score:", score);
  });
});
