// app/api/reviews/brands/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      select: {
        brand: true,
        rating: true,
        sentiment: true,
      },
    });

    const brands = {};

    for (const review of reviews) {
      const brand = review.brand || "Unknown";

      if (!brands[brand]) {
        brands[brand] = {
          total: 0,
          averageRating: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          ratingTotal: 0,
        };
      }

      brands[brand].total++;

      brands[brand].ratingTotal += Number(review.rating || 0);

      if (review.sentiment === "POSITIVE") {
        brands[brand].positive++;
      }

      if (review.sentiment === "NEUTRAL") {
        brands[brand].neutral++;
      }

      if (review.sentiment === "NEGATIVE") {
        brands[brand].negative++;
      }
    }

    for (const brand of Object.keys(brands)) {
      const data = brands[brand];

      data.averageRating =
        data.total > 0
          ? Number(
              (data.ratingTotal / data.total).toFixed(2)
            )
          : 0;

      delete data.ratingTotal;
    }

    return NextResponse.json(
      {
        success: true,
        brands,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("[Reviews Brands API]", err);

    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to load review brands",
      },
      {
        status: 500,
      }
    );
  }
}