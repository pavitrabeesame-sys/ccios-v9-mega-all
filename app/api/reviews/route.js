import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Corrected store/seller ID mapping matching your multi-brand accounts
const storeBrandMap = {
  "1000055891": "RAV Design",
  "100164017": "Nicole Collection",
  "300749392344": "Obermain",
  "300763632066": "Hush Puppies",
  "300934544102": "BHPC",
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const selectedBrand = searchParams.get('brand') || '';
    const selectedPlatform = searchParams.get('platform') || '';

    let whereClause = {};
    if (search) {
      whereClause.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { productSku: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { productName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }
    if (selectedPlatform && selectedPlatform !== 'ALL') {
      whereClause.marketplace = { contains: selectedPlatform, mode: 'insensitive' };
    }

    // Fetch all matching reviews from database
    const rawReviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    // Map each review to its real product and brand data
    const reviews = await Promise.all(
      rawReviews.map(async (reviewItem) => {
        let brandName = reviewItem.brand;
        let productName = reviewItem.productName || reviewItem.name;
        const cleanSku = (reviewItem.productSku || reviewItem.sku || '').trim();

        // 1. Check if the review's current brand or shop reference matches our store map
        for (const [storeId, mappedBrand] of Object.entries(storeBrandMap)) {
          if (
            (reviewItem.brand && reviewItem.brand.includes(storeId)) ||
            (reviewItem.shopId && String(reviewItem.shopId).includes(storeId)) ||
            (reviewItem.storeId && String(reviewItem.storeId).includes(storeId))
          ) {
            brandName = mappedBrand;
            break;
          }
        }

        // 2. Check Product table relation using SKU if brand is still unassigned
        if (cleanSku && (!brandName || brandName === '—' || brandName.startsWith('Store_'))) {
          try {
            const productInfo = await prisma.product.findFirst({
              where: { 
                sku: { 
                  equals: cleanSku, 
                  mode: 'insensitive' 
                } 
              },
              include: { brand: true },
            });

            if (productInfo) {
              if (productInfo.brand && productInfo.brand.name) {
                brandName = productInfo.brand.name;
              }
              if (productInfo.name && productInfo.name.trim() !== '') {
                productName = productInfo.name;
              }
            }
          } catch (err) {
            console.error("Product lookup error for SKU:", cleanSku, err.message);
          }
        }

        const finalBrand = (brandName && brandName.trim() !== '' && brandName !== '—' && !brandName.startsWith('Store_')) 
          ? brandName.trim() 
          : 'Unassigned';

        return {
          ...reviewItem,
          productSku: cleanSku,
          brand: finalBrand,
          productName: productName || `SKU: ${cleanSku || 'N/A'}`,
        };
      })
    );

    // Flexible filtering by selected brand
    const filteredReviews = reviews.filter((item) => {
      if (!selectedBrand || selectedBrand === 'ALL') return true;
      return item.brand.toLowerCase() === selectedBrand.toLowerCase() ||
             item.brand.toLowerCase().includes(selectedBrand.toLowerCase());
    });

    return NextResponse.json({ success: true, reviews: filteredReviews });
  } catch (error) {
    console.error("REVIEWS API ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}