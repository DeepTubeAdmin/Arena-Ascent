// Shared registry: gameId -> replay viewer component. Used by the operator
// settlement console AND the public winner-replay panels (Champions, Results).
// Add each new monthly game here alongside the other registries.
import type React from "react";
import type { ReplayArtifact } from "../../../shared/types";
import TargetRushReplay from "../../../games/2026-08-target-rush/ReplayView";
import DuckRunReplay from "../../../games/2026-09-duck-run/ReplayView";
import TowerStackReplay from "../../../games/2026-10-tower-stack/ReplayView";

export const REPLAY_VIEWS: Record<string, React.ComponentType<{ artifact: ReplayArtifact }>> = {
  "2026-08-target-rush": TargetRushReplay,
  "2026-09-duck-run": DuckRunReplay,
  "2026-10-tower-stack": TowerStackReplay,
};
