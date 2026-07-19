// Oracle settlement: NEVER auto-submits. The operator must explicitly approve
// (after mandatory replay review in the console); only then does the oracle
// signer call submitWinner on-chain.
import { getAddress } from "viem";
import { q } from "../db.js";
import { arenaAbi, oracleWallet, publicClient } from "../chain.js";
import { config } from "../config.js";
import { leaderboard } from "./scoring.js";

export async function approveAndSubmit(roundId: string, adminAddress: string) {
  if (!oracleWallet) throw new Error("oracle key not configured");

  const board = await leaderboard(roundId);
  const eligible = board.filter((r: any) => !r.disqualified);
  if (eligible.length === 0) throw new Error("no eligible (non-disqualified) scored sessions");
  const winner = getAddress(eligible[0].address);

  const hash = await oracleWallet.writeContract({
    address: config.contractAddress,
    abi: arenaAbi,
    functionName: "submitWinner",
    args: [BigInt(roundId), winner],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  await q(
    `INSERT INTO settlements (round_id, winner, approved_by, approved_at, tx_hash)
     VALUES ($1, $2, $3, now(), $4)
     ON CONFLICT (round_id) DO UPDATE SET winner=$2, approved_by=$3, approved_at=now(), tx_hash=$4`,
    [roundId, winner.toLowerCase(), adminAddress, hash]
  );
  return { winner, txHash: hash };
}

/** Anti-abuse hints for the settlement console: shared IPs among top finishers. */
export async function abuseFlags(roundId: string) {
  return q(
    `SELECT e.entry_ip, array_agg(s.address ORDER BY s.score DESC) AS addresses, count(*) AS n
     FROM sessions s JOIN entrants e ON e.round_id=s.round_id AND e.address=s.address
     WHERE s.round_id=$1 AND s.score IS NOT NULL AND e.entry_ip IS NOT NULL
     GROUP BY e.entry_ip HAVING count(*) > 1
     ORDER BY n DESC`,
    [roundId]
  );
}
