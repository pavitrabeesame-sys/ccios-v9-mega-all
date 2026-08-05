// app/api/reviews/brands/route.js

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

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

      brands[brand].ratingTotal += review.rating;

      if (review.sentiment === "POSITIVE")
        brands[brand].positive++;

      if (review.sentiment === "NEUTRAL")
        brands[brand].neutral++;

      if (review.sentiment === "NEGATIVE")
        brands[brand].negative++;

    }

    Object.keys(brands).forEach((brand) => {

      brands[brand].averageRating = Number(
        (
          brands[brand].ratingTotal /
          brands[brand].total
        ).toFixed(2)
      );

      delete brands[brand].ratingTotal;

    });

    return NextResponse.json({

      success: true,

      brands,

    });

  } catch (err) {

    return NextResponse.json({

      success: false,

      error: err.message,

    }, {

      status: 500,

    });

  }

}