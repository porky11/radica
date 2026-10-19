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

  /** `onChange(id)` runs when a subscribed contract changes on the network. */
  constructor(private onChange: (id: ContractId) => void) {}

  connect(): Promise<FreenetWsApi> {
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

  /** The state on the network (and subscribe to its changes), or null when nobody published it yet. */
  async get<T>(id: ContractId): Promise<T | null> {
    const api = await this.connect();
    const key = await contractKey(id);
    this.ids.set(key.encode(), id);
    try {
      const r = await withTimeout(api.get(new GetRequest(key, false, true)));
      this.known.add(id);
      return r.state.length ? (JSON.parse(new TextDecoder().decode(Uint8Array.from(r.state))) as T) : null;
    } catch (e) {
      if (/not found/i.test(String(e))) return null;
      throw e;
    }
  }

  /** Send `value` (put the first time, then update); the contract merges it and rejects it whole if anything is forged. */
  async push(id: ContractId, value: unknown): Promise<void> {
    const api = await this.connect();
    const key = await contractKey(id);
    const bytes = Array.from(new TextEncoder().encode(JSON.stringify(value)));
    if (!this.known.has(id) && (await this.get(id)) === null) {
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
