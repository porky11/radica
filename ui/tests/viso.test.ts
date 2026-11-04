import test from "node:test";
import assert from "node:assert/strict";
import { visoIdentityInstance, visoIdentityParams, visoProfileOf } from "../src/viso.ts";

// made with Viso's own code (viso-core: sign_slot, to_cbor, ContractKey::from_params_and_code), signing key [7; 32]
const PK = "ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c";
const INSTANCE = "eb1b8fefa88eee7bbb78817e1d293d72b6d604cfbe1155ea4b68bcfa42c523c6"; // base58: GpmBjuWwjPY8kZu4dEg1vE6pw9ZDnyrDcx5waUQDYVRo
const STATE = "a265736c6f7473a16770726f66696c65a36774696d655f6d731b0000018bcfe5680065627974657356a2646e616d6568416461205669736f6362696f62686963736967984018b7185d1894184718c81862183418561118870b18b8186518f0188f18b5184d184a1839183a186618b2186d189e18ed184f18b418381860183e18e0185418650e18d218d6182818fe183f18c218641848181f18e7182d1886183a182c0f18cb18c3186a18ea183f183f18271855182b1838182418c718f4189e0b6964657374726f796564f6";
const bytes = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

test("viso: a persona's identity contract address is the one Viso derives", () => {
  assert.equal(Buffer.from(visoIdentityParams(PK)).toString("hex"), `a26776657273696f6e01667075626b65795820${PK}`);
  assert.equal(Buffer.from(visoIdentityInstance(PK)).toString("hex"), INSTANCE);
});

test("viso: the profile is read only when the persona's signature checks out", async () => {
  assert.deepEqual(await visoProfileOf(bytes(STATE), PK), { name: "Ada Viso", bio: "hi" });
  const tampered = bytes(STATE.replace("416461205669736f", "457665205669736f")); // "Ada Viso" -> "Eve Viso"
  assert.equal(await visoProfileOf(tampered, PK), null);
  assert.equal(await visoProfileOf(bytes(STATE), "00".repeat(32)), null); // someone else's key
  assert.equal(await visoProfileOf(new Uint8Array(), PK), null);
});
