// Node-side identity delegate: keeps the Viso app key where the sandboxed page cannot lose it (no storage, URL hash
// dropped by the Viso redirect). Same delegate as freetunes. Optional: callers fall back to the page's own storage.
import { FreenetWsApi, DelegateRequest, type DelegateResponse } from "@freenetorg/freenet-stdlib";
import { ApplicationMessageT } from "@freenetorg/freenet-stdlib/common";
import {
  ApplicationMessagesT, ClientRequestT, ClientRequestType, DelegateCodeT, DelegateContainerT, DelegateKeyT,
  DelegateRequestType, DelegateType, InboundDelegateMsgT, InboundDelegateMsgType, RegisterDelegateT, WasmDelegateV1T,
} from "@freenetorg/freenet-stdlib/client-request";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import identityWasm from "./identity.wasm?url";

const TIMEOUT_MS = 8000;
let waiters: { resolve(r: DelegateResponse): void; reject(e: Error): void }[] = [];
let apiP: Promise<FreenetWsApi> | undefined;
let chain: Promise<unknown> = Promise.resolve();
let key: Promise<DelegateKeyT> | undefined;
const others = new Map<string, Promise<DelegateKeyT>>(); // other delegates by wasm url (ante)

function api(): Promise<FreenetWsApi> {
  return (apiP ??= new Promise((resolve, reject) => {
    const loc = globalThis.location;
    const onNode = loc.port === "7509" || loc.pathname.includes("/v1/contract/");
    const url = new URL(`${loc.protocol === "https:" ? "wss" : "ws"}://${onNode ? loc.host : "127.0.0.1:7509"}/v1/contract/command`);
    const a: FreenetWsApi = new FreenetWsApi(url, {
      onContractPut() {}, onContractGet() {}, onContractUpdate() {}, onContractUpdateNotification() {}, onContractNotFound() {},
      onDelegateResponse: (r) => waiters.shift()?.resolve(r), // replies carry no id: one request at a time
      onErr: (e) => console.warn("[Freenet delegate]", e?.cause ?? e),
      onOpen: () => resolve(a),
      onClose: () => {
        apiP = key = undefined;
        others.clear();
        waiters.splice(0).forEach((w) => w.reject(new Error("socket closed")));
        reject(new Error("socket closed"));
      },
    }, new URLSearchParams(loc.search).get("authToken") ?? "");
  }));
}

function send(req: DelegateRequest, timeoutMs = TIMEOUT_MS): Promise<DelegateResponse> {
  const run = async () => {
    const reply = new Promise<DelegateResponse>((resolve, reject) => {
      const w = { resolve, reject };
      waiters.push(w);
      setTimeout(() => {
        const i = waiters.indexOf(w);
        if (i >= 0) { waiters.splice(i, 1); reject(new Error("delegate timeout")); }
      }, timeoutMs);
    });
    (await api() as unknown as { sendRequest(r: ClientRequestT): void }).sendRequest(new ClientRequestT(ClientRequestType.DelegateRequest, req));
    return reply;
  };
  const p = chain.then(run);
  chain = p.catch(() => {});
  return p;
}

async function register(url: string, expectHash?: string): Promise<DelegateKeyT> {
  const code = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const hash = blake3(code);
  if (expectHash && bytesToHex(hash) !== expectHash) throw new Error("unexpected delegate code");
  const k = new DelegateKeyT(Array.from(blake3(hash)), Array.from(hash));
  const wasm = new WasmDelegateV1T([], new DelegateCodeT(Array.from(code), Array.from(hash)), k);
  await send(new DelegateRequest(DelegateRequestType.RegisterDelegate,
    new RegisterDelegateT(new DelegateContainerT(DelegateType.WasmDelegateV1, wasm), new Array(32).fill(0), new Array(24).fill(0)))); // node ignores cipher and nonce
  return k;
}

async function message(k: DelegateKeyT, payload: Uint8Array, timeoutMs?: number): Promise<Uint8Array> {
  const msg = new InboundDelegateMsgT(InboundDelegateMsgType.common_ApplicationMessage, new ApplicationMessageT(Array.from(payload), [], false));
  const r = await send(new DelegateRequest(DelegateRequestType.ApplicationMessages, new ApplicationMessagesT(k, [], [msg])), timeoutMs);
  // duck-typed: bundlers can duplicate the SDK classes, which breaks instanceof
  const m = r.values.map((v) => v.inbound).find((x) => Array.isArray((x as ApplicationMessageT | null)?.payload)) as ApplicationMessageT | undefined;
  if (!m) throw new Error("empty delegate reply");
  return new Uint8Array(m.payload);
}

/** One message to another app's delegate (registered on first use, refused unless its code hashes to `expectHash`). */
export async function delegateMessage(url: string, expectHash: string, payload: Uint8Array, timeoutMs?: number): Promise<Uint8Array> {
  let k = others.get(url);
  if (!k) others.set(url, (k = register(url, expectHash)));
  return message(await k.catch((e) => { others.delete(url); throw e; }), payload, timeoutMs);
}

async function call(payload: object): Promise<Record<string, string>> {
  const k = await (key ??= register(identityWasm)).catch((e) => {
    key = undefined; // try again next time instead of keeping the failure
    throw e;
  });
  const out = JSON.parse(new TextDecoder().decode(await message(k, new TextEncoder().encode(JSON.stringify(payload)))));
  if (out.err) throw new Error(out.err);
  return out;
}

/** The app key (hex secret) kept by the node: `candidate` is stored only if the node has none yet. Null when no delegate answers. */
export async function nodeAppKey(candidate: string): Promise<string | null> {
  try {
    await call({ op: "init", sk: candidate });
    return (await call({ op: "export" })).sk;
  } catch (e) {
    console.warn("identity delegate unavailable, using page storage:", e);
    return null;
  }
}

/** Make `sk` the app key the node keeps (Viso's shared key replacing this device's own). False when no delegate answers. */
export async function nodeReplaceAppKey(sk: string): Promise<boolean> {
  try {
    await call({ op: "replace", sk });
    return true;
  } catch (e) {
    console.warn("identity delegate unavailable, the app key stays in page storage:", e);
    return false;
  }
}

// the delegate takes only [A-Za-z0-9:-] keys; room ids carry '_' (never '-'), so this mapping cannot collide
const kvKey = (key: string) => key.replace(/_/g, "-");

/** A small private value kept by the node for this app (the delegate's key/value store); null when it is missing or no delegate answers. */
export async function nodeGet(key: string): Promise<string | null> {
  try {
    return ((await call({ op: "get", key: kvKey(key) })).value as string | null) ?? null;
  } catch (e) {
    console.warn("identity delegate unavailable:", e);
    return null;
  }
}

export async function nodePut(key: string, value: string): Promise<void> {
  try {
    await call({ op: "put", key: kvKey(key), value });
  } catch (e) {
    console.warn("identity delegate unavailable:", e);
  }
}
