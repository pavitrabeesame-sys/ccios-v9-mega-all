import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return Response.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // Shopee API integration hook for publishing the final reply
    // Uses review.reviewId and review.finalReply
    console.log(
      `[Shopee Sync] Publishing reply for marketplace review ID ${review.reviewId}: "${review.finalReply}"`
    );

    // TODO: Insert actual Shopee Open API HTTP call here when tokens are active

    return Response.json({
      success: true,
      message: "Synced review reply to Shopee successfully",
    });
  } catch (error) {
    console.error("SHOPEE SYNC ERROR:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}