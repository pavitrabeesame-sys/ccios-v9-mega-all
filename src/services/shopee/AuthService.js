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
    url.searchParams.set(k, String(v));
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

  const signature = sign(baseString, partnerKey);

  console.log("========== AUTH ==========");
  console.log({
    partnerId,
    timestamp,
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
   EXCHANGE CODE
============================================================ */

export async function exchangeCodeForToken(code, shopId) {
  const { partnerId, partnerKey } = getConfig();

  if (!code)
    throw new Error("Missing code");

  if (!shopId)
    throw new Error("Missing shop_id");

  const path = "/api/v2/auth/token/get";

  const timestamp = getTimestamp();

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
  console.log("URL:", url);
  console.log("BODY:", body);
  console.log("BASE:", baseString);
  console.log("SIGN:", signature);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log("TOKEN RESPONSE:", data);

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
  const { partnerId, partnerKey } = getConfig();

  const path =
    "/api/v2/auth/access_token/get";

  const timestamp = getTimestamp();

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
  console.log("URL:", url);
  console.log("BODY:", body);
  console.log("BASE:", baseString);
  console.log("SIGN:", signature);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log("REFRESH RESPONSE:", data);

  if (data.error) {
    throw new Error(
      data.message || data.error
    );
  }

  return data;
}

export const createAuthURL = buildAuthUrl;