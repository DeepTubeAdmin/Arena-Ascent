// Transaction helpers shared by every component that sends transactions.
//
// getFeeOverrides — #4: submit transactions with a healthy max-fee buffer
//   (3x the current base fee) so MetaMask's estimate can't land under a
//   rising base fee. On Arbitrum only the actual base fee is charged, so
//   the buffer costs users nothing — it just prevents the classic
//   "max fee per gas less than block base fee" rejection.
//
// friendlyTxError — #1: translate raw wallet/RPC errors into plain language
//   at the moment of failure, with a concrete fix the user can follow.

interface MinimalPublicClient {
  getBlock(): Promise<{ baseFeePerGas?: bigint | null }>;
}

export async function getFeeOverrides(
  client: MinimalPublicClient | undefined
): Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
  try {
    if (!client) return {};
    const block = await client.getBlock();
    const base = block.baseFeePerGas;
    if (!base || base <= 0n) return {};
    return {
      maxFeePerGas: base * 3n, // generous headroom; only base fee is charged
      maxPriorityFeePerGas: 0n, // Arbitrum's sequencer doesn't use tips
    };
  } catch {
    // If the lookup fails, fall back to wallet defaults rather than block the tx.
    return {};
  }
}

const GAS_ERROR_PATTERNS = [
  "max fee per gas less than block base fee",
  "maxfeepergas",
  "fee cap",
  "underpriced",
  "base fee",
  "basefee",
];

const REJECTED_PATTERNS = ["user rejected", "user denied", "rejected the request"];

export function friendlyTxError(e: any): string {
  const raw = String(e?.shortMessage ?? e?.message ?? e ?? "Transaction failed");
  const haystack = (raw + " " + String(e?.details ?? "")).toLowerCase();

  if (REJECTED_PATTERNS.some((p) => haystack.includes(p))) {
    return "Transaction cancelled in your wallet. No worries — nothing was sent.";
  }

  if (GAS_ERROR_PATTERNS.some((p) => haystack.includes(p))) {
    return (
      "Network fees shifted while your transaction was being prepared — a normal " +
      "blockchain timing quirk, and nothing was charged. Just try again (it usually " +
      "works on the second attempt). If it keeps happening, open the fee settings in " +
      "the MetaMask confirmation window and choose the 'Aggressive' or 'High' speed " +
      "option, then confirm."
    );
  }

  return raw;
}
