// src/services/ai/GroqService.js

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const META_API_URL =
  "https://api.llama.com/v1/chat/completions";

const OLLAMA_API_URL =
  process.env.OLLAMA_API_URL ||
  "http://127.0.0.1:11434/api/chat";

// ============================================================
// MODELS
// ============================================================

const GEMINI_MODEL =
  String(
    process.env.GEMINI_MODEL ||
      "gemini-2.5-flash-lite"
  )
    .trim()
    .replace(/['"]/g, "");

const GROQ_MODEL =
  String(
    process.env.GROQ_MODEL ||
      "openai/gpt-oss-20b"
  )
    .trim()
    .replace(/['"]/g, "");

const META_MODEL =
  String(
    process.env.META_MODEL ||
      "Llama-4-Maverick-17B-128E-Instruct-FP8"
  )
    .trim()
    .replace(/['"]/g, "");

const OLLAMA_MODEL =
  String(
    process.env.OLLAMA_MODEL ||
      "qwen3:4b"
  )
    .trim()
    .replace(/['"]/g, "");

// ============================================================
// PERFORMANCE
// ============================================================

const REQUEST_TIMEOUT_MS = 120000;
const OLLAMA_TIMEOUT_MS = 120000;

const GEMINI_MAX_TOKENS = 500;
const GROQ_MAX_TOKENS = 250;
const META_MAX_TOKENS = 250;
const OLLAMA_MAX_TOKENS = 120;

const TEMPERATURE = 0.3;

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT =
  "You are a professional ecommerce customer service assistant. " +
  "Return ONLY the final customer reply. " +
  "Never explain. Never output reasoning. " +
  "Never mention AI, models, prompts, automation, or internal systems.";

// ============================================================
// HELPERS
// ============================================================

function cleanReply(text) {
  if (!text) {
    return "";
  }

  let result = String(text).trim();

  result = result
    .replace(
      /^```(?:text|markdown|plaintext)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  result = result.replace(
    /^(final customer reply|customer reply|reply|response):\s*/i,
    ""
  );

  result = result
    .replace(/^["“”']+/, "")
    .replace(/["“”']+$/, "")
    .trim();

  return result;
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,

    clear() {
      clearTimeout(timeout);
    },
  };
}

function extractErrorMessage(data, fallback) {
  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (data.error) {
    if (typeof data.error === "string") {
      return data.error;
    }

    if (data.error.message) {
      return data.error.message;
    }
  }

  if (data.message) {
    return data.message;
  }

  return fallback;
}

// ============================================================
// GEMINI
// ============================================================

async function askGemini(prompt) {
  const apiKey =
    String(
      process.env.GEMINI_API_KEY || ""
    )
      .trim()
      .replace(/['"]/g, "");

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const url =
    `${GEMINI_API_URL}/${GEMINI_MODEL}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const timeout =
    createTimeoutSignal(
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: SYSTEM_PROMPT,
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
            temperature:
              TEMPERATURE,

            maxOutputTokens:
              GEMINI_MAX_TOKENS,

            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),

        signal: timeout.signal,
      });

    const rawText =
      await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          data,
          `Gemini API error (${response.status})`
        )
      );
    }

    const parts =
      data?.candidates?.[0]
        ?.content?.parts || [];

    const text =
      parts
        .map(
          (part) =>
            part?.text || ""
        )
        .join("")
        .trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    return cleanReply(text);
  } finally {
    timeout.clear();
  }
}

// ============================================================
// GROQ
// ============================================================

async function askGroqFallback(prompt) {
  const apiKey =
    String(
      process.env.GROQ_API_KEY || ""
    )
      .trim()
      .replace(/['"]/g, "");

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const timeout =
    createTimeoutSignal(
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        GROQ_API_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              GROQ_MODEL,

            messages: [
              {
                role: "system",

                content:
                  SYSTEM_PROMPT,
              },

              {
                role: "user",

                content:
                  prompt,
              },
            ],

            reasoning_effort:
              "low",

            temperature:
              TEMPERATURE,

            max_tokens:
              GROQ_MAX_TOKENS,
          }),

          signal:
            timeout.signal,
        }
      );

    const rawText =
      await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          data,
          `Groq API error (${response.status})`
        )
      );
    }

    const reply =
      data?.choices?.[0]
        ?.message?.content;

    if (
      !reply ||
      !String(reply).trim()
    ) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    return cleanReply(reply);
  } finally {
    timeout.clear();
  }
}

// ============================================================
// META LLAMA API
// ============================================================

async function askMeta(prompt) {
  const apiKey =
    String(
      process.env.META_LLAMA_API_KEY ||
        process.env.LLAMA_API_KEY ||
        process.env.MODEL_API_KEY ||
        ""
    )
      .trim()
      .replace(/['"]/g, "");

  if (!apiKey) {
    throw new Error(
      "META_LLAMA_API_KEY is not configured."
    );
  }

  const timeout =
    createTimeoutSignal(
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        META_API_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              META_MODEL,

            messages: [
              {
                role: "system",

                content:
                  SYSTEM_PROMPT,
              },

              {
                role: "user",

                content:
                  prompt,
              },
            ],

            temperature:
              TEMPERATURE,

            max_tokens:
              META_MAX_TOKENS,
          }),

          signal:
            timeout.signal,
        }
      );

    const rawText =
      await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          data,
          `Meta Llama API error (${response.status})`
        )
      );
    }

    const reply =
      data?.choices?.[0]
        ?.message?.content;

    if (
      !reply ||
      !String(reply).trim()
    ) {
      throw new Error(
        "Meta Llama returned an empty response."
      );
    }

    return cleanReply(reply);
  } finally {
    timeout.clear();
  }
}

// ============================================================
// OLLAMA
// ============================================================

async function askOllama(prompt) {
  const timeout =
    createTimeoutSignal(
      OLLAMA_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        OLLAMA_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              OLLAMA_MODEL,

            stream:
              false,

            think:
              false,

            messages: [
              {
                role: "system",

                content:
                  SYSTEM_PROMPT,
              },

              {
                role: "user",

                content:
                  prompt,
              },
            ],

            options: {
              temperature:
                TEMPERATURE,

              num_predict:
                OLLAMA_MAX_TOKENS,
            },
          }),

          signal:
            timeout.signal,
        }
      );

    const rawText =
      await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(
          data,
          `Ollama API error (${response.status})`
        )
      );
    }

    const reply =
      data?.message?.content;

    if (
      !reply ||
      !String(reply).trim()
    ) {
      throw new Error(
        "Ollama returned an empty response."
      );
    }

    return cleanReply(reply);
  } finally {
    timeout.clear();
  }
}

// ============================================================
// MAIN AI GATEWAY
//
// META → GEMINI → GROQ → OLLAMA
// ============================================================

export async function askGroq(
  prompt,
  options = {}
) {
  const skipGemini =
    Boolean(
      options?.skipGemini
    );

  if (
    !prompt ||
    !String(prompt).trim()
  ) {
    throw new Error(
      "AI prompt cannot be empty."
    );
  }

  const cleanPrompt =
    String(prompt).trim();

  // ==========================================================
  // 1. META
  // ==========================================================

  try {
    console.log(
      `[AI] Trying Meta ${META_MODEL}`
    );

    const reply =
      await askMeta(
        cleanPrompt
      );

    if (reply) {
      console.log(
        "[AI] Meta succeeded"
      );

      return reply;
    }
  } catch (error) {
    console.warn(
      "[AI] Meta failed:",
      error?.message ||
        String(error)
    );
  }

  // ==========================================================
  // 2. GEMINI
  // ==========================================================

  if (!skipGemini) {
    try {
      console.log(
        `[AI] Trying Gemini ${GEMINI_MODEL}`
      );

      const reply =
        await askGemini(
          cleanPrompt
        );

      if (reply) {
        console.log(
          "[AI] Gemini succeeded"
        );

        return reply;
      }
    } catch (error) {
      console.warn(
        "[AI] Gemini failed:",
        error?.message ||
          String(error)
      );
    }
  } else {
    console.log(
      "[AI] Gemini skipped"
    );
  }

  // ==========================================================
  // 3. GROQ
  // ==========================================================

  try {
    console.log(
      `[AI] Trying Groq ${GROQ_MODEL}`
    );

    const reply =
      await askGroqFallback(
        cleanPrompt
      );

    if (reply) {
      console.log(
        "[AI] Groq succeeded"
      );

      return reply;
    }
  } catch (error) {
    console.warn(
      "[AI] Groq failed:",
      error?.message ||
        String(error)
    );
  }

  // ==========================================================
  // 4. OLLAMA
  // ==========================================================

  if (
    process.env.VERCEL !== "1" &&
    process.env.NODE_ENV !==
      "production"
  ) {
    try {
      console.log(
        `[AI] Trying Ollama ${OLLAMA_MODEL}`
      );

      const reply =
        await askOllama(
          cleanPrompt
        );

      if (reply) {
        console.log(
          "[AI] Ollama succeeded"
        );

        return reply;
      }
    } catch (error) {
      console.warn(
        "[AI] Ollama failed:",
        error?.message ||
          String(error)
      );
    }
  } else {
    console.log(
      "[AI] Ollama skipped — production/Vercel"
    );
  }

  throw new Error(
    "All AI providers failed: Meta, Gemini, Groq, and Ollama."
  );
}

// ============================================================
// DIRECT PROVIDER EXPORTS
// ============================================================

export {
  askGemini,
  askGroqFallback,
  askMeta,
  askOllama,
};