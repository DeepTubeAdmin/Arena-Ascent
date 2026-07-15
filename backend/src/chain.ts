// viem clients + on-chain sync. The chain is the source of truth for entries:
// we watch Entered events and mirror them into Postgres. Client claims of
// entry are never trusted.
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { config } from "./config.js";
import { q } from "./db.js";

export const arenaAbi = parseAbi([
  "event RoundCreated(uint256 indexed roundId, address asset, uint96 entryFee, uint64 registrationDeadline, uint16 platformFeeBps)",
  "event Entered(uint256 indexed roundId, address indexed player, uint96 fee, uint128 newPool)",
  "event StateChanged(uint256 indexed roundId, uint8 from, uint8 to)",
  "event WinnerSubmitted(uint256 indexed roundId, address indexed winner)",
  "function rounds(uint256) view returns (address asset, uint96 entryFee, uint128 prizePool, uint32 entrantCount, uint8 state, address winner, uint64 registrationDeadline, uint16 platformFeeBps, bool prizeClaimed, bool feeCollected)",
  "function hasEntered(uint256 roundId, address player) view returns (bool)",
  "function submitWinner(uint256 roundId, address winner)",
]);

const chain = config.chain === "arbitrum" ? arbitrum : arbitrumSepolia;

export const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });

export const oracleAccount = config.oraclePrivateKey
  ? privateKeyToAccount(config.oraclePrivateKey)
  : undefined;

export const oracleWallet = oracleAccount
  ? createWalletClient({ account: oracleAccount, chain, transport: http(config.rpcUrl) })
  : undefined;

export async function readRound(roundId: bigint) {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: arenaAbi,
    functionName: "rounds",
    args: [roundId],
  });
}

export async function hasEnteredOnChain(roundId: bigint, player: `0x${string}`) {
  return publicClient.readContract({
    address: config.contractAddress,
    abi: arenaAbi,
    functionName: "hasEntered",
    args: [roundId, player],
  });
}

/** Watch Entered events and mirror the authoritative entrant list into Postgres. */
export function startEntrantWatcher() {
  return publicClient.watchContractEvent({
    address: config.contractAddress,
    abi: arenaAbi,
    eventName: "Entered",
    onLogs: async (logs) => {
      for (const log of logs) {
        const roundId = log.args.roundId!.toString();
        const address = getAddress(log.args.player!).toLowerCase();
        await q(
          `INSERT INTO entrants (round_id, address, tx_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (round_id, address) DO NOTHING`,
          [roundId, address, log.transactionHash]
        );
      }
    },
  });
}
