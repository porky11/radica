import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

function desertAntWasmPlugin(): Plugin {
  const getWasmPath = () => path.resolve("node_modules/@desert-ant-labs/moderator/dist/ModeratorWeb.wasm");
  const getDepsPath = () => path.resolve("node_modules/.vite/deps/ModeratorWeb.wasm");

  const syncWasm = () => {
    try {
      const src = getWasmPath();
      const dest = getDepsPath();
      const depsDir = path.dirname(dest);
      if (fs.existsSync(src) && fs.existsSync(depsDir) && !fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    } catch {
      // ignore
    }
  };

  return {
    name: "desert-ant-wasm-plugin",
    configureServer(server) {
      syncWasm();

      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes("ModeratorWeb.wasm")) {
          const wasmPath = getWasmPath();
          if (fs.existsSync(wasmPath)) {
            res.setHeader("Content-Type", "application/wasm");
            const stat = fs.statSync(wasmPath);
            res.setHeader("Content-Length", stat.size);
            fs.createReadStream(wasmPath).pipe(res);
            return;
          }
        }
        next();
      });
    },
    buildStart() {
      syncWasm();
    },
  };
}

function peerSyncPlugin(): Plugin {
  // In-memory memory relay for local development across normal & incognito tabs
  const memoryStore: {
    posts: any[];
    peers: Record<string, any>;
    communities: Record<string, any>;
    chatMessages: Record<string, any[]>;
  } = {
    posts: [],
    peers: {},
    communities: {},
    chatMessages: {},
  };

  return {
    name: "peer-sync-plugin",
    configureServer(server) {
      server.ws.on("spruce:peer-event", (data: any, client: any) => {
        if (!data) return;

        if (data.type === "hello") {
          if (data.pubkey) {
            memoryStore.peers[data.pubkey] = data.profile || { display_name: "Anonymous" };
          }
          // Send all cached state to newly joined client
          client.send("spruce:sync-state", memoryStore);
        } else if (data.type === "post") {
          if (data.post && !memoryStore.posts.some((p: any) => p.id === data.post.id)) {
            memoryStore.posts.unshift(data.post);
            memoryStore.posts = memoryStore.posts.slice(0, 200);
          }
        } else if (data.type === "community") {
          if (data.community && data.community.id) {
            memoryStore.communities[data.community.id] = data.community;
          }
        } else if (data.type === "chat") {
          if (data.message && data.message.room_id) {
            if (!memoryStore.chatMessages[data.message.room_id]) {
              memoryStore.chatMessages[data.message.room_id] = [];
            }
            if (!memoryStore.chatMessages[data.message.room_id].some((m: any) => m.id === data.message.id)) {
              memoryStore.chatMessages[data.message.room_id].push(data.message);
            }
          }
        } else if (data.type === "chat_clear") {
          if (data.roomId && memoryStore.chatMessages[data.roomId]) {
            memoryStore.chatMessages[data.roomId] = [];
          }
        } else if (data.type === "chat_delete") {
          if (data.roomId && data.messageId && memoryStore.chatMessages[data.roomId]) {
            memoryStore.chatMessages[data.roomId] = memoryStore.chatMessages[data.roomId].filter(
              (m: any) => m.id !== data.messageId
            );
          }
        }

        // Broadcast to all other connected tabs/clients
        for (const other of server.ws.clients) {
          const rawSocket = (other as any).socket;
          const isReady = rawSocket ? rawSocket.readyState === 1 : true;
          if (other !== client && isReady) {
            try {
              other.send("spruce:peer-event", data);
            } catch (err) {
              console.error("[peer-relay] send error:", err);
            }
          }
        }
      });
    },
  };
}

// base "./": Freenet serves the app from a sandboxed iframe under a contract path.
export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      supported: {
        "top-level-await": true,
      },
    },
  },
  server: {
    port: 5173,
  },
  plugins: [desertAntWasmPlugin(), peerSyncPlugin()],
});
