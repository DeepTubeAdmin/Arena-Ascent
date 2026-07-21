// Live ETH/USD price for displaying dollar context next to ETH amounts.
// Module-level cache: one fetch shared by every component, refreshed every
// 60s. Two independent public sources; if both fail, price is null and the
// UI simply omits the USD hint (never blocks anything on price data).

import { useEffect, useState } from "react";

let cachedPrice: number | null = null;
let lastFetch = 0;
let inflight: Promise<number | null> | null = null;
const TTL_MS = 60_000;

async function fetchPrice(): Promise<number | null> {
  // Primary: Coinbase spot
  try {
    const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
    if (r.ok) {
      const j = await r.json();
      const p = Number(j?.data?.amount);
      if (Number.isFinite(p) && p > 0) return p;
    }
  } catch { /* fall through */ }
  // Fallback: CoinGecko
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
    if (r.ok) {
      const j = await r.json();
      const p = Number(j?.ethereum?.usd);
      if (Number.isFinite(p) && p > 0) return p;
    }
  } catch { /* both failed */ }
  return null;
}

async function getPrice(): Promise<number | null> {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetch < TTL_MS) return cachedPrice;
  if (!inflight) {
    inflight = fetchPrice().then((p) => {
      if (p !== null) { cachedPrice = p; lastFetch = Date.now(); }
      inflight = null;
      return cachedPrice;
    });
  }
  return inflight;
}

/** Current ETH/USD price, or null while loading / if sources are down. */
export function useEthUsdPrice(): number | null {
  const [price, setPrice] = useState<number | null>(cachedPrice);
  useEffect(() => {
    let alive = true;
    getPrice().then((p) => { if (alive) setPrice(p); });
    const t = setInterval(() => getPrice().then((p) => { if (alive) setPrice(p); }), TTL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return price;
}

/** "(≈ $12.34)" for an ETH amount, or "" when price unavailable.
    Only meaningful for ETH — pass through "" for other assets. */
export function usdHint(ethAmount: string | number, price: number | null): string {
  if (price === null) return "";
  const eth = Number(ethAmount);
  if (!Number.isFinite(eth)) return "";
  const v = eth * price;
  if (v === 0) return "(≈ $0.00)";
  if (v < 0.01) return "(≈ <$0.01)";
  return `(≈ $${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
}
