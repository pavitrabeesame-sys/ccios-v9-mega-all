import { NextResponse } from "next/server";

export async function GET() {

  return NextResponse.json({

    provider: "Ollama",

    model: "qwen3:4b",

    endpoint: "http://127.0.0.1:11434/api/generate",

    temperature: 0.3,

    maxTokens: 180,

    languageDetection: true,

    autoBrandDetection: true,

    autoGenerate: false,

    requireApproval: true,

    stream: false,

  });

}

export async function POST(request) {

  const body = await request.json();

  return NextResponse.json({

    success: true,

    settings: body,

  });

}