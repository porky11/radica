import { createPublicClient, createWalletClient, custom, fallback, http, parseAbi, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";
import { Identity, Group, generateProof } from "@semaphore-protocol/core";
import { CHAIN_ID, RPC_URLS, FAUCET_URL, SUPPORT, USDC, SEMAPHORE, GROUPS, DEPLOY_BLOCK } from "./config.js";
import { IDENTITY_MESSAGE, SCOPE, TIER_MIN, tierOf, parseUsd, messageFor, encodeProofToken, blockRanges } from "./lib.js";

const chain = CHAIN_ID === base.id ? base : baseSepolia;
const rpcs = () => [...RPC_URLS.map((u) => http(u)), ...(window.ethereum ? [custom(window.ethereum)] : [])];
const pub = createPublicClient({ chain, transport: fallback(rpcs()) });
const erc20 = parseAbi([
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const supportAbi = parseAbi(["function donate(uint256 amount, uint256 identityCommitment)"]);
const semaphoreAbi = parseAbi([
  "function hasMember(uint256 groupId, uint256 identityCommitment) view returns (bool)",
  "function getMerkleTreeRoot(uint256 groupId) view returns (uint256)",
  "struct SemaphoreProof { uint256 merkleTreeDepth; uint256 merkleTreeRoot; uint256 nullifier; uint256 message; uint256 scope; uint256[8] points; }",
  "function verifyProof(uint256 groupId, SemaphoreProof proof) view returns (bool)",
]);

// RadicaSupport adds members one at a time, so MemberAdded (not MembersAdded) lists every member.
const memberAdded = parseAbiItem("event MemberAdded(uint256 indexed groupId, uint256 index, uint256 identityCommitment, uint256 merkleTreeRoot)");

/** All members of a group, in tree order, read from the chain. */
async function groupMembers(groupId, onProgress) {
  // shortcut: scans every block since DEPLOY_BLOCK on each proof; fine for a young contract, use an indexer when it gets slow
  // small ranges, a few at a time: public RPCs cap eth_getLogs ranges and rate-limit bursts
  const ranges = blockRanges(DEPLOY_BLOCK, await pub.getBlockNumber(), 2_000n);
  const logs = [];
  for (let i = 0; i < ranges.length; i += 4) {
    const batch = ranges.slice(i, i + 4).map(([fromBlock, toBlock]) =>
      pub.getLogs({ address: SEMAPHORE, event: memberAdded, args: { groupId }, fromBlock, toBlock })
    );
    logs.push(...(await Promise.all(batch)).flat());
    onProgress(Math.min(100, Math.round(((i + 4) / ranges.length) * 100)));
  }
  return logs.sort((a, b) => (a.args.index < b.args.index ? -1 : 1)).map((l) => l.args.identityCommitment);
}

const $ = (id) => document.getElementById(id);
let wallet, account, identity;

function status(id, text, error = false) {
  $(id).textContent = text;
  $(id).className = error ? "status error" : "status";
}
const step = (id, fn) =>
  $(id).addEventListener("click", async () => {
    const out = `${id}-status`;
    $(id).disabled = true;
    try {
      await fn(out);
    } catch (e) {
      status(out, [e.shortMessage || e.message || String(e), e.details].filter(Boolean).join(" — "), true);
    } finally {
      $(id).disabled = false;
    }
  });

step("connect", async (out) => {
  if (!window.ethereum) throw new Error("No wallet found. Install a browser wallet such as MetaMask or Rabby.");
  wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
  [account] = await wallet.requestAddresses();
  await wallet.switchChain({ id: chain.id }).catch(() => wallet.addChain({ chain }));
  status(out, `Connected: ${account} on ${chain.name}`);
  $("identity").disabled = false;
});

step("identity", async (out) => {
  const sig = await wallet.signMessage({ account, message: IDENTITY_MESSAGE });
  identity = new Identity(sig);
  status(out, "Supporter identity ready. Signing again with this wallet always gives the same identity.");
  $("donate").disabled = $("prove").disabled = false;
});

if (CHAIN_ID !== base.id) $("testnet-banner").hidden = false; // goes away by itself with the mainnet config
if (FAUCET_URL) {
  $("faucet").href = FAUCET_URL;
  $("faucet-note").hidden = false;
}

$("amount").addEventListener("input", () => {
  const v = parseUsd($("amount").value);
  const t = v && tierOf(v);
  $("tier-preview").textContent = t ? `Tier: ${t}` : `Minimum $${Number(TIER_MIN.sprout) / 1e6}`;
});

step("donate", async (out) => {
  const amount = parseUsd($("amount").value);
  if (!amount || !tierOf(amount)) throw new Error("Enter at least $1.");
  if ((await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [account] })) < amount)
    throw new Error("Not enough USDC in this wallet.");
  const allowance = await pub.readContract({ address: USDC, abi: erc20, functionName: "allowance", args: [account, SUPPORT] });
  if (allowance < amount) {
    status(out, "1/2 Approve USDC in your wallet…");
    const h = await wallet.writeContract({ account, address: USDC, abi: erc20, functionName: "approve", args: [SUPPORT, amount] });
    await pub.waitForTransactionReceipt({ hash: h });
  }
  status(out, "2/2 Confirm the donation in your wallet…");
  const hash = await wallet.writeContract({ account, address: SUPPORT, abi: supportAbi, functionName: "donate", args: [amount, identity.commitment] });
  await pub.waitForTransactionReceipt({ hash });
  status(out, `Thank you! You are now a ${tierOf(amount)} supporter. Next: create your proof below.`);
});

step("prove", async (out) => {
  const message = messageFor($("pubkey").value);
  status(out, "Finding your tier…");
  let tier;
  for (const t of ["oak", "root", "sprout"])
    if (await pub.readContract({ address: SEMAPHORE, abi: semaphoreAbi, functionName: "hasMember", args: [GROUPS[t], identity.commitment] })) {
      tier = t;
      break;
    }
  if (!tier) throw new Error("This wallet's identity has not donated yet (or the donation is not confirmed).");

  status(out, `Tier ${tier}. Loading the group…`);
  const groupId = GROUPS[tier];
  const members = await groupMembers(groupId, (pct) => status(out, `Tier ${tier}. Reading the group from the chain… ${pct}%`));
  const group = new Group(members);
  const onchainRoot = await pub.readContract({ address: SEMAPHORE, abi: semaphoreAbi, functionName: "getMerkleTreeRoot", args: [groupId] });
  if (group.root !== onchainRoot) throw new Error("The group read from the chain does not match its root yet. Try again in a minute.");

  status(out, "Generating the zero-knowledge proof (a few seconds)…");
  const proof = await generateProof(identity, group, message, SCOPE);
  const ok = await pub.readContract({ address: SEMAPHORE, abi: semaphoreAbi, functionName: "verifyProof", args: [groupId, { ...proof, points: proof.points.map(BigInt) }] });
  if (!ok) throw new Error("The proof did not verify on-chain.");

  $("token").value = encodeProofToken({ chainId: CHAIN_ID, contract: SUPPORT, tier, groupId, proof });
  status(out, "Proof ready and verified on-chain. Copy it and paste it in Radica.");
});

$("copy").addEventListener("click", () => navigator.clipboard.writeText($("token").value));
