import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

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

function sign(baseString) {
  return crypto.createHmac("sha256", PARTNER_KEY).update(baseString).digest("hex");
}

async function refreshAccessToken(account) {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const signature = sign(baseString);
  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: account.refreshToken || account.refresh_token,
      shop_id: Number(account.shopId || account.partnerId),
      partner_id: Number(PARTNER_ID)
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
  throw new Error(data.message || "Failed to refresh token");
}

async function shopeeFetchGet(account, path, params = {}) {
  let accessToken = account.accessToken || account.access_token;
  const shopId = String(account.shopId || account.partnerId);

  for (let attempt = 0; attempt < 2; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
    const signature = sign(baseString);

    const url = new URL(HOST + path);
    url.searchParams.set("partner_id", PARTNER_ID);
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("sign", signature);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("shop_id", shopId);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.error && (data.error.includes("access_token") || data.message?.includes("access_token")) && attempt === 0) {
      accessToken = await refreshAccessToken(account);
      continue;
    }

    return data;
  }
}

export async function GET(request) {
  try {
    const accounts = await prisma.shopeeAccount?.findMany() || [];
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: "No shopeeAccount records found." }, { status: 404 });
    }

    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ success: false, error: "No company record found." }, { status: 400 });
    }

    // Process all shops concurrently for maximum speed
    const results = await Promise.all(accounts.map(async (account) => {
      const shopId = String(account.shopId || account.partnerId);
      const brandInfo = SHOPEE_BRAND_MAPPING[shopId] || { name: "Unassigned", code: "UNASSIGNED" };
      
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
          return { shopId, brand: brandInfo.name, error: `Shopee API Error: ${listResponse.message || listResponse.error}`, status: 'failed' };
        }

        const itemList = listResponse?.response?.item || [];
        if (itemList.length === 0) {
          return { shopId, brand: brandInfo.name, imported: 0, status: 'success' };
        }

        // Fetch all item details in parallel chunks to avoid sequential latency
        const productPromises = itemList.map(async (listItem) => {
          const itemId = listItem.item_id;
          const detailResponse = await shopeeFetchGet(account, '/api/v2/product/get_item_base_info', {
            item_id_list: String(itemId)
          });

          const itemInfo = detailResponse?.response?.item_list?.[0];
          if (!itemInfo) return null;

          const sku = itemInfo.item_sku || String(itemId);
          const name = itemInfo.item_name || `Shopee Item ${itemId}`;
          const price = Number(itemInfo.price_info?.[0]?.original_price || itemInfo.price_info?.[0]?.current_price || 0);
          const stock = Number(itemInfo.stock_info?.[0]?.normal_stock || 0);

          if (!sku) return null;

          return prisma.product.upsert({
            where: { sku: sku },
            update: { name, price, stock, brandId, updatedAt: new Date() },
            create: { sku, name, marketplace: 'SHOPEE', price, stock, brandId },
          });
        });

        const upsertResults = await Promise.all(productPromises);
        const importedCount = upsertResults.filter(Boolean).length;

        return { shopId, brand: brandInfo.name, imported: importedCount, status: 'success' };
      } catch (err) {
        return { shopId, brand: brandInfo.name, error: err.message, status: 'failed' };
      }
    }));

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}