import crypto from "crypto";

const HOST =
  process.env.SHOPEE_HOST ||
  "https://partner.shopeemobile.com";

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;

function sign(base) {
  return crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(base)
    .digest("hex");
}

export function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function buildAuthUrl(redirectUrl) {

  const path = "/api/v2/shop/auth_partner";

  const timestamp = getTimestamp();

  const base =
    `${PARTNER_ID}${path}${timestamp}`;

  const signature = sign(base);

  const url = new URL(HOST + path);

  url.searchParams.set(
    "partner_id",
    PARTNER_ID
  );

  url.searchParams.set(
    "timestamp",
    timestamp
  );

  url.searchParams.set(
    "sign",
    signature
  );

  url.searchParams.set(
    "redirect",
    redirectUrl
  );

  return url.toString();

}

export async function exchangeCodeForToken(
  code,
  shopId
) {

  const path =
    "/api/v2/auth/token/get";

  const timestamp = getTimestamp();

  const base =
    `${PARTNER_ID}${path}${timestamp}`;

  const signature = sign(base);

  const url =
    new URL(HOST + path);

  url.searchParams.set(
    "partner_id",
    PARTNER_ID
  );

  url.searchParams.set(
    "timestamp",
    timestamp
  );

  url.searchParams.set(
    "sign",
    signature
  );

  console.log({
  code,
  shopId,
  partnerId: PARTNER_ID,
  url: url.toString(),
});

  const response = await fetch(
    url.toString(),
    {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({

        code,

        partner_id:
          Number(PARTNER_ID),

        shop_id:
          Number(shopId),

      }),

    }
  );

  if (!response.ok) {

    throw new Error(
      `Shopee Token Error ${response.status}`
    );

  }

const data = await response.json();

console.log("========== TOKEN RESPONSE ==========");
console.log(JSON.stringify(data, null, 2));
console.log("====================================");

return data;

}

export async function refreshAccessToken(
  refreshToken,
  shopId
) {

  const path =
    "/api/v2/auth/access_token/get";

  const timestamp =
    getTimestamp();

  const base =
    `${PARTNER_ID}${path}${timestamp}`;

  const signature =
    sign(base);

  const url =
    new URL(HOST + path);

  url.searchParams.set(
    "partner_id",
    PARTNER_ID
  );

  url.searchParams.set(
    "timestamp",
    timestamp
  );

  url.searchParams.set(
    "sign",
    signature
  );

  const response =
    await fetch(
      url.toString(),
      {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          partner_id:
            Number(PARTNER_ID),

          shop_id:
            Number(shopId),

          refresh_token:
            refreshToken,

        }),

      }
    );

  if (!response.ok) {

    throw new Error(
      `Shopee Refresh Error ${response.status}`
    );

  }

  return await response.json();

}