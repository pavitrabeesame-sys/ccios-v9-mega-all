import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import generateReply from "@/src/ai/reply/generateReply";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function POST() {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const results = [];

    for (const review of reviews) {

      const ai = await generateReply({
        reviewText: review.reviewText || "",
        rating: review.rating,
        brand: review.brand || "Obermain",
      });

      await prisma.review.update({
        where: {
          reviewId: review.reviewId,
        },
        data: {
          aiReply: ai.aiReply,
          language: ai.language,
          sentiment: ai.sentiment,
          category: ai.category,
          status:
            ai.approval === "AUTO_APPROVED"
              ? "APPROVED"
              : "GENERATED",
        },
      });

      results.push({
        reviewId: review.reviewId,
        language: ai.language,
        sentiment: ai.sentiment,
        category: ai.category,
        approval: ai.approval,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      results,
    });

  } catch (err) {

    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}