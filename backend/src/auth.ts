// Sign-In With Ethereum (EIP-4361) via viem's siwe utilities, then a JWT.
import { createSiweMessage, parseSiweMessage, verifySiweMessage } from "viem/siwe";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { publicClient } from "./chain.js";
import { redis } from "./redis.js";
import { config } from "./config.js";

export async function issueNonce(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  await redis.set(`siwe:nonce:${nonce}`, "1", "EX", 300); // 5 min validity
  return nonce;
}

export async function verifySiwe(message: string, signature: `0x${string}`) {
  const parsed = parseSiweMessage(message);
  if (!parsed.nonce || !parsed.address) throw new Error("bad SIWE message");
  const used = await redis.getdel(`siwe:nonce:${parsed.nonce}`);
  if (!used) throw new Error("nonce invalid or reused");

  const ok = await verifySiweMessage(publicClient, { message, signature });
  if (!ok) throw new Error("signature invalid");

  const address = parsed.address.toLowerCase();
  const token = jwt.sign({ sub: address }, config.jwtSecret, { expiresIn: "7d" });
  return { address, token };
}

export function requireAuth(authHeader?: string): string {
  if (!authHeader?.startsWith("Bearer ")) throw new Error("unauthorized");
  const payload = jwt.verify(authHeader.slice(7), config.jwtSecret) as { sub: string };
  return payload.sub.toLowerCase();
}

export function requireAdmin(authHeader?: string): string {
  const address = requireAuth(authHeader);
  if (!config.adminAddresses.includes(address)) throw new Error("forbidden");
  return address;
}
