export const dynamic = 'force-dynamic'; // 1. Tell Next this is dynamic
export const revalidate = 0;

import { prisma } from "../../../src/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    // 2. Fetch reviews + counts in parallel
    const [reviews,...counts] = await Promise.all([
      prisma.review.findMany({
        where: {
          OR: [
            { customerName: { contains: search, mode: "insensitive" } },
            { productName: { contains: search, mode: "insensitive" } },
            { reviewText: { contains: search, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 100 // add limit so it doesn't crash on 10k reviews
      }),
      prisma.review.count(),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { status: "GENERATED" } }),
      prisma.review.count({ where: { status: "APPROVED" } }),
      prisma.review.count({ where: { status: "REJECTED" } }),
      prisma.review.count({ where: { status: "REPLIED" } }),
    ]);

    // 3. FIX: Convert Date objects to strings for Client Components
    const safeReviews = reviews.map(r => ({
     ...r,
      createdAt: r.createdAt?.toISOString() || null,
      updatedAt: r.updatedAt?.toISOString() || null,
      repliedAt: r.repliedAt?.toISOString() || null,
    }));

    const stats = {
      total: counts[0],
      pending: counts[1],
      generated: counts[2],
      approved: counts[3],
      rejected: counts[4],
      replied: counts[5],
    };

    return NextResponse.json({
      reviews: safeReviews,
      stats,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}