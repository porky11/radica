// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// The parts of Semaphore RadicaSupport uses, with the real contract's rules: only the group admin adds members,
/// and adding an existing member reverts.
contract MockSemaphore {
    uint256 public groupCounter;
    mapping(uint256 => address) public admins;
    mapping(uint256 => uint256) public durations;
    mapping(uint256 => mapping(uint256 => bool)) public hasMember;
    mapping(uint256 => uint256) public size;

    function createGroup(address admin, uint256 merkleTreeDuration) external returns (uint256 id) {
        id = groupCounter++;
        admins[id] = admin;
        durations[id] = merkleTreeDuration;
    }

    function addMember(uint256 groupId, uint256 commitment) external {
        require(msg.sender == admins[groupId], "not admin");
        require(!hasMember[groupId][commitment], "already member");
        hasMember[groupId][commitment] = true;
        size[groupId]++;
    }
}
