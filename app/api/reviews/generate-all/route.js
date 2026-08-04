import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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

      const prompt = `
You are a professional Shopee customer service agent.

Customer Rating:
${review.rating}/5

Customer Review:
${review.reviewText || "No review text"}

Write a short, polite, professional reply.
`;

      const response = await fetch(
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

      const ai = await response.json();

      const reply =
        ai.choices?.[0]?.message?.content ||
        "Thank you for your support.";

      await prisma.review.update({
        where: {
          reviewId: review.reviewId,
        },
        data: {
          aiReply: reply,
          status: "GENERATED",
        },
      });

      results.push({
        reviewId: review.reviewId,
        rating: review.rating,
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