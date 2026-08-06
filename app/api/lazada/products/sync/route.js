import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { LAZADA_BRAND_MAPPING } from '@/src/lib/brandMapping';
import { lazadaGet } from '@/lib/lazada';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const accounts = await prisma.lazadaAccount.findMany();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: "No lazadaAccount records found in database." }, { status: 404 });
    }

    const results = [];

    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: "No company record found in database for brand relations." }, { status: 400 });
    }

    for (const account of accounts) {
      const sellerId = account.sellerId;
      const brandInfo = LAZADA_BRAND_MAPPING[sellerId];
      let brandId = null;
      let brandName = "Unassigned";

      if (brandInfo) {
        brandName = brandInfo.name;
        const brandRecord = await prisma.brand.upsert({
          where: { code: brandInfo.code },
          update: { name: brandInfo.name },
          create: {
            name: brandInfo.name,
            code: brandInfo.code,
            companyId: company.id
          }
        });
        brandId = brandRecord.id;
      }

      try {
        const response = await lazadaGet(sellerId, '/products/get', {
          filter: 'all',
          limit: 50
        });

        const products = response?.data?.products || [];
        let importedCount = 0;

        for (const item of products) {
          const sku = item.skus?.[0]?.SellerSku || String(item.item_id);
          const name = item.product_name || `Lazada Item ${item.item_id}`;
          const price = Number(item.skus?.[0]?.price || item.skus?.[0]?.offer_price || 0);
          const stock = Number(item.skus?.[0]?.stock || 0);

          if (!sku) continue;

          await prisma.product.upsert({
            where: { sku: sku },
            update: {
              name: name,
              price: price,
              stock: stock,
              brandId: brandId,
              updatedAt: new Date(),
            },
            create: {
              sku: sku,
              name: name,
              marketplace: 'LAZADA',
              price: price,
              stock: stock,
              brandId: brandId,
            },
          });

          importedCount++;
        }

        results.push({
          sellerId,
          brand: brandName,
          imported: importedCount,
          status: 'success'
        });

      } catch (accountError) {
        results.push({
          sellerId,
          brand: brandName,
          error: accountError.message,
          status: 'failed'
        });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('[Lazada Sync Route Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}