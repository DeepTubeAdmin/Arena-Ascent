// The GAME MOUNT POINT. The shell owns: play session, synchronized start gate,
// input streaming (batched every second + final flush), and hard stop. The
// monthly game component owns only gameplay + emitting input events.
import { useEffect, useRef, useState } from "react";
import type { InputEvent, RunSummary } from "../../../shared/types";
import type { RoundInfo } from "../App";
import { api } from "../lib/api";
import Countdown from "./Countdown";

// ---- monthly game registry (frontend side) ----
import TargetRushGame from "../../../games/2026-08-target-rush/Game";
const GAME_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "2026-08-target-rush": TargetRushGame,
};

type Phase = "lobby" | "loading" | "ready" | "playing" | "submitted" | "spectating" | "error";

export default function GameShell({
  round, me, authed, onDone,
}: {
  round: RoundInfo;
  me: { entered: boolean; session: any } | null;
  authed: boolean;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [seed, setSeed] = useState("");
  const [provisional, setProvisional] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const tokenRef = useRef("");
  const queueRef = useRef<InputEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval>>();

  const alreadyPlayed = Boolean(me?.session?.completed_at);
  const canPlay = authed && me?.entered && !alreadyPlayed;

  async function begin() {
    try {
      setErr("");
      setPhase("loading");
      const { playToken, seed } = await api.playStart(round.roundId);
      tokenRef.current = playToken;
      setSeed(seed);
      setPhase("ready"); // game mounts, calls onReady, then we gate the start
    } catch (e: any) {
      setErr(e.message);
      setPhase("error");
    }
  }

  // Batched input streaming: every 1s while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    flushTimerRef.current = setInterval(async () => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0, queueRef.current.length);
      try {
        await api.playInput(tokenRef.current, batch);
      } catch {
        // Re-queue on transient failure; the final flush retries everything.
        queueRef.current.unshift(...batch);
      }
    }, 1000);
    return () => clearInterval(flushTimerRef.current);
  }, [phase]);

  function handleInput(ev: InputEvent) {
    queueRef.current.push(ev);
  }

  function handleReady() {
    // Small fixed countdown so every player who hits Play gets the same gate.
    setTimeout(() => setPhase("playing"), 1500);
  }

  async function handleComplete(_summary: RunSummary) {
    clearInterval(flushTimerRef.current);
    const finalEvents = queueRef.current.splice(0, queueRef.current.length);
    try {
      const { provisionalScore } = await api.playComplete(tokenRef.current, finalEvents);
      setProvisional(provisionalScore);
      setPhase("submitted");
      onDone();
    } catch (e: any) {
      setErr(e.message);
      setPhase("error");
    }
  }

  const GameComponent = GAME_COMPONENTS[round.gameId];

  if (phase === "ready" || phase === "playing") {
    if (!GameComponent) return <div className="banner error">Game module {round.gameId} not found in this build.</div>;
    return (
      <main className="game-stage">
        {phase === "ready" && <div className="start-gate">GET READY</div>}
        <GameComponent
          seed={seed}
          started={phase === "playing"}
          onInput={handleInput}
          onReady={handleReady}
          onComplete={handleComplete}
        />
      </main>
    );
  }

  return (
    <main>
      <div className="live-badge">● LIVE</div>
      <Countdown target={round.liveEnd} label="WINDOW CLOSES IN" />
      {phase === "submitted" ? (
        <div className="banner ok">
          Run submitted. Provisional score: <b>{provisional?.toLocaleString()}</b>.
          Official results follow verification and human review of the top run after
          the window closes.
        </div>
      ) : alreadyPlayed ? (
        <div className="banner">Your attempt is complete. Results after the window closes.</div>
      ) : canPlay ? (
        <div className="play-cta">
          <p>The arena is open. You get one run — 30 seconds. When you press Play, your attempt is consumed.</p>
          <button className="btn big" onClick={begin} disabled={phase === "loading"}>
            {phase === "loading" ? "Preparing your session…" : "Play my one attempt"}
          </button>
        </div>
      ) : (
        <div className="banner">
          {authed ? "You're not entered in this round." : "Sign in to play."} Spectating — results after the window.
        </div>
      )}
      {err && <div className="banner error">{err}</div>}
    </main>
  );
}
