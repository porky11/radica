// River rooms: river.wasm (river-wasm/, built from river-core) builds and reads River room states and deltas, so
// Radica's chat runs on River's own room contract. One JSON call in, one JSON answer out; see river-wasm/src/lib.rs.

type Exports = {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  call(ptr: number, len: number): bigint;
};

export type RiverCall = (req: Record<string, unknown>) => Record<string, any>;

/** Instantiate river.wasm from its bytes; the call throws with River's reason when an op is refused. */
export async function loadRiver(bytes: BufferSource): Promise<RiverCall> {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports as unknown as Exports;
  return (req) => {
    const input = new TextEncoder().encode(JSON.stringify(req));
    const ptr = x.alloc(input.length);
    new Uint8Array(x.memory.buffer, ptr, input.length).set(input);
    const r = x.call(ptr, input.length);
    x.dealloc(ptr, input.length);
    const [outPtr, outLen] = [Number(r >> 32n), Number(r & 0xffffffffn)];
    const out = JSON.parse(new TextDecoder().decode(new Uint8Array(x.memory.buffer, outPtr, outLen)));
    x.dealloc(outPtr, outLen);
    if (out.error) throw new Error(`River: ${out.error}`);
    return out;
  };
}

let riverP: Promise<RiverCall> | undefined;
/** The browser's instance, loaded on first use. */
export function river(): Promise<RiverCall> {
  return (riverP ??= import("./river.wasm?url").then(({ default: url }) => fetch(url)).then((r) => r.arrayBuffer()).then(loadRiver));
}
