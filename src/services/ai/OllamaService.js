export async function askOllama(prompt, model = "qwen3:4b") {

  const response = await fetch(
    "http://127.0.0.1:11434/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a professional ecommerce customer service representative. Reply ONLY with the final customer reply.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        options: {
          temperature: 0.2,
          top_p: 0.8,
          num_predict: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Ollama Error ${response.status}`);
  }

  const data = await response.json();

  console.dir(data, { depth: null });

  return (data?.message?.content || "").trim();

}