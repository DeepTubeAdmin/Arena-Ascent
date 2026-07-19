// Duck Run — backend GameModule. computeScore re-simulates from scratch;
// its result is the ONLY trusted score.

import { simulate, STEP_MS } from "./sim";
import type { GameModule, InputEvent } from "../../shared/types";

export const DuckRunModule: GameModule = {
  id: "2026-09-duck-run",

  async computeScore(inputLog: InputEvent[], seed: string) {
    const final = simulate(seed, inputLog);
    return {
      score: final.score,
      detail: {
        cleared: final.cleared,
        survivedMs: (final.deathStep >= 0 ? final.deathStep : final.step) * STEP_MS,
        died: !final.alive,
      },
    };
  },

  async buildReplay(inputLog: InputEvent[], seed: string) {
    return { seed, inputLog, meta: { game: "2026-09-duck-run" } };
  },
};
