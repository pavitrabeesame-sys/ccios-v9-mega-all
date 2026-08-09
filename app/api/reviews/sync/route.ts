import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SHOP_BRANDS: Record<string, string> = {
  "74401016": "RAV",
  "115383763": "RAV",
  "170808053": "JOHN_LANGFORD",
  "170811257": "BHPC",
  "282544493": "HUSH",
  "469553987": "OBERMAIN",
  "1637647671": "OBERMAIN",
  "1747523033": "OBERMAIN",
  "1747523036": "OBERMAIN",
  "190669704": "NICOLE",
  "66854646": "NICOLE",
  "1770621264": "RAV",
  "1770621271": "RAV"
};

const MAX_PAGES_PER_CALL = 15;

function cleanText(val: any, fallback: string): string {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return fallback;
  }
  return val.trim();
}

async function refreshAccessToken(partnerId: string, partnerKey: string, refreshToken: string, shopId: number) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: Number(partnerId), refresh_token: refreshToken, shop_id: Number(shopId) })
    });
    const data = await res.json();
    if (data.access_token) {
      return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
    }
  } catch (e) {
    console.error(`Failed to refresh token for shop ${shopId}:`, e);
  }
  return null;
}

async function processShop(account: any, partnerId: string, partnerKey: string) {
  const shopId = Number(account.shopId);
  let accessToken = account.accessToken;
  const refreshToken = account.refreshToken;
  const assignedBrand = SHOP_BRANDS[String(shopId)] || "BHPC";
  let syncedCount = 0;
  let shopHasError = false;
  const failedReasons: string[] = [];

  if (!accessToken) {
    return { shopId, synced: 0, error: 'No access token available' };
  }

  let pageNo = 1;
  let hasMore = true;
  let pagesProcessed = 0;

  while (hasMore && pagesProcessed < MAX_PAGES_PER_CALL) {
    pagesProcessed++;

    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/product/get_comment';
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&page_size=50&page_no=${pageNo}`;

    try {
      let res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      let shopeeResponse = await res.json();

      const errorText = `${shopeeResponse.error || ""} ${shopeeResponse.message || ""}`.toLowerCase();
      if (errorText.includes("token") || errorText.includes("auth")) {
        if (refreshToken) {
          const refreshed = await refreshAccessToken(partnerId, partnerKey, refreshToken, shopId);
          if (refreshed) {
            accessToken = refreshed.accessToken;
            await prisma.shopeeAccount.updateMany({
              where: { shopId },
              data: { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken }
            });

            const newTimestamp = Math.floor(Date.now() / 1000);
            const newBaseString = `${partnerId}${path}${newTimestamp}${accessToken}${shopId}`;
            const newSign = crypto.createHmac('sha256', partnerKey).update(newBaseString).digest('hex');
            const newUrl = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${newTimestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${newSign}&page_size=50&page_no=${pageNo}`;

            const retryRes = await fetch(newUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            shopeeResponse = await retryRes.json();
          } else {
            failedReasons.push('Token refresh failed');
            shopHasError = true;
            break;
          }
        } else {
          failedReasons.push('Token expired and no refresh token available');
          shopHasError = true;
          break;
        }
      }

      if (shopeeResponse.error) {
        failedReasons.push(`Page ${pageNo}: ${shopeeResponse.error} - ${shopeeResponse.message || ''}`);
        shopHasError = true;
        break;
      }

      const commentList = shopeeResponse.response?.item_comment_list || shopeeResponse.response?.comment_list || shopeeResponse.response?.list;

      if (commentList && Array.isArray(commentList) && commentList.length > 0) {
        for (let idx = 0; idx < commentList.length; idx++) {
          const item = commentList[idx];
          const reviewIdStr = String(item.comment_id || `${shopId}-${pageNo}-${idx}`);

          const resolvedProductName = cleanText(
            item.item_name || item.product_name || item.model_name || item.name ||
            (item.item_id ? `Shopee Product ${item.item_id}` : ""),
            "Unknown Product"
          );
          const resolvedProductSku = cleanText(item.item_sku || item.model_sku, "");
          const resolvedCustomerName = cleanText(item.buyer_username || item.author_name, "Shopee Buyer");
          const resolvedReviewText = cleanText(item.comment || item.review || item.content, "");

          await prisma.review.upsert({
            where: { reviewId: reviewIdStr },
            update: {
              reviewText: resolvedReviewText,
              rating: Number(item.rating_star || item.rating || 5),
              customerName: resolvedCustomerName,
              productName: resolvedProductName,
              productSku: resolvedProductSku,
              brand: assignedBrand,
              storeName: `${assignedBrand} Official Store (${shopId})`,
            },
            create: {
              reviewId: reviewIdStr,
              marketplace: 'SHOPEE',
              productName: resolvedProductName,
              productSku: resolvedProductSku,
              customerName: resolvedCustomerName,
              rating: Number(item.rating_star || item.rating || 5),
              reviewText: resolvedReviewText,
              status: 'PENDING',
              brand: assignedBrand,
              storeName: `${assignedBrand} Official Store (${shopId})`
            }
          });
          syncedCount++;
        }

        if (commentList.length < 50 || !shopeeResponse.response?.more) {
          hasMore = false;
        } else {
          pageNo++;
        }
      } else {
        hasMore = false;
      }
    } catch (err: any) {
      console.error(`Error fetching reviews for shop ${shopId} page ${pageNo}:`, err);
      failedReasons.push(`Page ${pageNo}: ${err.message || 'Unknown network error'}`);
      shopHasError = true;
      break;
    }
  }

  return { shopId, brand: assignedBrand, synced: syncedCount, error: shopHasError ? failedReasons.join('; ') : null, hasMore };
}

export async function POST(request: Request) {
  console.log("=== REVIEW SYNC START ===");
  try {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;

    if (!partnerId || !partnerKey) {
      return NextResponse.json({ success: false, error: 'Missing Shopee API partner credentials in environment variables.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get('shopId');

    const accounts = await prisma.shopeeAccount.findMany();
    console.log("Accounts found:", accounts.length);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: "No Shopee accounts found. Please authorize your Shopee shops first." }, { status: 400 });
    }

    const targetAccounts = shopIdParam
      ? accounts.filter(a => String(a.shopId) === String(shopIdParam))
      : accounts;

    if (shopIdParam && targetAccounts.length === 0) {
      return NextResponse.json({ success: false, error: `Shop ${shopIdParam} not found among authorized accounts.` }, { status: 404 });
    }

    const results = [];
    for (const account of targetAccounts) {
      console.log("Processing shop:", account.shopId);
      const result = await processShop(account, partnerId, partnerKey);
      results.push(result);
    }

    const syncedCount = results.reduce((sum, r) => sum + r.synced, 0);
    const successfulShops = results.filter(r => !r.error).length;
    const failedShops = results.filter(r => r.error).map(r => `${r.shopId}: ${r.error}`);

    console.log("=== REVIEW SYNC END ===");
    return NextResponse.json({
      success: true,
      syncedCount,
      processedShops: targetAccounts.length,
      successfulShops,
      failedShopCount: failedShops.length,
      failedShops,
      shopResults: results,
      message: `Synchronized ${syncedCount} reviews across ${successfulShops}/${targetAccounts.length} shop(s).`
    });

  } catch (error: any) {
    console.error('Shopee Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
