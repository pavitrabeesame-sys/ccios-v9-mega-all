import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { reviewId } = await request.json();

    const review = await prisma.review.findUnique({
      where: {
        reviewId,
      },
    });

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error: "Review not found",
        },
        { status: 404 }
      );
    }

    const prompt = `
You are a professional Shopee customer service agent.

Customer Review:
${review.reviewText}

Rating:
${review.rating}

Write a polite, professional reply.
`;

    const ai = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const result = await ai.json();

    const reply =
      result.choices?.[0]?.message?.content || "";

    await prisma.review.update({
      where: {
        reviewId,
      },
      data: {
        aiReply: reply,
        status: "GENERATED",
      },
    });

    return NextResponse.json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}