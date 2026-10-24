// Downloads the Desert Ant moderator model into public/moderation/model/ so the app serves it itself: the Freenet
// gateway's CSP blocks Hugging Face at run time. Pinned to a revision and checked against its SHA-256.
// A failed download only warns (the app then blocks image uploads); a wrong hash fails the build.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const URL_ = process.env.MODERATION_MODEL_URL ?? "https://huggingface.co/desert-ant-labs/moderator/resolve/v1.0.0/moderator.tflite";
const SHA256 = "925d11966ea9086acbfeaf4d00c1dd30c738c531695f2004b68880d3f121cd89";
const SIZE = 9618016;
const dest = path.join(import.meta.dirname, "..", "public", "moderation", "model", "moderator.tflite");

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

if (fs.existsSync(dest) && sha(fs.readFileSync(dest)) === SHA256) {
  console.log("[moderation] model already in place");
} else {
  try {
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== SIZE || sha(buf) !== SHA256) {
      console.error(`[moderation] downloaded model does not match the pinned hash/size (${buf.length} bytes); not using it`);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    console.log(`[moderation] model downloaded (${buf.length} bytes)`);
  } catch (err) {
    console.warn(`[moderation] could not download the model (${err.message}). Image scanning will not work inside Freenet until ${dest} exists.`);
  }
}
