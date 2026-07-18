// Registration: transparent economics BEFORE entry (fee, pool, 85/15 split),
// USDC approve+enter or ETH direct enter, honest tx states.
import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount } from "wagmi";
import { formatUnits, zeroAddress } from "viem";
import { CONTRACT, USDC, arenaAbi, erc20Abi } from "../lib/wagmi";
import { getFeeOverrides, friendlyTxError } from "../lib/txFees";
import type { RoundInfo } from "../App";
import { RoundState } from "../../../shared/types";

export default function EntryPanel({
  round, me, authed, onEntered,
}: {
  round: RoundInfo;
  me: { entered: boolean } | null;
  authed: boolean;
  onEntered: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<"idle" | "approving" | "entering" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  const isEth = round.asset === zeroAddress;
  const decimals = isEth ? 18 : 6;
  const symbol = isEth ? "ETH" : "USDC";
  const fee = BigInt(round.entryFee);
  const pool = BigInt(round.prizePool);
  const bps = BigInt(round.platformFeeBps);
  const winnerTake = (pool * (10000n - bps)) / 10000n;
  const projectedPool = pool + fee;
  const projectedTake = (projectedPool * (10000n - bps)) / 10000n;
  const fmt = (v: bigint) => formatUnits(v, decimals);
  const regOpen = round.state === RoundState.RegistrationOpen;

  async function enter() {
    try {
      setErr("");
      if (!isEth) {
        setStatus("approving");
        const allowance = await publicClient!.readContract({
          address: USDC, abi: erc20Abi, functionName: "allowance",
          args: [address!, CONTRACT],
        });
        if (allowance < fee) {
          const hash = await writeContractAsync({
            address: USDC, abi: erc20Abi, functionName: "approve", args: [CONTRACT, fee],
            ...(await getFeeOverrides(publicClient)),
          });
          await publicClient!.waitForTransactionReceipt({ hash });
        }
      }
      setStatus("entering");
      const hash = await writeContractAsync({
        address: CONTRACT, abi: arenaAbi, functionName: "enter",
        args: [BigInt(round.roundId)],
        value: isEth ? fee : 0n,
        ...(await getFeeOverrides(publicClient)),
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setStatus("done");
      onEntered();
    } catch (e: any) {
      setStatus("error");
      setErr(friendlyTxError(e));
    }
  }

  return (
    <section className="entry">
      <div className="entry-grid">
        <div className="stat">
          <div className="stat-label">Entry fee</div>
          <div className="stat-value">{fmt(fee)} {symbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Current pool · {round.entrantCount} entrants</div>
          <div className="stat-value gold">{fmt(pool)} {symbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Winner takes (85%)</div>
          <div className="stat-value">{fmt(winnerTake)} {symbol}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Hosting fee (15%)</div>
          <div className="stat-value dim">{fmt(pool - winnerTake)} {symbol}</div>
        </div>
      </div>

      <p className="entry-note">
        If you enter, the pool becomes {fmt(projectedPool)} {symbol} and the winner's
        take becomes {fmt(projectedTake)} {symbol}. One entry per wallet. One attempt.
        The game is revealed only when the window opens.
      </p>

      {me?.entered ? (
        <div className="banner ok">You're in. Be here when the window opens — you get exactly one run.</div>
      ) : !regOpen ? (
        <div className="banner">Registration is closed. The entrant list and pool are locked.</div>
      ) : !authed ? (
        <div className="banner">Connect your wallet and sign in to enter.</div>
      ) : (
        <button className="btn big" onClick={enter} disabled={status === "approving" || status === "entering"}>
          {status === "approving" ? "Approving USDC…"
            : status === "entering" ? "Confirming entry…"
            : `Enter for ${fmt(fee)} ${symbol}`}
        </button>
      )}
      {err && <div className="banner error">{err}</div>}
    </section>
  );
}
