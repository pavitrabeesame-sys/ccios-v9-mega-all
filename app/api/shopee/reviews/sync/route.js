export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { resolveBrandName } from '@/src/lib/brandMapping';

const prisma = new PrismaClient();

// Fallback mapping for Shopee/Lazada store IDs
const STORE_BRAND_MAP = {
  "1000055891": "RAV",
  "100164017": "Nicole",
  "300749392344": "OBERMAIN",
  "300763632066": "HUSH PUPPIES",
  "300934544102": "BHPC",
};

export async function POST(request) {
  try {
    console.log(`[Review Sync] Starting real review synchronization across marketplaces...`);

    // Fetch active accounts
    const shopeeAccounts = await prisma.shopeeAccount.findMany();
    const lazadaAccounts = await prisma.lazadaAccount.findMany();

    let totalSyncedReviews = 0;
    const results = [];

    // Ensure parent company exists
    let parentCompany = await prisma.company.findFirst({
      where: { code: 'BST' }
    });

    if (!parentCompany) {
      parentCompany = await prisma.company.create({
        data: {
          code: 'BST',
          name: 'Bee Same Trading Sdn Bhd',
          description: 'Parent Company'
        },
      });
    }

    // 1. Sync Shopee Real Reviews
    for (const account of shopeeAccounts) {
      const shopIdStr = String(account.shopId || '').trim();
      const resolvedName = await resolveBrandName('SHOPEE', shopIdStr);
      const brandName = STORE_BRAND_MAP[shopIdStr] || resolvedName || `Store_${shopIdStr}`;
      const brandCode = brandName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

      try {
        // Ensure brand record exists
        let brandRecord = await prisma.brand.upsert({
          where: { code: brandCode },
          update: { name: brandName, companyId: parentCompany.id },
          create: { code: brandCode, name: brandName, companyId: parentCompany.id },
        });

        // Fetch real reviews from Shopee API (replace with your authenticated Shopee API call)
        // Example structure expected from API: { review_id, item_id, rating, comment, author, create_time }
        const realReviews = []; // e.g., await fetchShopeeReviews(account.accessToken, shopIdStr);

        let count = 0;
        for (const rev of realReviews) {
          const reviewExternalId = String(rev.review_id);

          await prisma.review.upsert({
            where: { externalId: reviewExternalId },
            update: {
              rating: Number(rev.rating || 5),
              comment: rev.comment || '',
              author: rev.author || 'Anonymous',
              marketplace: 'SHOPEE',
              brandId: brandRecord.id,
              companyId: parentCompany.id,
              updatedAt: new Date(),
            },
            create: {
              externalId: reviewExternalId,
              rating: Number(rev.rating || 5),
              comment: rev.comment || '',
              author: rev.author || 'Anonymous',
              marketplace: 'SHOPEE',
              brandId: brandRecord.id,
              companyId: parentCompany.id,
            },
          });
          count++;
        }

        totalSyncedReviews += count;
        results.push({ marketplace: 'SHOPEE', storeId: shopIdStr, brand: brandName, synced: count, success: true });
      } catch (err) {
        console.error(`[Shopee Review Error - Shop ${shopIdStr}]:`, err.message);
        results.push({ marketplace: 'SHOPEE', storeId: shopIdStr, error: err.message, success: false });
      }
    }

    // 2. Sync Lazada Real Reviews
    for (const account of lazadaAccounts) {
      const sellerIdStr = String(account.sellerId || '').trim();
      const resolvedName = await resolveBrandName('LAZADA', sellerIdStr);
      const brandName = STORE_BRAND_MAP[sellerIdStr] || resolvedName || `Store_${sellerIdStr}`;
      const brandCode = brandName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

      try {
        let brandRecord = await prisma.brand.upsert({
          where: { code: brandCode },
          update: { name: brandName, companyId: parentCompany.id },
          create: { code: brandCode, name: brandName, companyId: parentCompany.id },
        });

        // Fetch real reviews from Lazada API
        const realReviews = []; // e.g., await fetchLazadaReviews(account.accessToken, sellerIdStr);

        let count = 0;
        for (const rev of realReviews) {
          const reviewExternalId = String(rev.review_id);

          await prisma.review.upsert({
            where: { externalId: reviewExternalId },
            update: {
              rating: Number(rev.rating || 5),
              comment: rev.comment || '',
              author: rev.author || 'Anonymous',
              marketplace: 'LAZADA',
              brandId: brandRecord.id,
              companyId: parentCompany.id,
              updatedAt: new Date(),
            },
            create: {
              externalId: reviewExternalId,
              rating: Number(rev.rating || 5),
              comment: rev.comment || '',
              author: rev.author || 'Anonymous',
              marketplace: 'LAZADA',
              brandId: brandRecord.id,
              companyId: parentCompany.id,
            },
          });
          count++;
        }

        totalSyncedReviews += count;
        results.push({ marketplace: 'LAZADA', storeId: sellerIdStr, brand: brandName, synced: count, success: true });
      } catch (err) {
        console.error(`[Lazada Review Error - Seller ${sellerIdStr}]:`, err.message);
        results.push({ marketplace: 'LAZADA', storeId: sellerIdStr, error: err.message, success: false });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Real review synchronization completed.',
      totalSynced: totalSyncedReviews,
      details: results,
    });

  } catch (error) {
    console.error('[Review Sync Fatal Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}