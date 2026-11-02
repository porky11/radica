// Deploy RadicaSupport. Usage: DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
const { ethers, network } = require("hardhat");

const { TREASURY, ADDRESSES } = require("./addresses");

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const a = ADDRESSES[Number(chainId)];
  if (!a) throw new Error(`No addresses for chain ${chainId}`);
  const support = await ethers.deployContract("RadicaSupport", [a.semaphore, a.usdc, TREASURY]);
  await support.waitForDeployment();
  const groups = await Promise.all([0, 1, 2].map((i) => support.groupIds(i)));
  console.log(`RadicaSupport on ${network.name} (${chainId}): ${await support.getAddress()}`);
  console.log(`groups sprout/root/oak: ${groups.join(" / ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
