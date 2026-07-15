// Arena Ascent — shared type contracts.
// These types are the seam between the platform and each month's game.
// Client and server both import from here so an input log means the
// same thing everywhere.

export interface InputEvent {
  /** Milliseconds since game start (game-relative, never wall-clock). */
  t: number;
  /** Event kind, e.g. "click", "keydown", "pointermove". */
  type: string;
  /** Event payload, e.g. { x, y } in game coordinates. */
  data: Record<string, unknown>;
}

export interface RunSummary {
  /** Game-relative ms when the run ended. */
  endedAt: number;
  reason: "completed" | "died" | "timeout";
}

export interface ScoreResult {
  /** The authoritative number that ranks players. Integer. */
  score: number;
  /** Optional breakdown for transparency in the admin console. */
  detail?: Record<string, unknown>;
}

export interface ReplayArtifact {
  seed: string;
  inputLog: InputEvent[];
  meta?: Record<string, unknown>;
}

/** Props the platform's GameShell passes to the monthly game component. */
export interface GameProps {
  seed: string;
  /** Report every meaningful player action. The log is the only record. */
  onInput: (event: InputEvent) => void;
  /** Game assets loaded; shell will gate the actual start. */
  onReady: () => void;
  /** Shell says GO (synchronized start). Game begins its clock at this call. */
  started: boolean;
  onComplete: (summary: RunSummary) => void;
}

/** Backend-side contract each monthly game implements. */
export interface GameModule {
  id: string;
  /** Re-simulate from scratch; the returned score is the ONLY trusted score. */
  computeScore(inputLog: InputEvent[], seed: string): Promise<ScoreResult>;
  buildReplay(inputLog: InputEvent[], seed: string): Promise<ReplayArtifact>;
}

// ---- Round lifecycle (mirrors the contract enum; keep in sync) ----
export enum RoundState {
  RegistrationOpen = 0,
  RegistrationClosed = 1,
  Live = 2,
  Settling = 3,
  Settled = 4,
  Voided = 5,
}

export const ROUND_STATE_LABEL: Record<RoundState, string> = {
  [RoundState.RegistrationOpen]: "Registration open",
  [RoundState.RegistrationClosed]: "Registration closed",
  [RoundState.Live]: "Live",
  [RoundState.Settling]: "Settling",
  [RoundState.Settled]: "Settled",
  [RoundState.Voided]: "Voided",
};
