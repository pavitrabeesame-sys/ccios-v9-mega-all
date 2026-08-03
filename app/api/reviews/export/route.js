import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {

  const reviews = await prisma.review.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    success: true,
    total: reviews.length,
    data: reviews,
  });

}