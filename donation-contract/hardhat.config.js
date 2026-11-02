const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");

const SOLC = "0.8.28";

// Use the solc-js compiler from npm: no download from binaries.soliditylang.org. Its version ends in
// ".Emscripten.clang", which etherscan refuses; the compiler commit (so the bytecode) is the official one.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== SOLC) return runSuper();
  const compilerPath = path.join(__dirname, "node_modules", "solc", "soljson.js");
  return { compilerPath, isSolcJs: true, version: SOLC, longVersion: require("solc").version().replace(/\.Emscripten\.clang$/, "") };
});

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

module.exports = {
  networks: {
    baseSepolia: { url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org", accounts },
    base: { url: process.env.BASE_RPC || "https://mainnet.base.org", accounts },
  },
  // Etherscan API v2: one key (etherscan.io account) covers basescan too. Sourcify needs no key.
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
  sourcify: { enabled: true },
  solidity: { version: SOLC, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
};
