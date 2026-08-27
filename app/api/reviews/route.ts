import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brandQuery = searchParams.get('brand');
    const includeReplied = searchParams.get('includeReplied') === 'true';

    const whereClause: any = {
      marketplace: 'SHOPEE',
    };

    if (!includeReplied) {
      whereClause.status = {
        not: 'REPLIED',
      };
    }

    if (brandQuery && brandQuery.toUpperCase() !== 'ALL') {
      const upper = brandQuery.trim().toUpperCase();
      let resolvedBrand = brandQuery.trim();

      if (upper.includes('NICOLE')) resolvedBrand = 'Nicole Collection';
      else if (upper.includes('RAV')) resolvedBrand = 'RAV Design';
      else if (upper.includes('HUSH')) resolvedBrand = 'Hush Puppies Accessories';
      else if (upper.includes('OBERMAIN')) resolvedBrand = 'Obermain';
      else if (upper.includes('BHPC') || upper.includes('BEVERLY')) resolvedBrand = 'Beverly Hills Polo Club';
      else if (upper.includes('LANGFORD') || upper.includes('JOHN_LANGFORD')) resolvedBrand = 'JOHN LANGFORD OF LONDON';

      whereClause.brand = {
        contains: resolvedBrand,
        mode: 'insensitive',
      };
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
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