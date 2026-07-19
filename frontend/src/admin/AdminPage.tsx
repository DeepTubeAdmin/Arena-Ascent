// Operator console. Round metadata registration, state mirror, leaderboard,
// abuse flags, MANDATORY replay review, and two-step settlement approval.
// Note: on-chain owner actions (createRound, closeRegistration, setLive,
// closeWindow, voidRound) are performed with your owner wallet; this console
// mirrors those transitions to the backend and drives settlement.
import { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { parseAbi } from "viem";
import { CONTRACT } from "../lib/wagmi";
import { getFeeOverrides, friendlyTxError } from "../lib/txFees";
import { api } from "../lib/api";
import type { RoundInfo } from "../App";
import type { ReplayArtifact } from "../../../shared/types";
import TargetRushReplay from "../../../games/2026-08-target-rush/ReplayView";
import DuckRunReplay from "../../../games/2026-09-duck-run/ReplayView";

const ownerAbi = parseAbi([
  "function createRound(address asset, uint96 entryFee, uint64 registrationDeadline, uint16 platformFeeBps) returns (uint256)",
  "function closeRegistration(uint256 roundId)",
  "function setLive(uint256 roundId)",
  "function closeWindow(uint256 roundId)",
  "function voidRound(uint256 roundId)",
  "function withdrawFees(address asset, address to)",
]);

const REPLAY_VIEWS: Record<string, React.ComponentType<{ artifact: ReplayArtifact }>> = {
  "2026-08-target-rush": TargetRushReplay,
  "2026-09-duck-run": DuckRunReplay,
};

export default function AdminPage({
  authed, round, onChanged,
}: {
  authed: boolean;
  round: RoundInfo | null;
  onChanged: () => void;
}) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [board, setBoard] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [artifact, setArtifact] = useState<ReplayArtifact | null>(null);
  const [reviewedAddress, setReviewedAddress] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");

  if (!authed) return <main><div className="banner">Sign in with an operator wallet to use the console.</div></main>;

  async function ownerTx(fn: string, args: unknown[]) {
    try {
      setMsg(`Sending ${fn}…`);
      const hash = await writeContractAsync({
        address: CONTRACT, abi: ownerAbi, functionName: fn as any, args: args as any,
        ...(await getFeeOverrides(publicClient)),
      });
      await publicClient!.waitForTransactionReceipt({ hash });
      setMsg(`${fn} confirmed: ${hash.slice(0, 14)}…`);
      return true;
    } catch (e: any) {
      setMsg(`${fn} failed: ${friendlyTxError(e)}`);
      return false;
    }
  }

  async function transition(fn: "closeRegistration" | "setLive" | "closeWindow" | "voidRound", state: number) {
    if (!round) return;
    const ok = await ownerTx(fn, [BigInt(round.roundId)]);
    if (!ok) return; // on-chain tx failed — do NOT mirror the state to the backend
    await api.adminSetState(round.roundId, state);
    onChanged();
  }

  async function loadBoard() {
    if (!round) return;
    const { leaderboard } = await api.adminLeaderboard(round.roundId);
    setBoard(leaderboard);
    const { flags } = await api.adminFlags(round.roundId);
    setFlags(flags);
  }

  async function loadReplay(address: string) {
    if (!round) return;
    const { artifact } = await api.adminReplay(round.roundId, address);
    setArtifact(artifact);
    setReviewedAddress(address);
  }

  async function disqualify(address: string) {
    if (!round) return;
    const reason = window.prompt(
      "Reason for disqualification (recorded for the audit trail):",
      "Automation red flags in replay review"
    );
    if (reason === null) return; // cancelled
    await api.adminDisqualify(round.roundId, address, reason);
    setMsg(`Disqualified ${address.slice(0, 10)}… — ${reason}`);
    await loadBoard();
  }

  async function reinstate(address: string) {
    if (!round) return;
    await api.adminDisqualify(round.roundId, address, undefined, true);
    setMsg(`Reinstated ${address.slice(0, 10)}…`);
    await loadBoard();
  }

  async function approve() {
    if (!round) return;
    const result = await api.adminApprove(round.roundId);
    setMsg(`Winner submitted on-chain: ${result.winner} (tx ${result.txHash.slice(0, 14)}…)`);
    setConfirming(false);
    onChanged();
  }

  const ReplayView = round ? REPLAY_VIEWS[round.gameId] : undefined;
  // The approve target is the top ELIGIBLE (non-disqualified) run — and its
  // replay must be reviewed before the button unlocks.
  const topAddress = board.find((r: any) => !r.disqualified)?.address;
  const reviewedTopRun = reviewedAddress && reviewedAddress === topAddress;

  return (
    <main className="admin">
      <h1 className="page-title">Operator console</h1>
      {msg && <div className="banner">{msg}</div>}

      <section className="panel">
        <h2>Round control</h2>
        {round ? (
          <>
            <p>Round #{round.roundId} · game <code>{round.gameId}</code> · state {round.state} · {round.entrantCount} entrants</p>
            <div className="btn-row">
              <button className="btn" onClick={() => transition("closeRegistration", 1)}>Close registration</button>
              <button className="btn" onClick={() => transition("setLive", 2)}>Open window (LIVE)</button>
              <button className="btn" onClick={() => transition("closeWindow", 3)}>Close window (SETTLING)</button>
              <button className="btn warn" onClick={() => { if (window.confirm("Void this round? All entrants get full refunds.")) transition("voidRound", 5); }}>Void round</button>
            </div>
          </>
        ) : (
          <p>No active round. Create one on-chain with createRound from your owner wallet, then register it below.</p>
        )}
        <RegisterRoundForm onChanged={onChanged} />
      </section>

      <section className="panel">
        <h2>Settlement</h2>
        <button className="btn" onClick={loadBoard}>Load final leaderboard</button>
        {flags.length > 0 && (
          <div className="banner warn">
            ⚠ Shared-source flags: {flags.map((f: any) => `${f.n} scored entrants share IP ${f.entry_ip}`).join(" · ")}
          </div>
        )}
        {board.length > 0 && (
          <table className="board">
            <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Detail</th><th></th><th></th></tr></thead>
            <tbody>
              {board.map((r: any, i: number) => (
                <tr key={r.address} className={r.disqualified ? "dq" : r.address === topAddress ? "first" : ""}>
                  <td>{i + 1}</td>
                  <td className="mono">
                    {r.address}
                    {r.disqualified && <span className="dq-tag"> DISQUALIFIED{r.dq_reason ? `: ${r.dq_reason}` : ""}</span>}
                  </td>
                  <td>{Number(r.score).toLocaleString()}</td>
                  <td className="dim">{JSON.stringify(r.score_detail)}</td>
                  <td><button className="link" onClick={() => loadReplay(r.address)}>Review replay</button></td>
                  <td>
                    {r.disqualified ? (
                      <button className="link" onClick={() => reinstate(r.address)}>Reinstate</button>
                    ) : (
                      <button className="link" onClick={() => disqualify(r.address)}>Disqualify</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {artifact && ReplayView && (
          <div className="replay-panel">
            <h3>Replay review — {reviewedAddress}</h3>
            <ReplayView artifact={artifact} />
          </div>
        )}

        <div className="approve-zone">
          <h3>Approve & submit winner</h3>
          {!reviewedTopRun ? (
            <p className="dim">🔒 Locked until you have loaded and reviewed the replay of the #1 run. Replay review is mandatory before settlement.</p>
          ) : !confirming ? (
            <button className="btn gold-btn" onClick={() => setConfirming(true)}>
              Approve winner: {topAddress?.slice(0, 12)}… (step 1 of 2)
            </button>
          ) : (
            <div className="btn-row">
              <button className="btn gold-btn" onClick={approve}>CONFIRM — submit winner on-chain (step 2 of 2)</button>
              <button className="link" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Fees</h2>
        <p className="dim">Withdraw accumulated 15% hosting fees (per asset) to your wallet.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => ownerTx("withdrawFees", ["0x0000000000000000000000000000000000000000", prompt("Send ETH fees to address:") ?? ""])}>Withdraw ETH fees</button>
          <button className="btn" onClick={() => ownerTx("withdrawFees", [import.meta.env.VITE_USDC_ADDRESS, prompt("Send USDC fees to address:") ?? ""])}>Withdraw USDC fees</button>
        </div>
      </section>
    </main>
  );
}

function RegisterRoundForm({ onChanged }: { onChanged: () => void }) {
  const [roundId, setRoundId] = useState("");
  const [gameId, setGameId] = useState("2026-08-target-rush");
  const [liveStart, setLiveStart] = useState("");
  const [liveEnd, setLiveEnd] = useState("");
  const [formMsg, setFormMsg] = useState("");

  async function submit() {
    try {
      setFormMsg("");
      if (!roundId || !liveStart || !liveEnd) {
        setFormMsg("Fill in the round id and BOTH window times.");
        return;
      }
      // datetime-local gives a zone-less string ("2026-07-18T15:30") meaning
      // YOUR local time. Convert to a proper UTC ISO timestamp so the backend
      // (running in UTC) stores the moment you actually meant.
      const startIso = new Date(liveStart).toISOString();
      const endIso = new Date(liveEnd).toISOString();
      if (new Date(endIso) <= new Date(startIso)) {
        setFormMsg("Live end must be after live start.");
        return;
      }
      await api.adminRegisterRound({ roundId, gameId, liveStart: startIso, liveEnd: endIso });
      setFormMsg(`Round ${roundId} registered ✓`);
      onChanged();
    } catch (e: any) {
      setFormMsg(`Registration failed: ${e.message}`);
    }
  }

  return (
    <div className="form-row">
      <input placeholder="on-chain round id" value={roundId} onChange={(e) => setRoundId(e.target.value)} />
      <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
        <option value="2026-08-target-rush">Target Rush (2026-08)</option>
        <option value="2026-09-duck-run">Duck Run (2026-09)</option>
        <option value="stub">Stub (pipeline test)</option>
      </select>
      <input type="datetime-local" value={liveStart} onChange={(e) => setLiveStart(e.target.value)} />
      <input type="datetime-local" value={liveEnd} onChange={(e) => setLiveEnd(e.target.value)} />
      <button className="btn" onClick={submit}>Register round metadata</button>
      {formMsg && <div className="banner">{formMsg}</div>}
    </div>
  );
}
