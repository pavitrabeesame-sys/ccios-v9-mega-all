export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { resolveBrandName } from '@/src/lib/brandMapping';

const prisma = new PrismaClient();

// Permanent store ID to Brand Name fallback mapping for Shopee stores
const SHOPEE_STORE_BRAND_MAP = {
  "1000055891": "RAV",
  "100164017": "Nicole",
  "300749392344": "Obermain",
  "300763632066": "Hush Puppies",
  "300934544102": "Beverly Hills Polo Club",
};

// TODO: Replace this with your actual shopeeGet function call
async function fetchShopeeProducts(accessToken, shopId) {
  // Plug your actual Shopee API fetch logic here
  // Should return an array of items: { item_id, name, price, stock, sku }
  return [];
}

export async function POST(request) {
  try {
    console.log(`[Shopee Sync] Starting multi-store product sync...`);

    const accounts = await prisma.shopeeAccount.findMany();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Shopee accounts found in database. Please authorize your stores first.',
        syncedCount: 0,
      }, { status: 400 });
    }

    let totalSynced = 0;
    const results = [];

    // Ensure parent company exists safely using unique field or lookup
    let parentCompany = await prisma.company.findFirst({
      where: { 
        OR: [
          { code: 'BST' },
          { name: 'Bee Same Trading Sdn Bhd' }
        ]
      }
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

    for (const account of accounts) {
      const shopIdStr = String(account.shopId || account.sellerId || '').trim();
      const resolvedName = await resolveBrandName('SHOPEE', shopIdStr);
      const brandName = SHOPEE_STORE_BRAND_MAP[shopIdStr] || resolvedName || `Store_${shopIdStr}`;
      const brandCode = brandName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

      console.log(`[Shopee Sync] Processing shop ID: ${shopIdStr} -> Brand: ${brandName}`);

      try {
        // 1. Ensure brand exists and links to parent company
        let brandRecord = await prisma.brand.upsert({
          where: { code: brandCode },
          update: { name: brandName, companyId: parentCompany.id },
          create: {
            code: brandCode,
            name: brandName,
            companyId: parentCompany.id,
          },
        });

        // 2. Fetch products from Shopee API
        const products = await fetchShopeeProducts(account.accessToken, account.shopId);
        let brandSyncedCount = 0;

        // 3. Upsert each product with CCIOS enterprise fields
        for (const p of products) {
          const sku = String(p.sku || `SHOPEE_${p.item_id || 'UNKNOWN'}`);
          const shopeeIdVal = p.item_id ? BigInt(p.item_id) : null;

          await prisma.product.upsert({
            where: { sku },
            update: {
              name: p.name || 'Untitled Shopee Product',
              price: parseFloat(p.price || 0),
              stock: parseInt(p.stock || 0, 10),
              shopeeItemId: shopeeIdVal,
              marketplace: 'SHOPEE',
              lastSync: new Date(),
              companyId: parentCompany.id,
              brandId: brandRecord.id,
              updatedAt: new Date(),
            },
            create: {
              sku,
              name: p.name || 'Untitled Shopee Product',
              price: parseFloat(p.price || 0),
              stock: parseInt(p.stock || 0, 10),
              shopeeItemId: shopeeIdVal,
              marketplace: 'SHOPEE',
              lastSync: new Date(),
              companyId: parentCompany.id,
              brandId: brandRecord.id,
            },
          });
          brandSyncedCount++;
        }

        totalSynced += brandSyncedCount;
        results.push({ shopId: shopIdStr, brand: brandName, count: brandSyncedCount, success: true });

      } catch (err) {
        console.error(`[Shopee Sync Error for shop ${shopIdStr}]:`, err.message);
        results.push({ shopId: shopIdStr, error: err.message, success: false });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Shopee synchronization completed successfully.`,
      totalSynced,
      details: results,
    });

  } catch (error) {
    console.error('[Shopee Sync Fatal Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  return POST(request);
}