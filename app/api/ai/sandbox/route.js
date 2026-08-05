// app/api/ai/sandbox/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const {
      brandId,
      model = "qwen3:4b",
      systemPrompt = "",
      userPrompt = "",
      testVars = {},
    } = body;

    // 1. Fetch Brand & Knowledge Base Context if brandId is provided
    let brandContext = null;
    let knowledgeBaseContext = "";

    if (brandId) {
      brandContext = await prisma.brand.findUnique({
        where: { id: brandId },
        include: { aiProfile: true },
      });

      if (brandContext?.aiProfile?.knowledgeBase) {
        knowledgeBaseContext = brandContext.aiProfile.knowledgeBase;
      }
    }

    // 2. Interpolate user prompt variables
    let compiledUserPrompt = userPrompt;
    Object.keys(testVars).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      compiledUserPrompt = compiledUserPrompt.replace(regex, testVars[key] || "");
    });

    // 3. Assemble Full System Instructions
    const compiledSystemPrompt = `
${systemPrompt}

[BRAND CONTEXT]
Brand Name: ${brandContext?.name || testVars.brandName || "General Store"}
Rules: ${brandContext?.aiProfile?.brandRules || "Be polite and professional."}
Forbidden Words: ${brandContext?.aiProfile?.forbiddenWords?.join(", ") || "None"}

[KNOWLEDGE BASE & SOP MEMORY]
${knowledgeBaseContext || "No specific SOP injected."}
`.trim();

    let outputReply = "";
    let status = "SUCCESS";

    // 4. Execute via Ollama engine or fallback
    try {
      const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: `${compiledSystemPrompt}\n\nUser Message: ${compiledUserPrompt}`,
          stream: false,
        }),
      });

      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        outputReply = ollamaData.response;
      }
    } catch (err) {
      status = "FALLBACK_TRIGGERED";
    }

    if (!outputReply) {
      outputReply = `[SIMULATION FALLBACK] Hello ${testVars.customerName || "Valued Customer"}, thank you for your feedback regarding ${testVars.productName || "your item"}. We are dedicated to ensuring top quality across all ${brandContext?.name || "our"} products.`;
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      status,
      executionTimeMs: latencyMs,
      modelUsed: model,
      compiledPrompt: {
        system: compiledSystemPrompt,
        user: compiledUserPrompt,
      },
      output: outputReply,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Sandbox run failed", details: error.message },
      { status: 500 }
    );
  }
}