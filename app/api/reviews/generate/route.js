import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { generateReply } from "../../../../src/services/reviews/AIReplyService";

export async function POST(request) {
  try {

    console.log("========== GENERATE API ==========");

    console.log("METHOD:", request.method);

const raw = await request.text();

console.log("RAW BODY:");
console.log(raw);

if (!raw) {
  throw new Error("Request body is empty.");
}

const { id } = JSON.parse(raw);

    console.log("Review ID:", id);

    const review = await prisma.review.findUnique({
      where: { id },
    });

    console.log("Review Found:", review);

    if (!review) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 }
      );
    }

    console.log("Generating AI Reply...");

    const aiReply = await generateReply(review);

    console.log("AI Reply:");
    console.log(aiReply);

    console.log("Updating Database...");

    const updated = await prisma.review.update({
      where: { id },
      data: {
        aiReply,
        status: "GENERATED",
      },
    });

    console.log("Database Updated Successfully");

    return NextResponse.json(updated);

  } catch (error) {

    console.error("========== GROQ ERROR ==========");
    console.error(error);

    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      {
        status: 500,
      }
    );
  }
}