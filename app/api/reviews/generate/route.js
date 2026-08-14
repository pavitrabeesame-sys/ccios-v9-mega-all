import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";
import { askGroq } from "@/src/services/ai/GroqService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
============================================================
CCIOS REVIEW AI GENERATOR
Single-review generation
============================================================

Gemini
  ↓
Groq fallback
  ↓
Clean response
  ↓
Basic safety validation
  ↓
Save GENERATED

Goals:
- Natural Shopee seller reply
- Review-specific
- Brand-aware
- Same language as customer
- No fixed 35-word minimum
- No artificial long replies
- No markdown / emoji / headers
- Complete sentence
============================================================
*/

const MAX_ATTEMPTS = 2;

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function errorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function errorText(error) {
  return errorMessage(error).toLowerCase();
}

function isRateLimit(error) {
  const text = errorText(error);

  return (
    text.includes("429") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("resource_exhausted") ||
    text.includes("tokens per day") ||
    text.includes("daily token") ||
    text.includes("tpd")
  );
}

/*
============================================================
BRAND VOICE
============================================================
*/

const BRAND_CONFIG = {
  RAV: {
    name: "RAV Design",
    voice:
      "Premium, masculine, rugged yet sophisticated. Natural, confident and refined.",
  },

  "RAV DESIGN": {
    name: "RAV Design",
    voice:
      "Premium, masculine, rugged yet sophisticated. Natural, confident and refined.",
  },

  NICOLE: {
    name: "Nicole Collection",
    voice:
      "Elegant, feminine, modern and refined. Warm, graceful and natural.",
  },

  "NICOLE COLLECTION": {
    name: "Nicole Collection",
    voice:
      "Elegant, feminine, modern and refined. Warm, graceful and natural.",
  },

  "HUSH PUPPIES": {
    name: "Hush Puppies Accessories",
    voice:
      "Friendly, warm, trustworthy and professional. Comfortable and approachable.",
  },

  "HUSH PUPPIES ACCESSORIES": {
    name: "Hush Puppies Accessories",
    voice:
      "Friendly, warm, trustworthy and professional. Comfortable and approachable.",
  },

  OBERMAIN: {
    name: "Obermain",
    voice:
      "Premium, refined and practical. Sophisticated but still warm and natural.",
  },

  "OBERMAIN ACCESSORIES OFFICIAL STORE": {
    name: "Obermain",
    voice:
      "Premium, refined and practical. Sophisticated but still warm and natural.",
  },

  "JOHN LANGFORD": {
    name: "JOHN LANGFORD OF LONDON",
    voice:
      "Classic, formal, sophisticated and timeless. Polished but warm.",
  },

  "JOHN LANGFORD OF LONDON": {
    name: "JOHN LANGFORD OF LONDON",
    voice:
      "Classic, formal, sophisticated and timeless. Polished but warm.",
  },
};

function getBrand(rawBrand) {
  const key = String(rawBrand || "")
    .trim()
    .toUpperCase();

  return (
    BRAND_CONFIG[key] || {
      name: rawBrand || "Our Store",
      voice:
        "Warm, professional, genuine and customer-focused.",
    }
  );
}

/*
============================================================
LANGUAGE
============================================================
*/

function detectLanguage(text) {
  const value = String(text || "").trim();

  if (!value) return "English";

  if (/[\u3400-\u9fff]/.test(value)) {
    return "Simplified Chinese";
  }

  const malayWords = [
    "sangat",
    "bagus",
    "cantik",
    "terima",
    "kasih",
    "kualiti",
    "barang",
    "produk",
    "sampai",
    "cepat",
    "penghantaran",
    "puas",
    "hati",
    "sesuai",
    "selesa",
    "harga",
    "berbaloi",
    "kemas",
    "seller",
    "penjual",
  ];

  const lower = value.toLowerCase();

  const matches = malayWords.filter((word) => {
    return new RegExp(`\\b${word}\\b`, "i").test(lower);
  }).length;

  if (matches >= 2) {
    return "Malaysian Malay";
  }

  return "English";
}

/*
/* ============================================================
   PROMPT
   ============================================================ */

function buildPrompt(review, attempt = 1) {
  const reviewText = String(
    review.reviewText || ""
  ).trim();

  const rating =
    Number(review.rating) || 5;

  const brand = getBrand(
    review.brand ||
      review.storeName
  );

  const language =
    detectLanguage(reviewText);

  let languageRule = "";

  if (
    language ===
    "Simplified Chinese"
  ) {
    languageRule =
      "Reply naturally in Simplified Chinese.";
  } else if (
    language ===
    "Malaysian Malay"
  ) {
    languageRule =
      "Reply naturally in Malaysian Malay. Do not translate English word-for-word.";
  } else {
    languageRule =
      "Reply naturally in English.";
  }

  return `
You are the official Shopee customer-service representative for ${brand.name}.

BRAND VOICE:
${brand.voice}

CUSTOMER RATING:
${rating}/5

CUSTOMER REVIEW:
"${reviewText}"

LANGUAGE:
${languageRule}

YOUR JOB:
Write a natural seller reply specifically for this customer review.

VERY IMPORTANT:

- Read the actual review carefully.
- Reply to what the customer actually said.
- Do not use a generic reply when the customer mentioned something specific.
- If they praised quality, acknowledge quality.
- If they praised material, acknowledge material.
- If they mentioned design, acknowledge design.
- If they mentioned size or fit, acknowledge it naturally.
- If they mentioned delivery, acknowledge delivery only if they actually mentioned it.
- If they mentioned a problem, acknowledge the problem politely.
- Never invent information.
- Never promise something that was not stated.
- Never argue with the customer.
- Never blame the customer.

BRAND MENTION — REQUIRED:

- You MUST naturally mention the brand name "${brand.name}" in the reply.
- Mention the brand naturally inside a normal customer-facing sentence.
- Do NOT put the brand as a heading.
- Do NOT write "${brand.name}:" at the beginning.
- Mention the brand once unless repeating it is genuinely natural.
- The reply must still sound like a real seller, not an advertisement.

STYLE:

- Sound like a real human Shopee seller.
- Warm.
- Natural.
- Professional.
- Personal.
- Short and concise.
- Normally 1-2 short sentences.
- Target approximately 10-40 words.
- Do NOT force every reply to exactly the same length.
- A simple review can receive a simple reply.
- A detailed review can receive a slightly fuller reply.
- Thank the customer naturally.
- For positive reviews, acknowledge what they liked.
- Do not write long corporate-style paragraphs.

EMOJI:

- MUST include 1 natural emoji.
- You may use 2 natural emojis when appropriate.
- Use emojis naturally, not excessively.
- Do not put emojis on every word or sentence.

DO NOT USE:

- hashtags
- markdown
- bullet points
- headings
- "Reply:"
- "AI Generated:"
- quotation marks around the whole response
- fake claims
- excessive marketing language
- repetitive filler
- overly formal corporate language

AVOID OVERUSING:

"We are delighted to hear"
"We truly appreciate"
"wonderful review"
"positive experience"
"commitment to excellence"

IMPORTANT:

The response should feel individually written for this customer.

Example style only:

"Thank you for choosing ${brand.name} and for your 5-star rating! We’re happy to know you enjoyed the quality. 😊"

Do NOT copy the example word-for-word.
Use it only as a style reference.

OUTPUT:

Return ONLY the final customer-facing reply.

Attempt ${attempt}.

${
  attempt > 1
    ? `
The previous response was rejected.

Rewrite the reply.

Make sure:
- The brand name "${brand.name}" is included naturally.
- The reply addresses the actual customer review.
- The reply contains 1-2 natural emojis.
- The reply is short and natural.
- The reply is complete.
- The reply ends with proper punctuation.

Return ONLY the corrected customer reply.
`
    : ""
}
`.trim();
}

/*
============================================================
GEMINI
============================================================
*/

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash-lite";

  if (
    !apiKey ||
    apiKey === "YOUR_GEMINI_API_KEY"
  ) {
    throw new Error(
      "Gemini API key is not configured."
    );
  }

  // FIXED: No template literals to avoid markdown-link bugs
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey);

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You write natural, complete Shopee customer-service replies. Return only the final reply. Never return analysis, headings, markdown or emojis.",
          },
        ],
      },

      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      generationConfig: {
        temperature: 0.45,
        topP: 0.9,
        maxOutputTokens: 250,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Gemini ${response.status}: ${error}`
    );
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return text;
}

/*
============================================================
GROQ
============================================================
*/

async function askGroqSafe(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (
    !apiKey ||
    apiKey === "YOUR_GROQ_API_KEY"
  ) {
    throw new Error(
      "Groq API key is not configured."
    );
  }

  const reply = await askGroq(prompt);

  if (!reply || !reply.trim()) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  return reply.trim();
}

/*
============================================================
CLEAN RESPONSE
============================================================
*/

function cleanReply(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  let reply = text.trim();

  // Remove code fences.
  reply = reply
    .replace(/^```[a-zA-Z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Remove common labels.
  reply = reply
    .replace(
      /^(reply|response|answer|ai reply)\s*:\s*/i,
      ""
    )
    .trim();

  // Remove wrapping quotes.
  reply = reply
    .replace(/^["“”']+/, "")
    .replace(/["“”']+$/, "")
    .trim();

  // Remove accidental brand header.
  reply = reply.replace(
    /^(RAV Design|RAV|Nicole Collection|Nicole|Hush Puppies Accessories|Hush Puppies|Obermain|Obermain Accessories Official Store|JOHN LANGFORD OF LONDON|JOHN LANGFORD)\s*[:\-–—]\s*/i,
    ""
  );

  // Normalize whitespace.
  reply = reply.replace(/\s+/g, " ").trim();

  return reply;
}

/*
============================================================
VALIDATION
============================================================
*/

function validateReply(text, reviewText) {
  const reply = cleanReply(text);

  if (!reply) {
    return {
      valid: false,
      reason: "Empty reply.",
    };
  }

  // No markdown.
  if (
    /```/.test(reply) ||
    /^\s*[-•]\s+/m.test(reply) ||
    /\[[^\]]+\]\([^)]+\)/.test(reply)
  ) {
    return {
      valid: false,
      reason: "Markdown detected.",
    };
  }

  // No emoji.
  if (/[\p{Extended_Pictographic}]/u.test(reply)) {
    return {
      valid: false,
      reason: "Emoji detected.",
    };
  }

  // Must have a proper ending.
  if (!/[.!?]$/.test(reply)) {
    return {
      valid: false,
      reason: "Missing terminal punctuation.",
    };
  }

  // Don't allow obvious unfinished endings.
  const ending = reply
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();

  const words = ending.split(/\s+/);

  const lastWord =
    words[words.length - 1];

  const forbiddenEndings = [
    "to",
    "for",
    "that",
    "and",
    "because",
    "if",
    "when",
    "our",
    "your",
    "the",
    "we",
    "is",
    "are",
    "with",
    "of",
    "in",
    "on",
  ];

  if (forbiddenEndings.includes(lastWord)) {
    return {
      valid: false,
      reason:
        `Incomplete ending: ${lastWord}`,
    };
  }

  // Extremely short output is almost certainly broken.
  if (reply.length < 20) {
    return {
      valid: false,
      reason: "Reply is too short.",
    };
  }

  // If the review is detailed, don't accept a tiny generic answer.
  const reviewWords = String(reviewText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (
    reviewWords.length >= 8 &&
    reply.split(/\s+/).length < 8
  ) {
    return {
      valid: false,
      reason:
        "Reply is too short for the customer's detailed review.",
    };
  }

  return {
    valid: true,
    reply,
  };
}

/*
============================================================
NO COMMENT
============================================================
*/

function noCommentReply(rating, brandName) {
  if (rating >= 5) {
    return `Thank you so much for your 5-star rating and for choosing ${brandName}. We really appreciate your support and hope you continue to enjoy your purchase.`;
  }

  if (rating === 4) {
    return `Thank you for your 4-star rating and for choosing ${brandName}. We appreciate your support and are glad to know you had a positive experience with your purchase.`;
  }

  if (rating === 3) {
    return `Thank you for taking the time to leave us a rating. We appreciate your feedback and will continue working to provide an even better experience.`;
  }

  if (rating === 2) {
    return `Thank you for sharing your rating with us. We are sorry that your experience did not fully meet expectations and appreciate the opportunity to improve.`;
  }

  return `Thank you for your feedback. We are sorry that your experience did not meet expectations and appreciate the opportunity to serve you better.`;
}

/*
============================================================
POST
============================================================
*/

export async function POST(req) {
  try {
    let body = {};

    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const reviewId = body.reviewId;

    let review = null;

    /*
    ----------------------------------------------------------
    Load review from DB when reviewId supplied.
    ----------------------------------------------------------
    */

    if (reviewId) {
      review = await db.review.findUnique({
        where: {
          id: reviewId,
        },
      });
    }

    /*
    ----------------------------------------------------------
    Otherwise accept review data from request.
    ----------------------------------------------------------
    */

    if (!review) {
      review = {
        id: reviewId || null,
        reviewText: body.reviewText || "",
        rating: body.rating || 5,
        brand:
          body.brand ||
          body.brandName ||
          body.storeName ||
          "",
        storeName:
          body.storeName || "",
      };
    }

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error: "Review not found.",
        },
        {
          status: 404,
        }
      );
    }

    const reviewText =
      String(review.reviewText || "").trim();

    const rating =
      Number(review.rating) || 5;

    const brand = getBrand(
      review.brand ||
        review.storeName ||
        ""
    );

    /*
    ----------------------------------------------------------
    NO COMMENT
    ----------------------------------------------------------
    */

    if (!reviewText) {
      const reply = noCommentReply(
        rating,
        brand.name
      );

      if (review.id) {
        await db.review.update({
          where: {
            id: review.id,
          },

          data: {
            aiReply: reply,
            status: "GENERATED",
          },
        });
      }

      return NextResponse.json({
        success: true,
        generatedReply: reply,
        brand: brand.name,
        provider: "template",
      });
    }

    /*
    ----------------------------------------------------------
    AI GENERATION
    ----------------------------------------------------------
    */

    let geminiQuotaExhausted = false;
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= MAX_ATTEMPTS;
      attempt++
    ) {
      const prompt = buildPrompt(
        review,
        attempt
      );

      let rawReply = null;

      /*
      --------------------------------------------------------
      Gemini
      --------------------------------------------------------
      */

      if (!geminiQuotaExhausted) {
        try {
          console.log(
            `[AI] Trying Gemini, attempt ${attempt}`
          );

          rawReply =
            await askGemini(prompt);

          console.log(
            "[AI] SUCCESS: Gemini"
          );
        } catch (error) {
          lastError =
            errorMessage(error);

          console.error(
            "[AI] Gemini failed:",
            lastError
          );

          if (isRateLimit(error)) {
            geminiQuotaExhausted = true;
          }
        }
      }

      /*
      --------------------------------------------------------
      Groq
      --------------------------------------------------------
      */

      if (!rawReply) {
        try {
          console.log(
            `[AI] Trying Groq, attempt ${attempt}`
          );

          rawReply =
            await askGroqSafe(prompt);

          console.log(
            "[AI] SUCCESS: Groq"
          );
        } catch (error) {
          lastError =
            errorMessage(error);

          console.error(
            "[AI] Groq failed:",
            lastError
          );
        }
      }

      /*
      --------------------------------------------------------
      Validate
      --------------------------------------------------------
      */

      if (rawReply) {
        const validation =
          validateReply(
            rawReply,
            reviewText
          );

        if (validation.valid) {
          const finalReply =
            validation.reply;

          if (review.id) {
            await db.review.update({
              where: {
                id: review.id,
              },

              data: {
                aiReply: finalReply,
                status: "GENERATED",
              },
            });
          }

          console.log(
            `[AI] VALIDATED: ${finalReply}`
          );

          return NextResponse.json({
            success: true,
            generatedReply: finalReply,
            brand: brand.name,
            provider:
              geminiQuotaExhausted
                ? "groq"
                : "gemini",
          });
        }

        lastError =
          validation.reason;

        console.warn(
          `[AI] Response rejected: ${validation.reason}`
        );
      }

      if (attempt < MAX_ATTEMPTS) {
        await delay(500);
      }
    }

    /*
    ----------------------------------------------------------
    Failed safely
    ----------------------------------------------------------
    */

    return NextResponse.json(
      {
        success: false,
        error:
          lastError ||
          "AI generation failed validation.",
      },
      {
        status: 422,
      }
    );
  } catch (error) {
    console.error(
      "[AI] FATAL:",
      errorMessage(error)
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}