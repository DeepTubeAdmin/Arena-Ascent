// Tower Stack — replay viewer (operator review + public winner replays).
// Reconstructs the run from (seed, inputLog); play / pause / scrub, plus
// automation hints: drop-timing precision per row. Machine-consistent
// alignment at high speed, or drops before a row starts moving, raise flags.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayArtifact, InputEvent } from "../../shared/types";
import {
  STEP_MS, MAX_STEPS, GRACE_STEPS,
  buildStartPhases, bucketInputs, initState, stepState, rowPos,
} from "./sim";
import { drawFrame } from "./Game";

function analyze(artifact: ReplayArtifact) {
  const phases = buildStartPhases(artifact.seed);
  const buckets = bucketInputs(artifact.inputLog as InputEvent[]);

  // Re-simulate while recording, for each placement, how far the row was
  // from perfect alignment at the drop step (0 = dead center over support).
  const st = initState();
  const offsets: number[] = [];
  let preStart = 0;
  let prevLevel = 0;
  let prevRowStart = st.rowStartStep;
  while (st.alive && st.step < MAX_STEPS) {
    const evs = buckets.get(st.step) ?? [];
    for (const e of evs) {
      if (e.type !== "key" || (e.data as any)?.action !== "drop") continue;
      if (st.step < GRACE_STEPS || st.step < st.rowStartStep) { preStart++; continue; }
      const pos = rowPos(st.level, st.width, phases[st.level], st.step - st.rowStartStep);
      offsets.push(Math.abs(pos - st.belowStart));
    }
    stepState(st, phases, evs);
    if (st.level !== prevLevel) { prevLevel = st.level; prevRowStart = st.rowStartStep; }
  }
  void prevRowStart;

  const n = offsets.length;
  const mean = n ? offsets.reduce((a, b) => a + b, 0) / n : 0;
  const highRows = offsets.slice(30); // 2-wide and 1-wide territory
  const perfectHigh = highRows.filter((o) => o === 0).length;

  const flags: string[] = [];
  if (highRows.length >= 8 && perfectHigh === highRows.length) {
    flags.push(`Machine-perfect: ${perfectHigh} consecutive exact alignments at high rows`);
  }
  if (preStart > 1) flags.push(`${preStart} drops before the row started moving`);
  return {
    flags, meanOffset: mean, endStep: st.step,
    rows: st.level, finalScore: st.score, perfect: st.perfect,
  };
}

export default function TowerStackReplay({ artifact }: { artifact: ReplayArtifact }) {
  const analysis = useMemo(() => analyze(artifact), [artifact]);
  const phases = useMemo(() => buildStartPhases(artifact.seed), [artifact.seed]);
  const buckets = useMemo(() => bucketInputs(artifact.inputLog as InputEvent[]), [artifact.inputLog]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const st = initState();
    while (st.alive && st.step < step) {
      stepState(st, phases, buckets.get(st.step) ?? []);
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawFrame(ctx, st, phases, null);
  }, [step, phases, buckets]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setStep((s: number) => {
        const next = s + speed;
        if (next >= analysis.endStep) { setPlaying(false); return analysis.endStep; }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, [playing, speed, analysis.endStep]);

  return (
    <div className="replay">
      <div className="replay-flags">
        {analysis.flags.length === 0 ? (
          <span className="flag ok">No automation red flags · mean drop offset {analysis.meanOffset.toFixed(2)} cols · {analysis.perfect} perfect placements</span>
        ) : (
          analysis.flags.map((f: string) => <span key={f} className="flag bad">⚠ {f}</span>)
        )}
      </div>
      <canvas ref={canvasRef} width={450} height={670} className="replay-canvas st-canvas" />
      <div className="replay-controls">
        <button onClick={() => setPlaying((p: boolean) => !p)}>{playing ? "Pause" : "Play"}</button>
        <input type="range" min={0} max={analysis.endStep} value={step}
          onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} />
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
        </select>
        <span className="replay-meta">
          step {step}/{analysis.endStep} · rows {analysis.rows} · final {analysis.finalScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
