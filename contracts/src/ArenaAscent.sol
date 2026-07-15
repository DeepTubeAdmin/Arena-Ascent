// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Arena Ascent — monthly winner-takes-all skill tournament (Arbitrum)
/// @notice One round per month. Players enter with USDC or ETH (single asset
///         per round, set at creation). Highest score takes the pool minus a
///         platform fee (default 15%). A trusted oracle submits the winner
///         after off-chain server-authoritative scoring and mandatory human
///         replay review. Pull-payment pattern throughout. Voided rounds
///         refund FULL entry fees (fee is only taken at claim, never skimmed
///         per entry).
/// @dev    Self-contained: minimal role/guard implementations inlined so the
///         repo compiles with no external dependencies. Swapping to
///         OpenZeppelin AccessControl/ReentrancyGuard/SafeERC20 is a
///         reasonable hardening step before mainnet.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ArenaAscent {
    // ---------------------------------------------------------------- roles
    address public owner;   // operator: creates rounds, moves state, voids, withdraws fees
    address public oracle;  // settlement signer: submits winners (point at a Safe multisig)

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "not oracle");
        _;
    }

    // ------------------------------------------------------- reentrancy guard
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ---------------------------------------------------------------- rounds
    enum State {
        RegistrationOpen,
        RegistrationClosed,
        Live,
        Settling,
        Settled,
        Voided
    }

    struct Round {
        address asset;                // address(0) = ETH round, otherwise ERC20 (USDC)
        uint96 entryFee;              // per-entry fee in asset's smallest unit
        uint128 prizePool;            // sum of entry fees
        uint32 entrantCount;
        State state;
        address winner;
        uint64 registrationDeadline;  // informational; owner still flips state
        uint16 platformFeeBps;        // default 1500 = 15%
        bool prizeClaimed;
        bool feeCollected;
    }

    uint256 public nextRoundId = 1;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => bool)) public entered;
    mapping(uint256 => mapping(address => bool)) public refunded;

    /// Accumulated platform fees per asset (address(0) = ETH), withdrawable by owner.
    mapping(address => uint256) public feesAccrued;

    uint16 public constant DEFAULT_FEE_BPS = 1500; // 15%
    uint16 public constant MAX_FEE_BPS = 3000;     // hard ceiling, protects entrants

    // ---------------------------------------------------------------- events
    event RoundCreated(uint256 indexed roundId, address asset, uint96 entryFee, uint64 registrationDeadline, uint16 platformFeeBps);
    event Entered(uint256 indexed roundId, address indexed player, uint96 fee, uint128 newPool);
    event StateChanged(uint256 indexed roundId, State from, State to);
    event WinnerSubmitted(uint256 indexed roundId, address indexed winner);
    event PrizeClaimed(uint256 indexed roundId, address indexed winner, uint256 winnerAmount, uint256 feeAmount);
    event Refunded(uint256 indexed roundId, address indexed player, uint96 amount);
    event FeesWithdrawn(address indexed asset, address indexed to, uint256 amount);
    event OracleChanged(address indexed previousOracle, address indexed newOracle);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _oracle) {
        require(_oracle != address(0), "oracle=0");
        owner = msg.sender;
        oracle = _oracle;
    }

    // ------------------------------------------------------------- admin ops
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "oracle=0");
        emit OracleChanged(oracle, newOracle);
        oracle = newOracle;
    }

    /// @param asset address(0) for an ETH round, or the USDC token address.
    /// @param entryFee entry fee in the asset's smallest unit (wei / 6-decimals USDC).
    /// @param registrationDeadline unix time registration is expected to close.
    /// @param platformFeeBps pass 0 to use the 1500 (15%) default.
    function createRound(
        address asset,
        uint96 entryFee,
        uint64 registrationDeadline,
        uint16 platformFeeBps
    ) external onlyOwner returns (uint256 roundId) {
        require(entryFee > 0, "fee=0");
        uint16 fee = platformFeeBps == 0 ? DEFAULT_FEE_BPS : platformFeeBps;
        require(fee <= MAX_FEE_BPS, "fee too high");

        roundId = nextRoundId++;
        rounds[roundId] = Round({
            asset: asset,
            entryFee: entryFee,
            prizePool: 0,
            entrantCount: 0,
            state: State.RegistrationOpen,
            winner: address(0),
            registrationDeadline: registrationDeadline,
            platformFeeBps: fee,
            prizeClaimed: false,
            feeCollected: false
        });
        emit RoundCreated(roundId, asset, entryFee, registrationDeadline, fee);
    }

    // ------------------------------------------------------- state transitions
    function closeRegistration(uint256 roundId) external onlyOwner {
        _transition(roundId, State.RegistrationOpen, State.RegistrationClosed);
    }

    function setLive(uint256 roundId) external onlyOwner {
        _transition(roundId, State.RegistrationClosed, State.Live);
    }

    function closeWindow(uint256 roundId) external onlyOwner {
        _transition(roundId, State.Live, State.Settling);
    }

    function _transition(uint256 roundId, State from, State to) internal {
        Round storage r = rounds[roundId];
        require(r.entryFee != 0, "no round");
        require(r.state == from, "bad state");
        r.state = to;
        emit StateChanged(roundId, from, to);
    }

    // ------------------------------------------------------------------ entry
    function enter(uint256 roundId) external payable nonReentrant {
        Round storage r = rounds[roundId];
        require(r.entryFee != 0, "no round");
        require(r.state == State.RegistrationOpen, "registration closed");
        require(!entered[roundId][msg.sender], "already entered");

        entered[roundId][msg.sender] = true;
        r.entrantCount += 1;
        r.prizePool += r.entryFee;

        if (r.asset == address(0)) {
            require(msg.value == r.entryFee, "wrong ETH amount");
        } else {
            require(msg.value == 0, "ETH not accepted");
            require(
                IERC20(r.asset).transferFrom(msg.sender, address(this), r.entryFee),
                "token transfer failed"
            );
        }

        emit Entered(roundId, msg.sender, r.entryFee, r.prizePool);
    }

    // -------------------------------------------------------------- settlement
    /// @notice Oracle submits the winner AFTER off-chain scoring + human replay review.
    function submitWinner(uint256 roundId, address winner) external onlyOracle {
        Round storage r = rounds[roundId];
        require(r.state == State.Settling, "not settling");
        require(entered[roundId][winner], "winner not entrant");
        r.winner = winner;
        r.state = State.Settled;
        emit StateChanged(roundId, State.Settling, State.Settled);
        emit WinnerSubmitted(roundId, winner);
    }

    /// @notice Winner pulls (pool - fee). Fee accrues to the operator.
    ///         winnerAmount = floor(pool * (10000 - bps) / 10000);
    ///         fee = pool - winnerAmount. winnerAmount + fee == pool EXACTLY,
    ///         with integer-division dust accruing to the operator fee, so
    ///         nothing is ever stuck in the contract.
    function claimPrize(uint256 roundId) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.state == State.Settled, "not settled");
        require(msg.sender == r.winner, "not winner");
        require(!r.prizeClaimed, "claimed");

        r.prizeClaimed = true;
        uint256 pool = r.prizePool;
        uint256 winnerAmount = (pool * (10000 - r.platformFeeBps)) / 10000;
        uint256 fee = pool - winnerAmount;

        if (!r.feeCollected) {
            r.feeCollected = true;
            feesAccrued[r.asset] += fee;
        }

        _payout(r.asset, msg.sender, winnerAmount);
        emit PrizeClaimed(roundId, msg.sender, winnerAmount, fee);
    }

    /// @notice Operator withdraws accumulated platform fees for one asset.
    function withdrawFees(address asset, address to) external onlyOwner nonReentrant {
        require(to != address(0), "to=0");
        uint256 amount = feesAccrued[asset];
        require(amount > 0, "no fees");
        feesAccrued[asset] = 0;
        _payout(asset, to, amount);
        emit FeesWithdrawn(asset, to, amount);
    }

    // ------------------------------------------------------------ void / refund
    /// @notice Escape hatch for broken rounds. Any state before Settled.
    function voidRound(uint256 roundId) external onlyOwner {
        Round storage r = rounds[roundId];
        require(r.entryFee != 0, "no round");
        require(r.state != State.Settled && r.state != State.Voided, "final");
        State from = r.state;
        r.state = State.Voided;
        emit StateChanged(roundId, from, State.Voided);
    }

    /// @notice Entrants pull their FULL entry fee back from a voided round.
    function refund(uint256 roundId) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.state == State.Voided, "not voided");
        require(entered[roundId][msg.sender], "not entrant");
        require(!refunded[roundId][msg.sender], "refunded");

        refunded[roundId][msg.sender] = true;
        _payout(r.asset, msg.sender, r.entryFee);
        emit Refunded(roundId, msg.sender, r.entryFee);
    }

    // ----------------------------------------------------------------- payout
    function _payout(address asset, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (asset == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "ETH send failed");
        } else {
            require(IERC20(asset).transfer(to, amount), "token send failed");
        }
    }

    // ------------------------------------------------------------------ views
    function roundInfo(uint256 roundId)
        external
        view
        returns (Round memory)
    {
        return rounds[roundId];
    }

    function hasEntered(uint256 roundId, address player) external view returns (bool) {
        return entered[roundId][player];
    }
}
