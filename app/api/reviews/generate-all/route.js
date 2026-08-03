import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { generateReply } from "../../../../src/services/reviews/AIReplyService";

export async function POST() {

  try {

    console.log("========== GENERATE ALL ==========");

    const reviews = await prisma.review.findMany({
      where: {
        aiReply: "",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`Found ${reviews.length} reviews`);

    let generated = 0;

    for (const review of reviews) {

      try {

        const aiReply = await generateReply(review);

        await prisma.review.update({
          where: {
            id: review.id,
          },
          data: {
            aiReply,
            status: "GENERATED",
          },
        });

        generated++;

        console.log(`✓ ${review.customerName}`);

      } catch (err) {

        console.error(`✗ ${review.customerName}`);
        console.error(err);

      }

    }

    return NextResponse.json({
      success: true,
      total: reviews.length,
      generated,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );

  }

}