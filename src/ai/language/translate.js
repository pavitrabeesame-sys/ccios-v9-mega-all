// src/ai/language/translate.js

export function translate(text = "", from = "AUTO", to = "ENGLISH") {

  return {
    original: text,
    translated: text,
    sourceLanguage: from,
    targetLanguage: to,
    translatedBy: "NONE",
  };

}

export async function translateWithAI(text, target = "ENGLISH") {

  const prompt = `
Translate the following customer review.

Target Language:
${target}

Return ONLY the translated text.

Review:
${text}
`;

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const ai = await res.json();

  return (
    ai?.choices?.[0]?.message?.content?.trim() ||
    text
  );

}

export default translate;