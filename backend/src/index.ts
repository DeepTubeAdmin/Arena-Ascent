// Arena Ascent backend — Fastify server.
// Routes:
//   Auth:      GET /auth/nonce, POST /auth/verify
//   Public:    GET /rounds/current, GET /rounds/:id, GET /rounds/:id/me
//   Play:      POST /play/start, POST /play/input, POST /play/complete
//   Results:   GET /rounds/:id/results
//   Admin:     POST /admin/rounds, POST /admin/rounds/:id/state,
//              GET /admin/rounds/:id/leaderboard, GET /admin/rounds/:id/replay/:address,
//              GET /admin/rounds/:id/flags, POST /admin/rounds/:id/approve
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { q } from "./db.js";
import { issueNonce, verifySiwe, requireAuth, requireAdmin } from "./auth.js";
import { startEntrantWatcher, readRound } from "./chain.js";
import { issuePlayToken, resolvePlayToken } from "./services/sessions.js";
import { appendInputs, completeSession, leaderboard, replayArtifact, setDisqualified } from "./services/scoring.js";
import { approveAndSubmit, abuseFlags } from "./services/settlement.js";
import { RoundState } from "../../shared/types";

const JOIN_WINDOW_MS = 60_000; // players may START their attempt within 60s of go-live

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.frontendOrigin, credentials: true });

// ------------------------------------------------------------------ auth
app.get("/auth/nonce", async () => ({ nonce: await issueNonce() }));

app.post("/auth/verify", async (req, reply) => {
  const { message, signature } = req.body as { message: string; signature: `0x${string}` };
  try {
    const { address, token } = await verifySiwe(message, signature);
    // Record login IP as an anti-abuse hint on any current-round entrant row.
    await q(
      `UPDATE entrants SET entry_ip = $2 WHERE address = $1 AND entry_ip IS NULL`,
      [address, req.ip]
    );
    return { address, token };
  } catch (e: any) {
    return reply.code(401).send({ error: e.message });
  }
});

// ---------------------------------------------------------------- rounds
app.get("/rounds/current", async () => {
  // The latest round is always "current" — the UI routes on its state
  // (Settled → results, Voided → refund screen). A new month's round
  // supersedes it once registered.
  const rows = await q(
    `SELECT * FROM rounds ORDER BY round_id DESC LIMIT 1`
  );
  if (rows.length === 0) return { round: null };
  const r = rows[0];
  const onChain = await readRound(BigInt(r.round_id));
  return {
    round: {
      roundId: String(r.round_id),
      gameId: r.game_id,
      state: onChain[4],
      asset: onChain[0],
      entryFee: onChain[1].toString(),
      prizePool: onChain[2].toString(),
      entrantCount: onChain[3],
      platformFeeBps: onChain[7],
      liveStart: r.live_start,
      joinDeadline: r.live_opened_at
        ? new Date(new Date(r.live_opened_at).getTime() + JOIN_WINDOW_MS).toISOString()
        : null,
      liveEnd: r.live_end,
    },
  };
});

app.get("/rounds/:id/me", async (req, reply) => {
  try {
    const address = requireAuth(req.headers.authorization);
    const { id } = req.params as { id: string };
    const entered = await q("SELECT 1 FROM entrants WHERE round_id=$1 AND address=$2", [id, address]);
    const session = await q(
      "SELECT started_at, completed_at, score FROM sessions WHERE round_id=$1 AND address=$2",
      [id, address]
    );
    return { entered: entered.length > 0, session: session[0] ?? null };
  } catch (e: any) {
    return reply.code(401).send({ error: e.message });
  }
});

app.get("/rounds/:id/results", async (req) => {
  const { id } = req.params as { id: string };
  const settled = await q("SELECT winner, tx_hash FROM settlements WHERE round_id=$1", [id]);
  const board = (await leaderboard(id)).filter((r: any) => !r.disqualified);
  return {
    winner: settled[0]?.winner ?? null,
    txHash: settled[0]?.tx_hash ?? null,
    leaderboard: board.map((r: any, i: number) => ({
      rank: i + 1,
      address: r.address,
      score: Number(r.score),
    })),
  };
});

app.get("/champions", async () => {
  // Hall of fame: every settled round, newest first. Prize is computed from
  // the on-chain pool at the round's fee split.
  const rows = await q(
    `SELECT s.round_id, s.winner, s.approved_at, r.game_id
     FROM settlements s JOIN rounds r ON r.round_id = s.round_id
     WHERE s.winner IS NOT NULL
     ORDER BY s.approved_at DESC`
  );
  const champions: any[] = [];
  for (const row of rows) {
    try {
      const rc = await readRound(BigInt(row.round_id));
      const asset = rc[0] as string;
      const pool = rc[2] as bigint;
      const bps = BigInt(rc[7] as number);
      const prize = (pool * (10000n - bps)) / 10000n;
      if (prize === 0n) continue; // unreadable/legacy round — skip
      champions.push({
        roundId: String(row.round_id),
        gameId: row.game_id,
        winner: row.winner,
        wonAt: row.approved_at,
        prize: prize.toString(),
        asset,
      });
    } catch {
      /* skip rounds the current contract can't read (old deployments) */
    }
  }
  return { champions };
});

// ------------------------------------------------------------------ play
app.post("/play/start", async (req, reply) => {
  try {
    const address = requireAuth(req.headers.authorization);
    const { roundId } = req.body as { roundId: string };

    const round = await q("SELECT state, live_start, live_end, live_opened_at FROM rounds WHERE round_id=$1", [roundId]);
    if (round.length === 0) return reply.code(404).send({ error: "no round" });
    if (round[0].state !== RoundState.Live) return reply.code(409).send({ error: "round not live" });
    // Anti-cheat: attempts may only be STARTED within the join window after
    // go-live. UI shows a countdown, but this check is the enforcement.
    if (round[0].live_opened_at) {
      const opened = new Date(round[0].live_opened_at).getTime();
      if (Date.now() > opened + JOIN_WINDOW_MS) {
        return reply.code(403).send({ error: "join window closed" });
      }
    }

    const { token, seed } = await issuePlayToken(roundId, address);
    const round2 = await q("SELECT game_id FROM rounds WHERE round_id=$1", [roundId]);
    return { playToken: token, seed, gameId: round2[0].game_id, liveEnd: round[0].live_end };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post("/play/input", async (req, reply) => {
  try {
    const { playToken, events } = req.body as { playToken: string; events: any[] };
    const { roundId, address } = await resolvePlayToken(playToken);
    // Hard gate: no inputs accepted after the window closes.
    const round = await q("SELECT state FROM rounds WHERE round_id=$1", [roundId]);
    if (round[0]?.state !== RoundState.Live) return reply.code(409).send({ error: "window closed" });
    await appendInputs(roundId, address, events);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post("/play/complete", async (req, reply) => {
  try {
    const { playToken, finalEvents } = req.body as { playToken: string; finalEvents?: any[] };
    const { roundId, address } = await resolvePlayToken(playToken);
    if (finalEvents?.length) await appendInputs(roundId, address, finalEvents);
    const result = await completeSession(roundId, address);
    // The player sees a provisional score; official results wait for settlement.
    return { provisionalScore: result.score };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// ----------------------------------------------------------------- admin
app.post("/admin/rounds", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { roundId, gameId, liveStart, liveEnd } = req.body as {
      roundId: string; gameId: string; liveStart: string; liveEnd: string;
    };
    // Round is created ON-CHAIN first (createRound via your wallet); this
    // registers the off-chain metadata: which game, when the window runs.
    await q(
      `INSERT INTO rounds (round_id, game_id, live_start, live_end)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (round_id) DO UPDATE SET game_id=$2, live_start=$3, live_end=$4`,
      [roundId, gameId, liveStart, liveEnd]
    );
    return { ok: true };
  } catch (e: any) {
    return reply.code(403).send({ error: e.message });
  }
});

app.post("/admin/rounds/:id/state", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { id } = req.params as { id: string };
    const { state } = req.body as { state: number };
    // Mirror of the on-chain transition you make with your owner wallet.
    await q("UPDATE rounds SET state=$2 WHERE round_id=$1", [id, state]);
    return { ok: true };
  } catch (e: any) {
    return reply.code(403).send({ error: e.message });
  }
});

app.get("/admin/rounds/:id/leaderboard", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { id } = req.params as { id: string };
    return { leaderboard: await leaderboard(id) };
  } catch (e: any) {
    return reply.code(403).send({ error: e.message });
  }
});

app.get("/admin/rounds/:id/replay/:address", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { id, address } = req.params as { id: string; address: string };
    return { artifact: await replayArtifact(id, address.toLowerCase()) };
  } catch (e: any) {
    return reply.code(403).send({ error: e.message });
  }
});

app.get("/admin/rounds/:id/flags", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { id } = req.params as { id: string };
    return { flags: await abuseFlags(id) };
  } catch (e: any) {
    return reply.code(403).send({ error: e.message });
  }
});

app.post("/admin/rounds/:id/disqualify", async (req, reply) => {
  try {
    requireAdmin(req.headers.authorization);
    const { id } = req.params as { id: string };
    const { address, reason, undo } = req.body as { address: string; reason?: string; undo?: boolean };
    await setDisqualified(id, address.toLowerCase(), !undo, reason);
    return { ok: true };
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

app.post("/admin/rounds/:id/approve", async (req, reply) => {
  try {
    const admin = requireAdmin(req.headers.authorization);
    const { id } = req.params as { id: string };
    const { confirm } = req.body as { confirm: string };
    // Two-step confirm: client must echo the exact phrase.
    if (confirm !== `SETTLE ROUND ${id}`) {
      return reply.code(400).send({ error: "confirmation phrase mismatch" });
    }
    const result = await approveAndSubmit(id, admin);
    await q("UPDATE rounds SET state=$2 WHERE round_id=$1", [id, RoundState.Settled]);
    return result;
  } catch (e: any) {
    return reply.code(400).send({ error: e.message });
  }
});

// ------------------------------------------------------------------ boot
startEntrantWatcher();
app.listen({ port: config.port, host: "0.0.0.0" }).then(() => {
  app.log.info(`Arena Ascent backend on :${config.port} (${config.chain})`);
});
