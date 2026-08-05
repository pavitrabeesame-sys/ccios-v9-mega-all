// File: app/api/reviews/generate/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Internal Brand Guidelines & System Prompt Generator (Removed 'export')
function buildSystemPrompt(brand, productName) {
  const brandRules = {
    OBERMAIN: "Focus on genuine leather, RFID protection, premium durability, and craftsmanship.",
    HUSH_PUPPIES: "Focus on comfort, functional accessories, wallets, bags, and belts. (Do NOT mention shoes).",
    NICOLE: "Focus on stylish apparel, fit, and fabric quality. (Do NOT mention bags or footwear).",
    RAV_DESIGN: "Focus on bold modern lifestyle design and store opening highlights.",
  };

  const cleanBrandKey = (brand || "").toUpperCase().replace(/\s+/g, "_");
  const specificRules =
    brandRules[cleanBrandKey] ||
    brandRules[(brand || "").toUpperCase()] ||
    "Provide polite, appreciative customer service.";

  return `
You are the E-commerce Operations Specialist for ${brand || "Our Store"}.
Product context: "${productName || "our product"}".
Brand Guidelines: ${specificRules}

Rules:
1. For 5-star rating without text: Write a warm 2-sentence appreciation & encourage store follow.
2. For 4/5-star text reviews: Address specific praise (fast delivery, soft leather, fit).
3. Language: Default to Bahasa Melayu unless review is written in English.
4. Keep tone professional, polite, and under 50 words.
`.trim();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Review ID missing" }, { status: 400 });
    }

    // 1. Fetch Review record
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Extract review variables
    const reviewText = review.reviewText || "Great product!";
    const customerName = review.customerName || "Valued Customer";
    const productName = review.productName || "our product";
    const rating = review.rating || 5;

    // 2. Resolve Brand record via string match (brand or storeName)
    const searchBrandName = review.brand || review.storeName || "";
    let brandRecord = null;

    if (searchBrandName) {
      brandRecord = await prisma.brand.findFirst({
        where: {
          name: { equals: searchBrandName, mode: "insensitive" },
        },
        include: { AIProfile: true },
      });
    }

    // Fallback: Load default brand profile if no exact match
    if (!brandRecord) {
      brandRecord = await prisma.brand.findFirst({
        include: { AIProfile: true },
      });
    }

    const aiProfile = brandRecord?.AIProfile;
    const model = aiProfile?.model || "qwen3:4b";
    const resolvedBrandName = brandRecord?.name || searchBrandName || "Our Store";

    // 3. Build Brand System Prompt with SOP & Profile Overrides
    const basePrompt = buildSystemPrompt(resolvedBrandName, productName);
    const forbiddenWords = aiProfile?.forbiddenWords?.length
      ? aiProfile.forbiddenWords.join(", ")
      : "None";
    const knowledgeBase = aiProfile?.knowledgeBase || "";

    const systemPrompt = `
${basePrompt}

[EXTRA CONTEXT & CONSTRAINTS]
Forbidden Words (Do NOT use): ${forbiddenWords}
${knowledgeBase ? `SOP Memory: ${knowledgeBase}` : ""}
`.trim();

    const userPrompt = `Customer ${customerName} bought ${productName} (Rating: ${rating}/5 stars).
Review Feedback: "${reviewText}".
Provide a personalized, brand-aligned response addressing their review feedback.`;

    let reply = "";

    // 4. Send query to local Ollama inference engine
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
        reply = ollamaData.response?.trim();
      }
    } catch (ollamaErr) {
      console.warn("Ollama engine offline, using template fallback.", ollamaErr);
    }

    // 5. Smart fallback if model produces empty output or engine is offline
    if (!reply) {
      if (rating >= 4) {
        reply = `Terima kasih ${customerName} atas sokongan 5-bintang anda! Kami gembira anda berpuas hati dengan ${productName}. Jangan lupa untuk follow kedai kami di ${resolvedBrandName} untuk promosi terkini!`;
      } else if (rating === 3) {
        reply = `Terima kasih ${customerName} atas maklum balas anda berkenaan ${productName}. Kami menghargai sokongan anda dan akan terus berusaha menambah baik kualiti produk dan perkhidmatan kami di ${resolvedBrandName}.`;
      } else {
        reply = `Salam ${customerName}, kami memohon maaf di atas pengalaman anda dengan ${productName}. Terima kasih atas maklum balas ini. Sila hubungi khidmat pelanggan ${resolvedBrandName} melalui ruang chat untuk bantuan lanjut.`;
      }
    }

    // 6. Save generated reply back to the Review table
    const updated = await prisma.review.update({
      where: { id },
      data: {
        aiReply: reply,
        status: "GENERATED",
      },
    });

    return NextResponse.json({
      success: true,
      review: updated,
      engineUsed: model,
      brandResolved: resolvedBrandName,
    });
  } catch (error) {
    console.error("AI GENERATE ROUTE ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}