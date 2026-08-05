export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const brand = searchParams.get('brand');
    const marketplace = searchParams.get('marketplace');

    const whereClause = {};
    if (brand) whereClause.brand = brand;
    if (marketplace) whereClause.marketplace = marketplace;

    const reviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (format === 'csv') {
      const headers = ['ID', 'Brand', 'Marketplace', 'Rating', 'Comment', 'Status', 'CreatedAt'];
      const rows = reviews.map(r => [
        r.id,
        r.brand || '',
        r.marketplace || '',
        r.rating || '',
        `"${(r.comment || '').replace(/"/g, '""')}"`,
        r.status || '',
        r.createdAt ? new Date(r.createdAt).toISOString() : ''
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="reviews-export.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error('[Export API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}