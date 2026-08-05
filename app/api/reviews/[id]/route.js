import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.finalReply !== undefined && { finalReply: body.finalReply }),
        ...(body.aiReply !== undefined && { aiReply: body.aiReply }),
        ...(body.repliedBy !== undefined && { repliedBy: body.repliedBy }),
      },
    });

    return Response.json(updatedReview);
  } catch (error) {
    console.error("Error updating review:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }

    return Response.json(review);
  } catch (error) {
    console.error("Error fetching review:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}