# Arena Ascent — Operator Runbook

Everything you need to run a tournament round from start to finish, plus how to
talk to the contract directly on Arbiscan, what every number means, and how to
fix the problems that actually come up.

Written for the Arbitrum Sepolia **test** setup. When you move to real money on
Arbitrum One, the addresses change but the flow is identical.

---

## Your key facts (fill these in / keep handy)

| Thing | Value |
|---|---|
| Contract address | `0xBE1E0Dc13Be1CEb1808073a87DEA4D995aFeD4E6` |
| Your owner/operator wallet | `0x52E552063aC1aE24E0f55B87BB89502bd6eaAE1B` |
| Network | Arbitrum Sepolia (chain id `421614`) |
| Test USDC token | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| ETH "asset" value | `0x0000000000000000000000000000000000000000` (all zeros) |
| Backend | `http://localhost:8787` |
| Frontend | `http://localhost:5173` |

Block explorer for everything below:
`https://sepolia.arbiscan.io/address/0xBE1E0Dc13Be1CEb1808073a87DEA4D995aFeD4E6`

---

## The round lifecycle (memorize this order)

A round moves through states in a **strict order**. The contract rejects any
action that's out of order — that's a safety feature, but it's also the #1
source of "why did my transaction fail." The state is just a number:

| State # | Name | What it means | What you can do |
|---|---|---|---|
| `0` | Registration Open | Players can enter | Close registration |
| `1` | Registration Closed | Entrant list + pool locked | Go live |
| `2` | Live | The play window; one attempt each | Close window |
| `3` | Settling | Window shut; review + pick winner | Submit winner |
| `4` | Settled | Winner set; prize claimable | (winner claims, you withdraw fees) |
| `5` | Voided | Round cancelled | Everyone refunds in full |

You (the owner) drive every transition by hand. The on-screen countdown is
**informational only** — it does NOT start or stop anything. Reaching zero does
nothing on its own; you flip the states.

---

## Running a round — full click-by-click

### 1. Start the system (if not already running)
See `RESTART_GUIDE.md`. You need: Postgres up, Redis up, backend running,
frontend running, and MetaMask on Arbitrum Sepolia with your owner wallet.

### 2. Create the round on-chain (Arbiscan)
The round is born on the contract. Easiest is Arbiscan's Write interface:

1. Go to `<contract>#writeContract`
2. Click **Connect to Web3**, approve in MetaMask, confirm you're on Arbitrum Sepolia.
3. Expand **`createRound`** and fill the four inputs (see "createRound inputs" below).
4. Click **Write**, confirm in MetaMask.
5. Note the round id — your first round is `1`, second is `2`, and so on.

**createRound inputs, decoded:**

| Field | For an ETH round | Meaning |
|---|---|---|
| `asset` | `0x0000000000000000000000000000000000000000` | All-zeros = ETH round. For USDC, use the USDC token address instead. |
| `entryFee` | `1000000000000000` | Fee in the smallest unit. This is **wei** for ETH: `1000000000000000` = 0.001 ETH (15 zeros). For USDC use 6 decimals: `1000000` = 1 USDC. |
| `registrationDeadline` | `9999999999` | A unix timestamp. Informational only in this contract — a far-future number is fine. |
| `platformFeeBps` | `0` | `0` means "use the 15% default." Otherwise basis points: `1500` = 15%, `1000` = 10%. Max allowed is `3000` (30%). |

### 3. Register the round in the console
The contract knows the round exists; the backend needs to know which **game**
it runs and when.

1. Site → **Operator** tab.
2. "Register round metadata" form: round id (`1`), game (**Target Rush**),
   live start (a few min out), live end (~30 min later).
3. Click **Register round metadata**.
4. Click back to **Arena** — you should now see the round with its countdown
   and the entry panel (entry fee, pool, 85% take, 15% fee). If not, wait ~10s
   and refresh; if still nothing, check the backend terminal for red errors.

### 4. Registration window
Players (or you, testing) enter via the Arena page's **Enter** button. Each
entry is an on-chain transaction that adds the fee to the pool. The backend's
chain-watcher mirrors entries automatically.

### 5. Close registration
Operator console → **Close registration** → confirm in MetaMask.
Moves state `0 → 1`. Locks the entrant list and pool.

### 6. Go live
Operator console → **Open window (LIVE)** → confirm.
Moves state `1 → 2`. The play window is open; the **Play my one attempt**
button now appears on the Arena page for entrants.

### 7. Players play
Each entrant clicks **Play my one attempt**, gets a GET READY gate, then plays.
**One attempt only** — no replays. Input streams to the backend, which computes
the authoritative score.

### 8. Close the window
When the play window is over: Operator console → **Close window (SETTLING)** →
confirm. Moves state `2 → 3`. No more scores accepted.

### 9. Review and settle (the mandatory part)
1. Operator console → **Load final leaderboard**.
2. Check the abuse flags (shared-IP hints among top finishers).
3. **Review the #1 run's replay** — the approve button stays locked until you
   do. Watch for the automation red flags (inhuman reaction consistency,
   pixel-perfect centering).
4. **Approve** → two-step confirm. This has the backend's oracle submit the
   winner on-chain. Moves state `3 → 4` (Settled).

### 10. Winner claims, then you withdraw fees (ORDER MATTERS)
- **The winner claims first**: Arena page → **Claim my prize (85% of pool)**.
  This pays the winner 85% AND sets aside your 15% fee inside the contract.
- **Then you withdraw fees**: Operator console → **Withdraw ETH fees** → enter
  your wallet address → confirm.

> Fees do NOT exist to withdraw until the winner has claimed. If you try to
> withdraw first, the contract reverts and MetaMask shows an absurd fee. Claim
> first, always.

### 11. If something broke: void instead
At any point before Settled, Operator console → **Void round** → confirm
(state → `5`). Every entrant can then reclaim their FULL entry fee from the
Arena page (no fee is taken on a void).

---

## Reading the contract directly on Arbiscan

Two tabs on your verified contract page:

- **`#readContract`** — look things up, costs nothing, no wallet needed.
- **`#writeContract`** — send transactions, needs wallet connected, costs gas.

### Most useful READ functions

- **`owner`** — the operator address. Should be your wallet. Owner-only actions
  fail from any other account.
- **`oracle`** — the settlement signer (your backend's key on testnet; a Safe
  multisig in production).
- **`rounds`** → enter a round id → returns every field of that round. Read the
  `state` number using the table above. Also shows `asset`, `entryFee`,
  `prizePool`, `entrantCount`, `winner`, `platformFeeBps`, and whether the prize
  was claimed / fee collected.
- **`hasEntered`** → round id + an address → true/false, is that wallet entered.
- **`feesAccrued`** → an asset address → how much fee is sitting ready to
  withdraw for that asset (`0x0000...0000` for ETH).

### Decoding the money numbers

Everything on-chain is in the smallest unit — no decimal points.

- **ETH / wei**: 18 decimals. `1000000000000000` = 0.001 ETH.
  Quick check: 0.001 ETH has 15 zeros after the 1.
  `1000000000000000000` (18 zeros) = 1 ETH.
- **USDC**: 6 decimals. `1000000` = 1 USDC. `25000000` = 25 USDC.
- **platformFeeBps**: basis points, 1 bp = 0.01%. `1500` = 15%. `10000` = 100%.
- **The 85/15 split**: winner gets `pool × (10000 − bps) / 10000`; the rest is
  your fee. With `bps = 1500`: winner 85%, you 15%.

---

## Troubleshooting (the problems that actually happened)

### "max fee per gas less than block base fee"
**Benign gas-timing wobble.** MetaMask bid a hair below the network's current
base fee. The transaction is fine; the bid was just stale.
- Fix: click the action again. Base fees drift every second; the retry usually
  clears.
- If it persists: in the MetaMask popup, open the gas/fee section, pick
  **Aggressive** (or edit max fee to something comfortably above the base fee,
  e.g. `50000000` wei). Costs a fraction of a cent in test ETH.

### MetaMask shows an ABSURD fee (thousands of ETH)
**This means the transaction would REVERT.** Do not fund it, do not confirm it —
reject it. The giant number is MetaMask failing to simulate a call the contract
is rejecting. Almost always one of:
- **Wrong state** — you're calling an action out of order (e.g. `setLive` while
  the round is still in state `0`). Read the round's `state` and confirm the
  action is legal from there.
- **Withdrawing fees before the winner claimed** — nothing has accrued yet.
  Have the winner claim first.
- **Wrong account** — MetaMask is on an account that isn't the owner/oracle for
  an owner/oracle-only action. Switch to `0x52E5...AE1B`.

### Transaction "failed" with a non-`0x` id, or weird estimates on everything
**Likely MetaMask nonce desync** (its local transaction count drifted out of
sync after a failed/stuck tx). Fix, and it's safe — does NOT touch funds:
- MetaMask → **Settings → Advanced → Clear activity tab data** → confirm.
- Then retry the action. Fee should look normal again.

### An owner-only action fails and state + account both look right
- Double-check you're on **Arbitrum Sepolia**, not Ethereum mainnet or another
  network.
- Try the same call directly from Arbiscan `#writeContract` to isolate whether
  it's the website or the wallet/network. `createRound` worked there, so most
  owner actions will too.

### Site shows "no round" after you registered it
- Wait ~10 seconds (the site polls) and refresh.
- If still empty, the backend probably couldn't read the round from the
  contract — check the backend terminal for red errors, and confirm your
  Alchemy RPC URL is correct in `backend/.env`.

### The game doesn't start when the countdown hits zero
**Working as designed.** The countdown is informational. You must move the round
to **Live** (state `2`) via **Open window (LIVE)**. The Play button only appears
once the contract says the round is Live.

### "already entered" / can't play twice
**Working as designed** — one entry and one attempt per wallet, enforced by the
backend. To test multiple players you need multiple wallets.

---

## Before real money (do NOT skip — none of these are UI work)

1. **Professional smart-contract audit.** Passing tests ≠ audited. Required.
2. **Legal review** of paid-entry skill contests in your jurisdiction. This can
   determine whether/where you can operate at all.
3. **Move the oracle to a Safe multisig** (`setOracle`) — never a hot key in a
   `.env` file for production.
4. Full dress rehearsal on Sepolia, then a tiny-stakes real round on Arbitrum
   One, verifying the 85/15 math on Arbiscan with real value.
