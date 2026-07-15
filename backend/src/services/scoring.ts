// Input ingestion + authoritative scoring. The client streams input event
// batches during play; at completion we run the GameModule's computeScore —
// the ONLY score the platform ever trusts.
import { q } from "../db.js";
import { getGameModule } from "../games/registry.js";
import type { InputEvent } from "../../../shared/types";

const MAX_EVENTS = 20_000; // sanity cap; a 30s game can't need more

export async function appendInputs(roundId: string, address: string, events: InputEvent[]) {
  if (!Array.isArray(events) || events.length === 0) return;
  const clean = events
    .filter((e) => typeof e?.t === "number" && typeof e?.type === "string")
    .slice(0, 500); // per-batch cap
  await q(
    `UPDATE sessions
     SET input_log = CASE WHEN jsonb_array_length(input_log) >= $3 THEN input_log
                          ELSE input_log || $4::jsonb END
     WHERE round_id=$1 AND address=$2 AND completed_at IS NULL`,
    [roundId, address, MAX_EVENTS, JSON.stringify(clean)]
  );
}

export async function completeSession(roundId: string, address: string) {
  const rows = await q(
    `UPDATE sessions SET completed_at = now()
     WHERE round_id=$1 AND address=$2 AND completed_at IS NULL
     RETURNING seed, input_log`,
    [roundId, address]
  );
  if (rows.length === 0) throw new Error("no active session");
  const { seed, input_log } = rows[0];

  const round = await q("SELECT game_id FROM rounds WHERE round_id=$1", [roundId]);
  const module = getGameModule(round[0].game_id);
  const result = await module.computeScore(input_log as InputEvent[], seed);

  await q(
    "UPDATE sessions SET score=$3, score_detail=$4 WHERE round_id=$1 AND address=$2",
    [roundId, address, result.score, JSON.stringify(result.detail ?? {})]
  );
  return result;
}

export async function leaderboard(roundId: string) {
  return q(
    `SELECT address, score, score_detail, completed_at
     FROM sessions WHERE round_id=$1 AND score IS NOT NULL
     ORDER BY score DESC, completed_at ASC`,
    [roundId]
  );
}

export async function replayArtifact(roundId: string, address: string) {
  const rows = await q(
    "SELECT seed, input_log FROM sessions WHERE round_id=$1 AND address=$2",
    [roundId, address]
  );
  if (rows.length === 0) throw new Error("no session");
  const round = await q("SELECT game_id FROM rounds WHERE round_id=$1", [roundId]);
  const module = getGameModule(round[0].game_id);
  return module.buildReplay(rows[0].input_log as InputEvent[], rows[0].seed);
}
