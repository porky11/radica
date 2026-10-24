// Deterministic, offline avatar generation and client-side image compression for Freenet dApps.

/**
 * Encodes an SVG string safely into a base64 Data URI.
 * Works seamlessly in both browser and Node.js test environments.
 */
function svgToBase64Uri(svg: string): string {
  try {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    }
    const globalBuffer = (globalThis as unknown as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer;
    if (globalBuffer) {
      return `data:image/svg+xml;base64,${globalBuffer.from(svg).toString("base64")}`;
    }
  } catch {}
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates a deterministic, modern SVG identicon/avatar as a Data URI.
 * 100% offline, requires zero network requests, and never fails inside Freenet's sandbox.
 */
export function generateDefaultAvatar(seed?: string): string {
  const safeSeed = (seed && typeof seed === "string" && seed.trim()) || "radica";

  let hash = 0;
  for (let i = 0; i < safeSeed.length; i++) {
    hash = (hash << 5) - hash + safeSeed.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  const hue1 = absHash % 360;
  const hue2 = (hue1 + 40 + (absHash % 80)) % 360;
  const hue3 = (hue1 + 180) % 360;

  const color1 = `hsl(${hue1}, 78%, 48%)`;
  const color2 = `hsl(${hue2}, 85%, 32%)`;
  const color3 = `hsl(${hue3}, 75%, 58%)`;

  const cx1 = 20 + (absHash % 35);
  const cy1 = 20 + ((absHash >> 3) % 35);
  const r1 = 25 + ((absHash >> 5) % 20);

  const cx2 = 65 + ((absHash >> 7) % 25);
  const cy2 = 65 + ((absHash >> 9) % 25);
  const r2 = 20 + ((absHash >> 11) % 20);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="g_${absHash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
    <clipPath id="c_${absHash}">
      <circle cx="50" cy="50" r="50"/>
    </clipPath>
  </defs>
  <g clip-path="url(#c_${absHash})">
    <rect width="100" height="100" fill="url(#g_${absHash})"/>
    <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${color3}" opacity="0.35"/>
    <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="#ffffff" opacity="0.2"/>
    <!-- Minimalist persona silhouette -->
    <circle cx="50" cy="38" r="16" fill="#ffffff" opacity="0.94"/>
    <ellipse cx="50" cy="82" rx="28" ry="20" fill="#ffffff" opacity="0.94"/>
  </g>
</svg>`;

  return svgToBase64Uri(svg);
}

/**
 * Resizes, center-crops, and compresses a user-uploaded image file
 * into a lightweight JPEG Data URI (~2-5 KB) suitable for decentralized Freenet state.
 */
export async function compressAvatarFile(file: File, maxDim = 64, quality = 0.55): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Selected file is not an image"));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return reject(new Error("Could not acquire 2D canvas context"));
          }

          // Smooth resampling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Center-crop to a square
          const minDim = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - minDim) / 2;
          const sy = (img.naturalHeight - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDim, maxDim);

          // Try WebP first for optimal byte-efficiency, fallback to JPEG
          let dataUrl = "";
          try {
            const webp = canvas.toDataURL("image/webp", quality);
            if (webp.startsWith("data:image/webp")) {
              dataUrl = webp;
            }
          } catch {}
          if (!dataUrl) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const POST_IMAGE_MAX_CHARS = 400_000; // data: URI length; the contract accepts up to 768 KB

/**
 * Resizes and compresses an image for a Moment post while preserving aspect ratio:
 * at most 1024 px on the long side, typically 50-200 KB. shortcut: too big for the sandbox URL-hash cache
 * (SafeStorage drops it from there), so a reload before the network answers shows no image; shrink if that matters.
 */
export async function compressPostImageFile(
  fileOrUrl: File | Blob | string,
  maxDim = 1024,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's an external web URL or contract path, preserve it directly without re-encoding!
    if (typeof fileOrUrl === "string") {
      const trimmed = fileOrUrl.trim();
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("/v1/") ||
        trimmed.startsWith("/v2/")
      ) {
        return resolve(trimmed);
      }
    }

    const processImage = (src: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onerror = () => reject(new Error("Failed to load image for post compression"));
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(src);
          }

          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          // WebP when the browser can encode it, else JPEG
          const encode = (w: number, h: number): string => {
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return src;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, w, h);
            try {
              const webp = canvas.toDataURL("image/webp", quality);
              if (webp.startsWith("data:image/webp")) return webp;
            } catch {}
            return canvas.toDataURL("image/jpeg", quality);
          };

          // Stay well under the contract's MAX_MEDIA (768 KB): shrink step by step until it fits
          let compressed = encode(width, height);
          for (let scale = 0.75; compressed.length > POST_IMAGE_MAX_CHARS && scale > 0.2; scale -= 0.25) {
            compressed = encode(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
          }

          resolve(compressed);
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };

    if (typeof fileOrUrl === "string") {
      processImage(fileOrUrl);
    } else {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => processImage(reader.result as string);
      reader.readAsDataURL(fileOrUrl);
    }
  });
}

