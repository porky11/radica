// Radica contracts on the Freenet network:
// - feed (contract/): one per persona, parameters = the persona's 32-byte pubkey || app path;
// - log (log-contract/): named append-only logs of signed entries (inbox, communities, chats), params `radica/<name>|<app path>`.
// The node merges every update with the contract, so a whole state can be pushed: only what is new changes.
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
import feedWasmUrl from "./contract.wasm?url";
import logWasmUrl from "./log.wasm?url";
import { hexToBytes } from "./crypto.ts";
import { appPath } from "./whoiam.ts";
import { limiter } from "./limit.ts";
import { CURRENT, LEGACY } from "./legacy.ts";

const RECONNECT_MS = 5000;
const PROBED = "radica_legacy_probed"; // contracts already looked up under earlier generations
const TIMEOUT_MS = 45000; // a get/put for a contract the node has not got goes looking on the network

/** The node's WebSocket: same host when served by the node (web container), else the default local node. */
function wsUrl(): URL {
  const loc = globalThis.location;
  const onNode = loc && (loc.port === "7509" || loc.pathname.includes("/v1/contract/"));
  const host = onNode ? loc.host : "127.0.0.1:7509";
  return new URL(`${loc?.protocol === "https:" ? "wss" : "ws"}://${host}/v1/contract/command`);
}

// One node queue serves every request: a burst of lookups (feeds of many contacts, a log per room) gets the extra ones
// refused, and a refused one waits out its whole timeout. Lookups therefore go a few at a time (River measured this in #810).
const MAX_GETS = 6;
const oneAtATime = limiter(MAX_GETS);

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Freenet request timeout")), TIMEOUT_MS))]);

/** A contract on the network: the feed of a persona (`feed:<pubkey>`) or a named log (`log:<name>`). */
export type ContractId = `feed:${string}` | `log:${string}`;

const codes = new Map<string, Promise<{ code: Uint8Array; hash: Uint8Array }>>();
function contractCode(url: string) {
  if (!codes.has(url))
    codes.set(url, fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Cannot load ${url}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        const code = new Uint8Array(b);
        return { code, hash: blake3(code) };
      }));
  return codes.get(url)!;
}

/** Code and parameters: a feed is keyed by the owner's pubkey, a log by its name. */
function partsOf(id: ContractId): { url: string; params: Uint8Array } {
  const app = appPath(); // contracts accept Viso delegations made for this app only
  return id.startsWith("feed:")
    ? { url: feedWasmUrl, params: new Uint8Array([...hexToBytes(id.slice(5)), ...new TextEncoder().encode(app)]) }
    : { url: logWasmUrl, params: new TextEncoder().encode(`radica/${id.slice(4)}|${app}`) };
}

export async function contractKey(id: ContractId): Promise<ContractKey> {
  const { url, params } = partsOf(id);
  const { hash } = await contractCode(url);
  return new ContractKey(blake3(new Uint8Array([...hash, ...params])), hash);
}

export class FreenetNetwork {
  private apiP?: Promise<FreenetWsApi>;
  private ids = new Map<string, ContractId>(); // encoded contract key -> id
  private known = new Set<ContractId>(); // contracts that exist on the network

  /** When each contract was last fetched (and so subscribed to) on this connection; cleared when the socket drops. */
  private live = new Map<ContractId, number>();

  /** Ms since `id` was fetched on this connection, or null: the node pushes its changes to us meanwhile. */
  liveAge(id: ContractId): number | null {
    const t = this.live.get(id);
    return t === undefined ? null : Date.now() - t;
  }

  /** `onChange(id)` runs when a subscribed contract changes on the network. */
  constructor(private onChange: (id: ContractId) => void) {}

  connect(): Promise<FreenetWsApi> {
    let opened = false;
    return (this.apiP ??= withTimeout(
      new Promise<FreenetWsApi>((resolve, reject) => {
        const api: FreenetWsApi = new FreenetWsApi(wsUrl(), {
          onContractPut() {},
          onContractGet() {},
          onContractUpdate() {},
          onContractUpdateNotification: (n) => {
            const id = this.ids.get(n.key.encode());
            if (id) this.onChange(id);
          },
          onContractNotFound() {},
          onDelegateResponse() {},
          onErr: (e) => console.warn("[Freenet]", e?.cause ?? e),
          onOpen: () => {
            opened = true;
            resolve(api);
          },
          onClose: () => {
            this.apiP = undefined;
            this.live.clear(); // the node drops our subscriptions with the socket
            reject(new Error("Freenet WebSocket closed"));
            if (opened) this.resubscribe(); // the node drops our subscriptions with the socket
          },
        }, new URLSearchParams(globalThis.location?.search ?? "").get("authToken") ?? ""); // "" not undefined: the stdlib would read document.cookie, which throws in the sandboxed iframe
      })
    ).catch((e) => {
      this.apiP = undefined;
      throw e;
    }));
  }

  /** Reconnect, then fetch again (and so subscribe again to) every contract we follow. */
  private resubscribe(): void {
    setTimeout(() => this.connect().then(() => new Set(this.ids.values()).forEach(this.onChange), () => this.resubscribe()), RECONNECT_MS);
  }

  /** The state on the network (and subscribe to its changes), or null when nobody published it yet. */
  async get<T>(id: ContractId): Promise<T | null> {
    const api = await this.connect();
    const key = await contractKey(id);
    this.ids.set(key.encode(), id);
    try {
      const r = await oneAtATime(() => withTimeout(api.get(new GetRequest(key, false, true)))); // the timeout starts when the lookup is sent, not while it waits
      this.known.add(id);
      if (r.state.length) this.live.set(id, Date.now()); // nothing published yet: no subscription to rely on
      return r.state.length ? (JSON.parse(new TextDecoder().decode(Uint8Array.from(r.state))) as T) : null;
    } catch (e) {
      if (/not found/i.test(String(e))) return this.fromLegacy<T>(id);
      throw e;
    }
  }

  /** Raw state of any contract key (another app's, like River's), or null when it is not on the network. */
  async getRaw(key: ContractKey): Promise<Uint8Array | null> {
    const api = await this.connect();
    try {
      const r = await oneAtATime(() => withTimeout(api.get(new GetRequest(key, false, false))));
      return r.state.length ? Uint8Array.from(r.state) : null;
    } catch (e) {
      if (/not found/i.test(String(e))) return null;
      throw e;
    }
  }

  /** Nothing under the current code: look under earlier generations, once per contract, and carry what is found forward. */
  private async fromLegacy<T>(id: ContractId): Promise<T | null> {
    const kind = id.startsWith("feed:") ? "feed" : "log";
    const mark = `${PROBED}:${CURRENT[kind]}`; // a new generation probes everything again
    // shortcut: a legacy lookup that times out is not retried, retry per session if near-misses strand data
    const done: string[] = JSON.parse(localStorage.getItem(mark) || "[]");
    if (done.includes(id)) return null;
    localStorage.setItem(mark, JSON.stringify([...done, id])); // before probing: push below calls get again
    const api = await this.connect();
    const { params } = partsOf(id);
    for (const hex of LEGACY[kind]) {
      const hash = hexToBytes(hex);
      const key = new ContractKey(blake3(new Uint8Array([...hash, ...params])), hash);
      const r = await oneAtATime(() => withTimeout(api.get(new GetRequest(key, false, false)))).catch(() => null);
      if (!r?.state.length) continue;
      const state = JSON.parse(new TextDecoder().decode(Uint8Array.from(r.state))) as T;
      try {
        await this.push(id, state); // the current contract checks every record: a state it no longer accepts stays behind
        return state;
      } catch (e) {
        console.warn("[Freenet] Could not carry", id, "forward from an earlier contract", e);
        return null;
      }
    }
    return null;
  }

  /** Send `value` (put the first time, then update); the contract merges it and rejects it whole if anything is forged. */
  async push(id: ContractId, value: unknown): Promise<void> {
    const api = await this.connect();
    const key = await contractKey(id);
    const bytes = Array.from(new TextEncoder().encode(JSON.stringify(value)));
    if (!this.known.has(id) && (await this.get(id).catch(() => null)) === null) { // a lookup that times out: put anyway, the node merges it with any existing state
      const { url, params } = partsOf(id);
      const { code, hash } = await contractCode(url);
      const contract = new WasmContractV1(new ContractCodeT(Array.from(code), Array.from(hash)), Array.from(params), key);
      await withTimeout(api.put(new PutRequest(new ContractContainer(ContractType.WasmContractV1, contract), bytes, new RelatedContractsT(), true)));
      this.known.add(id);
      return;
    }
    await withTimeout(api.update(new UpdateRequest(key, new UpdateData(UpdateDataType.DeltaUpdate, new DeltaUpdate(bytes)))));
  }
}
