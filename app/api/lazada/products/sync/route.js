import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const APP_KEY = process.env.LAZADA_APP_KEY;
const APP_SECRET = process.env.LAZADA_APP_SECRET;
const HOST = process.env.LAZADA_HOST || "https://api.lazada.com.my/rest";

const LAZADA_BRAND_MAPPING = {
  "300934544102": { name: "Beverly Hills Polo Club", code: "BHPC" },
  "300763632066": { name: "Hush Puppies", code: "HUSH_PUPPIES" },
  "300749392344": { name: "Obermain", code: "OBERMAIN" },
  "100164017": { name: "Nicole", code: "NICOLE" },
  "1000055891": { name: "RAV", code: "RAV" },
};

function generateLazadaSign(apiPath, params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = apiPath;
  for (const key of sortedKeys) {
    baseString += key + params[key];
  }
  return crypto
    .createHmac('sha256', appSecret)
    .update(baseString)
    .digest('hex')
    .toUpperCase();
}

async function lazadaFetchGet(account, apiPath, params = {}) {
  const timestamp = String(Date.now());
  const accessToken = account.accessToken || account.access_token;

  const allParams = {
    app_key: APP_KEY,
    timestamp: timestamp,
    sign_method: 'sha256',
    access_token: accessToken,
    ...params,
  };

  const sign = generateLazadaSign(apiPath, allParams, APP_SECRET);
  allParams.sign = sign;

  const url = new URL(HOST + apiPath);
  Object.entries(allParams).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return await res.json();
}

export async function GET(request) {
  try {
    const accounts = await prisma.lazadaAccount?.findMany() || [];
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: "No lazadaAccount records found." }, { status: 404 });
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: "No company record found." }, { status: 400 });
    }

    // Ensure fallback "Unassigned" brand exists
    await prisma.brand.upsert({
      where: { code: "UNASSIGNED" },
      update: {},
      create: { name: "Unassigned", code: "UNASSIGNED", companyId: company.id }
    });

    const results = [];

    // Process accounts sequentially to prevent gateway timeout / fetch failed errors
    for (const account of accounts) {
      const sellerId = String(account.sellerId || account.id);
      const brandInfo = LAZADA_BRAND_MAPPING[sellerId] || { name: "Unassigned", code: "UNASSIGNED" };
      
      try {
        const brandRecord = await prisma.brand.upsert({
          where: { code: brandInfo.code },
          update: { name: brandInfo.name },
          create: { name: brandInfo.name, code: brandInfo.code, companyId: company.id }
        });
        const brandId = brandRecord.id;

        const listResponse = await lazadaFetchGet(account, '/products/get', {
          filter: 'all',
          offset: '0',
          limit: '50'
        });

        if (listResponse.code && listResponse.code !== "0") {
          results.push({ sellerId, brand: brandInfo.name, error: `Lazada API Error: ${listResponse.message || listResponse.code}`, status: 'failed' });
          continue;
        }

        const productsList = listResponse?.data?.products || [];
        let importedCount = 0;

        for (const item of productsList) {
          const itemId = item.item_id;
          const skus = item.skus || [];
          if (skus.length === 0) continue;

          const primarySku = skus[0];
          const sku = primarySku.SellerSku || primarySku.sku_id || String(itemId);
          const name = item.attributes?.name || item.product_name || `Lazada Item ${itemId}`;
          const price = Number(primarySku.price || primarySku.offer_price || 0);
          const stock = Number(primarySku.quantity || primarySku.stock || 0);

          if (!sku) continue;

          await prisma.product.upsert({
            where: { sku: sku },
            update: { name, price, stock, brandId, updatedAt: new Date() },
            create: { sku, name, marketplace: 'LAZADA', price, stock, brandId },
          });

          importedCount++;
        }

        results.push({ sellerId, brand: brandInfo.name, imported: importedCount, status: 'success' });
      } catch (err) {
        results.push({ sellerId, brand: brandInfo.name, error: err.message, status: 'failed' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}