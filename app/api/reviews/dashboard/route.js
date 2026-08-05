export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const marketplace = searchParams.get('marketplace');

    // Build filter criteria if needed
    const whereClause = {};
    if (brand) whereClause.brand = brand;
    if (marketplace) whereClause.marketplace = marketplace;

    // Fetch review statistics and metrics for the dashboard
    const totalReviews = await prisma.review.count({ where: whereClause });
    const pendingReviews = await prisma.review.count({ 
      where: { ...whereClause, status: 'PENDING' } 
    });
    const repliedReviews = await prisma.review.count({ 
      where: { ...whereClause, status: 'REPLIED' } 
    });
    const flaggedReviews = await prisma.review.count({ 
      where: { ...whereClause, status: 'FLAGGED' } 
    });

    return NextResponse.json({
      success: true,
      data: {
        totalReviews,
        pendingReviews,
        repliedReviews,
        flaggedReviews,
      },
    });
  } catch (error) {
    console.error('[Dashboard API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}