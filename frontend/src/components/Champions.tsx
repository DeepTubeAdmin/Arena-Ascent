// Champions — public hall of fame: every settled round's winner, when they
// won, and the prize they took. Static fetch, reuses board styling.
import { useEffect, useState } from "react";
import { formatUnits, zeroAddress } from "viem";
import { api } from "../lib/api";
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
            <tr><th>Round</th><th>Champion</th><th>Won</th><th>Prize</th></tr>
          </thead>
          <tbody>
            {champions.map((c) => (
              <tr key={c.roundId} className="first">
                <td>#{c.roundId}</td>
                <td className="mono">{c.winner.slice(0, 10)}…{c.winner.slice(-6)}</td>
                <td>{new Date(c.wonAt).toLocaleString(undefined, {
                  year: "numeric", month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}</td>
                <td>{fmtPrize(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
