// Champions — public hall of fame: every settled round's winner, when they
// won, and the prize they took. Static fetch, reuses board styling.
import { useEffect, useState } from "react";
import { formatUnits, zeroAddress } from "viem";
import { api } from "../lib/api";
import { REPLAY_VIEWS } from "../lib/replays";
import { useEthUsdPrice, usdHint } from "../lib/ethPrice";

interface Champion {
  roundId: string;
  gameId: string;
  winner: string;
  wonAt: string;
  prize: string;
  asset: string;
}

export default function Champions() {
  const [champions, setChampions] = useState<Champion[] | null>(null);
  const ethUsd = useEthUsdPrice();
  const [openReplay, setOpenReplay] = useState<string | null>(null);   // roundId
  const [artifacts, setArtifacts] = useState<Record<string, any>>({}); // roundId -> artifact
  const [replayErr, setReplayErr] = useState<string>("");

  async function toggleReplay(roundId: string) {
    setReplayErr("");
    if (openReplay === roundId) { setOpenReplay(null); return; }
    if (!artifacts[roundId]) {
      try {
        const r: any = await api.winnerReplay(roundId);
        setArtifacts((a) => ({ ...a, [roundId]: r.artifact }));
      } catch {
        setReplayErr("Couldn't load that replay right now.");
        return;
      }
    }
    setOpenReplay(roundId);
  }

  useEffect(() => {
    api.champions().then((r: any) => setChampions(r.champions)).catch(() => setChampions([]));
  }, []);

  function fmtPrize(c: Champion): string {
    const isEth = c.asset === zeroAddress;
    const amount = formatUnits(BigInt(c.prize), isEth ? 18 : 6);
    const hint = isEth ? ` ${usdHint(amount, ethUsd)}` : "";
    return `${amount} ${isEth ? "ETH" : "USDC"}${hint}`;
  }

  return (
    <main className="faq">
      <div className="eyebrow gold-eyebrow">CHAMPIONS</div>
      <h1 className="page-title">The hall of ascent</h1>
      <p className="sub" style={{ marginBottom: 32 }}>
        One champion per round. Each earned it with a single attempt.
      </p>

      {champions === null ? (
        <p className="dim">Loading…</p>
      ) : champions.length === 0 ? (
        <p className="dim">
          No champions yet. The arena awaits its first — it could be you.
        </p>
      ) : (
        <table className="board">
          <thead>
            <tr><th>Round</th><th>Champion</th><th>Won</th><th>Prize</th><th></th></tr>
          </thead>
          <tbody>
            {champions.map((c) => {
              const Replay = REPLAY_VIEWS[c.gameId];
              const isOpen = openReplay === c.roundId;
              return [
                <tr key={c.roundId} className="first">
                  <td>#{c.roundId}</td>
                  <td className="mono">{c.winner.slice(0, 10)}…{c.winner.slice(-6)}</td>
                  <td>{new Date(c.wonAt).toLocaleString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })}</td>
                  <td>{fmtPrize(c)}</td>
                  <td>
                    {Replay && (
                      <button className="link" onClick={() => toggleReplay(c.roundId)}>
                        {isOpen ? "Hide replay" : "▶ Watch the winning run"}
                      </button>
                    )}
                  </td>
                </tr>,
                isOpen && artifacts[c.roundId] && Replay ? (
                  <tr key={c.roundId + "-replay"}>
                    <td colSpan={5} className="replay-cell">
                      <Replay artifact={artifacts[c.roundId]} />
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      )}
      {replayErr && <div className="banner error">{replayErr}</div>}
    </main>
  );
}
