// app/api/ai/knowledge/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Fetch knowledge base documents by brandId or retrieve all
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        include: { aiProfile: true },
      });

      if (!brand) {
        return NextResponse.json({ error: "Brand not found" }, { status: 404 });
      }

      return NextResponse.json({
        brandId: brand.id,
        brandName: brand.name,
        knowledgeBase: brand.aiProfile?.knowledgeBase || "",
      });
    }

    const profiles = await prisma.aIProfile.findMany({
      include: { brand: true },
    });

    const knowledgeList = profiles.map((p) => ({
      brandId: p.brandId,
      brandName: p.brand.name,
      brandCode: p.brand.code,
      knowledgeBase: p.knowledgeBase || "No SOP context configured.",
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json(knowledgeList);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch knowledge base", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Append or update brand Knowledge Base context
export async function POST(request) {
  try {
    const body = await request.json();
    const { brandId, category, title, content } = body;

    if (!brandId || !content) {
      return NextResponse.json(
        { error: "brandId and content are required." },
        { status: 400 }
      );
    }

    const existingProfile = await prisma.aIProfile.findUnique({
      where: { brandId },
    });

    const docHeader = title ? `\n\n=== [${category || "GENERAL SOP"}] ${title} ===\n` : "\n\n";
    const formattedEntry = `${docHeader}${content.trim()}`;
    const updatedKB = (existingProfile?.knowledgeBase || "") + formattedEntry;

    const updatedProfile = await prisma.aIProfile.upsert({
      where: { brandId },
      update: { knowledgeBase: updatedKB },
      create: {
        brandId,
        knowledgeBase: formattedEntry.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Knowledge document added successfully.",
      knowledgeBase: updatedProfile.knowledgeBase,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update Knowledge Base", details: error.message },
      { status: 500 }
    );
  }
}