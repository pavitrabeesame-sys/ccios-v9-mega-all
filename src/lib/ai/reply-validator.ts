export type ReplyValidationCode =
  | "VALID"
  | "EMPTY"
  | "INCOMPLETE_PHRASE"
  | "INSUFFICIENT_TOPICS"
  | "TOO_GENERIC"
  | "TOO_LONG"
  | "TOO_MANY_SENTENCES"
  | "PROMPT_LEAK"
  | "PLACEHOLDER"
  | "META_RESPONSE"
  | "OTHER";

export interface ReplyValidationResult {
  valid: boolean;
  code: ReplyValidationCode;
  cleanedReply?: string;
  reason?: string;
}

// ============================================================
// NORMALIZE
// ============================================================

export function normalizeReply(reply: string): string {
  return String(reply || "")
    .trim()
    .replace(/```(?:text|plaintext)?/gi, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// PLACEHOLDERS
// ============================================================

const PLACEHOLDERS = [
  "[Company Name]",
  "[Your Company Name]",
  "[Customer Service Team]",
  "[Your Customer Service Team]",
  "[Customer Service]",
  "[Brand Name]",
  "[Store Name]",
  "[Customer Name]",
  "[Product Name]",
  "[Name]",
  "{{company_name}}",
  "{{brand_name}}",
  "{{customer_name}}",
  "{{product_name}}",
];

// ============================================================
// PROMPT LEAK DETECTION
// ============================================================

const PROMPT_LEAK_PATTERNS: RegExp[] = [
  /we are writing a response/i,
  /we need to write/i,
  /write a short/i,
  /write a natural/i,
  /write a warm/i,
  /customer review for/i,
  /the customer rated/i,
  /the customer wrote/i,
  /address the points/i,
  /match the customer's language/i,
  /to match the customer's language/i,
  /malaysian malay customer/i,
  /malaysian customer review/i,
  /generate a response/i,
  /generate the response/i,
  /respond to the customer/i,
  /reply to the customer/i,
  /create a response/i,
  /create the response/i,
  /here is the response/i,
  /here's the response/i,
  /here is a suggested reply/i,
  /suggested reply/i,
  /instruction/i,
  /instructions:/i,
  /requirements:/i,
  /task:/i,
  /context:/i,
  /review context/i,
  /rating:/i,
  /customer said:/i,
  /customer comment:/i,
  /response should/i,
  /reply should/i,
  /make sure to/i,
  /we should/i,
  /you should/i,
];

// ============================================================
// META RESPONSE
// ============================================================

const META_PATTERNS: RegExp[] = [
  /^sure[!,.:]/i,
  /^of course[!,.:]/i,
  /^certainly[!,.:]/i,
  /^here is/i,
  /^here's/i,
  /^the response is/i,
  /^response:/i,
  /^reply:/i,
  /^answer:/i,
  /^output:/i,
];

// ============================================================
// PLACEHOLDER CHECK
// ============================================================

function containsPlaceholder(text: string): boolean {
  if (
    PLACEHOLDERS.some((placeholder) =>
      text
        .toLowerCase()
        .includes(placeholder.toLowerCase())
    )
  ) {
    return true;
  }

  if (/\[[^\]]+\]/.test(text)) {
    return true;
  }

  if (/\{\{[^}]+\}\}/.test(text)) {
    return true;
  }

  return false;
}

// ============================================================
// PROMPT LEAK CHECK
// ============================================================

function containsPromptLeak(text: string): boolean {
  return PROMPT_LEAK_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

// ============================================================
// META CHECK
// ============================================================

function containsMetaResponse(text: string): boolean {
  return META_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

// ============================================================
// INDONESIAN REPAIR
// ============================================================

export function repairCommonIndonesianOpening(
  reply: string
): string {
  let text = normalizeReply(reply);

  if (!text) {
    return text;
  }

  text = text.replace(
    /^terima kasih atas[.!?,]?$/i,
    "Terima kasih sudah berbelanja di toko kami."
  );

  text = text.replace(
    /^terima kasih atas\.{2,}$/i,
    "Terima kasih sudah berbagi pengalaman."
  );

  text = text.replace(
    /^terima kasih atas[.!?,]+\s+/i,
    "Terima kasih sudah berbagi pengalaman. "
  );

  text = text.replace(
    /^terima kasih atas\s+(dan|tapi|namun|semoga|untuk)\b/i,
    "Terima kasih sudah berbelanja "
  );

  return text
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// EMOJI
// ============================================================

function countEmojis(text: string): number {
  const matches = text.match(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
  );

  return matches ? matches.length : 0;
}

// ============================================================
// SENTENCE COUNT
// ============================================================

function countSentences(text: string): number {
  const matches = text.match(/[.!?。！？]+(?=\s|$)/g);

  return matches ? matches.length : 1;
}

// ============================================================
// VALIDATE
// ============================================================

export function validateReply(
  rawReply: string,
  reviewContext?: {
    comment?: string;
    rating?: number;
  }
): ReplyValidationResult {
  if (
    !rawReply ||
    !String(rawReply).trim()
  ) {
    return {
      valid: false,
      code: "EMPTY",
      reason: "Reply is empty or whitespace only.",
    };
  }

  let cleaned =
    repairCommonIndonesianOpening(rawReply);

  if (!cleaned) {
    return {
      valid: false,
      code: "EMPTY",
      reason: "Reply is empty after normalization.",
    };
  }

  // ==========================================================
  // PROMPT LEAK
  // ==========================================================

  if (containsPromptLeak(cleaned)) {
    return {
      valid: false,
      code: "PROMPT_LEAK",
      reason:
        "Reply contains AI generation instructions or prompt text.",
    };
  }

  // ==========================================================
  // META RESPONSE
  // ==========================================================

  if (containsMetaResponse(cleaned)) {
    return {
      valid: false,
      code: "META_RESPONSE",
      reason:
        "Reply appears to be an AI meta-response rather than a customer-facing reply.",
    };
  }

  // ==========================================================
  // PLACEHOLDERS
  // ==========================================================

  if (containsPlaceholder(cleaned)) {
    return {
      valid: false,
      code: "PLACEHOLDER",
      reason:
        "Reply contains placeholder or template text.",
    };
  }

  // ==========================================================
  // INCOMPLETE PHRASES
  // ==========================================================

  const lower = cleaned.toLowerCase();

  if (
    lower === "terima kasih atas" ||
    lower.startsWith("terima kasih atas.") ||
    lower.startsWith("terima kasih atas,") ||
    lower.endsWith("terima kasih atas")
  ) {
    return {
      valid: false,
      code: "INCOMPLETE_PHRASE",
      reason:
        'Unnatural/incomplete phrase detected: "terima kasih atas".',
    };
  }

  // ==========================================================
  // LENGTH
  // ==========================================================

  if (cleaned.length < 15) {
    return {
      valid: false,
      code: "TOO_GENERIC",
      reason:
        "Reply is too short to be meaningful.",
    };
  }

  if (cleaned.length > 500) {
    return {
      valid: false,
      code: "TOO_LONG",
      reason:
        "Reply exceeds maximum allowable length.",
    };
  }

  // ==========================================================
  // SENTENCE LIMIT
  // ==========================================================

  const sentenceCount =
    countSentences(cleaned);

  if (sentenceCount > 2) {
    return {
      valid: false,
      code: "TOO_MANY_SENTENCES",
      reason:
        "Reply contains more than 2 sentences.",
    };
  }

  // ==========================================================
  // EMOJI LIMIT
  // ==========================================================

  if (countEmojis(cleaned) > 2) {
    return {
      valid: false,
      code: "OTHER",
      reason:
        "Reply contains more than 2 emojis.",
    };
  }

  // ==========================================================
  // STRUCTURED AI OUTPUT
  // ==========================================================

  if (
    cleaned.includes("•") &&
    cleaned.length > 150
  ) {
    return {
      valid: false,
      code: "META_RESPONSE",
      reason:
        "Reply appears to contain structured AI instructions.",
    };
  }

  // ==========================================================
  // REVIEW-SPECIFIC SAFETY
  // ==========================================================

  if (reviewContext?.comment) {
    const comment =
      String(reviewContext.comment)
        .trim();

    // Do not force exact keyword matching.
    // AI replies can legitimately paraphrase the review.
    //
    // This section intentionally remains soft.
    if (
      comment.length > 0 &&
      cleaned.length < 15
    ) {
      return {
        valid: false,
        code: "INSUFFICIENT_TOPICS",
        reason:
          "Reply does not contain enough meaningful content for the review.",
      };
    }
  }

  // ==========================================================
  // VALID
  // ==========================================================

  return {
    valid: true,
    code: "VALID",
    cleanedReply: cleaned,
    reason: "Passed validation.",
  };
}