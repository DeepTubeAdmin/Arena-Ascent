// The signature element: the window IS the product, so the countdown is the hero.
import { useEffect, useState } from "react";

export default function Countdown({ target, label }: { target: string | null; label: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!target) return null;
  const ms = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="countdown">
      <div className="countdown-label">{label}</div>
      <div className="countdown-digits">
        {d > 0 && <span>{d}<em>d</em></span>}
        <span>{pad(h)}<em>h</em></span>
        <span>{pad(m)}<em>m</em></span>
        <span>{pad(s)}<em>s</em></span>
      </div>
    </div>
  );
}
