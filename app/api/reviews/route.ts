import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Review } from '@prisma/client';

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      total: reviews.length,
      reviews: reviews.map((r: Review) => ({
        id: r.id,
        reviewId: r.reviewId,
        marketplace: r.marketplace,
        brand: r.brand,
        productName: r.productName,
        productSku: r.productSku,
        rating: r.rating,
        reviewText: r.reviewText,
        customerName: r.customerName,
        aiReply: r.aiReply,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}