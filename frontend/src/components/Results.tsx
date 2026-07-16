// Post-window: pending during Settling, champion pedestal once Settled.
// RESTYLE ONLY — all claim/refund logic identical to the original.
import { useEffect, useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { CONTRACT, arenaAbi } from "../lib/wagmi";
import { api } from "../lib/api";
import type { RoundInfo } from "../App";
import { RoundState } from "../../../shared/types";

/** The lone champion: a minimal pixel figure on a stepped podium. Pure SVG,
    muted gold, no animation beyond a CSS fade handled in styles.css. */
function Pedestal() {
  return (
    <svg
      className="pedestal-svg"
      viewBox="0 0 200 170"
      role="img"
      aria-label="A lone champion standing on a podium"
      shapeRendering="crispEdges"
    >
      {/* figure — 8-bit silhouette */}
      <g fill="var(--gold)">
        <rect x="92" y="28" width="16" height="14" /> {/* head */}
        <rect x="88" y="44" width="24" height="20" /> {/* torso */}
        <rect x="80" y="44" width="6" height="16" />  {/* left arm raised base */}
        <rect x="80" y="34" width="6" height="12" />  {/* left arm up */}
        <rect x="114" y="44" width="6" height="16" /> {/* right arm */}
        <rect x="90" y="66" width="8" height="16" />  {/* left leg */}
        <rect x="102" y="66" width="8" height="16" /> {/* right leg */}
      </g>
      {/* podium — three quiet steps */}
      <g fill="none" stroke="var(--line-strong)" strokeWidth="2">
        <rect x="70" y="86" width="60" height="30" />
        <rect x="34" y="102" width="36" height="14" />
        <rect x="130" y="106" width="36" height="10" />
      </g>
      <g fill="var(--dim)" fontFamily="var(--font-display)" fontSize="13" textAnchor="middle">
        <text x="100" y="107">1</text>
      </g>
      {/* ground line */}
      <line x1="12" y1="116" x2="188" y2="116" stroke="var(--line)" strokeWidth="1" />
    </svg>
  );
}

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
      <main className="results-stage">
        <div className="eyebrow">ROUND VOIDED</div>
        <h1 className="page-title">Everyone gets their entry back</h1>
        <p className="sub">
          This round was voided. Every entrant can reclaim their full entry fee —
          no hosting fee was taken.
        </p>
        <button className="btn big" onClick={claim} disabled={claimState === "claiming"}>
          {claimState === "claiming" ? "Refunding…" : claimState === "claimed" ? "Refunded ✓" : "Reclaim my entry fee"}
        </button>
        {err && <div className="banner error">{err}</div>}
      </main>
    );
  }

  const winnerScore = results?.leaderboard?.[0]?.score;

  return (
    <main className="results-stage">
      {!results?.winner ? (
        <>
          <div className="eyebrow">WINDOW CLOSED</div>
          <h1 className="page-title">Verifying the arena</h1>
          <p className="sub">
            Scores are being verified and the winning run is under human replay
            review. The winner is submitted on-chain after approval.
          </p>
        </>
      ) : (
        <div className="champion">
          <Pedestal />
          <div className="eyebrow gold-eyebrow">CHAMPION</div>
          <p className="champion-address mono">
            {results.winner.slice(0, 10)}…{results.winner.slice(-8)}
          </p>
          {typeof winnerScore === "number" && (
            <p className="champion-score">{winnerScore.toLocaleString()}</p>
          )}
          {isWinner && (
            <button className="btn big gold-btn" onClick={claim} disabled={claimState === "claiming"}>
              {claimState === "claiming" ? "Claiming…" : claimState === "claimed" ? "Prize claimed ✓" : "Claim my prize (85% of pool)"}
            </button>
          )}
          {err && <div className="banner error">{err}</div>}
        </div>
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
