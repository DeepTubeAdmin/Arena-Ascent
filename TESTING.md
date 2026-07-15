# TESTING.md — how to prove Arena Ascent works before real money touches it

Work through these layers in order. Each layer catches a different class of
problem, and each is cheap compared to the one after it failing in public.

## Layer 1 — Contract tests (automated, free, minutes)

```bash
cd contracts
forge test -vv
```

What it proves: the money logic. Entry, double-entry rejection, state-machine
order, oracle-only settlement, the exact 85/15 split for both USDC and ETH
(including odd amounts — dust goes to the fee, winner + fee always equals the
pool), full refunds on void, and that a malicious winner contract can't
re-enter the payout. **All tests must pass. Zero exceptions.**

## Layer 2 — Game determinism tests (automated, free, minutes)

```bash
cd backend && npm install
npx vitest run ../games/2026-08-target-rush
```

What it proves: the same seed and input log always produce the same score —
the property both fair scoring and replay review depend on. The first run
prints a fixture score; pin it (env var `TARGET_RUSH_PINNED`) so future edits
that change scoring get caught.

## Layer 3 — Full pipeline dry run on Arbitrum Sepolia (fake money, an evening)

1. Deploy the contract to Sepolia (`README.md`), point backend + frontend at it.
2. Create a round with a tiny entry fee in test ETH; register the **stub** game
   or Target Rush.
3. Use TWO browser profiles with two funded test wallets. Both enter.
4. Walk the whole lifecycle from the operator console: close registration →
   LIVE → both wallets play their one attempt → close window.
5. In the console: load leaderboard, **replay the winning run**, approve
   (two-step), confirm the tx on Sepolia Arbiscan.
6. Winning wallet claims; check on Arbiscan that it received exactly 85% of the
   pool. Withdraw fees; check you received exactly 15%.
7. Run a second round and **void it** mid-window; confirm both wallets refund
   in full.

What it proves: every integration seam — auth, chain watcher, one-attempt
enforcement, input streaming, authoritative scoring, replay, settlement, claims.

## Layer 4 — Human playtest (friends, still Sepolia, a weekend)

Get 3–5 people on real devices (include a phone). You're testing what
automation can't see: Is the start gate fair? Does streaming survive a flaky
connection? Does the countdown feel right? Is anything confusing at the moment
of entry? Fix, repeat.

## Layer 5 — Dress rehearsal on Arbitrum One (real money, tiny stakes)

Same as Layer 3 but on mainnet with a $1 entry fee and invited players only.
This catches mainnet-only differences (real USDC contract, gas behavior, RPC
rate limits) with almost nothing at risk. Verify the 85/15 math on Arbiscan
with real value one final time.

## Layer 6 — Before public launch (professional, costs money)

- **Smart-contract audit.** Automated tests prove the code does what you
  intended; an audit hunts for what you didn't think of. Required.
- **Legal review** of paid-entry skill contests in your target jurisdictions.
- Move the oracle to a **Safe multisig** and rehearse settlement through it.

## Quick reference — what each failure looks like

| Symptom | First place to look |
|---|---|
| Entrant missing from lobby | Backend chain watcher / RPC URL |
| "attempt already used" on first play | sessions table — was a row created earlier? |
| Replay score ≠ leaderboard score | Determinism break — sim changed after play |
| Approve button locked | You haven't loaded the #1 run's replay yet (by design) |
| Winner claim reverts | Round not Settled on-chain, or wrong wallet |
