import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        marketplace: 'SHOPEE',
        status: {
          not: 'REPLIED',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const serializedReviews = reviews.map((review) => ({
      id: review.id,
      reviewId: review.reviewId,
      productName: review.productName,
      productSku: review.productSku,
      customerName: review.customerName,
      storeName: review.storeName,
      rating: review.rating,
      reviewText: review.reviewText,
      status: review.status,
      marketplace: review.marketplace,
      brand: review.brand,
      aiReply: review.aiReply,
      shopId:
        review.shopId !== null
          ? review.shopId.toString()
          : null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    return NextResponse.json(serializedReviews, {
      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error(
      '[Reviews API] Error fetching reviews:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to fetch reviews',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}