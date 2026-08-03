import { NextResponse } from "next/server";

export async function GET() {

  return NextResponse.json({

    installed: [

      {
        name: "qwen3:4b",
        provider: "Ollama",
        ram: "8GB",
        recommended: true,
      },

      {
        name: "llama3.2:3b",
        provider: "Ollama",
        ram: "8GB",
        recommended: false,
      },

      {
        name: "gemma3:4b",
        provider: "Ollama",
        ram: "8GB",
        recommended: false,
      }

    ],

    active: "qwen3:4b"

  });

}