// Tower Stack — frontend game component (2026-10).
// SPACE (or click) = freeze the row. Rendering + input capture only; the
// server re-simulates the authoritative score from the input log.

import { useEffect, useRef, useState } from "react";
import type { GameProps, InputEvent } from "../../shared/types";
import {
  STEP_MS, MAX_STEPS, GRACE_STEPS, COLS, ROW_TIMEOUT_STEPS,
  buildStartPhases, initState, stepState, rowPos, speedAt,
  type StackState,
} from "./sim";

const W = 450, H = 670;
const CELL = 28, PAD = (W - COLS * CELL) / 2;
const VISIBLE_ROWS = 20;

export function drawFrame(
  ctx: CanvasRenderingContext2D, st: StackState, phases: number[],
  practiceLeftS: number | null, frac: number = 0
) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#12141f";
  ctx.fillRect(0, 0, W, H);

  // camera: keep the active row near the middle once the tower grows
  const camBase = Math.max(0, st.level - 14);

  const rowY = (level: number) => H - 50 - (level - camBase) * (CELL + 2);

  // grid dots for visible board
  ctx.fillStyle = "#1c1f2e";
  for (let r = 0; r < VISIBLE_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillRect(PAD + c * CELL + 1, rowY(camBase + r) + 1, CELL - 4, CELL - 4);
    }
  }

  // milestone lines (rows 11 and 15, i.e. levels 10 and 14)
  for (const [lvl, name] of [[19, "MINOR"], [39, "MAJOR"]] as [number, string][]) {
    const y = rowY(lvl);
    if (y > 20 && y < H - 10) {
      ctx.strokeStyle = "#3a3d52";
      ctx.beginPath(); ctx.moveTo(6, y - 3); ctx.lineTo(W - 6, y - 3); ctx.stroke();
      ctx.fillStyle = "#8d8877";
      ctx.font = "14px VT323, monospace";
      ctx.fillText(name, 8, y - 8);
    }
  }

  // placed rows
  ctx.fillStyle = "#c9a45c";
  st.placed.forEach((p, lvl) => {
    const y = rowY(lvl);
    if (y < -CELL || y > H) return;
    for (let c = 0; c < p.width; c++) {
      ctx.fillRect(PAD + (p.start + c) * CELL + 1, y + 1, CELL - 4, CELL - 4);
    }
  });

  // the moving row (interpolated between cells — cosmetic only)
  if (st.alive && st.step >= GRACE_STEPS) {
    const sIn = st.step - st.rowStartStep;
    const pos = rowPos(st.level, st.width, phases[st.level], sIn);
    const nxt = rowPos(st.level, st.width, phases[st.level], sIn + speedAt(st.level));
    const within = ((sIn % speedAt(st.level)) + frac) / speedAt(st.level);
    const x = pos + (nxt - pos) * Math.min(1, within);
    const y = rowY(st.level);
    ctx.fillStyle = "#e8e4d8";
    for (let c = 0; c < st.width; c++) {
      ctx.fillRect(PAD + (x + c) * CELL + 1, y + 1, CELL - 4, CELL - 4);
    }
    // shot clock (thin bar under the HUD): drains over ROW_TIMEOUT
    const left = Math.max(0, 1 - sIn / ROW_TIMEOUT_STEPS);
    ctx.fillStyle = left < 0.25 ? "#d96b5d" : "#3a3d52";
    ctx.fillRect(10, 44, (W - 20) * left, 3);
  }

  // HUD
  ctx.fillStyle = "#e8e4d8";
  ctx.font = "22px VT323, monospace";
  ctx.fillText(`SCORE ${st.score}`, 10, 26);
  ctx.textAlign = "right";
  ctx.fillText(`ROW ${st.level + 1}`, W - 10, 26);
  ctx.textAlign = "left";
  ctx.font = "16px VT323, monospace";
  ctx.fillStyle = "#8d8877";
  ctx.fillText("SPACE = FREEZE THE ROW", 10, H - 10);

  if (practiceLeftS !== null && practiceLeftS > 0) {
    ctx.fillStyle = "#9bb489";
    ctx.font = "22px VT323, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`READ THIS — first row moves in ${practiceLeftS}s`, W / 2, 110);
    ctx.font = "17px VT323, monospace";
    ctx.fillText("A row of blocks slides back and forth.", W / 2, 150);
    ctx.fillText("Press SPACE (or click) to freeze it in place.", W / 2, 174);
    ctx.fillText("Blocks hanging past the row below are chopped off.", W / 2, 198);
    ctx.fillText("Miss the stack completely and your run is over.", W / 2, 222);
    ctx.fillText("Rows speed up as you climb; the stack narrows every 10 rows.", W / 2, 246);
    ctx.fillText("Higher rows are worth far more points.", W / 2, 270);
    ctx.fillText("Don't stall: each row has a 10-second shot clock.", W / 2, 294);
    ctx.textAlign = "left";
  }
  if (!st.alive) {
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "30px VT323, monospace";
    ctx.textAlign = "center";
    const msg = st.endReason === "timeout" ? "SHOT CLOCK — RUN OVER"
              : st.endReason === "cap" ? "TOWER COMPLETE"
              : "MISSED — RUN OVER";
    ctx.fillText(msg, W / 2, 120);
    ctx.textAlign = "left";
  }
}

export default function TowerStackGame({ seed, onInput, onReady, started, onComplete }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [done, setDone] = useState(false);

  const phasesRef = useRef<number[]>([]);
  const stateRef = useRef<StackState | null>(null);
  const startRef = useRef(0);
  const bufferRef = useRef<Map<number, InputEvent[]>>(new Map());
  const doneRef = useRef(false);
  const hudAtRef = useRef(0);

  useEffect(() => {
    phasesRef.current = buildStartPhases(seed);
    onReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (!started) return;
    function emit() {
      const t = Math.max(0, performance.now() - startRef.current);
      const e: InputEvent = { t, type: "key", data: { action: "drop" } };
      onInput(e);
      const s = Math.floor(t / STEP_MS);
      if (!bufferRef.current.has(s)) bufferRef.current.set(s, []);
      bufferRef.current.get(s)!.push(e);
    }
    function down(ev: KeyboardEvent) {
      if (ev.repeat) return;
      if (ev.code === "Space" || ev.key === " ") { ev.preventDefault(); emit(); }
    }
    function click() { emit(); }
    window.addEventListener("keydown", down);
    canvasRef.current?.addEventListener("mousedown", click);
    const cv = canvasRef.current;
    return () => { window.removeEventListener("keydown", down); cv?.removeEventListener("mousedown", click); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

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
        stepState(st, phasesRef.current, bufferRef.current.get(st.step) ?? []);
      }
      const nowMs = performance.now();
      if (nowMs - hudAtRef.current > 250) {
        hudAtRef.current = nowMs;
        setDisplayScore(st.score);
      }
      if (ctx) {
        const practiceLeft = st.step < GRACE_STEPS
          ? Math.ceil((GRACE_STEPS - st.step) * STEP_MS / 1000) : null;
        const frac = st.alive ? Math.min(1, Math.max(0, exactStep - st.step)) : 0;
        drawFrame(ctx, st, phasesRef.current, practiceLeft, frac);
      }
      if (!st.alive || st.step >= MAX_STEPS) {
        if (!doneRef.current) {
          doneRef.current = true;
          setDisplayScore(st.score);
          setDone(true);
          onComplete({
            endedAt: st.step * STEP_MS,
            reason: st.endReason === "miss" ? "died"
                  : st.endReason === "cap" ? "completed"
                  : "timeout",
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
                : "SPACE freezes the row. Stack it clean — every overhang is gone forever."}
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="st-canvas" />
    </div>
  );
}
