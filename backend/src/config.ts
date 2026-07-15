import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: req("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: req("JWT_SECRET"),
  chain: (process.env.CHAIN ?? "arbitrumSepolia") as "arbitrum" | "arbitrumSepolia",
  rpcUrl: req("RPC_URL"),
  contractAddress: req("CONTRACT_ADDRESS") as `0x${string}`,
  oraclePrivateKey: process.env.ORACLE_PRIVATE_KEY as `0x${string}` | undefined,
  adminAddresses: (process.env.ADMIN_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
};
