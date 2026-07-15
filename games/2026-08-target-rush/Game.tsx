// Target Rush — frontend game component.
// The shell owns: session token, input streaming, synchronized start, timing.
// This component owns: rendering, capturing input, running the SAME sim the
// server will use. It never reports a trusted score — the local score shown
// to the player is display-only; the backend re-derives the real one.

import { useEffect, useRef, useState } from "react";
import type { GameProps, InputEvent } from "../../shared/types";
import {
  ARENA,
  GAME_MS,
  STEP_MS,
  TOTAL_STEPS,
  buildTargets,
  initState,
  stepState,
  activeTargetAt,
  type RushState,
  type Target,
} from "./sim";

export default function TargetRushGame({ seed, onInput, onReady, started, onComplete }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [done, setDone] = useState(false);

  const targetsRef = useRef<Target[]>([]);
  const stateRef = useRef<RushState | null>(null);
  const startRef = useRef<number>(0);
  const bufferRef = useRef<Map<number, InputEvent[]>>(new Map());
  const completedRef = useRef(false);

  // Load / init once per seed.
  useEffect(() => {
    targetsRef.current = buildTargets(seed);
    stateRef.current = initState(seed);
    bufferRef.current = new Map();
    completedRef.current = false;
    setDone(false);
    setDisplayScore(0);
    onReady();
  }, [seed]);

  // Run loop begins only when the shell opens the gate.
  useEffect(() => {
    if (!started) return;
    startRef.current = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      const state = stateRef.current;
      if (!state) return;
      const elapsed = now - startRef.current;
      const targetStep = Math.min(Math.floor(elapsed / STEP_MS), TOTAL_STEPS);

      // Advance the fixed-timestep sim up to wall-clock, feeding buffered inputs.
      while (state.step < targetStep) {
        const inputs = bufferRef.current.get(state.step) ?? [];
        bufferRef.current.delete(state.step);
        stepState(state, targetsRef.current, inputs);
      }

      draw(elapsed);
      setDisplayScore(state.score);

      if (state.step >= TOTAL_STEPS) {
        if (!completedRef.current) {
          completedRef.current = true;
          setDone(true);
          onComplete({ endedAt: Math.min(elapsed, GAME_MS), reason: "timeout" });
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  function gameCoords(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Convert screen px → integer game coords (resolution-independent).
    const x = Math.round(((e.clientX - rect.left) / rect.width) * ARENA);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * ARENA);
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!started || completedRef.current) return;
    const pt = gameCoords(e);
    const state = stateRef.current;
    if (!pt || !state) return;

    const t = Math.min(performance.now() - startRef.current, GAME_MS - 1);
    const ev: InputEvent = { t, type: "click", data: { x: pt.x, y: pt.y } };

    onInput(ev); // stream to the shell → backend stores it (the real record)

    // Buffer locally so the live sim applies it at the same step the server will.
    const step = Math.floor(t / STEP_MS);
    if (step >= state.step) {
      const arr = bufferRef.current.get(step);
      if (arr) arr.push(ev);
      else bufferRef.current.set(step, [ev]);
    }
  }

  function draw(elapsedMs: number) {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const sx = w / ARENA;
    const sy = h / ARENA;

    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(120,140,190,0.10)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= ARENA; g += 100) {
      ctx.beginPath(); ctx.moveTo(g * sx, 0); ctx.lineTo(g * sx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g * sy); ctx.lineTo(w, g * sy); ctx.stroke();
    }

    // active target (deterministic view of the shared sim state)
    const step = state.step;
    const idx = activeTargetAt(targetsRef.current, state, step);
    if (idx >= 0) {
      const t = targetsRef.current[idx];
      const frac = (t.despawnStep - step) / (t.despawnStep - t.spawnStep); // life remaining

      ctx.beginPath();
      ctx.arc(t.x * sx, t.y * sy, t.r * sx, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245,184,65,0.16)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#F5B841";
      ctx.stroke();

      // shrinking life ring
      ctx.beginPath();
      ctx.arc(t.x * sx, t.y * sy, t.r * sx * Math.max(frac, 0.05), 0, Math.PI * 2);
      ctx.strokeStyle = "#4EE1EC";
      ctx.lineWidth = 2;
      ctx.stroke();

      // bullseye
      ctx.beginPath();
      ctx.arc(t.x * sx, t.y * sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#F5B841";
      ctx.fill();
    }

    // time bar
    const timeFrac = Math.max(0, 1 - elapsedMs / GAME_MS);
    ctx.fillStyle = "rgba(78,225,236,0.9)";
    ctx.fillRect(0, h - 4, w * timeFrac, 4);
  }

  return (
    <div className="tr-wrap">
      <div className="tr-hud">
        <span className="tr-score">{displayScore.toLocaleString()}</span>
        <span className="tr-hint">
          {done ? "Run complete — score pending official verification" : started ? "Hit the targets!" : "Waiting for start…"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={720}
        className="tr-canvas"
        onPointerDown={handlePointerDown}
        style={{ touchAction: "none", cursor: started && !done ? "crosshair" : "default" }}
      />
    </div>
  );
}
