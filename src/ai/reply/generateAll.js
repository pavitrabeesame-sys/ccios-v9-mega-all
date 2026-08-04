import { PrismaClient } from "@prisma/client";
import generateReply from "./generateReply";

const prisma = new PrismaClient();

export async function generateAllReplies() {
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
      brand: review.brand || "Obermain",
      reviewText: review.reviewText || "",
      rating: review.rating,
    });

    await prisma.review.update({
      where: {
        reviewId: review.reviewId,
      },
      data: {
        language: ai.language,
        sentiment: ai.sentiment,
        category: ai.category,
        aiReply: ai.aiReply,
        status:
          ai.approval === "AUTO_APPROVED"
            ? "APPROVED"
            : "GENERATED",
      },
    });

    results.push({
      reviewId: review.reviewId,
      approval: ai.approval,
    });
  }

  return results;
}

export default generateAllReplies;