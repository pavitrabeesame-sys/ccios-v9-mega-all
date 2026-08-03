import { prisma } from "../../../src/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";

    const reviews = await prisma.review.findMany({
      where: {
        OR: [
          {
            customerName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            productName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            reviewText: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const stats = {
      total: await prisma.review.count(),

      pending: await prisma.review.count({
        where: {
          status: "PENDING",
        },
      }),

      generated: await prisma.review.count({
        where: {
          status: "GENERATED",
        },
      }),

      approved: await prisma.review.count({
        where: {
          status: "APPROVED",
        },
      }),

      rejected: await prisma.review.count({
        where: {
          status: "REJECTED",
        },
      }),

      replied: await prisma.review.count({
        where: {
          status: "REPLIED",
        },
      }),
    };

    return NextResponse.json({
      reviews,
      stats,
    });
  } catch (error) {
    console.error(error);

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