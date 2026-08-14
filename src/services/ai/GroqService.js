const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const OLLAMA_API_URL =
  process.env.OLLAMA_API_URL ||
  "http://127.0.0.1:11434/api/chat";

/*
|--------------------------------------------------------------------------
| MODELS
|--------------------------------------------------------------------------
*/

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ||
  "llama3.2:3b";

/*
|--------------------------------------------------------------------------
| PERFORMANCE SETTINGS
|--------------------------------------------------------------------------
*/

const REQUEST_TIMEOUT_MS = 30000;

const GEMINI_MAX_TOKENS = 180;

const GROQ_MAX_TOKENS = 180;

const OLLAMA_MAX_TOKENS = 180;

const TEMPERATURE = 0.3;


/*
|--------------------------------------------------------------------------
| COMMON SYSTEM PROMPT
|--------------------------------------------------------------------------
*/

const SYSTEM_PROMPT =
  "You are a professional ecommerce customer service assistant. " +
  "Return ONLY the final customer reply. " +
  "Never explain. Never output reasoning. " +
  "Never mention AI, models, prompts, automation, or internal systems.";


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function createTimeoutSignal(timeoutMs) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);

  return {
    signal:
      controller.signal,

    clear() {
      clearTimeout(timeout);
    },
  };
}


function cleanReply(text) {
  if (!text) {
    return "";
  }

  let result =
    String(text).trim();

  /*
   * Remove accidental markdown fences.
   */

  result =
    result
      .replace(
        /^```(?:text|markdown)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  /*
   * Remove accidental labels.
   */

  result =
    result.replace(
      /^(final customer reply|customer reply|reply):\s*/i,
      ""
    );

  return result.trim();
}


function extractErrorMessage(
  data,
  fallback
) {
  if (!data) {
    return fallback;
  }

  if (
    typeof data === "string"
  ) {
    return data;
  }

  if (data.error) {
    if (
      typeof data.error ===
      "string"
    ) {
      return data.error;
    }

    if (
      data.error.message
    ) {
      return data.error.message;
    }
  }

  if (data.message) {
    return data.message;
  }

  return fallback;
}


function isRateLimitError(
  status,
  text
) {
  const value =
    String(text || "")
      .toLowerCase();

  return (
    status === 429 ||
    value.includes("rate limit") ||
    value.includes("rate_limit") ||
    value.includes("resource exhausted") ||
    value.includes("quota") ||
    value.includes("too many requests") ||
    value.includes("tokens per day") ||
    value.includes("tokens per minute")
  );
}


/*
|--------------------------------------------------------------------------
| GEMINI
|--------------------------------------------------------------------------
*/

async function askGemini(
  prompt
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured."
    );
  }

  const url =
    `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const timeout =
    createTimeoutSignal(
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text:
                      SYSTEM_PROMPT,
                  },
                ],
              },

              contents: [
                {
                  role: "user",

                  parts: [
                    {
                      text:
                        prompt,
                    },
                  ],
                },
              ],

              generationConfig: {
                temperature:
                  TEMPERATURE,

                maxOutputTokens:
                  GEMINI_MAX_TOKENS,
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
      data =
        JSON.parse(rawText);
    } catch {
      data =
        rawText;
    }

    if (!response.ok) {
      const message =
        extractErrorMessage(
          data,
          `Gemini API error (${response.status})`
        );

      const error =
        new Error(message);

      error.status =
        response.status;

      error.isRateLimit =
        isRateLimitError(
          response.status,
          message
        );

      throw error;
    }

    const parts =
      data
        ?.candidates?.[0]
        ?.content
        ?.parts || [];

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


/*
|--------------------------------------------------------------------------
| GROQ
|--------------------------------------------------------------------------
*/

async function askGroqFallback(
  prompt
) {
  const apiKey =
    process.env.GROQ_API_KEY;

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

          body:
            JSON.stringify({
              model:
                GROQ_MODEL,

              temperature:
                TEMPERATURE,

              max_tokens:
                GROQ_MAX_TOKENS,

              messages: [
                {
                  role:
                    "system",

                  content:
                    SYSTEM_PROMPT,
                },

                {
                  role:
                    "user",

                  content:
                    prompt,
                },
              ],
            }),

          signal:
            timeout.signal,
        }
      );

    const rawText =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(rawText);
    } catch {
      data =
        rawText;
    }

    if (!response.ok) {
      const message =
        extractErrorMessage(
          data,
          `Groq API error (${response.status})`
        );

      const error =
        new Error(message);

      error.status =
        response.status;

      error.isRateLimit =
        isRateLimitError(
          response.status,
          message
        );

      throw error;
    }

    const reply =
      data
        ?.choices?.[0]
        ?.message
        ?.content;

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


/*
|--------------------------------------------------------------------------
| OLLAMA
|--------------------------------------------------------------------------
*/

async function askOllama(
  prompt
) {
  const timeout =
    createTimeoutSignal(
      REQUEST_TIMEOUT_MS
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

          body:
            JSON.stringify({
              model:
                OLLAMA_MODEL,

              stream:
                false,

              messages: [
                {
                  role:
                    "system",

                  content:
                    SYSTEM_PROMPT,
                },

                {
                  role:
                    "user",

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
      data =
        JSON.parse(rawText);
    } catch {
      data =
        rawText;
    }

    if (!response.ok) {
      const message =
        extractErrorMessage(
          data,
          `Ollama API error (${response.status})`
        );

      throw new Error(
        message
      );
    }

    const reply =
      data
        ?.message
        ?.content;

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


/*
|--------------------------------------------------------------------------
| MAIN CCIOS AI GATEWAY
|--------------------------------------------------------------------------
|
| Existing code continues using:
|
|   askGroq(prompt)
|
| Internally:
|
|   Gemini
|      ↓
|   Groq 8B
|      ↓
|   Ollama
|
|--------------------------------------------------------------------------
*/

export async function askGroq(
  prompt
) {
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


  /*
   |--------------------------------------------------------------------------
   | 1. GEMINI
   |--------------------------------------------------------------------------
   */

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
        `[AI] Gemini succeeded`
      );

      return reply;
    }
  } catch (error) {
    console.warn(
      `[AI] Gemini failed:`,
      error?.message ||
        String(error)
    );
  }


  /*
   |--------------------------------------------------------------------------
   | 2. GROQ GPT-OSS 20B
   |--------------------------------------------------------------------------
   */

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
  `[AI] Groq GPT-OSS 20B succeeded`
);

      return reply;
    }
  } catch (error) {
    console.warn(
      `[AI] Groq failed:`,
      error?.message ||
        String(error)
    );
  }


  /*
   |--------------------------------------------------------------------------
   | 3. OLLAMA
   |--------------------------------------------------------------------------
   */

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
        `[AI] Ollama succeeded`
      );

      return reply;
    }
  } catch (error) {
    console.warn(
      `[AI] Ollama unavailable:`,
      error?.message ||
        String(error)
    );
  }


  /*
   |--------------------------------------------------------------------------
   | ALL PROVIDERS FAILED
   |--------------------------------------------------------------------------
   */

  throw new Error(
    "All AI providers failed: Gemini, Groq GPT-OSS 20B, and Ollama."
  );
}
