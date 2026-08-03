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

  ]);

  return NextResponse.json({
    total,
    pending,
    approved,
    rejected,
    replied,
    generated,
  });

}