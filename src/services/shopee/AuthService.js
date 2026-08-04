import crypto from "crypto";

const HOST =
  process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";

function getConfig() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    throw new Error(
      "Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY"
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

function sign(baseString, partnerKey) {
  return crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");
}

function buildUrl(path, params = {}) {
  const url = new URL(HOST + path);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  });

  return url.toString();
}

/* ============================================================
   STEP 1
   AUTHORIZE SHOP
============================================================ */

export function buildAuthUrl(redirectUrl) {
  const { partnerId, partnerKey } = getConfig();

  const path = "/api/v2/shop/auth_partner";
  const timestamp = getTimestamp();

  const baseString =
    `${partnerId}${path}${timestamp}`;

  const signature =
    sign(baseString, partnerKey);

  console.log("========== AUTH ==========");
  console.log({
    partnerId,
    timestamp,
    path,
    baseString,
    signature,
    redirectUrl,
  });

  return buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
    redirect: redirectUrl,
  });
}

/* ============================================================
   STEP 2
   EXCHANGE CODE FOR TOKEN
============================================================ */

export async function exchangeCodeForToken(
  code,
  shopId
) {
  const { partnerId, partnerKey } = getConfig();

  if (!code)
    throw new Error("Missing code");

  if (!shopId)
    throw new Error("Missing shop_id");

  const path =
    "/api/v2/auth/token/get";

  const timestamp =
    getTimestamp();

  // Shopee requires shop_id here
  const baseString =
    `${partnerId}${path}${timestamp}${shopId}`;

  const signature =
    sign(baseString, partnerKey);

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

  console.log("========== TOKEN ==========");
  console.log({
    partnerId,
    shopId,
    timestamp,
    path,
    baseString,
    signature,
    partnerKeyLength:
      partnerKey.length,
  });

  console.log("Request URL:", url);
  console.log("Request Body:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log(
    "Shopee Response:",
    JSON.stringify(data, null, 2)
  );

  if (data.error) {
    throw new Error(
      data.message || data.error
    );
  }

  return data;
}

/* ============================================================
   STEP 3
   REFRESH TOKEN
============================================================ */

export async function refreshAccessToken(
  refreshToken,
  shopId
) {
  const { partnerId, partnerKey } =
    getConfig();

  const path =
    "/api/v2/auth/access_token/get";

  const timestamp =
    getTimestamp();

  const baseString =
    `${partnerId}${path}${timestamp}${shopId}`;

  const signature =
    sign(baseString, partnerKey);

  const url = buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
  });

  const body = {
    partner_id: partnerId,
    refresh_token: refreshToken,
    shop_id: Number(shopId),
  };

  console.log("========== REFRESH ==========");
  console.log({
    partnerId,
    shopId,
    timestamp,
    path,
    baseString,
    signature,
    partnerKeyLength:
      partnerKey.length,
  });

  console.log("Request URL:", url);
  console.log("Request Body:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log(
    "Shopee Refresh Response:",
    JSON.stringify(data, null, 2)
  );

  if (data.error) {
    throw new Error(
      data.message || data.error
    );
  }

  return data;
}

/* ============================================================
   STEP 4
   SHOP API HELPER
============================================================ */

export function buildShopApiUrl(
  path,
  accessToken,
  shopId,
  params = {}
) {
  const { partnerId, partnerKey } =
    getConfig();

  const timestamp =
    getTimestamp();

  const baseString =
    `${partnerId}${path}${timestamp}${accessToken}${shopId}`;

  const signature =
    sign(baseString, partnerKey);

  return buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    access_token: accessToken,
    shop_id: shopId,
    sign: signature,
    ...params,
  });
}

export const createAuthURL =
  buildAuthUrl;