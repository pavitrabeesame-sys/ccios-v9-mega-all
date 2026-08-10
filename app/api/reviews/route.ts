import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        marketplace: 'SHOPEE',
        status: {
          not: 'REPLIED',
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Convert BigInt fields (shopId) so NextResponse can serialize them.
    const serializedReviews = reviews.map((review) => ({
      ...review,
      shopId:
        review.shopId !== null
          ? review.shopId.toString()
          : null,
    }));

    return NextResponse.json(serializedReviews);
  } catch (error: any) {
    console.error('API Error fetching reviews:', error);

    return NextResponse.json(
      {
        error:
          error.message ||
          'Failed to fetch reviews',
      },
      {
        status: 500,
      }
    );
  }
}