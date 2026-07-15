// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ArenaAscent.sol";

contract MockUSDC is IERC20 {
    string public name = "Mock USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(balanceOf[from] >= amount, "bal");
        require(allowance[from][msg.sender] >= amount, "allow");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// Malicious winner that tries to re-enter claimPrize from its ETH receive hook.
contract ReentrantWinner {
    ArenaAscent public arena;
    uint256 public roundId;
    bool public attacked;

    constructor(ArenaAscent _arena) {
        arena = _arena;
    }

    function enter(uint256 _roundId) external payable {
        roundId = _roundId;
        arena.enter{value: msg.value}(_roundId);
    }

    function claim() external {
        arena.claimPrize(roundId);
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Attempt re-entry; must revert inside, we swallow so outer succeeds.
            try arena.claimPrize(roundId) {
                revert("reentry succeeded");
            } catch {}
        }
    }
}

contract ArenaAscentTest is Test {
    ArenaAscent arena;
    MockUSDC usdc;

    address owner = address(this);
    address oracle = makeAddr("oracle");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint96 constant USDC_FEE = 25_000_000; // 25 USDC (6 decimals)
    uint96 constant ETH_FEE = 0.01 ether;

    function setUp() public {
        arena = new ArenaAscent(oracle);
        usdc = new MockUSDC();
        for (uint160 i = 0; i < 3; i++) {
            address p = [alice, bob, carol][i];
            usdc.mint(p, 1_000_000_000); // 1000 USDC
            vm.deal(p, 10 ether);
            vm.prank(p);
            usdc.approve(address(arena), type(uint256).max);
        }
    }

    // ------------------------------------------------------------ helpers
    function _createUsdcRound() internal returns (uint256 id) {
        id = arena.createRound(address(usdc), USDC_FEE, uint64(block.timestamp + 1 days), 0);
    }

    function _createEthRound() internal returns (uint256 id) {
        id = arena.createRound(address(0), ETH_FEE, uint64(block.timestamp + 1 days), 0);
    }

    function _enterUsdc(uint256 id, address p) internal {
        vm.prank(p);
        arena.enter(id);
    }

    function _enterEth(uint256 id, address p) internal {
        vm.prank(p);
        arena.enter{value: ETH_FEE}(id);
    }

    function _toSettling(uint256 id) internal {
        arena.closeRegistration(id);
        arena.setLive(id);
        arena.closeWindow(id);
    }

    // --------------------------------------------------------- happy paths
    function test_HappyPath_Usdc_85_15() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _enterUsdc(id, bob);
        _toSettling(id);

        vm.prank(oracle);
        arena.submitWinner(id, alice);

        uint256 pool = uint256(USDC_FEE) * 2; // 50 USDC
        uint256 expectedWinner = (pool * 8500) / 10000;
        uint256 expectedFee = pool - expectedWinner;

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        arena.claimPrize(id);
        assertEq(usdc.balanceOf(alice) - before, expectedWinner, "winner 85%");

        arena.withdrawFees(address(usdc), owner);
        assertEq(usdc.balanceOf(owner), expectedFee, "operator 15%");
        assertEq(expectedWinner + expectedFee, pool, "sums to pool");
        assertEq(usdc.balanceOf(address(arena)), 0, "nothing stuck");
    }

    function test_HappyPath_Eth_85_15() public {
        uint256 id = _createEthRound();
        _enterEth(id, alice);
        _enterEth(id, bob);
        _enterEth(id, carol);
        _toSettling(id);

        vm.prank(oracle);
        arena.submitWinner(id, bob);

        uint256 pool = uint256(ETH_FEE) * 3;
        uint256 expectedWinner = (pool * 8500) / 10000;
        uint256 expectedFee = pool - expectedWinner;

        uint256 before = bob.balance;
        vm.prank(bob);
        arena.claimPrize(id);
        assertEq(bob.balance - before, expectedWinner, "winner 85%");

        address feeSink = makeAddr("feeSink");
        arena.withdrawFees(address(0), feeSink);
        assertEq(feeSink.balance, expectedFee, "operator 15%");
        assertEq(address(arena).balance, 0, "nothing stuck");
    }

    /// Odd pool: dust from integer division must accrue to the fee, and
    /// winner + fee must equal the pool exactly.
    function test_FeeMath_OddPool_DustToOperator() public {
        uint96 oddFee = 333; // odd smallest-unit fee
        uint256 id = arena.createRound(address(usdc), oddFee, uint64(block.timestamp + 1 days), 0);
        _enterUsdc(id, alice);
        _enterUsdc(id, bob);
        _enterUsdc(id, carol);
        _toSettling(id);

        vm.prank(oracle);
        arena.submitWinner(id, carol);

        uint256 pool = uint256(oddFee) * 3; // 999
        uint256 winnerAmount = (pool * 8500) / 10000; // floor(849.15) = 849
        uint256 fee = pool - winnerAmount;            // 150 (dust to operator)

        uint256 before = usdc.balanceOf(carol);
        vm.prank(carol);
        arena.claimPrize(id);
        assertEq(usdc.balanceOf(carol) - before, winnerAmount);

        arena.withdrawFees(address(usdc), owner);
        assertEq(usdc.balanceOf(owner), fee);
        assertEq(winnerAmount + fee, pool, "exact");
        assertEq(usdc.balanceOf(address(arena)), 0, "no dust stuck");
        assertGe(fee * 10000, pool * 1500, "fee never below 15% on dust");
    }

    // ----------------------------------------------------------- rejections
    function test_Reject_DoubleEntry() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        vm.prank(alice);
        vm.expectRevert("already entered");
        arena.enter(id);
    }

    function test_Reject_EntryAfterClose() public {
        uint256 id = _createUsdcRound();
        arena.closeRegistration(id);
        vm.prank(alice);
        vm.expectRevert("registration closed");
        arena.enter(id);
    }

    function test_Reject_WrongEthAmount() public {
        uint256 id = _createEthRound();
        vm.prank(alice);
        vm.expectRevert("wrong ETH amount");
        arena.enter{value: ETH_FEE - 1}(id);
    }

    function test_Reject_EthToUsdcRound() public {
        uint256 id = _createUsdcRound();
        vm.prank(alice);
        vm.expectRevert("ETH not accepted");
        arena.enter{value: 1 wei}(id);
    }

    function test_Reject_NonOracleSubmitWinner() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _toSettling(id);
        vm.prank(alice);
        vm.expectRevert("not oracle");
        arena.submitWinner(id, alice);
    }

    function test_Reject_SubmitWinnerWrongState() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        vm.prank(oracle);
        vm.expectRevert("not settling");
        arena.submitWinner(id, alice);
    }

    function test_Reject_WinnerNotEntrant() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _toSettling(id);
        vm.prank(oracle);
        vm.expectRevert("winner not entrant");
        arena.submitWinner(id, bob);
    }

    function test_Reject_ClaimByNonWinner() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _enterUsdc(id, bob);
        _toSettling(id);
        vm.prank(oracle);
        arena.submitWinner(id, alice);
        vm.prank(bob);
        vm.expectRevert("not winner");
        arena.claimPrize(id);
    }

    function test_Reject_DoubleClaim() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _toSettling(id);
        vm.prank(oracle);
        arena.submitWinner(id, alice);
        vm.startPrank(alice);
        arena.claimPrize(id);
        vm.expectRevert("claimed");
        arena.claimPrize(id);
        vm.stopPrank();
    }

    function test_Reject_NonOwnerAdmin() public {
        uint256 id = _createUsdcRound();
        vm.startPrank(alice);
        vm.expectRevert("not owner");
        arena.closeRegistration(id);
        vm.expectRevert("not owner");
        arena.voidRound(id);
        vm.expectRevert("not owner");
        arena.withdrawFees(address(usdc), alice);
        vm.stopPrank();
    }

    // --------------------------------------------------------- void / refund
    function test_VoidRefund_FullFees() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _enterUsdc(id, bob);
        arena.closeRegistration(id);
        arena.setLive(id);
        arena.voidRound(id); // game broke mid-window

        uint256 aBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        arena.refund(id);
        assertEq(usdc.balanceOf(alice) - aBefore, USDC_FEE, "FULL refund, no skim");

        vm.prank(bob);
        arena.refund(id);

        // no double refund
        vm.prank(alice);
        vm.expectRevert("refunded");
        arena.refund(id);

        // non-entrant can't refund
        vm.prank(carol);
        vm.expectRevert("not entrant");
        arena.refund(id);

        assertEq(usdc.balanceOf(address(arena)), 0, "pool fully returned");
    }

    function test_Reject_VoidAfterSettled() public {
        uint256 id = _createUsdcRound();
        _enterUsdc(id, alice);
        _toSettling(id);
        vm.prank(oracle);
        arena.submitWinner(id, alice);
        vm.expectRevert("final");
        arena.voidRound(id);
    }

    // ------------------------------------------------------------ reentrancy
    function test_Reentrancy_ClaimBlocked() public {
        uint256 id = _createEthRound();
        ReentrantWinner attacker = new ReentrantWinner(arena);
        vm.deal(address(attacker), 1 ether);
        attacker.enter{value: ETH_FEE}(id);
        _enterEth(id, bob);
        _toSettling(id);

        vm.prank(oracle);
        arena.submitWinner(id, address(attacker));

        uint256 pool = uint256(ETH_FEE) * 2;
        uint256 winnerAmount = (pool * 8500) / 10000;

        uint256 before = address(attacker).balance;
        attacker.claim();
        // Re-entry attempted (attacked flag set) but only ONE payout occurred.
        assertTrue(attacker.attacked(), "reentry was attempted");
        assertEq(address(attacker).balance - before, winnerAmount, "single payout only");
    }

    // ------------------------------------------------------------ state machine
    function test_StateMachine_OrderEnforced() public {
        uint256 id = _createUsdcRound();
        vm.expectRevert("bad state");
        arena.setLive(id); // can't skip RegistrationClosed
        arena.closeRegistration(id);
        vm.expectRevert("bad state");
        arena.closeWindow(id); // can't skip Live
        arena.setLive(id);
        arena.closeWindow(id);
        (, , , , ArenaAscent.State s, , , , , ) = _round(id);
        assertEq(uint8(s), uint8(ArenaAscent.State.Settling));
    }

    function _round(uint256 id)
        internal
        view
        returns (
            address asset,
            uint96 entryFee,
            uint128 prizePool,
            uint32 entrantCount,
            ArenaAscent.State state,
            address winner,
            uint64 deadline,
            uint16 feeBps,
            bool claimed,
            bool feeCollected
        )
    {
        return arena.rounds(id);
    }

    receive() external payable {}
}
