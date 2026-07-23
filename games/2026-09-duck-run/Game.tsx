// Duck Run — frontend game component (2026-09).
// UP/W = jump · DOWN/S = duck. Rendering + input capture only; the shown
// score is display-only — the server re-simulates the authoritative one.

import { useEffect, useRef, useState } from "react";
import type { GameProps, InputEvent } from "../../shared/types";
import {
  STEP_MS, MAX_STEPS, GRACE_STEPS, X_SPAWN, PLAYER_W, OB_W,
  buildObstacles, initState, stepState, airborne, speedAt, waveAt,
  type RunState, type Obstacle,
} from "./sim";

const W = 720, H = 360, GROUND = 300;
const SCALE = (W - 60) / X_SPAWN; // world units → px

export function drawFrame(
  ctx: CanvasRenderingContext2D, st: RunState, practiceLeftS: number | null,
  frac: number = 0
) {
  // `frac` (0..1) is how far the wall clock sits inside the CURRENT sim step.
  // It is used for DRAWING ONLY — the sim stays discrete and deterministic.
  // Without it, fast obstacles visibly teleport between 16ms ticks.
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#12141f";
  ctx.fillRect(0, 0, W, H);

  // ground
  ctx.strokeStyle = "#3a3d52";
  ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

  // player: run / jump arc / duck squat
  const px = 30, pw = PLAYER_W * SCALE;
  let ph = 46, py = GROUND - ph;
  if (airborne(st)) {
    const total = 30; // JUMP_STEPS
    const into = total - (st.jumpUntil - st.step) + frac; // continuous arc
    const t = Math.min(1, into / total);       // 0..1
    const lift = 4 * 60 * t * (1 - t);         // parabola, peak 60px
    py = GROUND - ph - lift;
  } else if (st.ducking) {
    ph = 22; py = GROUND - ph;
  }
  ctx.fillStyle = st.alive ? "#c9a45c" : "#d96b5d";
  ctx.fillRect(px, py, pw, ph);

  // obstacles — drawn at interpolated positions between sim steps
  const v = speedAt(st.step);
  for (const o of st.active) {
    const ix = Math.max(-OB_W, o.x - v * frac);
    const x = 30 + ix * SCALE;
    const w = OB_W * SCALE;
    if (o.kind === 0) {
      // LOW wall — jump it
      ctx.fillStyle = "#9bb489";
      ctx.fillRect(x, GROUND - 34, w, 34);
    } else {
      // HIGH bar — duck under it (gap below)
      ctx.fillStyle = "#8a94c9";
      ctx.fillRect(x, GROUND - 110, w, 78);
    }
  }

  // HUD
  ctx.fillStyle = "#e8e4d8";
  ctx.font = "24px VT323, monospace";
  ctx.fillText(`SCORE ${st.score}`, 16, 30);
  ctx.fillText(`WAVE ${waveAt(st.step) + 1}`, W - 110, 30);

  ctx.font = "18px VT323, monospace";
  ctx.fillStyle = "#8d8877";
  ctx.fillText("UP = JUMP    DOWN = DUCK", 16, H - 14);

  if (practiceLeftS !== null && practiceLeftS > 0) {
    ctx.fillStyle = "#9bb489";
    ctx.font = "26px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`PRACTICE — first obstacle in ${practiceLeftS}s`, W / 2, 90);
    ctx.font = "20px VT323, monospace";
    ctx.fillText("Try your keys: UP to jump, DOWN to duck", W / 2, 120);
    ctx.textAlign = "left";
  }
  if (!st.alive) {
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "34px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText("RUN OVER", W / 2, 140);
    ctx.textAlign = "left";
  }
}

export default function DuckRunGame({ seed, onInput, onReady, started, onComplete }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [done, setDone] = useState(false);

  const scheduleRef = useRef<Obstacle[]>([]);
  const stateRef = useRef<RunState | null>(null);
  const startRef = useRef(0);
  const bufferRef = useRef<Map<number, InputEvent[]>>(new Map());
  const duckHeldRef = useRef(false);
  const doneRef = useRef(false);
  const hudAtRef = useRef(0);

  useEffect(() => {
    scheduleRef.current = buildObstacles(seed);
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // keyboard → InputEvents (recorded relative to game start)
  useEffect(() => {
    if (!started) return;
    function emit(action: "jump" | "duckDown" | "duckUp") {
      const t = Math.max(0, performance.now() - startRef.current);
      const e: InputEvent = { t, type: "key", data: { action } };
      onInput(e);
      const s = Math.floor(t / STEP_MS);
      if (!bufferRef.current.has(s)) bufferRef.current.set(s, []);
      bufferRef.current.get(s)!.push(e);
    }
    function down(ev: KeyboardEvent) {
      if (ev.repeat) return;
      if (ev.key === "ArrowUp" || ev.key === "w" || ev.key === "W" || ev.key === " ") {
        ev.preventDefault(); emit("jump");
      } else if (ev.key === "ArrowDown" || ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        if (!duckHeldRef.current) { duckHeldRef.current = true; emit("duckDown"); }
      }
    }
    function up(ev: KeyboardEvent) {
      if (ev.key === "ArrowDown" || ev.key === "s" || ev.key === "S") {
        ev.preventDefault();
        if (duckHeldRef.current) { duckHeldRef.current = false; emit("duckUp"); }
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // main loop: fixed-step sim driven by wall clock, capped, death-aware
  useEffect(() => {
    if (!started) return;
    startRef.current = performance.now();
    stateRef.current = initState();
    let raf = 0;
    const ctx = canvasRef.current?.getContext("2d") ?? null;

    function frame() {
      const st = stateRef.current!;
      const exactStep = Math.min(MAX_STEPS, (performance.now() - startRef.current) / STEP_MS);
      const targetStep = Math.floor(exactStep);
      while (st.alive && st.step < targetStep) {
        stepState(st, scheduleRef.current, bufferRef.current.get(st.step) ?? []);
      }
      // React HUD updates are throttled to 4/s — per-frame setState forces a
      // React render alongside every canvas frame and causes jank. The canvas
      // itself is the real-time HUD.
      const nowMs = performance.now();
      if (nowMs - hudAtRef.current > 250) {
        hudAtRef.current = nowMs;
        setDisplayScore(st.score);
      }
      if (ctx) {
        const practiceLeft = st.step < GRACE_STEPS
          ? Math.ceil((GRACE_STEPS - st.step) * STEP_MS / 1000) : null;
        const frac = st.alive ? Math.min(1, Math.max(0, exactStep - st.step)) : 0;
        drawFrame(ctx, st, practiceLeft, frac);
      }
      if (!st.alive || st.step >= MAX_STEPS) {
        if (!doneRef.current) {
          doneRef.current = true;
          setDisplayScore(st.score); // exact final score, immediately
          setDone(true);
          onComplete({
            endedAt: (st.deathStep >= 0 ? st.deathStep : MAX_STEPS) * STEP_MS,
            reason: st.alive ? "timeout" : "died",
          });
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div className="tr-wrap">
      <div className="tr-hud">
        <div className="tr-score">{displayScore.toLocaleString()}</div>
        <div className="tr-hint">
          {done ? "Run complete — the server verifies your score."
                : "UP = jump · DOWN = duck. Survive the acceleration."}
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="dr-canvas" />
    </div>
  );
}
