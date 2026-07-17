import { http, createConfig } from "wagmi";
import { arbitrum, arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { parseAbi } from "viem";

export const activeChain =
  import.meta.env.VITE_CHAIN === "arbitrum" ? arbitrum : arbitrumSepolia;

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
});

export const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`;
export const USDC = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`;

export const arenaAbi = parseAbi([
  "function enter(uint256 roundId) payable",
  "function claimPrize(uint256 roundId)",
  "function refund(uint256 roundId)",
  "function hasEntered(uint256 roundId, address player) view returns (bool)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
