export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const marketplace = searchParams.get('marketplace');

    const whereClause = {};
    if (brand) whereClause.brand = brand;
    if (marketplace) whereClause.marketplace = marketplace;

    // Fetch review metrics for insights
    const totalReviews = await prisma.review.count({ where: whereClause });
    const avgRatingAgg = await prisma.review.aggregate({
      where: whereClause,
      _avg: { rating: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalReviews,
        averageRating: avgRatingAgg._avg.rating || 0,
        insights: 'Customer feedback indicates strong satisfaction across product categories.',
      },
    });
  } catch (error) {
    console.error('[Insights API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}