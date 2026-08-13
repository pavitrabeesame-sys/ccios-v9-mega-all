import { buildShopApiUrl } from "./AuthService";
import { getValidToken } from "./TokenService";

const DISCOUNT_GET_LIST =
  "/api/v2/discount/get_discount_list";

const DISCOUNT_GET =
  "/api/v2/discount/get_discount";

const DISCOUNT_ADD_ITEM =
  "/api/v2/discount/add_discount_item";


// ========================================
// SHOPEE GET
// ========================================

async function shopeeGet(
  path,
  shopId,
  params = {}
) {

  const token =
    await getValidToken(shopId);

  const url =
    buildShopApiUrl(
      path,
      token.accessToken,
      shopId,
      params
    );

  console.log(
    "SHOPEE GET:",
    url.replace(
      /access_token=[^&]+/,
      "access_token=***"
    )
  );

  const response =
    await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

  const data =
    await response.json();

  console.log(
    "SHOPEE RESPONSE:",
    JSON.stringify(data, null, 2)
  );

  if (!response.ok || data.error) {

    throw new Error(
      data.message ||
      data.error ||
      `Shopee API failed: ${response.status}`
    );

  }

  return data;
}


// ========================================
// SHOPEE POST
// ========================================

async function shopeePost(
  path,
  shopId,
  body
) {

  const token =
    await getValidToken(shopId);

  const url =
    buildShopApiUrl(
      path,
      token.accessToken,
      shopId
    );

  console.log(
    "SHOPEE POST:",
    path
  );

  console.log(
    "SHOPEE BODY:",
    JSON.stringify(body, null, 2)
  );

  const response =
    await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body:
        JSON.stringify(body)

    });

  const data =
    await response.json();

  console.log(
    "SHOPEE POST RESPONSE:",
    JSON.stringify(data, null, 2)
  );

  if (!response.ok || data.error) {

    throw new Error(
      data.message ||
      data.error ||
      `Shopee API failed: ${response.status}`
    );

  }

  return data;
}


// ========================================
// GET DISCOUNT LIST
// ========================================

export async function getDiscountList(
  shopId
) {

  return await shopeeGet(
    DISCOUNT_GET_LIST,
    shopId
  );

}


// ========================================
// GET DISCOUNT DETAILS
// ========================================

export async function getDiscount(
  shopId,
  discountId,
  pageNo = 1,
  pageSize = 50
) {

  return await shopeeGet(
    DISCOUNT_GET,
    shopId,
    {
      discount_id:
        Number(discountId),

      page_no:
        Number(pageNo),

      page_size:
        Number(pageSize)
    }
  );

}


// ========================================
// GET ALL DISCOUNT PAGES
// ========================================

export async function getAllDiscountItems(
  shopId,
  discountId
) {

  let pageNo = 1;

  const pageSize = 50;

  let allItems = [];

  let discountInfo = null;

  while (true) {

    const data =
      await getDiscount(
        shopId,
        discountId,
        pageNo,
        pageSize
      );

    if (!data.response) {

      throw new Error(
        "Shopee returned no discount response"
      );

    }

    if (!discountInfo) {

      discountInfo =
        data.response;

    }

    const items =
      data.response.item_list || [];

    allItems.push(
      ...items
    );

    console.log(
      `Discount page ${pageNo}: ${items.length} items`
    );

    if (
      data.response.more !== true
    ) {

      break;

    }

    pageNo++;

  }

  return {

    ...discountInfo,

    item_list: allItems

  };

}


// ========================================
// ADD ITEM / MODEL BACK TO PROMOTION
// ========================================

export async function addDiscountItem(
  shopId,
  discountId,
  item
) {

  return await shopeePost(
    DISCOUNT_ADD_ITEM,
    shopId,
    {
      discount_id:
        Number(discountId),

      item_list: [
        item
      ]
    }
  );

}