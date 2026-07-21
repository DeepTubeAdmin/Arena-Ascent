// Test page — two jobs for newcomers, zero stakes:
// 1) Readiness check: wallet connected, correct network, ETH balance > 0.
// 2) A free practice game so people learn the flow before a real round.
//
// The practice game is a simple evergreen REFLEX WARM-UP — deliberately NOT a
// real monthly game (those are never-before-seen). It runs entirely in the
// browser: no entry fee, no session, no server scoring, nothing recorded.
// Practice layouts are random on purpose — real rounds use one shared,
// server-issued seed so every entrant faces the identical game.

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { activeChain } from "../lib/wagmi";

const GAME_S = 15;

function PracticeGame({ onDone }: { onDone: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(GAME_S);

  const target = useRef({ x: 200, y: 150, r: 40 });
  const scoreRef = useRef(0);

  function respawn() {
    // Practice-only randomness (real rounds are seeded + identical for all)
    target.current = {
      x: 60 + Math.random() * 520,
      y: 60 + Math.random() * 240,
      r: 26 + Math.random() * 22,
    };
  }

  useEffect(() => {
    respawn();
    const start = performance.now();
    let raf = 0;
    const ctx = canvasRef.current?.getContext("2d");

    function frame() {
      const elapsed = (performance.now() - start) / 1000;
      const remain = Math.max(0, GAME_S - elapsed);
      setLeft(Math.ceil(remain));
      if (ctx) {
        ctx.fillStyle = "#12141f";
        ctx.fillRect(0, 0, 640, 360);
        const t = target.current;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fillStyle = "#c9a45c";
        ctx.fill();
        ctx.fillStyle = "#e8e4d8";
        ctx.font = "22px VT323, monospace";
        ctx.fillText(`SCORE ${scoreRef.current}`, 14, 28);
        ctx.fillText(`${Math.ceil(remain)}s`, 596, 28);
      }
      if (remain <= 0) { onDone(scoreRef.current); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function click(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 640;
    const y = ((e.clientY - rect.top) / rect.height) * 360;
    const t = target.current;
    const dx = x - t.x, dy = y - t.y;
    if (dx * dx + dy * dy <= t.r * t.r) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      respawn();
    }
  }

  return (
    <div className="tr-wrap">
      <div className="tr-hud">
        <div className="tr-score">{score}</div>
        <div className="tr-hint">Click the discs. {left}s left. Practice only — nothing is recorded.</div>
      </div>
      <canvas ref={canvasRef} width={640} height={360} className="dr-canvas" onClick={click} />
    </div>
  );
}

export default function TestPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const onRightChain = isConnected && chain?.id === activeChain.id;
  const { data: bal } = useBalance({
    address,
    chainId: activeChain.id,
    query: { enabled: Boolean(address) },
  });
  const hasEth = Boolean(bal && bal.value > 0n);

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [finalScore, setFinalScore] = useState(0);

  const ready = isConnected && onRightChain && hasEth;

  return (
    <main className="faq">
      <div className="eyebrow">TEST YOUR SETUP</div>
      <h1 className="page-title">Ready for the arena?</h1>
      <p className="sub" style={{ marginBottom: 28 }}>
        Two quick checks before a real round: that your wallet is set up with
        ETH on the right network, and a free practice game so the flow isn't
        new when it counts.
      </p>

      <section className="faq-section">
        <h2>1 · Wallet &amp; funds check</h2>
        <div className="check-list">
          <div className={`check ${isConnected ? "ok" : ""}`}>
            {isConnected ? "✓" : "○"} Wallet connected
            {!isConnected && <span className="dim"> — use the Connect wallet button in the top bar</span>}
          </div>
          <div className={`check ${onRightChain ? "ok" : isConnected ? "bad" : ""}`}>
            {onRightChain ? "✓" : "○"} On {activeChain.name}
            {isConnected && !onRightChain && (
              <button className="link" onClick={() => switchChain({ chainId: activeChain.id })}>
                Switch to {activeChain.name}
              </button>
            )}
          </div>
          <div className={`check ${hasEth ? "ok" : onRightChain ? "bad" : ""}`}>
            {hasEth ? "✓" : "○"} ETH balance on {activeChain.name}
            {bal && (
              <span className="dim"> — you have {Number(bal.formatted).toFixed(5)} ETH</span>
            )}
            {onRightChain && !hasEth && (
              <span className="dim"> — you'll need ETH here to enter rounds; see How it works for the ways to get it</span>
            )}
          </div>
        </div>
        {ready ? (
          <div className="banner ok">Your setup looks good. Note: entering a real round costs the
          entry fee plus a tiny network fee, so keep a little extra beyond the fee itself.</div>
        ) : (
          <div className="banner">Complete the checks above — the How it works page walks
          through each step, including getting ETH onto {activeChain.name}.</div>
        )}
      </section>

      <section className="faq-section">
        <h2>2 · Practice game</h2>
        <p>
          A simple warm-up so you can feel how playing works: click Play, the
          game runs, your score appears. Free, unscored, and deliberately NOT
          one of the monthly games — those are never seen before their round.
          In a real round you get exactly one attempt and the server verifies
          every score.
        </p>
        {phase === "idle" && (
          <button className="btn big" onClick={() => setPhase("playing")} disabled={!isConnected}>
            {isConnected ? "Play the practice game" : "Connect a wallet first"}
          </button>
        )}
        {phase === "playing" && <PracticeGame onDone={(s) => { setFinalScore(s); setPhase("done"); }} />}
        {phase === "done" && (
          <>
            <p><b>Practice score: {finalScore}.</b> In a real round, that number would be
            re-computed by the server from your recorded inputs — the on-screen score is
            never trusted on its own.</p>
            <button className="btn" onClick={() => setPhase("playing")}>Play again</button>
          </>
        )}
      </section>
    </main>
  );
}
