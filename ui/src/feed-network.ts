// Feed contracts on the Freenet network: one contract per persona, parameters = the persona's 32-byte pubkey.
// The node merges every update with contract/src/lib.rs, so a feed can be pushed whole: only what is new changes.
import {
  ContractContainer,
  ContractKey,
  ContractType,
  DeltaUpdate,
  FreenetWsApi,
  GetRequest,
  PutRequest,
  UpdateData,
  UpdateDataType,
  UpdateRequest,
  WasmContractV1,
} from "@freenetorg/freenet-stdlib";
import { ContractCodeT } from "@freenetorg/freenet-stdlib/common";
import { RelatedContractsT } from "@freenetorg/freenet-stdlib/client-request";
import { blake3 } from "@noble/hashes/blake3.js";
import wasmUrl from "./contract.wasm?url";
import { hexToBytes } from "./crypto.ts";
import type { FeedState } from "./types.ts";

const TIMEOUT_MS = 15000;

/** The node's WebSocket: same host when served by the node (web container), else the default local node. */
function wsUrl(): URL {
  const loc = globalThis.location;
  const onNode = loc && (loc.port === "7509" || loc.pathname.includes("/v1/contract/"));
  const host = onNode ? loc.host : "127.0.0.1:7509";
  return new URL(`${loc?.protocol === "https:" ? "wss" : "ws"}://${host}/v1/contract/command`);
}

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Freenet request timeout")), TIMEOUT_MS))]);

let codeP: Promise<{ code: Uint8Array; hash: Uint8Array }> | undefined;
function contractCode() {
  return (codeP ??= fetch(wasmUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`Cannot load contract.wasm: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => {
      const code = new Uint8Array(b);
      return { code, hash: blake3(code) };
    }));
}

export async function feedKey(ownerHex: string): Promise<ContractKey> {
  const { hash } = await contractCode();
  const params = hexToBytes(ownerHex);
  return new ContractKey(blake3(new Uint8Array([...hash, ...params])), hash);
}

export class FeedNetwork {
  private apiP?: Promise<FreenetWsApi>;
  private owners = new Map<string, string>(); // contract key -> owner pubkey hex
  private known = new Set<string>(); // owners whose contract exists on the network

  /** `onChange(owner)` runs when a subscribed feed changes on the network. */
  constructor(private onChange: (owner: string) => void) {}

  connect(): Promise<FreenetWsApi> {
    return (this.apiP ??= withTimeout(
      new Promise<FreenetWsApi>((resolve, reject) => {
        const api: FreenetWsApi = new FreenetWsApi(wsUrl(), {
          onContractPut() {},
          onContractGet() {},
          onContractUpdate() {},
          onContractUpdateNotification: (n) => {
            const owner = this.owners.get(n.key.encode());
            if (owner) this.onChange(owner);
          },
          onContractNotFound() {},
          onDelegateResponse() {},
          onErr: (e) => console.warn("[Freenet]", e?.cause ?? e),
          onOpen: () => resolve(api),
          onClose: () => {
            this.apiP = undefined;
            reject(new Error("Freenet WebSocket closed"));
          },
        }, new URLSearchParams(globalThis.location?.search ?? "").get("authToken") ?? undefined);
      })
    ).catch((e) => {
      this.apiP = undefined;
      throw e;
    }));
  }

  /** The feed on the network (and subscribe to its changes), or null when nobody published it yet. */
  async get(owner: string): Promise<FeedState | null> {
    const api = await this.connect();
    const key = await feedKey(owner);
    this.owners.set(key.encode(), owner);
    try {
      const r = await withTimeout(api.get(new GetRequest(key, false, true)));
      this.known.add(owner);
      return r.state.length ? (JSON.parse(new TextDecoder().decode(Uint8Array.from(r.state))) as FeedState) : null;
    } catch (e) {
      if (/not found/i.test(String(e))) return null;
      throw e;
    }
  }

  /** Publish `feed` (put the first time, then update). The contract rejects the whole update if any record is forged. */
  async push(feed: FeedState): Promise<void> {
    const api = await this.connect();
    const key = await feedKey(feed.owner);
    const bytes = Array.from(new TextEncoder().encode(JSON.stringify(feed)));
    if (!this.known.has(feed.owner) && (await this.get(feed.owner)) === null) {
      const { code, hash } = await contractCode();
      const contract = new WasmContractV1(new ContractCodeT(Array.from(code), Array.from(hash)), Array.from(hexToBytes(feed.owner)), key);
      await withTimeout(api.put(new PutRequest(new ContractContainer(ContractType.WasmContractV1, contract), bytes, new RelatedContractsT(), true)));
      this.known.add(feed.owner);
      return;
    }
    await withTimeout(api.update(new UpdateRequest(key, new UpdateData(UpdateDataType.DeltaUpdate, new DeltaUpdate(bytes)))));
  }
}
