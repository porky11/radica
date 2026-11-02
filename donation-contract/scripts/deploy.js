// Deploy RadicaSupport. Usage: DEPLOYER_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
const { ethers, network } = require("hardhat");

const TREASURY = "0xA6591dCDff5C7616110b4f84207184aef7835048";
// Semaphore v4 from @semaphore-protocol/utils deployed-contracts; USDC is Circle's native USDC. Check both on basescan.
const ADDRESSES = {
  8453: { semaphore: "0xC10E5102A2Cc077BE3B9740Fc0Ad7e27Ff8E0245", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  84532: { semaphore: "0xC10E5102A2Cc077BE3B9740Fc0Ad7e27Ff8E0245", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
};

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
