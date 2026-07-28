// Duck Run — frontend game component (2026-09).
// UP/W/Space = jump the LOW rods, DOWN/S (hold) = duck the HIGH rods.
// Rendering + input capture only; the shown score is display-only — the
// server re-simulates the authoritative one from the input log.

import { useEffect, useRef, useState } from "react";
import type { GameProps, InputEvent } from "../../shared/types";
import {
  STEP_MS, MAX_STEPS, GRACE_STEPS, X_SPAWN, PLAYER_W, OB_W, MAX_HITS,
  buildObstacles, initState, stepState, airborne, isDucking, speedAt, waveAt,
  type RunState, type Obstacle,
} from "./sim";

const W = 720, H = 360, GROUND = 300;
const SCALE = (W - 120) / X_SPAWN;   // world units → px
const LANE_X = 150;                  // player's x at full health
const STEP_BACK = 16;                // px shoved toward the water per hit

export function drawFrame(
  ctx: CanvasRenderingContext2D, st: RunState, practiceLeftS: number | null,
  frac: number = 0
) {
  // `frac` (0..1) = how far the wall clock sits inside the CURRENT sim step.
  // DRAWING ONLY — never feeds back into sim state, collision, or scoring.
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#12141f";
  ctx.fillRect(0, 0, W, H);

  // --- the water you're being shoved toward (left edge) ---
  const waterW = 60;
  ctx.fillStyle = "#1b2740";
  ctx.fillRect(0, GROUND - 6, waterW, H - GROUND + 6);
  ctx.strokeStyle = "#3d5680";
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = GROUND + 12 + i * 16;
    ctx.moveTo(4, y); ctx.lineTo(waterW - 4, y);
  }
  ctx.stroke();

  // --- track ---
  ctx.strokeStyle = "#3a3d52";
  ctx.beginPath(); ctx.moveTo(waterW, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

  // --- player (shoved left one notch per hit) ---
  const px = LANE_X - st.hits * STEP_BACK;
  const pw = PLAYER_W * SCALE;
  let ph = 46, py = GROUND - ph;
  if (airborne(st)) {
    const into = JUMP_TOTAL - (st.jumpUntil - st.step) + frac;
    const t = Math.min(1, Math.max(0, into / JUMP_TOTAL));
    py = GROUND - ph - 4 * 60 * t * (1 - t);      // continuous arc
  } else if (isDucking(st)) {
    ph = 22; py = GROUND - ph;
  }
  // flash on the step you get clobbered
  const justHit = st.lastHitStep >= 0 && st.step - st.lastHitStep < 12;
  ctx.fillStyle = !st.alive ? "#d96b5d" : justHit ? "#e0b894" : "#c9a45c";
  ctx.fillRect(px, py, pw, ph);

  // --- rods, drawn at interpolated positions ---
  const v = speedAt(st.step);
  for (const o of st.active) {
    const ix = o.x - v * frac;
    const x = 120 + ix * SCALE;
    const w = OB_W * SCALE;
    if (o.kind === 0) {
      ctx.fillStyle = "#9bb489";                  // LOW — jump it
      ctx.fillRect(x, GROUND - 34, w, 34);
    } else {
      ctx.fillStyle = "#8a94c9";                  // HIGH — duck it
      ctx.fillRect(x, GROUND - 110, w, 78);
    }
  }

  // --- HUD ---
  ctx.fillStyle = "#e8e4d8";
  ctx.font = "24px VT323, monospace";
  ctx.fillText(`SCORE ${st.score}`, 130, 30);
  ctx.fillText(`WAVE ${waveAt(st.step) + 1}`, W - 110, 30);

  // footing pips: how many hits before you're in the drink
  const left = MAX_HITS - st.hits;
  ctx.font = "20px VT323, monospace";
  ctx.fillStyle = left <= 2 ? "#d96b5d" : "#8d8877";
  ctx.fillText(`FOOTING ${"|".repeat(Math.max(0, left))}`, 130, 54);

  ctx.font = "18px VT323, monospace";
  ctx.fillStyle = "#8d8877";
  ctx.fillText("UP = JUMP    DOWN = DUCK", 130, H - 14);

  if (practiceLeftS !== null && practiceLeftS > 0) {
    ctx.fillStyle = "#9bb489";
    ctx.font = "26px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`PRACTICE — first rod in ${practiceLeftS}s`, W / 2, 96);
    ctx.font = "20px VT323, monospace";
    ctx.fillText("UP to jump the green rods, DOWN to duck the blue ones", W / 2, 124);
    ctx.fillText(`${MAX_HITS - 1} hits you survive — the ${MAX_HITS}th is the water`, W / 2, 150);
    ctx.textAlign = "left";
  }
  if (!st.alive) {
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "34px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText("IN THE WATER", W / 2, 150);
    ctx.textAlign = "left";
  }
}
const JUMP_TOTAL = 30; // JUMP_STEPS, local copy for the draw arc

export default function DuckRunGame({ seed, onInput, onReady, started, onComplete }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayHits, setDisplayHits] = useState(0);
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

  // keyboard → InputEvents (timestamps relative to game start)
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

  // main loop: fixed-step sim on the wall clock, interpolated rendering
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
      // React HUD throttled to 4/s — per-frame setState causes jank.
      const nowMs = performance.now();
      if (nowMs - hudAtRef.current > 250) {
        hudAtRef.current = nowMs;
        setDisplayScore(st.score);
        setDisplayHits(st.hits);
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
          setDisplayScore(st.score);
          setDisplayHits(st.hits);
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
          {done
            ? "Run complete — the server verifies your score."
            : `UP = jump · DOWN = duck · ${MAX_HITS - displayHits} footing left`}
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="dr-canvas" />
    </div>
  );
}
