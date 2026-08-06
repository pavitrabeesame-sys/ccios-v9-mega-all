import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const search = searchParams.get('search');

    let whereClause = {
      marketplace: { contains: 'Shopee', mode: 'insensitive' }
    };

    if (brand && brand !== 'ALL') {
      whereClause.brand = {
        is: {
          name: { equals: brand, mode: 'insensitive' }
        }
      };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: { brand: true },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("SHOPEE PRODUCTS API ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}