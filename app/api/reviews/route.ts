import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');

    const where: any = {};
    if (brand && brand !== 'ALL') {
      where.brand = brand.toUpperCase();
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      reviews: reviews.map(r => ({
        id: r.id,
        reviewId: r.reviewId,
        marketplace: r.marketplace,
        productName: r.productName,
        productSku: (r as any).productSku || (r as any).sku || null,
        customerName: r.customerName,
        rating: r.rating,
        reviewText: r.reviewText,
        aiReply: (r as any).aiReply || null,
        finalReply: (r as any).finalReply || null,
        status: r.status,
        brand: r.brand,
        storeName: r.storeName
      })),
      total: reviews.length
    });
  } catch (error: any) {
    console.error('Error fetching reviews from database:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
