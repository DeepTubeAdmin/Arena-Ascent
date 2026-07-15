// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ArenaAscent.sol";

/// Env-driven deploy for Arbitrum One / Arbitrum Sepolia.
/// Required env: PRIVATE_KEY, ORACLE_ADDRESS
/// Usage:
///   forge script script/Deploy.s.sol --rpc-url $ARBITRUM_SEPOLIA_RPC --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        vm.startBroadcast(pk);
        ArenaAscent arena = new ArenaAscent(oracle);
        vm.stopBroadcast();
        console2.log("ArenaAscent deployed:", address(arena));
        console2.log("Oracle:", oracle);
    }
}
