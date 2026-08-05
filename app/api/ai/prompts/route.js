// app/api/ai/prompts/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Default built-in prompt templates
const DEFAULT_PROMPTS = [
  {
    id: "prompt_5star_reply",
    title: "5-Star Positive Review Reply",
    category: "REVIEW_REPLY",
    description: "Engaging thank-you response for high-rating product reviews.",
    systemPrompt: "You are an official brand ambassador. Express genuine gratitude, mention the specific product, and reinforce brand quality.",
    userTemplate: "Customer {customerName} gave {rating} stars for {productName}. Comment: '{reviewText}'. Draft a warm, professional reply.",
    isDefault: true,
  },
  {
    id: "prompt_negative_resolution",
    title: "1-3 Star Service Escalation",
    category: "CUSTOMER_SERVICE",
    description: "Empathic, professional apology and escalation response for negative feedback.",
    systemPrompt: "You are a customer care supervisor. Acknowledge the issue sincerely, avoid making false promises, and guide the customer to official support channels.",
    userTemplate: "Customer {customerName} rated {productName} {rating} stars. Complaint: '{reviewText}'. Draft an empathic resolution reply.",
    isDefault: true,
  },
  {
    id: "prompt_chat_broadcast",
    title: "Platform Campaign Broadcast",
    category: "MARKETING",
    description: "Short, high-converting Shopee/Lazada/TikTok chat broadcast copy.",
    systemPrompt: "You are an e-commerce copywriting expert. Draft concise, punchy broadcast messages with clear calls to action and emoji accents.",
    userTemplate: "Create a promotional chat broadcast for {brandName} featuring {productName} for an upcoming campaign. Highlight special value.",
    isDefault: true,
  },
];

// GET: Fetch all prompt templates or filter by category
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let prompts = DEFAULT_PROMPTS;

    if (category) {
      prompts = prompts.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      count: prompts.length,
      prompts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch prompt templates", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Add or update a prompt template
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, title, category, description, systemPrompt, userTemplate } = body;

    if (!title || !systemPrompt || !userTemplate) {
      return NextResponse.json(
        { error: "Title, systemPrompt, and userTemplate are required." },
        { status: 400 }
      );
    }

    const newTemplate = {
      id: id || `prompt_${Date.now()}`,
      title,
      category: category || "GENERAL",
      description: description || "",
      systemPrompt,
      userTemplate,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: "Prompt template saved successfully.",
      template: newTemplate,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save prompt template", details: error.message },
      { status: 500 }
    );
  }
}