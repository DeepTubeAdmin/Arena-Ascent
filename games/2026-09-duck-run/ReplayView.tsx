// Duck Run — operator replay viewer (mandatory pre-settlement review).
// Reconstructs the run purely from (seed, inputLog); play / pause / scrub,
// plus automation hints: reaction times from obstacle visibility to the
// correct evasive action. Inhuman consistency or pre-visibility actions flag.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayArtifact, InputEvent } from "../../shared/types";
import {
  STEP_MS, MAX_STEPS, X_SPAWN, PLAYER_W, OB_W,
  buildObstacles, bucketInputs, initState, stepState, speedAt,
  type RunState,
} from "./sim";
import { drawFrame } from "./Game";

function analyzeForAutomation(artifact: ReplayArtifact) {
  const schedule = buildObstacles(artifact.seed);
  const buckets = bucketInputs(artifact.inputLog as InputEvent[]);

  // For each obstacle, find when it became "actionable" (spawn) and the step
  // of the matching evasive action that preceded the player-zone overlap.
  const reactions: number[] = [];
  let preVisible = 0;

  // replay once to find death step / end
  const st = initState();
  while (st.alive && st.step < MAX_STEPS) {
    stepState(st, schedule, buckets.get(st.step) ?? []);
  }
  const endStep = st.deathStep >= 0 ? st.deathStep : st.step;

  const actions: { step: number; action: string }[] = [];
  for (const [s, evs] of buckets) {
    for (const e of evs) {
      const a = (e.data as any)?.action;
      if (a === "jump" || a === "duckDown") actions.push({ step: s, action: a });
    }
  }
  actions.sort((a, b) => a.step - b.step);

  for (const o of schedule) {
    if (o.spawnStep > endStep) break;
    // arrival step ≈ spawn + travel time at prevailing speed
    const v = speedAt(o.spawnStep);
    const arrive = o.spawnStep + Math.floor((X_SPAWN - PLAYER_W) / v);
    const want = o.kind === 0 ? "jump" : "duckDown";
    const a = actions.find((x) => x.action === want && x.step > o.spawnStep - 8 && x.step <= arrive + 4);
    if (!a) continue;
    const reactionMs = (a.step - o.spawnStep) * STEP_MS;
    if (reactionMs < 0) preVisible++;
    else reactions.push(reactionMs);
  }

  const mean = reactions.length ? reactions.reduce((x, y) => x + y, 0) / reactions.length : 0;
  const variance = reactions.length
    ? reactions.reduce((x, y) => x + (y - mean) * (y - mean), 0) / reactions.length : 0;
  const stdev = Math.sqrt(variance);

  const flags: string[] = [];
  if (reactions.length >= 8 && mean < 130) flags.push(`Superhuman mean reaction ${mean.toFixed(0)}ms across ${reactions.length} obstacles`);
  if (reactions.length >= 8 && stdev < 14) flags.push(`Machine-like consistency: stdev ${stdev.toFixed(1)}ms`);
  if (preVisible > 1) flags.push(`${preVisible} actions before the obstacle spawned`);
  return { flags, mean, stdev, endStep, finalScore: st.score, cleared: st.cleared };
}

export default function DuckRunReplay({ artifact }: { artifact: ReplayArtifact }) {
  const analysis = useMemo(() => analyzeForAutomation(artifact), [artifact]);
  const schedule = useMemo(() => buildObstacles(artifact.seed), [artifact.seed]);
  const buckets = useMemo(() => bucketInputs(artifact.inputLog as InputEvent[]), [artifact.inputLog]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Re-simulate up to `step` for a scrub-accurate frame (cheap: integer sim).
  useEffect(() => {
    const st = initState();
    while (st.alive && st.step < step) {
      stepState(st, schedule, buckets.get(st.step) ?? []);
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawFrame(ctx, st, null);
  }, [step, schedule, buckets]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setStep((s: number) => {
        const next = s + speed;
        if (next >= analysis.endStep) { setPlaying(false); return analysis.endStep; }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(interval);
  }, [playing, speed, analysis.endStep]);

  return (
    <div className="replay">
      <div className="replay-flags">
        {analysis.flags.length === 0 ? (
          <span className="flag ok">No automation red flags · mean reaction {analysis.mean.toFixed(0)}ms · stdev {analysis.stdev.toFixed(0)}ms</span>
        ) : (
          analysis.flags.map((f: string) => <span key={f} className="flag bad">⚠ {f}</span>)
        )}
      </div>
      <canvas ref={canvasRef} width={720} height={360} className="replay-canvas dr-replay" />
      <div className="replay-controls">
        <button onClick={() => setPlaying((p: boolean) => !p)}>{playing ? "Pause" : "Play"}</button>
        <input
          type="range" min={0} max={analysis.endStep} value={step}
          onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
        />
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
        </select>
        <span className="replay-meta">
          step {step}/{analysis.endStep} · cleared {analysis.cleared} · final {analysis.finalScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
