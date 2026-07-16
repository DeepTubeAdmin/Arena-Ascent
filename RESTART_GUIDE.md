# Arena Ascent — Restart Guide

How to bring the whole local system back up after you reboot your PC, close a
terminal, or come back the next day. On WSL, the database services do NOT
auto-start and your server terminals don't survive a reboot — so this is a
normal, expected routine, not a sign anything broke.

You'll open **two Ubuntu terminals** and leave both running: one for the
backend, one for the frontend.

---

## The 30-second version

```
# Terminal 1 — services + backend
sudo service postgresql start
sudo service redis-server start
cd ~/arena-ascent/backend
npm run dev        # leave running — wait for "Arena Ascent backend on :8787"

# Terminal 2 — frontend
cd ~/arena-ascent/frontend
npm run dev        # leave running — opens on http://localhost:5173
```

Then open MetaMask, make sure it's on **Arbitrum Sepolia** and your wallet
`0x52E552063aC1aE24E0f55B87BB89502bd6eaAE1B`, and go to
`http://localhost:5173`.

---

## The explained version

### Step 1 — Open Ubuntu
Windows Start → type `Ubuntu` → Enter. You get a terminal at a
`seth@...:~$` prompt.

### Step 2 — Start the database services
These don't auto-start on WSL, so start them by hand every session:

```
sudo service postgresql start
```
```
sudo service redis-server start
```

(It asks for your Linux `sudo` password — the one you set when installing
Ubuntu. Typing is invisible; that's normal.)

Confirm both are alive:
```
redis-cli ping
```
Should print `PONG`.
```
sudo service postgresql status
```
Should say active/online.

### Step 3 — Start the backend
```
cd ~/arena-ascent/backend
```
```
npm run dev
```
Wait for: `Arena Ascent backend on :8787 (arbitrumSepolia)`.
**Leave this terminal open and running.** Closing it stops the backend.

### Step 4 — Start the frontend (second terminal)
Open a NEW Ubuntu window (Start → `Ubuntu`), then:
```
cd ~/arena-ascent/frontend
```
```
npm run dev
```
Wait for the `Local: http://localhost:5173/` line.
**Leave this one running too.**

### Step 5 — Open the site
Browser → `http://localhost:5173`. Check MetaMask is on Arbitrum Sepolia and
your wallet. Connect + sign in.

---

## Shutting down cleanly

There's no real "shutdown" needed — just close the two Ubuntu terminals (or
press **Ctrl+C** in each to stop the servers). The database services and your
on-chain contract are unaffected; you just start the servers again next time.

---

## Restart troubleshooting

### `EADDRINUSE: address already in use 0.0.0.0:8787`
An old backend is still running and holding the port. You only ever want ONE
backend at a time.
- Find the old backend terminal and press **Ctrl+C**, OR
- Run `npx kill-port 8787` to free it, then `npm run dev` again.

### Backend starts but errors connecting to the database
- Did you start Postgres this session? Re-run `sudo service postgresql start`.
- Password mismatch: the `DATABASE_URL` in `backend/.env` must match your
  Postgres password. Current known-good:
  `postgresql://postgres:arena123@localhost:5432/arena_ascent`
- Verify the connection directly:
  `psql "postgresql://postgres:arena123@localhost:5432/arena_ascent" -c "\dt"`
  Should list four tables (entrants, rounds, sessions, settlements).

### Backend errors connecting to Redis
- Re-run `sudo service redis-server start`, then `redis-cli ping` (expect `PONG`).

### `npm run dev` hangs on a `?` prompt
npm is waiting on a question. Press **Enter** to accept the default. To avoid it
entirely, run `CI=true npm install --no-fund --no-audit` when installing.

### Site loads but shows "no round" or won't sign in
- "No round" with no active round is correct — nothing to show.
- Can't sign in / database errors on sign-in: the backend can't reach Postgres.
  See the database troubleshooting above.
- Confirm the backend is actually running (Terminal 1 shows the `:8787` line)
  and the frontend `.env` points at `http://localhost:8787`.

### After a Windows reboot, "nothing works"
Expected. WSL stopped the services and closed the terminals. Just run this whole
guide again from Step 1. Nothing is broken; nothing on-chain is lost.

---

## What survives a reboot vs. what doesn't

| Survives | Does NOT survive (restart it) |
|---|---|
| Your deployed contract (it's on-chain) | Postgres service (`sudo service postgresql start`) |
| Your wallet + test ETH | Redis service (`sudo service redis-server start`) |
| Your code + `.env` files | Backend server (`npm run dev`) |
| Your database DATA (rounds, scores) | Frontend server (`npm run dev`) |
| Anything on Arbiscan | Your two terminal windows |
