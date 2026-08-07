export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

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

// Helper to prevent fetch requests from hanging indefinitely
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

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

  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: account.refreshToken,
      shop_id: Number(account.shopId),
      partner_id: Number(SHOPEE_PARTNER_ID)
    }),
  }, 10000);
  
  const data = await res.json();
  if (data.access_token) {
    const updated = await prisma.shopeeAccount.update({
      where: { id: account.id },
      data: { accessToken: data.access_token, refreshToken: data.refreshToken, updatedAt: new Date() }
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

    const res = await fetchWithTimeout(url.toString(), {}, 10000);
    const data = await res.json();

    if (data.error && (data.error.includes("access_token") || data.message?.includes("access_token")) && attempt === 0) {
      accessToken = await refreshShopeeAccessToken(account);
      continue;
    }
    return data;
  }
}

function generateLazadaSign(apiPath, params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let baseString = apiPath;
  for (const key of sortedKeys) {
    baseString += key + params[key];
  }
  return crypto.createHmac('sha256', appSecret).update(baseString).digest('hex').toUpperCase();
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
      const res = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }, 10000);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function lazadaFetchGetWithRetry(account, apiPath, params = {}, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await lazadaFetchGet(account, apiPath, params);
    if (result?.code !== 'ApiCallLimit') {
      return result;
    }
    const backoff = 1500 * (attempt + 1);
    await sleep(backoff);
  }
  return await lazadaFetchGet(account, apiPath, params);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { brand, marketplace } = body;

    let totalShopeeReviews = 0;
    let totalLazadaReviews = 0;
    let lazadaDebugLogs = [];

    // 1. Sync Shopee Reviews
    if (!marketplace || marketplace.toUpperCase() === 'SHOPEE') {
      const shopeeAccounts = await prisma.shopeeAccount?.findMany() || [];

      for (const account of shopeeAccounts) {
        const shopIdStr = String(account.shopId);
        const brandInfo = SHOPEE_BRAND_MAPPING[shopIdStr] || { name: "Unassigned" };

        if (brand && brand.toLowerCase() !== brandInfo.name.toLowerCase()) continue;

        try {
          let cursor = "";
          let hasMore = true;
          let loops = 0;

          while (hasMore && loops < 5) {
            loops++;
            const resData = await shopeeFetchGet(account, '/api/v2/product/get_comment', {
              cursor: cursor,
              page_size: 50
            });

            if (resData.error) break;

            const comments = resData?.response?.item_comment_list || [];
            hasMore = resData?.response?.more || false;
            cursor = resData?.response?.next_cursor || "";

            for (const c of comments) {
              const reviewId = String(c.comment_id);
              const customerName = c.buyer_username || "Anonymous Shopee Buyer";
              const rating = Number(c.rating || 5);
              const reviewText = c.comment || "";
              const orderNumber = c.order_sn || null;
              const itemSku = String(c.item_id || "");

              const product = await prisma.product.findFirst({
                where: { OR: [{ sku: itemSku }, { shopeeItemId: BigInt(c.item_id || 0) }] }
              });
              const productName = product ? product.name : `Shopee Product ${c.item_id}`;

              await prisma.review.upsert({
                where: { reviewId },
                update: { rating, reviewText, updatedAt: new Date() },
                create: {
                  reviewId,
                  marketplace: 'SHOPEE',
                  storeName: brandInfo.name,
                  brand: brandInfo.name,
                  productName,
                  productSku: itemSku,
                  customerName,
                  rating,
                  reviewText,
                  orderNumber,
                  status: 'PENDING'
                }
              });
              totalShopeeReviews++;
            }
            if (!hasMore || comments.length === 0) break;
          }
        } catch (err) {
          console.error(`Shopee review sync error for shop ${shopIdStr}:`, err.message);
        }
      }
    }

    // 2. Sync Lazada Reviews with Timeout Protection
    if (!marketplace || marketplace.toUpperCase() === 'LAZADA') {
      const lazadaAccounts = await prisma.lazadaAccount?.findMany() || [];
      lazadaDebugLogs.push(`Found ${lazadaAccounts.length} Lazada accounts in DB.`);

      for (const account of lazadaAccounts) {
        await sleep(1000); 
        lazadaDebugLogs.push(`LOOP ENTER sellerId=${account.sellerId}`);
        const sellerId = typeof account.sellerId === 'bigint' ? account.sellerId.toString() : String(account.sellerId);
        const brandInfo = LAZADA_BRAND_MAPPING[sellerId] || { name: "Unassigned" };

        if (brand && brand.toLowerCase() !== brandInfo.name.toLowerCase()) continue;
        if (!account.accessToken) continue;

        try {
          const prodData = await lazadaFetchGetWithRetry(account, '/products/get', {
            filter: 'live',
            limit: '5'
          });

          const productsList = prodData?.data?.products || [];

          for (const p of productsList) {
            const itemId = p.item_id;
            if (!itemId) continue;

            await sleep(1200); 

            const reviewRes = await lazadaFetchGetWithRetry(account, '/review/seller/list', {
              item_id: String(itemId),
              page_size: '50',
              current: '1'
            });

            if (reviewRes.code === "0" && reviewRes.data?.data) {
              const reviewsList = reviewRes.data.data;
              for (const itemReviewGroup of reviewsList) {
                const innerReviews = itemReviewGroup.reviews || [];
                for (const r of innerReviews) {
                  const reviewId = String(r.id || `${itemId}_${Math.random()}`);
                  const customerName = r.buyer_name || "Anonymous Lazada Buyer";
                  const rating = Number(r.ratings?.product_rating || r.rating || 5);
                  const reviewText = r.review_content || "";
                  const productName = p.attributes?.name || "Lazada Product";
                  const productSku = p.skus?.[0]?.seller_sku || null;

                  await prisma.review.upsert({
                    where: { reviewId },
                    update: { rating, reviewText, updatedAt: new Date() },
                    create: {
                      reviewId,
                      marketplace: 'LAZADA',
                      storeName: brandInfo.name,
                      brand: brandInfo.name,
                      productName,
                      productSku,
                      customerName,
                      rating,
                      reviewText,
                      status: 'PENDING'
                    }
                  });
                  totalLazadaReviews++;
                }
              }
            }
          }
        } catch (err) {
          lazadaDebugLogs.push(`Lazada error for seller ${sellerId}: ${err.message}`);
        }
      }
    }

    const totalSynced = totalShopeeReviews + totalLazadaReviews;

    return NextResponse.json({
      success: true,
      message: 'Smart sync completed successfully.',
      syncedCount: totalSynced,
      breakdown: {
        shopee: totalShopeeReviews,
        lazada: totalLazadaReviews
      },
      lazadaDebug: lazadaDebugLogs,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Smart-Sync API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return POST(request);
}