import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(request) {

  try {

    const { id } = await request.json();

    const review = await prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      return NextResponse.json(
        { error: "Review not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        finalReply: review.aiReply,
        status: "APPROVED",
      },
    });

    return NextResponse.json(updated);

  } catch (error) {

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  }

}