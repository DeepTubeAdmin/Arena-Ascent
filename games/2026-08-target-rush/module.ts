// Target Rush — backend GameModule. The tournament core calls computeScore;
// the returned score is the ONLY trusted score. It re-simulates from scratch.

import { simulate } from "./sim";
import type { GameModule, InputEvent } from "../../shared/types";

export const TargetRushModule: GameModule = {
  id: "2026-08-target-rush",

  async computeScore(inputLog: InputEvent[], seed: string) {
    const final = simulate(seed, inputLog);
    return {
      score: final.score,
      detail: {
        hits: final.hits,
        misses: final.misses,
        accuracy:
          final.hits + final.misses > 0
            ? Math.round((final.hits * 1000) / (final.hits + final.misses)) / 10
            : 0,
      },
    };
  },

  async buildReplay(inputLog: InputEvent[], seed: string) {
    return { seed, inputLog, meta: { game: "2026-08-target-rush" } };
  },
};
