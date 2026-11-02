// Constructor arguments and deployments of RadicaSupport, shared by deploy.js and verify.js.
const TREASURY = "0xA6591dCDff5C7616110b4f84207184aef7835048";
// Semaphore v4 from @semaphore-protocol/utils deployed-contracts; USDC is Circle's native USDC. Check both on basescan.
const ADDRESSES = {
  8453: { semaphore: "0xC10E5102A2Cc077BE3B9740Fc0Ad7e27Ff8E0245", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  84532: { semaphore: "0xC10E5102A2Cc077BE3B9740Fc0Ad7e27Ff8E0245", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
};
// Deployed RadicaSupport per chain (add Base mainnet after its deploy).
const DEPLOYED = { 84532: "0x92B853F5B22B0A380bd2Df08B0941D31f720C693" };

module.exports = { TREASURY, ADDRESSES, DEPLOYED };
