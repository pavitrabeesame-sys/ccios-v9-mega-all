import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Shopee Config
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const SHOPEE_HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

const SHOPEE_BRAND_MAPPING = {
  "66854646": { name: "Nicole", code: "NICOLE" },
  "190669704": { name: "Nicole", code: "NICOLE" },
  "170808053": { name: "John Langford", code: "JOHN_LANGFORD" },
  "170811257": { name: "Beverly Hills Polo Club", code: "BHPC" },
  "1770621264": { name: "RAV", code: "RAV" },
  "1770621271": { name: "RAV", code: "RAV" },
  "115383763": { name: "RAV", code: "RAV" },
  "74401016": { name: "RAV", code: "RAV" },
  "1637647671": { name: "Obermain", code: "OBERMAIN" },
  "1747523033": { name: "Obermain", code: "OBERMAIN" },
  "1747523036": { name: "Obermain", code: "OBERMAIN" },
  "469553987": { name: "Obermain", code: "OBERMAIN" },
  "282544493": { name: "Hush Puppies", code: "HUSH_PUPPIES" },
};

// Lazada Config
const LAZADA_APP_KEY = process.env.LAZADA_APP_KEY;
const LAZADA_APP_SECRET = process.env.LAZADA_APP_SECRET;
const LAZADA_HOST = process.env.LAZADA_HOST || "https://api.lazada.com.my/rest";

const LAZADA_BRAND_MAPPING = {
  "300934544102": { name: "Beverly Hills Polo Club", code: "BHPC" },
  "300763632066": { name: "Hush Puppies", code: "HUSH_PUPPIES" },
  "300749392344": { name: "Obermain", code: "OBERMAIN" },
  "100164017": { name: "Nicole", code: "NICOLE" },
  "1000055891": { name: "RAV", code: "RAV" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Shopee Helpers
function signShopee(baseString) {
  return crypto.createHmac("sha256", SHOPEE_PARTNER_KEY).update(baseString).digest("hex");
}

async function refreshShopeeAccessToken(account) {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}`;
  const signature = signShopee(baseString);
  const url = new URL(SHOPEE_HOST + path);
  url.searchParams.set("partner_id", SHOPEE_PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: account.refreshToken,
      shop_id: Number(account.shopId),
      partner_id: Number(SHOPEE_PARTNER_ID)
    }),
  });
  
  const data = await res.json();
  if (data.access_token) {
    const updated = await prisma.shopeeAccount.update({
      where: { id: account.id },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        updatedAt: new Date()
      }
    });
    return updated.accessToken;
  }
  throw new Error(data.message || "Failed to refresh Shopee token");
}

async function shopeeFetchGet(account, path, params = {}) {
  let accessToken = account.accessToken;
  const shopId = String(account.shopId);

  for (let attempt = 0; attempt < 2; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${SHOPEE_PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
    const signature = signShopee(baseString);

    const url = new URL(SHOPEE_HOST + path);
    url.searchParams.set("partner_id", SHOPEE_PARTNER_ID);
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("sign", signature);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("shop_id", shopId);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error && (data.error.includes("access_token") || data.message?.includes("access_token")) && attempt === 0) {
      accessToken = await refreshShopeeAccessToken(account);
      continue;
    }

    return data;
  }
}

// Lazada Helpers
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
  const accessToken = account.accessToken;

  const allParams = {
    app_key: LAZADA_APP_KEY,
    timestamp: timestamp,
    sign_method: 'sha256',
    access_token: accessToken,
    ...params,
  };

  const sign = generateLazadaSign(apiPath, allParams, LAZADA_APP_SECRET);
  allParams.sign = sign;

  const url = new URL(LAZADA_HOST + apiPath);
  Object.entries(allParams).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * attempt);
    }
  }
}

export async function GET(request) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: "No company record found." }, { status: 400 });
    }

    await prisma.brand.upsert({
      where: { code: "UNASSIGNED" },
      update: {},
      create: { name: "Unassigned", code: "UNASSIGNED", companyId: company.id }
    });

    // 1. Run Shopee Synchronization
    const shopeeAccounts = await prisma.shopeeAccount?.findMany() || [];
    const shopeeResults = [];

    for (const account of shopeeAccounts) {
      const shopIdStr = String(account.shopId);
      const brandInfo = SHOPEE_BRAND_MAPPING[shopIdStr] || { name: "Unassigned", code: "UNASSIGNED" };
      
      try {
        const brandRecord = await prisma.brand.upsert({
          where: { code: brandInfo.code },
          update: { name: brandInfo.name },
          create: { name: brandInfo.name, code: brandInfo.code, companyId: company.id }
        });
        const brandId = brandRecord.id;

        const listResponse = await shopeeFetchGet(account, '/api/v2/product/get_item_list', {
          offset: 0,
          page_size: 50,
          item_status: 'NORMAL'
        });

        if (listResponse.error) {
          shopeeResults.push({ shopId: shopIdStr, brand: brandInfo.name, error: `Shopee API Error: ${listResponse.message || listResponse.error}`, status: 'failed' });
          continue;
        }

        const itemList = listResponse?.response?.item || [];
        let importedCount = 0;

        for (const listItem of itemList) {
          const itemId = listItem.item_id;
          
          const detailResponse = await shopeeFetchGet(account, '/api/v2/product/get_item_base_info', {
            item_id_list: String(itemId)
          });
          const itemInfo = detailResponse?.response?.item_list?.[0];
          if (!itemInfo) continue;

          const sku = itemInfo.item_sku || String(itemId);
          const name = itemInfo.item_name || `Shopee Item ${itemId}`;
          const price = Number(itemInfo.price_info?.[0]?.original_price || itemInfo.price_info?.[0]?.current_price || 0);
          const stock = Number(itemInfo.stock_info?.[0]?.normal_stock || 0);

          if (!sku) continue;

          await prisma.product.upsert({
            where: { sku: sku },
            update: { 
              name, 
              price, 
              stock, 
              brandId, 
              companyId: company.id,
              shopeeItemId: BigInt(itemId),
              marketplace: 'SHOPEE',
              updatedAt: new Date() 
            },
            create: { 
              sku, 
              name, 
              marketplace: 'SHOPEE', 
              price, 
              stock, 
              brandId, 
              companyId: company.id,
              shopeeItemId: BigInt(itemId)
            },
          });
          importedCount++;
        }

        shopeeResults.push({ shopId: shopIdStr, brand: brandInfo.name, imported: importedCount, status: 'success' });
      } catch (err) {
        shopeeResults.push({ shopId: shopIdStr, brand: brandInfo.name, error: err.message, status: 'failed' });
      }
    }

    await sleep(2000);

    // 2. Run Lazada Synchronization
    const lazadaAccounts = await prisma.lazadaAccount?.findMany() || [];
    const lazadaResults = [];

    for (const account of lazadaAccounts) {
      const sellerId = String(account.sellerId);
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
          lazadaResults.push({ sellerId, brand: brandInfo.name, error: `Lazada API Error: ${listResponse.message || listResponse.code}`, status: 'failed' });
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
            update: { 
              name, 
              price, 
              stock, 
              brandId, 
              companyId: company.id,
              marketplace: 'LAZADA',
              updatedAt: new Date() 
            },
            create: { 
              sku, 
              name, 
              marketplace: 'LAZADA', 
              price, 
              stock, 
              brandId, 
              companyId: company.id 
            },
          });

          importedCount++;
        }

        lazadaResults.push({ sellerId, brand: brandInfo.name, imported: importedCount, status: 'success' });
      } catch (err) {
        lazadaResults.push({ sellerId, brand: brandInfo.name, error: err.message, status: 'failed' });
      }

      await sleep(500);
    }

    return NextResponse.json({
      success: true,
      shopee: shopeeResults,
      lazada: lazadaResults
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}