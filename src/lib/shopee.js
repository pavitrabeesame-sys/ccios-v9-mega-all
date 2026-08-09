import crypto from 'crypto';

function generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken = '', shopId = '') {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

/**
 * Fetches base product details (item_name, images, etc.) from Shopee API v2
 */
export async function getItemBaseInfo(itemIdList, shopId, accessToken) {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';
  
  const apiPath = '/api/v2/product/get_item_base_info';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, String(shopId));

  const url = `${host}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_id_list: Array.isArray(itemIdList) ? itemIdList.map(Number) : [Number(itemIdList)]
    })
  });

  const data = await response.json();
  if (data.error && data.error !== '') {
    throw new Error(`Shopee API Base Info Error: ${data.message || data.error}`);
  }

  return data.response?.item_list || [];
}

/**
 * Fetches all product IDs and their full base details from Shopee
 */
export async function getStoreItemList(shopId, accessToken) {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';
  
  const apiPath = '/api/v2/product/get_item_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, String(shopId));

  const params = new URLSearchParams({
    partner_id: String(partnerId),
    timestamp: String(timestamp),
    sign: sign,
    access_token: accessToken,
    shop_id: String(shopId),
    item_status: 'NORMAL',
    page_size: '50',
    offset: '0'
  });

  const url = `${host}${apiPath}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();

  if (data.error && data.error !== '') {
    throw new Error(`Shopee Catalog Error: ${data.message || data.error}`);
  }

  const itemSummaryList = data.response?.item || [];
  const itemIds = itemSummaryList.map(i => i.item_id);

  if (itemIds.length === 0) return [];

  // Batch query item base details in chunks of 50
  return await getItemBaseInfo(itemIds, shopId, accessToken);
}