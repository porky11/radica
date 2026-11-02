// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {ISemaphoreGroups} from "@semaphore-protocol/contracts/interfaces/ISemaphoreGroups.sol";

/// @title Radica supporter donations
/// @notice A USDC donation goes straight to the treasury and adds the donor's Semaphore identity commitment to the
/// group of its tier. Supporters later prove "I am in the Oak group" with a zero-knowledge proof, without revealing
/// which wallet donated. No owner, no upgrade, no admin function: once deployed nobody can change the rules.
contract RadicaSupport {
    using SafeERC20 for IERC20;

    enum Tier {
        Sprout,
        Root,
        Oak
    }

    /// USDC has 6 decimals.
    uint256 public constant SPROUT_MIN = 1e6; // $1
    uint256 public constant ROOT_MIN = 50e6; // $50
    uint256 public constant OAK_MIN = 250e6; // $250

    /// How long an old Merkle root stays valid for proofs: long, so a proof can still be re-checked years later.
    uint256 public constant ROOT_VALIDITY = 3650 days;

    ISemaphore public immutable semaphore;
    IERC20 public immutable usdc;
    address public immutable treasury;

    /// Semaphore group id of each tier, indexed by Tier. Set once in the constructor; this contract is the only admin.
    uint256[3] public groupIds;

    event Donated(Tier indexed tier, uint256 indexed identityCommitment, uint256 amount);

    error BelowMinimum();
    error ZeroAddress();

    constructor(ISemaphore _semaphore, IERC20 _usdc, address _treasury) {
        if (address(_semaphore) == address(0) || address(_usdc) == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }
        semaphore = _semaphore;
        usdc = _usdc;
        treasury = _treasury;
        for (uint256 i = 0; i < 3; i++) {
            groupIds[i] = _semaphore.createGroup(address(this), ROOT_VALIDITY);
        }
    }

    function tierOf(uint256 amount) public pure returns (Tier) {
        if (amount >= OAK_MIN) return Tier.Oak;
        if (amount >= ROOT_MIN) return Tier.Root;
        if (amount >= SPROUT_MIN) return Tier.Sprout;
        revert BelowMinimum();
    }

    /// @notice Donate `amount` USDC (approve this contract first) and join the tier the amount reaches.
    /// Donating again with the same identity is fine: the commitment is added to a group only once.
    function donate(uint256 amount, uint256 identityCommitment) external {
        Tier tier = tierOf(amount);
        usdc.safeTransferFrom(msg.sender, treasury, amount);
        uint256 groupId = groupIds[uint256(tier)];
        if (!ISemaphoreGroups(address(semaphore)).hasMember(groupId, identityCommitment)) {
            semaphore.addMember(groupId, identityCommitment);
        }
        emit Donated(tier, identityCommitment, amount);
    }
}
