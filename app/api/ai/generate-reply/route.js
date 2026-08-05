// app/api/ai/generate-reply/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Knowledge Topic Extractor
function filterRelevantKnowledge(knowledgeBaseStr, reviewText) {
  if (!knowledgeBaseStr) return "N/A";

  const lowerText = reviewText.toLowerCase();
  const sections = knowledgeBaseStr.split("===");

  const matchedSections = sections.filter((sec) => {
    const lowerSec = sec.toLowerCase();
    if (lowerText.includes("warranty") || lowerText.includes("guarantee") || lowerText.includes("repair")) {
      if (lowerSec.includes("warranty") || lowerSec.includes("repair")) return true;
    }
    if (lowerText.includes("size") || lowerText.includes("small") || lowerText.includes("tight") || lowerText.includes("big")) {
      if (lowerSec.includes("size") || lowerSec.includes("fitting")) return true;
    }
    if (lowerText.includes("return") || lowerText.includes("refund") || lowerText.includes("broken") || lowerText.includes("damaged")) {
      if (lowerSec.includes("return") || lowerSec.includes("refund")) return true;
    }
    if (lowerText.includes("ship") || lowerText.includes("delivery") || lowerText.includes("late") || lowerText.includes("slow")) {
      if (lowerSec.includes("shipping") || lowerSec.includes("sla")) return true;
    }
    return false;
  });

  if (matchedSections.length > 0) {
    return matchedSections.join("===");
  }

  return knowledgeBaseStr; // Fallback to full knowledge base if no topic keyword triggers
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { reviewId, reviewText, brandName, rating, customerName, productName } = body;

    let reviewData = { reviewText, brandName, rating, customerName, productName };

    if (reviewId) {
      const dbReview = await prisma.review.findUnique({ where: { id: reviewId } });
      if (dbReview) {
        reviewData = {
          reviewText: dbReview.reviewText || "",
          brandName: dbReview.brand || "",
          rating: dbReview.rating || 5,
          customerName: dbReview.customerName || "Valued Customer",
          productName: dbReview.productName || "Product",
        };
      }
    }

    // Fetch Brand & AI Profile
    let aiProfile = null;
    if (reviewData.brandName) {
      const brand = await prisma.brand.findFirst({
        where: { name: { equals: reviewData.brandName, mode: "insensitive" } },
        include: { aiProfile: true },
      });
      if (brand && brand.aiProfile) {
        aiProfile = brand.aiProfile;
      }
    }

    const model = aiProfile?.model || "qwen3:4b";
    const tone = aiProfile?.tone || "Professional";
    const personality = aiProfile?.personality || "Helpful e-commerce support agent.";
    const brandRules = aiProfile?.brandRules || "Be polite, helpful, and clear.";
    const forbiddenWords = aiProfile?.forbiddenWords || [];
    const replyStyle = aiProfile?.replyStyle || "Concise and professional.";
    const fullKB = aiProfile?.knowledgeBase || "";

    // Extract Knowledge Base context
    const targetedKnowledge = filterRelevantKnowledge(fullKB, reviewData.reviewText);

    const systemPrompt = `
You are the official AI representative for brand: "${reviewData.brandName || "Store"}".

[BRAND PERSONALITY & TONE]
Model: ${model}
Tone: ${tone}
Personality: ${personality}
Reply Style: ${replyStyle}

[BRAND GUARDRAILS & RULES]
Rules: ${brandRules}
STRICT FORBIDDEN WORDS (NEVER USE): ${forbiddenWords.length > 0 ? forbiddenWords.join(", ") : "None"}

[MATCHED KNOWLEDGE BASE & SOP DOCUMENTS]
${targetedKnowledge}
`;

    const userPrompt = `
Customer Review:
- Customer Name: ${reviewData.customerName}
- Rating: ${reviewData.rating} / 5 Stars
- Product: ${reviewData.productName}
- Review Message: "${reviewData.reviewText}"

Task: Draft an official customer service reply using the brand's tone, following all SOP guidelines provided, avoiding forbidden words.
`;

    let generatedReply = "";

    try {
      const ollamaRes = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
        }),
      });

      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        generatedReply = ollamaData.response;
      }
    } catch (e) {
      console.warn("Local Ollama server offline. Falling back to rule-based template engine.");
    }

    if (!generatedReply) {
      if (reviewData.rating >= 4) {
        generatedReply = `Hi ${reviewData.customerName}, thank you for purchasing the ${reviewData.productName}! We are glad to hear your positive experience. As an official ${reviewData.brandName} item, quality and customer satisfaction are our top priorities.`;
      } else {
        generatedReply = `Hi ${reviewData.customerName}, thank you for reaching out regarding your ${reviewData.productName}. We apologize for the issue. Please refer to our support team so we can assist you according to our store's policy.`;
      }
    }

    if (reviewId) {
      await prisma.review.update({
        where: { id: reviewId },
        data: { aiReply: generatedReply, status: "GENERATED" },
      });
    }

    return NextResponse.json({
      success: true,
      brand: reviewData.brandName,
      injectedKnowledge: targetedKnowledge,
      generatedReply,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Generation failed", details: error.message },
      { status: 500 }
    );
  }
}