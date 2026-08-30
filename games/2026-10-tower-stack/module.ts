// Tower Stack — backend GameModule. computeScore re-simulates from scratch;
// its result is the ONLY trusted score.
import { simulate, STEP_MS } from "./sim";
import type { GameModule, InputEvent } from "../../shared/types";

export const TowerStackModule: GameModule = {
  id: "2026-10-tower-stack",
  async computeScore(inputLog: InputEvent[], seed: string) {
    const final = simulate(seed, inputLog);
    return {
      score: final.score,
      detail: {
        rows: final.level,
        perfect: final.perfect,
        endReason: final.endReason,
        survivedMs: final.step * STEP_MS,
      },
    };
  },
  async buildReplay(inputLog: InputEvent[], seed: string) {
    return { seed, inputLog, meta: { game: "2026-10-tower-stack" } };
  },
};
