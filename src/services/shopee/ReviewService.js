import crypto from "crypto";

export async function getReviews(shopId, accessToken) {

  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  const timestamp = Math.floor(Date.now() / 1000);

  const path = "/api/v2/product/get_comment";

  const base =
    `${partnerId}${path}${timestamp}${accessToken}${shopId}`;

  const sign = crypto
    .createHmac("sha256", partnerKey)
    .update(base)
    .digest("hex");

  const url =
    `https://partner.shopeemobile.com${path}` +
    `?partner_id=${partnerId}` +
    `&timestamp=${timestamp}` +
    `&access_token=${accessToken}` +
    `&shop_id=${shopId}` +
    `&cursor=` +
    `&page_size=100` +
    `&sign=${sign}`;

  const response = await fetch(url);

  const result = await response.json();

  console.log(result);

  return result;

}