import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { lazadaGet } from '@/lib/lazada';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const accounts = await prisma.lazadaAccount.findMany();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No Lazada accounts found in the database. Please complete authorization first." 
      }, { status: 400 });
    }

    let syncResults = [];

    for (const account of accounts) {
      try {
        const response = await lazadaGet(account.sellerId, '/products/get', {
          filter: 'all',
          offset: '0',
          limit: '50'
        });

        const products = response.data?.products || [];
        let importedCount = 0;

        for (const item of products) {
          const sku = item.skus?.[0]?.SellerSku || String(item.item_id);
          const productName = item.product_name || `Lazada Item ${item.item_id}`;

          if (!sku) continue;

          let brandId = account.brandId || null;

          await prisma.product.upsert({
            where: { sku: sku },
            update: {
              name: productName,
              updatedAt: new Date(),
            },
            create: {
              sku: sku,
              name: productName,
              marketplace: 'Lazada',
              brandId: brandId,
            },
          });

          importedCount++;
        }

        syncResults.push({ 
          sellerId: account.sellerId, 
          brand: account.brand || 'Unassigned', 
          importedCount, 
          status: 'success' 
        });

      } catch (err) {
        console.error(`[Lazada Sync Error] Account ${account.sellerId}:`, err.message);
        syncResults.push({ 
          sellerId: account.sellerId, 
          brand: account.brand || 'Unassigned', 
          error: err.message, 
          status: 'failed' 
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Lazada multi-brand product synchronization completed.', 
      results: syncResults 
    });

  } catch (error) {
    console.error("LAZADA PRODUCTS SYNC API ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}