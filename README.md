# Arena Ascent

One game. One shot. One winner. A monthly winner-takes-all skill tournament on
Arbitrum: players enter with USDC or ETH, play one never-before-seen game for
one attempt inside a single live window, and the highest verified score takes
the prize pool minus a 15% hosting fee.

**Live domain:** arenaascent.com

## How trust works (read this first)

- **Server-authoritative scoring.** The browser streams the player's raw input
  log; the backend re-simulates the run and computes the only score that counts.
- **Determinism is the contract.** Every game module reproduces the exact run
  and score from `(seed, inputLog)`. See `ADDING_A_MONTHLY_GAME.md`.
- **Mandatory human replay review.** The operator replays the winning run in
  the console (with automation red-flag hints) before anything touches the chain.
- **On-chain settlement.** Only after approval does the oracle submit the
  winner. The winner pulls 85% of the pool; the operator's 15% fee accrues for
  withdrawal. Voided rounds refund entry fees in full.

## Repo layout

```
contracts/   ArenaAscent.sol + Foundry tests + deploy script
backend/     Fastify + Postgres + Redis: SIWE auth, chain sync, sessions,
             scoring, settlement
frontend/    React + wagmi: entry, lobby, game shell, results, operator console
shared/      Cross-cutting types + seeded PRNG (the determinism seam)
games/       One folder per month. 2026-08-target-rush is the first game.
```

## Prerequisites

- Node 20+, npm
- [Foundry](https://getfoundry.sh) (`curl -L https://foundry.sh | bash && foundryup`)
- Postgres 15+ and Redis running locally (or Railway URLs)
- A wallet (MetaMask) with Arbitrum Sepolia test ETH — faucet via Alchemy

## Local development

```bash
# 1. Contracts — run the test suite first
cd contracts
forge test -vv

# 2. Backend
cd ../backend
npm install
cp .env.example .env      # fill in DATABASE_URL, REDIS_URL, JWT_SECRET, RPC_URL,
                          # CONTRACT_ADDRESS (after deploy), ADMIN_ADDRESSES
psql $DATABASE_URL -f schema.sql
npm run dev               # http://localhost:8787

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env      # VITE_API_URL, VITE_CONTRACT_ADDRESS, VITE_USDC_ADDRESS
npm run dev               # http://localhost:5173

# 4. Game determinism tests
cd ../backend && npx vitest run ../games/2026-08-target-rush
```

## Deploy to Arbitrum Sepolia

```bash
cd contracts
cp .env.example .env      # PRIVATE_KEY, ORACLE_ADDRESS, ARBITRUM_SEPOLIA_RPC, ARBISCAN_API_KEY
source .env
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast --verify
```

Put the deployed address into `backend/.env` (`CONTRACT_ADDRESS`) and
`frontend/.env` (`VITE_CONTRACT_ADDRESS`).

USDC addresses (env, never hardcoded): Arbitrum Sepolia test USDC and Arbitrum
One **native** USDC (not bridged USDC.e) — get the current canonical addresses
from Circle's developer docs.

## Running a monthly round (operator playbook)

1. **Create the round on-chain** — call `createRound(asset, entryFee, deadline, 0)`
   from your owner wallet (0 = default 1500 bps / 15% fee).
2. **Register metadata** — Operator console → round id, game id, window times.
3. **Registration** — players enter; the backend chain-watcher mirrors entrants.
4. **Close registration** (console button → on-chain tx) before the window.
5. **Go LIVE** at the window start; players each get one attempt.
6. **Close window** at the end → SETTLING.
7. **Review** — load leaderboard, check abuse flags, **replay the #1 run**
   (the approve button stays locked until you do).
8. **Approve** → two-step confirm → oracle submits winner on-chain.
9. Winner claims 85% from the site; withdraw your 15% fee from the console.
10. If anything breaks: **Void round** — every entrant refunds in full.

## Adding next month's game

See `ADDING_A_MONTHLY_GAME.md`. Short version: implement the deterministic sim
(`simulate(seed, inputLog)` → exact score), a `Game.tsx` for players, a
`module.ts` for the backend registry, a `ReplayView.tsx` for the console, and
pass the determinism test harness.

## Before real money (non-negotiable)

- **Professional smart-contract audit** of `ArenaAscent.sol`.
- **Legal review** — paid-entry skill contests sit close to gambling law;
  jurisdiction analysis and terms of service are required.
- **Oracle key → Safe multisig** (`setOracle`), never a hot key in production.
- Full dress rehearsal on Arbitrum Sepolia, then a tiny-stakes round on
  Arbitrum One. See `TESTING.md`.
