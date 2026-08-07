import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketplace = searchParams.get('marketplace');
    const brandParam = searchParams.get('brand');
    const status = searchParams.get('status');

    let reviews = [];

    const brandMapping = {
      'BHPC': 'Beverly Hills Polo Club',
      'HUSH': 'Hush Puppies',
      'RAV': 'RAV Design',
      'NICOLE': 'Nicole',
      'OBERMAIN': 'Obermain'
    };

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const where = {};
      if (marketplace && marketplace !== 'ALL' && marketplace !== 'all') {
        where.marketplace = marketplace.toUpperCase();
      }
      if (brandParam && brandParam !== 'ALL' && brandParam !== 'all') {
        const targetBrand = brandMapping[brandParam.toUpperCase()] || brandParam;
        where.brand = { contains: targetBrand, mode: 'insensitive' };
      }
      if (status && status !== 'ALL' && status !== 'all') {
        where.status = status.toUpperCase();
      }

      reviews = await prisma.review.findMany({ 
        where, 
        orderBy: { updatedAt: 'desc' } 
      });
    } catch (dbErr) {
      console.log('Querying memory store fallback:', dbErr.message);
      reviews = globalThis.mockReviewStore || [];

      if (marketplace && marketplace !== 'ALL' && marketplace !== 'all') {
        reviews = reviews.filter(r => r.marketplace === marketplace.toUpperCase());
      }
      if (brandParam && brandParam !== 'ALL' && brandParam !== 'all') {
        const targetBrand = (brandMapping[brandParam.toUpperCase()] || brandParam).toLowerCase();
        reviews = reviews.filter(r => r.brand.toLowerCase().includes(targetBrand));
      }
      if (status && status !== 'ALL' && status !== 'all') {
        reviews = reviews.filter(r => r.status === status.toUpperCase());
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: reviews.length, 
      reviews 
    });
  } catch (error) {
    console.error('Fetch Reviews API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}