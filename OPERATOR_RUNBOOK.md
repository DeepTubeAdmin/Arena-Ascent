# Arena Ascent — Operator Runbook

Everything you need to run a tournament round, handle anything that goes wrong,
talk to the contract directly on Arbiscan, and understand what every number
means.

Written for the Arbitrum Sepolia **test** setup. On Arbitrum One (real money)
the addresses change but the flow is identical.

---

## Your key facts

| Thing | Value |
|---|---|
| Contract address | `0xBE1E0Dc13Be1CEb1808073a87DEA4D995aFeD4E6` |
| Your owner/operator wallet | `0x52E552063aC1aE24E0f55B87BB89502bd6eaAE1B` |
| Network | Arbitrum Sepolia (chain id `421614`) |
| Test USDC token | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| ETH "asset" value | `0x0000000000000000000000000000000000000000` (all zeros) |
| Backend | `http://localhost:8787` |
| Frontend | `http://localhost:5173` |

Explorer: `https://sepolia.arbiscan.io/address/0xBE1E0Dc13Be1CEb1808073a87DEA4D995aFeD4E6`

---

## The round lifecycle and state machine

Each round is a **separate, permanent** record with its own id (1, 2, 3, ...) and
its own state. A round never "resets" — when one settles, you create a NEW round
for the next event. States move in a strict order; the contract rejects
out-of-order actions on purpose.

| State # | Name | Meaning | Legal actions from here |
|---|---|---|---|
| `0` | Registration Open | Players can enter | Close registration - **Void** |
| `1` | Registration Closed | Entrant list + pool locked | Go live - **Void** |
| `2` | Live | Play window; one attempt each | Close window - **Void** |
| `3` | Settling | Window shut; review + pick winner | Submit winner - **Void** |
| `4` | Settled | Winner set; prize claimable | (winner claims, you withdraw fees) — FINAL |
| `5` | Voided | Round cancelled | Entrants refund in full — FINAL |

Two states are terminal: **Settled (4)** and **Voided (5)**. You cannot void a
Settled round, and you cannot un-void. Everything before Settled can be voided.

The on-screen countdown is **informational only** — it starts and stops nothing.
You drive every state change by hand.

---

## PART A — The normal ("happy path") round

### A1. Start the system
See `RESTART_GUIDE.md`: Postgres up, Redis up, backend running, frontend
running, MetaMask on Arbitrum Sepolia with your owner wallet.

### A2. Create the round on-chain (Arbiscan)
1. `<contract>#writeContract` -> **Connect to Web3** -> MetaMask, owner wallet.
2. Expand **`createRound`**, fill the four inputs (see "createRound inputs").
3. **Write** -> confirm. The new round gets the next id automatically.
4. Confirm the id: read **`nextRoundId`** on `#readContract` — if it now says
   `3`, the round you just made is `2`.

**createRound inputs, decoded:**

| Field | ETH round value | Meaning |
|---|---|---|
| `asset` | `0x0000000000000000000000000000000000000000` | All-zeros = ETH round. For a USDC round, use the USDC token address. |
| `entryFee` | `1000000000000000` | Smallest unit. ETH = wei (18 decimals): `1000000000000000` = 0.001 ETH. USDC (6 decimals): `1000000` = 1 USDC. |
| `registrationDeadline` | `9999999999` | Unix timestamp; informational here. Far-future is fine. |
| `platformFeeBps` | `0` | `0` = use 15% default. Else basis points: `1500` = 15%. Max `3000`. |

### A3. Register metadata in the console
Site -> **Operator** -> "Register round metadata": round id, game (Target Rush),
live start, live end -> **Register round metadata**. Then check the **Arena** page
shows the round (wait ~10s + refresh if needed).

### A4. Registration window
Entrants use the Arena **Enter** button (an on-chain tx that adds their fee to
the pool). The backend chain-watcher mirrors entries automatically.

### A5. Close registration
Operator -> **Close registration** -> confirm. State `0 -> 1`.

### A6. Go live
Operator -> **Open window (LIVE)** -> confirm. State `1 -> 2`. The **Play my one
attempt** button now appears for entrants.

### A7. Players play
One attempt each, no replays. Input streams to the backend for authoritative
scoring.

### A8. Close the window
Operator -> **Close window (SETTLING)** -> confirm. State `2 -> 3`.

### A9. Review and settle
1. **Load final leaderboard**.
2. Check abuse flags (shared-IP hints).
3. **Review the #1 run's replay** — approve stays locked until you do. Watch for
   automation red flags.
4. **Approve** -> two-step confirm -> oracle submits winner on-chain. State
   `3 -> 4`.

### A10. Withdraw fees and winner claims (any order)
As of the settlement-fee contract update, your 15% fee accrues the moment the
winner is submitted on-chain (A9) — you can withdraw it immediately, whether or
not the winner has claimed yet.
- You: Operator -> **Withdraw ETH fees** -> your address -> confirm (any time
  after settlement).
- Winner: Arena page -> **Claim my prize (85% of pool)** (any time after
  settlement).

### A11. Next month
Create a NEW round (back to A2). The old round stays Settled forever; its results
remain on-chain and in your database.

---

## PART B — Voiding a round (when something goes wrong)

Voiding cancels a round and lets every entrant reclaim their **full** entry fee.
No platform fee is taken on a void. Use it whenever a round shouldn't or can't be
settled fairly.

### When to void
- The game broke, lagged, or behaved inconsistently during the window.
- Scores are unreliable or the leaderboard looks wrong.
- A determinism mismatch: a replay doesn't reproduce the leaderboard score.
- Strong evidence the top run is automated/cheated and you can't fairly pick a
  winner.
- Too few entrants, a technical failure, or any reason the round is invalid.
- Anything where refunding everyone is the right, safe outcome.

### You can void from states 0, 1, 2, or 3 — NOT from 4 (Settled)
Once a winner is submitted (Settled), the prize path is committed and void is
blocked. So if you're going to void, decide **before** you approve a winner.

### How to void
1. Confirm the round's current state first: `#readContract` -> **`rounds`** ->
   your round id -> read `state` (must be 0-3).
2. Operator console -> **Void round** -> confirm the browser warning -> confirm in
   MetaMask. State `-> 5`.
   - Or directly on Arbiscan: `#writeContract` -> **`voidRound`** -> enter round
     id -> Write.
3. The round is now Voided. Tell your entrants they can refund.

### How refunds work after a void
Refunds are **pull-based**: the contract doesn't push money out; each entrant
withdraws their own fee. This is a deliberate safety pattern.

- **Each entrant** goes to the Arena page for that round and clicks
  **Reclaim my entry fee** -> confirms in MetaMask. They get their FULL entry fee
  back.
- Or any entrant can refund directly on Arbiscan: `#writeContract` ->
  **`refund`** -> enter the round id -> Write (from their own wallet).
- Each entrant can refund **once**. A second attempt reverts ("refunded").
- Only actual entrants can refund; non-entrants revert ("not entrant").

### Testing the void/refund path solo
Since you're often both operator and entrant in testing:
1. Create a round, enter it with your wallet (state 0 -> you're an entrant).
2. **Void round** (state -> 5).
3. Arena page -> **Reclaim my entry fee** -> confirm. Your wallet gets the full
   fee back.
4. Verify on Arbiscan: read **`rounds`** -> the round shows state `5`; your wallet
   balance went back up by the entry fee.

### After everyone has refunded
There's nothing else to do — a voided round is finished. Move on and create a new
round for a fresh attempt. The contract holds no leftover funds for that round
once all entrants have refunded (verify with `feesAccrued` = 0 for the asset and
the round's entrants all refunded).

---

## PART C — Every scenario, and what to do

| Situation | State | What to do |
|---|---|---|
| Normal round, clean winner | 3 -> 4 | Review replay -> approve -> winner claims -> you withdraw fees (Part A9-A10). |
| Game broke mid-window | 2 | **Void** (Part B). Everyone refunds. |
| Bad/unreliable scores after close | 3 | **Void** before approving. Everyone refunds. |
| Replay != leaderboard score | 3 | Do NOT approve. **Void** and investigate the determinism break. |
| Suspected automation on #1 run | 3 | Judgment call: if you can't fairly settle, **void**. Otherwise document why you approved. |
| Nobody entered / too few | 0-1 | **Void** (or just leave it and create a fresh round later). |
| Wrong entry fee or settings at creation | 0 | **Void** the misconfigured round, create a new one with correct values. |
| You already approved but realize there's a problem | 4 | Void is blocked. The winner can still claim. This is why careful review before approving matters — there's no undo after Settled. |
| Round stuck, MetaMask misbehaving | any | See troubleshooting; usually a nonce/gas issue, not a contract problem. |
| Want to change the platform fee for one round | 0 (at creation) | Set `platformFeeBps` in `createRound` (e.g. `1000` for 10%). Can't change after creation. |

---

## Reading the contract on Arbiscan

- **`#readContract`** — look things up, free, no wallet needed.
- **`#writeContract`** — send transactions, wallet + gas required.

### Useful READ functions
- **`owner`** — should be your wallet. Owner-only actions fail from other accounts.
- **`oracle`** — settlement signer (backend key on testnet; Safe multisig in prod).
- **`rounds`** -> round id -> all fields incl. the `state` number, `asset`,
  `entryFee`, `prizePool`, `entrantCount`, `winner`, `platformFeeBps`, and the
  claimed/fee-collected flags.
- **`nextRoundId`** — the id the next created round will get.
- **`hasEntered`** -> round id + address -> is that wallet entered.
- **`feesAccrued`** -> asset address (`0x0000...0000` for ETH) -> withdrawable fee.

### Decoding the numbers
- **ETH / wei** (18 decimals): `1000000000000000` = 0.001 ETH; `1000000000000000000` = 1 ETH.
- **USDC** (6 decimals): `1000000` = 1 USDC; `25000000` = 25 USDC.
- **platformFeeBps** (basis points): `1500` = 15%; `1000` = 10%; `10000` = 100%.
- **85/15 split**: winner = `pool x (10000 - bps) / 10000`; the remainder is your
  fee. Integer-division dust goes to the fee, so winner + fee = pool exactly.

---

## Troubleshooting

### "max fee per gas less than block base fee"
Benign gas-timing wobble. Retry the action (base fee drifts every second). If it
persists, in the MetaMask popup pick **Aggressive** gas, or set max fee above the
base fee (e.g. `50000000` wei). Fractions of a cent in test ETH.

### MetaMask shows an ABSURD fee (thousands of ETH)
**The transaction would REVERT — reject it, never fund it.** Causes:
- **Wrong state** — the action is illegal from the round's current state (read
  `state` and check the legal-actions table).
- **Withdraw before winner claimed** — nothing accrued yet; claim first.
- **Wrong account** — MetaMask isn't on the owner/oracle account for an
  owner/oracle-only action. Switch to `0x52E5...AE1B`.
- **Voiding/refunding wrong** — e.g. `refund` before the round is Voided, or a
  non-entrant calling `refund`, or a second refund.
- **Malformed input** — a typo in a long number or an address.

### Transaction "failed" with a non-`0x` id, or every estimate looks wrong
Likely MetaMask **nonce desync**. Fix (safe, doesn't touch funds): MetaMask ->
**Settings -> Advanced -> Clear activity tab data** -> confirm -> retry.

### Owner-only action fails though state + account look right
Confirm you're on **Arbitrum Sepolia**. Try the call directly on Arbiscan
`#writeContract` to isolate website vs. wallet. Disconnect/reconnect the wallet
on the Arbiscan page if the connection is stale.

### Site shows "no round" after registering
Wait ~10s and refresh. If still empty, the backend couldn't read the round —
check the backend terminal for errors and confirm the Alchemy RPC URL in
`backend/.env`.

### Game doesn't start when countdown hits zero
Working as designed. Move the round to **Live** (state 2) via **Open window
(LIVE)**. The Play button only shows when the contract says Live.

### "already entered" / can't play twice
Working as designed — one entry, one attempt per wallet. Use multiple wallets to
test multiple players.

### Refund button does nothing / reverts
- The round must be **Voided** (state 5) for refunds to work. Check `state`.
- The wallet must be an actual entrant, and must not have already refunded.

---

## Before real money (NOT UI work — do not skip)

1. **Professional smart-contract audit.** Passing tests != audited.
2. **Legal review** of paid-entry skill contests in your jurisdiction — may
   determine whether/where you can operate at all.
3. **Move the oracle to a Safe multisig** (`setOracle`); never a hot key in prod.
4. **Dependency security review** of the backend/frontend before public launch
   (carefully, not `npm audit fix --force`).
5. Full Sepolia dress rehearsal, then a tiny-stakes real round on Arbitrum One,
   verifying the 85/15 math on Arbiscan with real value.
