const API = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

let jwt: string | null = localStorage.getItem("aa_jwt");

export function setJwt(token: string) {
  jwt = token;
  localStorage.setItem("aa_jwt", token);
}

async function call(path: string, opts: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export const api = {
  nonce: () => call("/auth/nonce"),
  verify: (message: string, signature: string) =>
    call("/auth/verify", { method: "POST", body: JSON.stringify({ message, signature }) }),
  currentRound: () => call("/rounds/current"),
  champions: () => call("/champions"),
  me: (roundId: string) => call(`/rounds/${roundId}/me`),
  results: (roundId: string) => call(`/rounds/${roundId}/results`),
  playStart: (roundId: string) =>
    call("/play/start", { method: "POST", body: JSON.stringify({ roundId }) }),
  playInput: (playToken: string, events: unknown[]) =>
    call("/play/input", { method: "POST", body: JSON.stringify({ playToken, events }) }),
  playComplete: (playToken: string, finalEvents: unknown[]) =>
    call("/play/complete", { method: "POST", body: JSON.stringify({ playToken, finalEvents }) }),
  // admin
  adminRegisterRound: (b: object) =>
    call("/admin/rounds", { method: "POST", body: JSON.stringify(b) }),
  adminSetState: (id: string, state: number) =>
    call(`/admin/rounds/${id}/state`, { method: "POST", body: JSON.stringify({ state }) }),
  adminLeaderboard: (id: string) => call(`/admin/rounds/${id}/leaderboard`),
  adminReplay: (id: string, address: string) => call(`/admin/rounds/${id}/replay/${address}`),
  adminFlags: (id: string) => call(`/admin/rounds/${id}/flags`),
  adminDisqualify: (id: string, address: string, reason?: string, undo?: boolean) =>
    call(`/admin/rounds/${id}/disqualify`, {
      method: "POST",
      body: JSON.stringify({ address, reason, undo }),
    }),
  adminApprove: (id: string) =>
    call(`/admin/rounds/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ confirm: `SETTLE ROUND ${id}` }),
    }),
};
