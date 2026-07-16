import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { api, setJwt } from "./lib/api";
import { activeChain } from "./lib/wagmi";
import { RoundState } from "../../shared/types";
import Countdown from "./components/Countdown";
import EntryPanel from "./components/EntryPanel";
import GameShell from "./components/GameShell";
import Results from "./components/Results";
import FAQ from "./components/FAQ";
import AdminPage from "./admin/AdminPage";

export interface RoundInfo {
  roundId: string;
  gameId: string;
  state: RoundState;
  asset: string;
  entryFee: string;
  prizePool: string;
  entrantCount: number;
  platformFeeBps: number;
  liveStart: string | null;
  liveEnd: string | null;
}

export default function App() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  const [authed, setAuthed] = useState(false);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const [me, setMe] = useState<{ entered: boolean; session: any } | null>(null);
  const [view, setView] = useState<"arena" | "faq" | "admin">("arena");
  const [err, setErr] = useState("");

  const wrongNetwork = isConnected && chainId !== activeChain.id;

  async function signIn() {
    try {
      setErr("");
      const { nonce } = await api.nonce();
      const message = createSiweMessage({
        address: address!,
        chainId: activeChain.id,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to Arena Ascent.",
      });
      const signature = await signMessageAsync({ message });
      const { token } = await api.verify(message, signature);
      setJwt(token);
      setAuthed(true);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function refresh() {
    try {
      const { round } = await api.currentRound();
      setRound(round);
      if (round && authed) setMe(await api.me(round.roundId));
    } catch {
      /* backend may be down in early setup; UI shows empty state */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [authed]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▲</span> ARENA ASCENT
        </div>
        <nav>
          <button className="link" onClick={() => setView("arena")}>Arena</button>
          <button className="link" onClick={() => setView("faq")}>How it works</button>
          <button className="link" onClick={() => setView("admin")}>Operator</button>
        </nav>
        <div className="wallet">
          {!isConnected ? (
            <button className="btn" onClick={() => connect({ connector: connectors[0] })}>
              Connect wallet
            </button>
          ) : wrongNetwork ? (
            <button className="btn warn" onClick={() => switchChain({ chainId: activeChain.id })}>
              Switch to {activeChain.name}
            </button>
          ) : !authed ? (
            <button className="btn" onClick={signIn}>Sign in</button>
          ) : (
            <button className="link" onClick={() => { disconnect(); setAuthed(false); }}>
              {address?.slice(0, 6)}…{address?.slice(-4)} · sign out
            </button>
          )}
        </div>
      </header>

      {err && <div className="banner error">{err}</div>}

      {view === "admin" ? (
        <AdminPage authed={authed} round={round} onChanged={refresh} />
      ) : view === "faq" ? (
        <FAQ />
      ) : !round ? (
        <main className="hero">
          <div className="eyebrow">MONTHLY SKILL TOURNAMENT</div>
          <h1>One game. One shot.<br />One winner.</h1>
          <p className="sub">
            A never-before-seen skill game, playable for one 30-minute window each
            month. Highest score takes the pool. The next round hasn't been
            announced yet — check back soon.
          </p>
        </main>
      ) : round.state === RoundState.RegistrationOpen || round.state === RoundState.RegistrationClosed ? (
        <main>
          <Countdown target={round.liveStart} label="THE WINDOW OPENS IN" />
          <EntryPanel round={round} me={me} authed={authed} onEntered={refresh} />
        </main>
      ) : round.state === RoundState.Live ? (
        <GameShell round={round} me={me} authed={authed} onDone={refresh} />
      ) : (
        <Results round={round} address={address} />
      )}

      <footer className="foot">
        Entry fees form the prize pool. The winner takes 85%; Arena Ascent retains a
        15% hosting fee. Scores are computed server-side and every winning run is
        human-reviewed before settlement. Voided rounds refund entry fees in full.
      </footer>
    </div>
  );
}
