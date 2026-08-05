import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Fetch brand and its connected AI Profile
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        aiProfile: true,
        company: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    return NextResponse.json(brand);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch AI brand profile", details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Save or update AI Profile in PostgreSQL
export async function PUT(request, { params }) {
  try {
    const { id: brandId } = params;
    const body = await request.json();

    let parsedForbiddenWords = [];
    if (Array.isArray(body.forbiddenWords)) {
      parsedForbiddenWords = body.forbiddenWords.map((w) => w.trim()).filter(Boolean);
    } else if (typeof body.forbiddenWords === "string") {
      parsedForbiddenWords = body.forbiddenWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
    }

    const updatedProfile = await prisma.aIProfile.upsert({
      where: { brandId },
      update: {
        model: body.model || "qwen3:4b",
        tone: body.tone || "Professional",
        personality: body.personality || null,
        brandRules: body.brandRules || null,
        forbiddenWords: parsedForbiddenWords,
        replyStyle: body.replyStyle || null,
        knowledgeBase: body.knowledgeBase || null,
      },
      create: {
        brandId,
        model: body.model || "qwen3:4b",
        tone: body.tone || "Professional",
        personality: body.personality || null,
        brandRules: body.brandRules || null,
        forbiddenWords: parsedForbiddenWords,
        replyStyle: body.replyStyle || null,
        knowledgeBase: body.knowledgeBase || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "AI Profile saved successfully",
      aiProfile: updatedProfile,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save AI Profile", details: error.message },
      { status: 500 }
    );
  }
}