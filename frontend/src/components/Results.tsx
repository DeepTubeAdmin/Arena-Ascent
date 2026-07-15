// Post-window: pending during Settling, winner + claim once Settled.
import { useEffect, useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { CONTRACT, arenaAbi } from "../lib/wagmi";
import { api } from "../lib/api";
import type { RoundInfo } from "../App";
import { RoundState } from "../../../shared/types";

export default function Results({ round, address }: { round: RoundInfo; address?: string }) {
  const [results, setResults] = useState<any>(null);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [claimState, setClaimState] = useState<"idle" | "claiming" | "claimed" | "error">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.results(round.roundId).then(setResults).catch(() => {});
  }, [round.roundId]);

  const isWinner = results?.winner && address?.toLowerCase() === results.winner;
  const voided = round.state === RoundState.Voided;

  async function claim() {
    try {
      setClaimState("claiming");
      const hash = await writeContractAsync({
        address: CONTRACT, abi: arenaAbi,
        functionName: voided ? "refund" : "claimPrize",
        args: [BigInt(round.roundId)],
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setClaimState("claimed");
    } catch (e: any) {
      setClaimState("error");
      setErr(e.shortMessage ?? e.message);
    }
  }

  if (voided) {
    return (
      <main>
        <h1 className="page-title">Round voided</h1>
        <p>This round was voided. Every entrant can reclaim their full entry fee — no hosting fee was taken.</p>
        <button className="btn big" onClick={claim} disabled={claimState === "claiming"}>
          {claimState === "claiming" ? "Refunding…" : claimState === "claimed" ? "Refunded ✓" : "Reclaim my entry fee"}
        </button>
        {err && <div className="banner error">{err}</div>}
      </main>
    );
  }

  return (
    <main>
      {!results?.winner ? (
        <>
          <h1 className="page-title">Verifying the arena</h1>
          <p>The window is closed. Scores are being verified and the winning run is
          under human replay review. The winner is submitted on-chain after approval.</p>
        </>
      ) : (
        <>
          <h1 className="page-title gold">Champion crowned</h1>
          <p className="mono">{results.winner}</p>
          {isWinner && (
            <button className="btn big gold-btn" onClick={claim} disabled={claimState === "claiming"}>
              {claimState === "claiming" ? "Claiming…" : claimState === "claimed" ? "Prize claimed ✓" : "Claim my prize (85% of pool)"}
            </button>
          )}
          {err && <div className="banner error">{err}</div>}
        </>
      )}
      {results?.leaderboard?.length > 0 && (
        <table className="board">
          <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
          <tbody>
            {results.leaderboard.map((r: any) => (
              <tr key={r.address} className={r.rank === 1 ? "first" : ""}>
                <td>{r.rank}</td>
                <td className="mono">{r.address.slice(0, 10)}…{r.address.slice(-6)}</td>
                <td>{r.score.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
