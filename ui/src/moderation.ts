import { Moderator, type Moderation } from "@desert-ant-labs/moderator";

let moderatorInstance: Moderator | null = null;
let loadPromise: Promise<Moderator | null> | null = null;

/**
 * Lazily loads the on-device Desert Ant Moderator model via WebAssembly & LiteRT.
 * Cached in browser cache after first load (~9-10 MB).
 */
export async function getModerator(): Promise<Moderator | null> {
  if (moderatorInstance) return moderatorInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      console.log("[Moderation] Loading Desert Ant on-device model...");
      moderatorInstance = await Moderator.load();
      console.log("[Moderation] Desert Ant Moderator loaded successfully on-device.");
      return moderatorInstance;
    } catch (err) {
      console.warn("[Moderation] Could not initialize @desert-ant-labs/moderator:", err);
      return null;
    }
  })();

  return loadPromise;
}

export interface ImageModerationResult {
  isNSFW: boolean;
  score: number;
  label: string;
  details?: Record<string, number>;
}

/**
 * Scans an image on-device using Desert Ant Moderator.
 * Accepts File, Blob, ImageBitmap or HTMLImageElement.
 */
export async function analyzeImageFile(
  fileOrBlob: Blob | File | HTMLImageElement
): Promise<ImageModerationResult> {
  try {
    const mod = await getModerator();
    if (!mod) {
      return { isNSFW: false, score: 0, label: "Unmoderated" };
    }

    let target: ImageBitmap | HTMLImageElement | Blob = fileOrBlob;
    if (typeof createImageBitmap !== "undefined" && (fileOrBlob instanceof Blob || fileOrBlob instanceof File)) {
      target = await createImageBitmap(fileOrBlob);
    }

    const res: Moderation = await mod.analyze(target, {
      threshold: 0.5,
      policy: "standard",
      quality: "balanced",
    });

    let topRegion = "";
    let maxRegionScore = 0;
    if (res.regions) {
      for (const [key, val] of Object.entries(res.regions)) {
        if (typeof val === "number" && val > maxRegionScore) {
          maxRegionScore = val;
          topRegion = key;
        }
      }
    }

    return {
      isNSFW: res.isNSFW,
      score: Math.round(res.score * 100) / 100,
      label: res.isNSFW ? `NSFW (${topRegion || "Explicit"})` : "Safe",
      details: res.regions as unknown as Record<string, number>,
    };
  } catch (err) {
    console.warn("[Moderation] Image analysis failed:", err);
    return { isNSFW: false, score: 0, label: "Check failed" };
  }
}

export interface TextCensorshipResult {
  censoredText: string;
  hasCensoredPII: boolean;
  hasCensoredProfanity: boolean;
  details: string[];
}

export interface TextModerationResult {
  isToxic: boolean;
  containsPII: boolean;
  warnings: string[];
}

/**
 * Automatically censors sensitive personal data (PII) like emails, phone numbers,
 * credit cards, IBANs, tax IDs, and bad words/profanities (Italian & English).
 */
export function censorTextAndPII(text: string): TextCensorshipResult {
  let censored = text;
  const details: string[] = [];
  let hasCensoredPII = false;
  let hasCensoredProfanity = false;

  // 1. Credit Card numbers (13 to 19 digits)
  const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  if (ccRegex.test(censored)) {
    const prev = censored;
    censored = censored.replace(ccRegex, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19) {
        hasCensoredPII = true;
        return "[💳 CARD DATA REDACTED]";
      }
      return match;
    });
    if (censored !== prev && !details.includes("Credit card / payment details")) {
      details.push("Credit card / payment details");
    }
  }

  // 2. IBAN numbers (IT + European formats)
  const ibanRegex = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/gi;
  if (ibanRegex.test(censored)) {
    hasCensoredPII = true;
    if (!details.includes("Bank IBAN number")) {
      details.push("Bank IBAN number");
    }
    censored = censored.replace(ibanRegex, "[🏦 IBAN REDACTED]");
  }

  // 3. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  if (emailRegex.test(censored)) {
    hasCensoredPII = true;
    if (!details.includes("Email address")) {
      details.push("Email address");
    }
    censored = censored.replace(emailRegex, "[📧 EMAIL REDACTED]");
  }

  // 4. Italian Codice Fiscale / Tax IDs (16 characters)
  const cfRegex = /\b[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]\b/gi;
  if (cfRegex.test(censored)) {
    hasCensoredPII = true;
    if (!details.includes("Tax ID / Codice Fiscale")) {
      details.push("Tax ID / Codice Fiscale");
    }
    censored = censored.replace(cfRegex, "[🪪 TAX ID REDACTED]");
  }

  // 5. Phone numbers (Italian + international)
  const phoneRegex = /(?:\+?39[\s.-]?)?(?:3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|0\d{1,4}[\s.-]?\d{5,8}|\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b)/g;
  if (phoneRegex.test(censored)) {
    const prev = censored;
    censored = censored.replace(phoneRegex, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) {
        hasCensoredPII = true;
        return "[📱 PHONE NUMBER REDACTED]";
      }
      return match;
    });
    if (censored !== prev && !details.includes("Phone number")) {
      details.push("Phone number");
    }
  }

  // 6. Bad words / profanities / hate speech (Italian + English)
  const badWords = [
    // Italiano
    "cazzo", "cazzi", "cazzata", "cazzate", "incazzare", "incazzato", "incazzata", "incazzati",
    "merda", "merde", "merdoso", "merdosa", "stronzo", "stronza", "stronzi", "stronze",
    "vaffanculo", "fanculo", "puttana", "puttane", "troia", "troie", "mignotta", "zoccola", "zoccole",
    "bastardo", "bastardi", "bastarda", "bastarde", "frocio", "froci", "finocchio", "negro", "negri",
    "coglione", "coglioni", "cogliona", "deficiente", "deficienti", "cretino", "cretina", "cretini",
    "idiota", "idioti", "porco dio", "porca madonna", "dio cane", "dio porco",
    // English
    "fuck", "fucking", "fucked", "fucker", "fuckers", "shit", "shitty", "bitch", "bitches",
    "asshole", "assholes", "bastard", "bastards", "nigger", "nigga", "faggot", "fag",
    "cunt", "dick", "pussy", "whore", "whores", "slut", "sluts", "nazi", "hitler",
    "kill yourself", "kys", "motherfucker"
  ];

  for (const word of badWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    if (regex.test(censored)) {
      hasCensoredProfanity = true;
      censored = censored.replace(regex, (m) => "*".repeat(m.length));
    }
  }

  if (hasCensoredProfanity) {
    details.push("Inappropriate language / profanity");
  }

  return {
    censoredText: censored,
    hasCensoredPII,
    hasCensoredProfanity,
    details,
  };
}

/**
 * Fast on-device check for Personally Identifiable Information (PII)
 * and severe toxic / abusive language.
 */
export function analyzeTextContent(text: string): TextModerationResult {
  const result = censorTextAndPII(text);
  return {
    isToxic: result.hasCensoredProfanity,
    containsPII: result.hasCensoredPII,
    warnings: result.details,
  };
}
