// Verify RadicaSupport's source on basescan (Etherscan API v2) and Sourcify, so wallets recognise the contract.
// Usage: ETHERSCAN_API_KEY=... npx hardhat run scripts/verify.js --network baseSepolia   (no key: Sourcify only)
// Another address than the one in addresses.js: SUPPORT_ADDRESS=0x... before the command.
const hre = require("hardhat");
const { TREASURY, ADDRESSES, DEPLOYED } = require("./addresses");

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  const a = ADDRESSES[Number(chainId)];
  const address = process.env.SUPPORT_ADDRESS || DEPLOYED[Number(chainId)];
  if (!a || !address) throw new Error(`No RadicaSupport deployment known for chain ${chainId}`);
  await hre.run("verify:verify", { address, constructorArguments: [a.semaphore, a.usdc, TREASURY] });
  console.log(`Verified ${address} on ${hre.network.name}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
