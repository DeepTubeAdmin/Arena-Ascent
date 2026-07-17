// Homepage pedestal: the champion elevated in gold, a small muted crowd of
// defeated players at ground level below. Pure SVG, static, crispEdges.
// The results-screen Pedestal (in Results.tsx) stays solo — this variant is
// only for the hero.

/** One small dim pixel figure (a defeated player), ~half champion scale. */
function CrowdFigure({ x, h = 0 }: { x: number; h?: number }) {
  // h nudges height slightly so the crowd isn't uniform. Baseline y = 116.
  const top = 88 - h;
  return (
    <g fill="var(--line-strong)">
      <rect x={x + 3} y={top} width={8} height={7} />        {/* head */}
      <rect x={x + 1} y={top + 9} width={12} height={10} />  {/* torso */}
      <rect x={x + 2} y={top + 20} width={4} height={116 - (top + 20)} /> {/* left leg */}
      <rect x={x + 8} y={top + 20} width={4} height={116 - (top + 20)} /> {/* right leg */}
    </g>
  );
}

export default function HeroPedestal() {
  return (
    <svg
      className="pedestal-svg hero-pedestal"
      viewBox="0 0 280 170"
      role="img"
      aria-label="A lone champion on a podium above a small crowd of defeated players"
      shapeRendering="crispEdges"
    >
      {/* champion — same 8-bit figure as the results screen, centered */}
      <g fill="var(--gold)">
        <rect x="132" y="28" width="16" height="14" />
        <rect x="128" y="44" width="24" height="20" />
        <rect x="120" y="44" width="6" height="16" />
        <rect x="120" y="34" width="6" height="12" />
        <rect x="154" y="44" width="6" height="16" />
        <rect x="130" y="66" width="8" height="16" />
        <rect x="142" y="66" width="8" height="16" />
      </g>

      {/* podium */}
      <g fill="var(--ink)" stroke="var(--line-strong)" strokeWidth="2">
        <rect x="110" y="86" width="60" height="30" />
      </g>
      <g fill="var(--dim)" fontFamily="var(--font-display)" fontSize="13" textAnchor="middle">
        <text x="140" y="107">1</text>
      </g>

      {/* the crowd below — dim, grounded, varied heights, flanking the podium */}
      <CrowdFigure x={22} h={0} />
      <CrowdFigure x={44} h={3} />
      <CrowdFigure x={66} h={1} />
      <CrowdFigure x={88} h={4} />
      <CrowdFigure x={176} h={2} />
      <CrowdFigure x={198} h={5} />
      <CrowdFigure x={220} h={0} />
      <CrowdFigure x={242} h={3} />

      {/* ground line */}
      <line x1="10" y1="116" x2="270" y2="116" stroke="var(--line)" strokeWidth="1" />
    </svg>
  );
}
