export async function askGroq(prompt) {

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "You are a professional ecommerce customer service assistant. Return ONLY the final customer reply. Never explain. Never output reasoning.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  if (!response.ok) {

    const error = await response.text();

    console.log("========== GROQ API ERROR ==========");
    console.log(error);

    throw new Error(error);

  }

  const data = await response.json();

  console.log("========== GROQ RESPONSE ==========");
  console.dir(data, { depth: null });

  return data.choices[0].message.content.trim();

}