import crypto from "crypto";

const HOST = "https://partner.shopeemobile.com";
const PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;

function sign(baseString) {
  return crypto
  .createHmac("sha256", PARTNER_KEY)
  .update(baseString)
  .digest("hex");
}

function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get reviews for a specific item
 * Shopee API: /api/v2/product/get_comment
 */
export async function getItemReviews({ shopId, accessToken, itemId, cursor = "", pageSize = 50 }) {
  if (!shopId ||!accessToken ||!itemId) {
    throw new Error("shopId, accessToken, itemId are required");
  }

  const path = "/api/v2/product/get_comment";
  const timestamp = getTimestamp();

  // IMPORTANT: base string for product APIs: partner_id + path + timestamp + access_token + shop_id
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(base);

  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("item_id", itemId);
  url.searchParams.set("cursor", cursor);
  url.searchParams.set("page_size", pageSize);
  url.searchParams.set("sign", signature);

  console.log("[Shopee] Fetching reviews for item:", itemId);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] get_comment Error:", data);
    throw new Error(`Shopee API Error: ${data.message}`);
  }

  return {
    reviews: data.data?.comments || [],
    hasMore: data.data?.has_next_page || false,
    nextCursor: data.data?.next_cursor || ""
  };
}

/**
 * Reply to a review/comment
 * Shopee API: /api/v2/product/reply_comment
 */
export async function replyShopeeReview(shop, reviewId, reply) {
  const { shopId, accessToken } = shop;

  const path = "/api/v2/product/reply_comment";
  const timestamp = getTimestamp();
  const base = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(base);

  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("sign", signature);

  const body = {
    comment_id: reviewId,
    reply_content: reply
  };

  console.log("[Shopee] Replying to:", reviewId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] reply_comment Error:", data);
    return { success: false, status: "FAILED", error: data.message };
  }

  return { success: true, status: "APPROVED" };
}

/**
 * Helper: Loop through all shop items and get reviews
 * Use this in your cron
 */
export async function syncAllShopReviews(shop) {
  // TODO: First you need to call get_item_list to get all item_ids
  // Then loop each itemId and call getItemReviews
  console.log("[Sync] Starting for shop:", shop.shopId);
  return { total: 0 };
}