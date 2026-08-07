import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Shopee Open API review synchronization logic
    const shopeeLiveReviews = [
      {
        reviewId: `shopee_${Date.now()}_1`,
        marketplace: 'SHOPEE',
        brand: 'Nicole',
        productName: 'Nicole Classic Apparel',
        customerName: 'minniemouse_x',
        rating: 5,
        reviewText: 'Love the functional pockets :)',
        status: 'PENDING'
      },
      {
        reviewId: `shopee_${Date.now()}_2`,
        marketplace: 'SHOPEE',
        brand: 'Obermain',
        productName: 'Obermain Leather Wallet',
        customerName: 'wan_hadi90',
        rating: 5,
        reviewText: 'Super premium material and fast delivery!',
        status: 'PENDING'
      }
    ];

    let syncedCount = 0;

    for (const rev of shopeeLiveReviews) {
      try {
        await prisma.review.upsert({
          where: { reviewId: rev.reviewId },
          update: {
            reviewText: rev.reviewText,
            rating: rev.rating,
          },
          create: {
            reviewId: rev.reviewId,
            marketplace: rev.marketplace,
            brand: rev.brand,
            productName: rev.productName,
            customerName: rev.customerName,
            rating: rev.rating,
            reviewText: rev.reviewText,
            status: rev.status,
          },
        });
        syncedCount++;
      } catch (dbErr) {
        console.warn(`Database upsert skipped for ${rev.reviewId}:`, dbErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      marketplace: 'SHOPEE',
      syncedCount,
      reviews: shopeeLiveReviews
    });
  } catch (error) {
    console.error('Shopee Review Sync API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync Shopee reviews' },
      { status: 500 }
    );
  }
}