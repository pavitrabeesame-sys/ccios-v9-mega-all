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

function signShopee(baseString) {
  return crypto.createHmac("sha256", SHOPEE_PARTNER_KEY).update(baseString).digest("hex");
}

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

async function runStandaloneSync() {
  console.log("Starting Shopee review sync...");
  let totalShopeeReviews = 0;

  try {
    const shopeeAccounts = await prisma.shopeeAccount?.findMany() || [];
    console.log(`Found ${shopeeAccounts.length} Shopee accounts.`);

    for (const account of shopeeAccounts) {
      const shopIdStr = String(account.shopId);
      const brandInfo = SHOPEE_BRAND_MAPPING[shopIdStr] || { name: "Unassigned" };
      console.log(`Processing Shopee Shop ID: ${shopIdStr} (${brandInfo.name})`);

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

          if (resData.error) {
            console.log(`Shopee error for shop ${shopIdStr}:`, resData.message || resData.error);
            break;
          }

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
        console.error(`Shopee sync error for shop ${shopIdStr}:`, err.message);
      }
    }

    console.log(`\nSync Completed Successfully!`);
    console.log(`- Shopee Reviews Synced: ${totalShopeeReviews}`);
  } catch (error) {
    console.error('Fatal sync error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runStandaloneSync();
