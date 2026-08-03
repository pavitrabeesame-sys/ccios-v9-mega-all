import crypto from "crypto";

const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";
const PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;

if (!PARTNER_ID ||!PARTNER_KEY) {
  throw new Error("Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY in.env");
}

function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function sign(baseString) {
  return crypto
   .createHmac("sha256", PARTNER_KEY)
   .update(baseString)
   .digest("hex");
}

function buildUrl(path, params = {}) {
  const url = new URL(HOST + path);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/**
 * 1. Build Auth URL to redirect seller to authorize
 */
export function buildAuthUrl(redirectUrl) {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = getTimestamp();
  const base = `${PARTNER_ID}${path}${timestamp}`;
  const signature = sign(base);

  return buildUrl(path, {
    partner_id: PARTNER_ID,
    timestamp,
    sign: signature,
    redirect: redirectUrl,
  });
}

/**
 * 2. Exchange auth code for access_token + refresh_token
 * Note: Shopee V2 requires shop_id in base string for this endpoint
 */
export async function exchangeCodeForToken(code, shopId) {
  if (!code ||!shopId) throw new Error("code and shopId are required");

  const path = "/api/v2/auth/token/get";
  const timestamp = getTimestamp();
  const base = `${PARTNER_ID}${path}${timestamp}${shopId}`; // shopId must be in base
  const signature = sign(base);

  const url = buildUrl(path, {
    partner_id: PARTNER_ID,
    timestamp,
    sign: signature,
  });

  const body = {
    code,
    partner_id: PARTNER_ID,
    shop_id: Number(shopId),
  };

  console.log("[Shopee] Exchanging code:", { shopId, url });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] Token Error:", data);
    throw new Error(`Shopee Token Error: ${data.message || data.error}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expire_in: data.expire_in,
    refresh_expire_in: data.refresh_token_expire_in,
    shop_id: data.shop_id,
  };
}

/**
 * 3. Refresh access_token using refresh_token
 * Note: shop_id must also be in base string here
 */
export async function refreshAccessToken(refreshToken, shopId) {
  if (!refreshToken ||!shopId) throw new Error("refreshToken and shopId are required");

  const path = "/api/v2/auth/access_token/get";
  const timestamp = getTimestamp();
  const base = `${PARTNER_ID}${path}${timestamp}${shopId}`; // shopId must be in base
  const signature = sign(base);

  const url = buildUrl(path, {
    partner_id: PARTNER_ID,
    timestamp,
    sign: signature,
  });

  const body = {
    partner_id: PARTNER_ID,
    shop_id: Number(shopId),
    refresh_token: refreshToken,
  };

  console.log("[Shopee] Refreshing token:", { shopId });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] Refresh Error:", data);
    throw new Error(`Shopee Refresh Error: ${data.message || data.error}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expire_in: data.expire_in,
    refresh_expire_in: data.refresh_token_expire_in,
    shop_id: data.shop_id,
  };
}

// Backward compatibility
export const createAuthURL = buildAuthUrl;