// One GameModule per month, registered by id. The stub module lets the whole
// pipeline (scoring, replay, settlement) be tested with no real game.
import type { GameModule, InputEvent } from "../../../shared/types";
import { TargetRushModule } from "../../../games/2026-08-target-rush/module";

export const StubModule: GameModule = {
  id: "stub",
  async computeScore(inputLog: InputEvent[]) {
    // Deterministic toy scoring: count "point" events.
    const score = inputLog.filter((e) => e.type === "point").length;
    return { score, detail: { events: inputLog.length } };
  },
  async buildReplay(inputLog, seed) {
    return { seed, inputLog, meta: { game: "stub" } };
  },
};

const modules: Record<string, GameModule> = {
  [StubModule.id]: StubModule,
  [TargetRushModule.id]: TargetRushModule,
};

export function getGameModule(id: string): GameModule {
  const m = modules[id];
  if (!m) throw new Error(`unknown game module: ${id}`);
  return m;
}
