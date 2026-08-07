import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SHOP\_BRANDS: Record\<string, string> = {
"74401016": "RAV",
"115383763": "RAV",
"170808053": "JOHN\_LANGFORD",
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

async function refreshAccessToken(partnerId: string, partnerKey: string, refreshToken: string, shopId: number) {
try {
const timestamp = Math.floor(Date.now() / 1000);
const path = '/api/v2/auth/access\_token/get';
const baseString = `${partnerId}${path}${timestamp}`;
const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

```
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ partner_id: Number(partnerId), refresh_token: refreshToken, shop_id: Number(shopId) })
});
const data = await res.json();
if (data.access_token) {
  return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
}
```

} catch (e) {
console.error(`Failed to refresh token for shop ${shopId}:`, e);
}
return null;
}

export async function POST(request: Request) {
try {
const partnerId = process.env.SHOPEE\_PARTNER\_ID;
const partnerKey = process.env.SHOPEE\_PARTNER\_KEY;

```
if (!partnerId || !partnerKey) {
  return NextResponse.json({ 
    success: false, 
    error: 'Missing Shopee API partner credentials in environment variables.' 
  }, { status: 400 });
}

const accounts = await prisma.shopeeAccount.findMany();

if (!accounts || accounts.length === 0) {
  return NextResponse.json(
    {
      success: false,
      error: "No Shopee accounts found. Please authorize your Shopee shops first."
    },
    { status: 400 }
  );
}

let syncedCount = 0;
let successfulShops = 0;
const failedShops: string[] = [];

for (const account of accounts) {
  const shopId = Number(account.shopId);
  let accessToken = account.accessToken;
  const refreshToken = account.refreshToken;
  const assignedBrand = SHOP_BRANDS[String(shopId)] || "BHPC";

  if (!accessToken) {
    failedShops.push(`${shopId}: No access token available`);
    continue;
  }

  let pageNo = 1;
  let hasMore = true;
  let safety = 0;
  let shopHasError = false;

  while (hasMore && safety < 100) {
    safety++;
    // Optimized 50ms delay to respect rate limits without risking Vercel timeout limits
    await new Promise(resolve => setTimeout(resolve, 50));

    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/product/get_comment';
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&page_size=50&page_no=${pageNo}`;

    try {
      let res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
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
            
            const retryRes = await fetch(newUrl, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
            shopeeResponse = await retryRes.json();
          } else {
            failedShops.push(`${shopId}: Token refresh failed`);
            shopHasError = true;
            hasMore = false;
            break;
          }
        } else {
          failedShops.push(`${shopId}: Token expired and no refresh token available`);
          shopHasError = true;
          hasMore = false;
          break;
        }
      }

      // Capture general Shopee API-level errors (non-token related)
      if (shopeeResponse.error) {
        failedShops.push(`${shopId} (Page ${pageNo}): ${shopeeResponse.error} - ${shopeeResponse.message || ''}`);
        shopHasError = true;
        hasMore = false;
        break;
      }

      const commentList = shopeeResponse.response?.item_comment_list || shopeeResponse.response?.comment_list || shopeeResponse.response?.list;

      if (commentList && Array.isArray(commentList) && commentList.length > 0) {
        for (let idx = 0; idx < commentList.length; idx++) {
          const item = commentList[idx];
          const reviewIdStr = String(item.comment_id || `${shopId}-${pageNo}-${idx}`);

          await prisma.review.upsert({
            where: { reviewId: reviewIdStr },
            update: {
              reviewText: item.comment || item.review || item.content || '',
              rating: Number(item.rating_star || item.rating || 5),
              customerName: item.buyer_username || item.author_name || 'Shopee Buyer',
              productName: item.item_name || item.product_name || null,
              productSku: item.item_sku || item.model_sku || null,
              brand: assignedBrand,
              storeName: `${assignedBrand} Official Store (${shopId})`,
            },
            create: {
              reviewId: reviewIdStr,
              marketplace: 'SHOPEE',
              productName: item.item_name || item.product_name || null,
              productSku: item.item_sku || item.model_sku || null,
              customerName: item.buyer_username || item.author_name || 'Shopee Buyer',
              rating: Number(item.rating_star || item.rating || 5),
              reviewText: item.comment || item.review || item.content || '',
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
      failedShops.push(`${shopId} page ${pageNo}: ${err.message || 'Unknown network error'}`);
      shopHasError = true;
      hasMore = false;
    }
  }

  if (!shopHasError) {
    successfulShops++;
  }
}

return NextResponse.json({
  success: true,
  syncedCount,
  processedShops: accounts.length,
  successfulShops,
  failedShopCount: failedShops.length,
  failedShops,
  message: `Successfully synchronized ${syncedCount} real reviews across ${successfulShops}/${accounts.length} shops.`
});
```

} catch (error: any) {
console.error('Shopee Sync Error:', error);
return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
}
