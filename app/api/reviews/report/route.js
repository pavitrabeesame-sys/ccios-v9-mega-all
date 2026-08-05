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

    // Aggregate report summary statistics
    const totalReviews = await prisma.review.count({ where: whereClause });
    const pendingCount = await prisma.review.count({ where: { ...whereClause, status: 'PENDING' } });
    const repliedCount = await prisma.review.count({ where: { ...whereClause, status: 'REPLIED' } });

    return NextResponse.json({
      success: true,
      report: {
        totalReviews,
        pendingCount,
        repliedCount,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Report API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}