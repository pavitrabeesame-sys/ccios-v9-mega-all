import crypto from "crypto";

const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

function getConfig() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  if (!partnerId || !partnerKey) {
    throw new Error("Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY");
  }
  return { partnerId, partnerKey };
}

function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function sign(baseString: string, partnerKey: string) {
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

function buildUrl(path: string, params: Record<string, any> = {}) {
  const url = new URL(HOST + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") { // skip empty
      url.searchParams.set(k, String(v));
    }
  });
  return url.toString();
}

/* STEP 1: AUTHORIZE SHOP */
export function buildAuthUrl(redirectUrl: string) {
  const { partnerId, partnerKey } = getConfig();
  const path = "/api/v2/shop/auth_partner";
  const timestamp = getTimestamp();
  const baseString = `${partnerId}${path}${timestamp}`;
  const signature = sign(baseString, partnerKey);
  return buildUrl(path, { partner_id: partnerId, timestamp, sign: signature, redirect: redirectUrl });
}

/* STEP 2: EXCHANGE CODE */
export async function exchangeCodeForToken(code: string, shopId: number) {
  const { partnerId, partnerKey } = getConfig();
  const path = "/api/v2/auth/token/get";
  const timestamp = getTimestamp();
  const baseString = `${partnerId}${path}${timestamp}${shopId}`;
  const signature = sign(baseString, partnerKey);
  const url = buildUrl(path, { partner_id: partnerId, timestamp, sign: signature });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, partner_id: partnerId, shop_id: shopId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.message || data.error);
  return data;
}

/* STEP 3: REFRESH TOKEN */
export async function refreshAccessToken(refreshToken: string, shopId: number) {
  const { partnerId, partnerKey } = getConfig();
  const path = "/api/v2/auth/access_token/get";
  const timestamp = getTimestamp();
  const baseString = `${partnerId}${path}${timestamp}${shopId}`;
  const signature = sign(baseString, partnerKey);
  const url = buildUrl(path, { partner_id: partnerId, timestamp, sign: signature });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_id: partnerId, refresh_token: refreshToken, shop_id: shopId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.message || data.error);
  return data;
}

/* STEP 4: FOR v2.product.get_comment and all other shop APIs */
export function buildShopApiUrl(
  path: string,
  accessToken: string,
  shopId: number | string,
  params: Record<string, any> = {}
) {
  const { partnerId, partnerKey } = getConfig();
  const timestamp = getTimestamp();
  // BaseString format for shop APIs: partnerId + path + timestamp + accessToken + shopId
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  const signature = sign(baseString, partnerKey);

  return buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    access_token: accessToken,
    shop_id: shopId,
    sign: signature,
    ...params, // cursor, page_size, item_id, comment_id etc
  });
}