import { NextResponse } from "next/server";

export async function POST(request) {

  const body = await request.json();

  const prompt = body.prompt;

  const response = await fetch(
    "http://127.0.0.1:11434/api/generate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen3:4b",
        prompt,
        stream: false,
      }),
    }
  );

  const data = await response.json();

  return NextResponse.json({
    success: true,
    reply: data.response,
  });

}