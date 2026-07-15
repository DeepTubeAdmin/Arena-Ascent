// Single-use play sessions. Exactly one attempt per (round, address):
// the UNIQUE constraint in Postgres is the hard guarantee; Redis holds the
// short-lived signed token. Seed = deterministic per (round, address) so a
// reconnect can't reroll the level layout.
import { createHmac, randomBytes } from "node:crypto";
import { q } from "../db.js";
import { redis } from "../redis.js";
import { config } from "../config.js";

function sign(payload: string): string {
  return createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
}

export function sessionSeed(roundId: string, address: string): string {
  // Deterministic per entrant, unpredictable without the server secret.
  return sign(`seed:${roundId}:${address}`).slice(0, 32);
}

export async function issuePlayToken(roundId: string, address: string) {
  // Must be an on-chain-verified entrant.
  const entrant = await q(
    "SELECT 1 FROM entrants WHERE round_id=$1 AND address=$2",
    [roundId, address]
  );
  if (entrant.length === 0) throw new Error("not an entrant");

  // One attempt: creating the session row is the consumption point.
  const seed = sessionSeed(roundId, address);
  const rows = await q(
    `INSERT INTO sessions (round_id, address, seed, started_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (round_id, address) DO NOTHING
     RETURNING id`,
    [roundId, address, seed]
  );
  if (rows.length === 0) throw new Error("attempt already used");

  const token = randomBytes(24).toString("hex");
  await redis.set(`play:${token}`, JSON.stringify({ roundId, address }), "EX", 40 * 60);
  return { token, seed };
}

export async function resolvePlayToken(token: string) {
  const raw = await redis.get(`play:${token}`);
  if (!raw) throw new Error("invalid play token");
  return JSON.parse(raw) as { roundId: string; address: string };
}
