import crypto from "crypto";

const HOST =
  process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

/**
 * Load Shopee configuration only when needed.
 * This prevents Next.js from failing during build.
 */
function getConfig() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    throw new Error(
      "Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY in .env"
    );
  }

  return {
    partnerId,
    partnerKey,
  };
}

function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function sign(baseString) {
  const { partnerKey } = getConfig();

  return crypto
    .createHmac("sha256", partnerKey)
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
 * Build Shopee Authorization URL
 */
export function buildAuthUrl(redirectUrl) {
  const { partnerId } = getConfig();

  const path = "/api/v2/shop/auth_partner";
  const timestamp = getTimestamp();
  const base = `${partnerId}${path}${timestamp}`;
  const signature = sign(base);

  return buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
    redirect: redirectUrl,
  });
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code, shopId) {
  const { partnerId } = getConfig();

  if (!code || !shopId) {
    throw new Error("code and shopId are required");
  }

  const path = "/api/v2/auth/token/get";
  const timestamp = getTimestamp();
  const base = `${partnerId}${path}${timestamp}${shopId}`;
  const signature = sign(base);

  const url = buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
  });

  const body = {
    code,
    partner_id: partnerId,
    shop_id: Number(shopId),
  };

  console.log("[Shopee] Exchanging code:", { shopId, url });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] Token Error:", data);

    throw new Error(
      `Shopee Token Error: ${data.message || data.error}`
    );
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
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken, shopId) {
  const { partnerId } = getConfig();

  if (!refreshToken || !shopId) {
    throw new Error("refreshToken and shopId are required");
  }

  const path = "/api/v2/auth/access_token/get";
  const timestamp = getTimestamp();
  const base = `${partnerId}${path}${timestamp}${shopId}`;
  const signature = sign(base);

  const url = buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
  });

  const body = {
    partner_id: partnerId,
    shop_id: Number(shopId),
    refresh_token: refreshToken,
  };

  console.log("[Shopee] Refreshing token:", { shopId });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    console.error("[Shopee] Refresh Error:", data);

    throw new Error(
      `Shopee Refresh Error: ${data.message || data.error}`
    );
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