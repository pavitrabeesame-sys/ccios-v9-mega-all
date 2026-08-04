import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {

  const [
    total,
    pending,
    approved,
    rejected,
    replied,
    generated,
    positive,
    neutral,
    negative,
  ] = await Promise.all([

    prisma.review.count(),

    prisma.review.count({
      where: { status: "PENDING" },
    }),

    prisma.review.count({
      where: { status: "APPROVED" },
    }),

    prisma.review.count({
      where: { status: "REJECTED" },
    }),

    prisma.review.count({
      where: { status: "REPLIED" },
    }),

    prisma.review.count({
      where: { status: "GENERATED" },
    }),

    prisma.review.count({
      where: { sentiment: "POSITIVE" },
    }),

    prisma.review.count({
      where: { sentiment: "NEUTRAL" },
    }),

    prisma.review.count({
      where: { sentiment: "NEGATIVE" },
    }),

  ]);

  return NextResponse.json({
    total,
    pending,
    approved,
    rejected,
    replied,
    generated,
    positive,
    neutral,
    negative,
  });

}