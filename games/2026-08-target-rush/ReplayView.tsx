// Target Rush — operator replay viewer (mandatory pre-settlement review).
// Reconstructs the run purely from (seed, inputLog): play / pause / scrub,
// score accumulation, and automation red-flag hints. Rendering reuses the
// same deterministic sim; nothing here depends on the live session.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayArtifact, InputEvent } from "../../shared/types";
import {
  ARENA, GAME_MS, STEP_MS, TOTAL_STEPS,
  buildTargets, initState, stepState, bucketInputs, activeTargetAt,
  type RushState,
} from "./sim";

/** Reaction-time / regularity analysis to aid the human reviewer. */
function analyzeForAutomation(artifact: ReplayArtifact) {
  const targets = buildTargets(artifact.seed);
  const buckets = bucketInputs(artifact.inputLog);
  const state = initState(artifact.seed);
  for (let s = 0; s < TOTAL_STEPS; s++) stepState(state, targets, buckets.get(s) ?? []);

  const reactions: number[] = [];
  for (let i = 0; i < targets.length; i++) {
    if (state.hitStep[i] >= 0) reactions.push((state.hitStep[i] - targets[i].spawnStep) * STEP_MS);
  }
  const flags: string[] = [];
  if (reactions.length >= 5) {
    const mean = reactions.reduce((a, b) => a + b, 0) / reactions.length;
    const variance = reactions.reduce((a, b) => a + (b - mean) ** 2, 0) / reactions.length;
    const stdev = Math.sqrt(variance);
    if (mean < 130) flags.push(`Mean reaction ${mean.toFixed(0)}ms — below plausible human range`);
    if (stdev < 18) flags.push(`Reaction stdev ${stdev.toFixed(1)}ms — inhumanly consistent timing`);
    // Pixel-perfect centering: humans scatter, scripts click centers.
    // Match each hit to the click that landed in its exact hit step.
    const clicks = artifact.inputLog.filter((e) => e.type === "click");
    let centered = 0;
    for (let i = 0; i < targets.length; i++) {
      if (state.hitStep[i] < 0) continue;
      const c = clicks.find((e) => Math.floor(e.t / STEP_MS) === state.hitStep[i]);
      if (!c) continue;
      const dx = (c.data.x as number) - targets[i].x;
      const dy = (c.data.y as number) - targets[i].y;
      if (dx * dx + dy * dy <= 9) centered++;
    }
    if (centered / reactions.length > 0.6) flags.push(`${centered}/${reactions.length} hits within 3px of exact center — script-like precision`);
    return { reactions, mean, stdev, flags, hits: state.hits, misses: state.misses, finalScore: state.score };
  }
  return { reactions, mean: 0, stdev: 0, flags, hits: state.hits, misses: state.misses, finalScore: state.score };
}

export default function TargetRushReplay({ artifact }: { artifact: ReplayArtifact }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);

  const targets = useMemo(() => buildTargets(artifact.seed), [artifact.seed]);
  const buckets = useMemo(() => bucketInputs(artifact.inputLog), [artifact.inputLog]);
  const analysis = useMemo(() => analyzeForAutomation(artifact), [artifact]);

  // Full state timeline: recompute state at `step` deterministically each render
  // target (cheap: 1875 tiny steps). For scrubbing this is simplest + exact.
  const stateAt = (target: number): RushState => {
    const s = initState(artifact.seed);
    for (let i = 0; i < target; i++) stepState(s, targets, buckets.get(i) ?? []);
    return s;
  };

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setStep((s: number) => {
        const next = s + speed;
        if (next >= TOTAL_STEPS) {
          setPlaying(false);
          return TOTAL_STEPS;
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(interval);
  }, [playing, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = stateAt(step);
    const w = canvas.width, h = canvas.height;
    const sx = w / ARENA, sy = h / ARENA;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,140,190,0.10)";
    for (let g = 0; g <= ARENA; g += 100) {
      ctx.beginPath(); ctx.moveTo(g * sx, 0); ctx.lineTo(g * sx, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g * sy); ctx.lineTo(w, g * sy); ctx.stroke();
    }

    const idx = activeTargetAt(targets, state, step);
    if (idx >= 0) {
      const t = targets[idx];
      ctx.beginPath();
      ctx.arc(t.x * sx, t.y * sy, t.r * sx, 0, Math.PI * 2);
      ctx.strokeStyle = "#F5B841";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // clicks near this step (ghost markers ±6 steps)
    for (const ev of artifact.inputLog) {
      if (ev.type !== "click") continue;
      const es = Math.floor(ev.t / STEP_MS);
      if (Math.abs(es - step) <= 6) {
        ctx.beginPath();
        ctx.arc((ev.data.x as number) * sx, (ev.data.y as number) * sy, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#4EE1EC";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [step, targets, buckets, artifact]);

  const state = stateAt(step);

  return (
    <div className="replay">
      <div className="replay-flags">
        {analysis.flags.length === 0 ? (
          <span className="flag ok">No automation red flags · mean reaction {analysis.mean.toFixed(0)}ms · stdev {analysis.stdev.toFixed(0)}ms</span>
        ) : (
          analysis.flags.map((f: string) => <span key={f} className="flag bad">⚠ {f}</span>)
        )}
      </div>
      <canvas ref={canvasRef} width={640} height={640} className="replay-canvas" />
      <div className="replay-controls">
        <button onClick={() => setPlaying((p: boolean) => !p)}>{playing ? "Pause" : "Play"}</button>
        <input
          type="range" min={0} max={TOTAL_STEPS} value={step}
          onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
        />
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
        </select>
        <span className="replay-meta">
          t={((step * STEP_MS) / 1000).toFixed(1)}s · score {state.score.toLocaleString()} · {state.hits} hits / {state.misses} misses
        </span>
      </div>
      <div className="replay-final">Verified final score: <b>{analysis.finalScore.toLocaleString()}</b></div>
    </div>
  );
}
