import crypto from "crypto";
import { getValidAccessToken } from "./ShopService";

const HOST =
  process.env.SHOPEE_HOST ||
  "https://partner.shopeemobile.com";

const PARTNER_ID =
  process.env.SHOPEE_PARTNER_ID;

const PARTNER_KEY =
  process.env.SHOPEE_PARTNER_KEY;

function sign(base) {

  return crypto
    .createHmac("sha256", PARTNER_KEY)
    .update(base)
    .digest("hex");

}

export async function replyComment({

  shopId,

  commentId,

  reply,

}) {

  const accessToken =
    await getValidAccessToken(shopId);

  const path =
    "/api/v2/product/reply_comment";

  const timestamp =
    Math.floor(Date.now() / 1000);

  const base =
    `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`;

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
    "access_token",
    accessToken
  );

  url.searchParams.set(
    "shop_id",
    shopId
  );

  url.searchParams.set(
    "sign",
    signature
  );

  const response =
    await fetch(url.toString(), {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json",

      },

      body: JSON.stringify({

        comment_id: Number(commentId),

        comment_reply: reply,

      }),

    });

  const data =
    await response.json();

  if (data.error) {

    throw new Error(
      data.message || data.error
    );

  }

  return data;

}