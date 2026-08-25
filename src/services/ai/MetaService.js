const META_API_URL =
  process.env.META_API_URL || "https://api.meta.ai/v1";

const META_MODEL =
  process.env.META_MODEL || "muse-spark-1.1";

export async function askMeta(prompt) {
  const apiKey = String(
    process.env.MODEL_API_KEY || ""
  ).trim();

  if (!apiKey) {
    throw new Error("MODEL_API_KEY is not configured.");
  }

  const response = await fetch(
    `${META_API_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: META_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a professional ecommerce customer service assistant. Return ONLY the final customer reply. Never explain reasoning.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 300,
      }),
    }
  );s

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Meta returned invalid JSON: ${text}`);
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Meta API error ${response.status}`
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("Meta returned empty response.");
  }

  return reply;
}