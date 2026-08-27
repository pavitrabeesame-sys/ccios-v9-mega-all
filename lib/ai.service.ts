import Groq from "groq-sdk";

import { validateReply } from "@/lib/ai/reply-validator";

const groq = process.env.GROQ_API_KEY
  ? new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  : null;

const TEMPLATES = [
  "Thank you for your support! We truly appreciate your kind feedback. 😊",
  "Thank you so much for your feedback! We truly appreciate your support. 🙌",
  "We really appreciate your support and kind feedback! Thank you for choosing us. 😊",
];

function cleanAIReply(text: unknown): string | null {
  let reply = String(text || "")
    .trim()
    .replace(/^```(?:text|plaintext)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["“”']+/, "")
    .replace(/["“”']+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!reply) {
    return null;
  }

  const validation = validateReply(reply);

  if (validation.valid && validation.cleanedReply) {
    return validation.cleanedReply;
  }

  return null;
}

async function generateWithGroq(
  prompt: string
): Promise<string> {
  if (!groq) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const model =
    process.env.GROQ_REVIEW_MODEL ||
    "llama-3.1-8b-instant";

  console.log(
    `[AI] Groq model → ${model}`
  );

  const response =
    await groq.chat.completions.create(
      {
        model,

        messages: [
          {
            role: "system",
            content: `
You are a professional ecommerce customer service representative.

Return ONLY the final seller reply to the customer.

Rules:
- One natural customer-facing reply.
- Maximum 2 sentences.
- Warm, sincere and professional.
- No explanation.
- No markdown.
- No bullet points.
- No quotation marks.
- Do not repeat the review.
- Do not mention AI.
- End with a complete sentence.
- Keep it approximately 20–45 words.
`.trim(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0.6,

        max_completion_tokens: 300,

        // IMPORTANT FOR GPT-OSS
        include_reasoning: false,

        reasoning_effort: "low",

        stream: false,
      },
      {
        timeout: 20000,
      }
    );

  const choice =
    response.choices?.[0];

  console.log(
    `[AI] Groq finish reason → ${
      choice?.finish_reason || "unknown"
    }`
  );

  console.log(
    `[AI] Groq usage →`,
    response.usage || {}
  );

  const raw =
    choice?.message?.content
      ?.trim() || "";

  console.log(
    `[AI] Groq raw length → ${raw.length}`
  );

  console.log(
    `[AI] Groq raw → ${raw}`
  );

  if (!raw) {
    throw new Error(
      `Groq returned empty content. finish_reason=${choice?.finish_reason || "unknown"}`
    );
  }

  const reply =
    cleanAIReply(raw);

  if (!reply) {
    throw new Error(
      `Groq generated an invalid reply. Raw response: ${raw}`
    );
  }

  return reply;
}

async function generateWithOllama(
  prompt: string
): Promise<string> {
  if (
    String(
      process.env.OLLAMA_ENABLED
    ).toLowerCase() !== "true"
  ) {
    throw new Error(
      "Ollama fallback is disabled."
    );
  }

  const baseUrl =
    process.env.OLLAMA_BASE_URL ||
    "http://localhost:11434";

  const model =
    process.env.OLLAMA_REVIEW_MODEL ||
    "qwen3:4b";

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    45000
  );

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/generate`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        signal: controller.signal,

        body: JSON.stringify({
          model,

          prompt: `
You are a professional ecommerce customer service representative.

Return ONLY the final seller reply.

Customer review:
${prompt}

Rules:
- One natural reply.
- Maximum 2 sentences.
- Warm and professional.
- No explanation.
- No markdown.
- Complete sentence.
`.trim(),

          stream: false,

          options: {
            temperature: 0.65,
            num_predict: 120,
          },
        }),
      }
    );

    if (!response.ok) {
      const text =
        await response.text();

      throw new Error(
        `Ollama HTTP ${response.status}: ${text}`
      );
    }

    const data =
      await response.json();

    const reply =
      cleanAIReply(
        data?.response || ""
      );

    if (!reply) {
      throw new Error(
        "Ollama generated an invalid reply."
      );
    }

    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateReply(
  prompt: string,
  brand = "Our Store"
): Promise<string> {
  const text =
    String(prompt || "").trim();

  if (!text) {
    return TEMPLATES[0];
  }

  // ==========================================================
  // GROQ PRIMARY
  // ==========================================================

  try {
    console.log(
      `[AI] Groq → ${brand}`
    );

    const reply =
      await generateWithGroq(text);

    console.log(
      `[AI] Groq SUCCESS → ${brand}`
    );

    return reply;
  } catch (error: unknown) {
    console.error(
      `[AI] Groq FAILED → ${brand}:`,
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  // ==========================================================
  // OLLAMA FALLBACK
  // ==========================================================

  try {
    console.log(
      `[AI] Ollama → ${brand}`
    );

    const reply =
      await generateWithOllama(text);

    console.log(
      `[AI] Ollama SUCCESS → ${brand}`
    );

    return reply;
  } catch (error: unknown) {
    console.error(
      `[AI] Ollama FAILED → ${brand}:`,
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  // ==========================================================
  // SAFE TEMPLATE
  // ==========================================================

  console.warn(
    `[AI] Groq + Ollama failed for ${brand}. Using safe template.`
  );

  return TEMPLATES[0];
}

export const generateAIReply =
  generateReply;