import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(request) {

  try {

    const { id } = await request.json();

    const review = await prisma.review.update({
      where: {
        id,
      },
      data: {
        aiReply: null,
        finalReply: null,
        status: "REJECTED",
      },
    });

    return NextResponse.json(review);

  } catch (error) {

    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );

  }

}