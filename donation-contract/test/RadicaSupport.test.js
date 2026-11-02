const { expect } = require("chai");
const { ethers } = require("hardhat");

const usd = (n) => ethers.parseUnits(String(n), 6);
const Tier = { Sprout: 0, Root: 1, Oak: 2 };

describe("RadicaSupport", () => {
  let support, usdc, semaphore, donor, treasury;

  beforeEach(async () => {
    [, donor, treasury] = await ethers.getSigners();
    usdc = await ethers.deployContract("MockUSDC");
    semaphore = await ethers.deployContract("MockSemaphore");
    support = await ethers.deployContract("RadicaSupport", [semaphore, usdc, treasury]);
    await usdc.mint(donor, usd(1000));
    await usdc.connect(donor).approve(support, ethers.MaxUint256);
  });

  it("creates one group per tier, administered by itself, with long-lived roots", async () => {
    for (let i = 0; i < 3; i++) {
      const id = await support.groupIds(i);
      expect(await semaphore.admins(id)).to.equal(await support.getAddress());
      expect(await semaphore.durations(id)).to.equal(await support.ROOT_VALIDITY());
    }
  });

  it("maps amounts to tiers at the exact thresholds", async () => {
    expect(await support.tierOf(usd(1))).to.equal(Tier.Sprout);
    expect(await support.tierOf(usd(49.999999))).to.equal(Tier.Sprout);
    expect(await support.tierOf(usd(50))).to.equal(Tier.Root);
    expect(await support.tierOf(usd(250))).to.equal(Tier.Oak);
    await expect(support.tierOf(usd(0.999999))).to.be.revertedWithCustomError(support, "BelowMinimum");
  });

  it("sends the donation to the treasury and adds the commitment to the tier's group", async () => {
    await expect(support.connect(donor).donate(usd(50), 42n))
      .to.emit(support, "Donated")
      .withArgs(Tier.Root, 42n, usd(50));
    expect(await usdc.balanceOf(treasury)).to.equal(usd(50));
    expect(await usdc.balanceOf(support)).to.equal(0n);
    expect(await semaphore.hasMember(await support.groupIds(Tier.Root), 42n)).to.equal(true);
    expect(await semaphore.hasMember(await support.groupIds(Tier.Oak), 42n)).to.equal(false);
  });

  it("lets the same identity donate again without reverting", async () => {
    await support.connect(donor).donate(usd(1), 7n);
    await support.connect(donor).donate(usd(2), 7n);
    expect(await semaphore.size(await support.groupIds(Tier.Sprout))).to.equal(1n);
    expect(await usdc.balanceOf(treasury)).to.equal(usd(3));
  });

  it("rejects donations below $1 and without allowance, taking nothing", async () => {
    await expect(support.connect(donor).donate(usd(0.5), 1n)).to.be.revertedWithCustomError(support, "BelowMinimum");
    const [, , , stranger] = await ethers.getSigners();
    await usdc.mint(stranger, usd(10));
    await expect(support.connect(stranger).donate(usd(10), 1n)).to.be.reverted;
    expect(await usdc.balanceOf(treasury)).to.equal(0n);
  });

  it("refuses zero addresses at deploy", async () => {
    const F = await ethers.getContractFactory("RadicaSupport");
    await expect(F.deploy(semaphore, usdc, ethers.ZeroAddress)).to.be.revertedWithCustomError(F, "ZeroAddress");
  });

  it("has no owner or admin functions", async () => {
    const fns = support.interface.fragments.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f) => f.name);
    expect(fns).to.deep.equal(["donate"]);
  });
});

describe("RadicaSupport with the real Semaphore contract", () => {
  it("adds members, keeps repeat donations working, and only it can add to its groups", async () => {
    const [, donor, treasury, stranger] = await ethers.getSigners();
    const poseidon = await ethers.deployContract("PoseidonT3");
    const verifier = await ethers.deployContract("SemaphoreVerifier");
    const semaphore = await ethers.deployContract("Semaphore", [verifier], { libraries: { PoseidonT3: poseidon } });
    const usdc = await ethers.deployContract("MockUSDC");
    const support = await ethers.deployContract("RadicaSupport", [semaphore, usdc, treasury]);
    await usdc.mint(donor, usd(1000));
    await usdc.connect(donor).approve(support, ethers.MaxUint256);

    const oak = await support.groupIds(Tier.Oak);
    await support.connect(donor).donate(usd(300), 123n);
    await support.connect(donor).donate(usd(300), 123n);
    expect(await semaphore.hasMember(oak, 123n)).to.equal(true);
    expect(await semaphore.getMerkleTreeSize(oak)).to.equal(1n);
    expect(await usdc.balanceOf(treasury)).to.equal(usd(600));

    // invalid commitment (0) reverts the whole donation: no money taken
    await expect(support.connect(donor).donate(usd(5), 0n)).to.be.reverted;
    expect(await usdc.balanceOf(treasury)).to.equal(usd(600));

    await expect(semaphore.connect(stranger).addMember(oak, 9n)).to.be.reverted;
  });
});
