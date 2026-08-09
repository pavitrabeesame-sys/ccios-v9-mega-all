import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

function generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken = '', shopId = '') {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function buildShopeeUrl(host, apiPath, queryParams) {
  const cleanHost = host.replace(/\/+$/, '');
  const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const url = new URL(`${cleanHost}${cleanPath}`);

  Object.keys(queryParams).forEach(key => {
    url.searchParams.append(key, queryParams[key]);
  });

  return url.toString();
}

async function getItemBaseInfo(itemIdList, shopId, accessToken) {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';

  const apiPath = '/api/v2/product/get_item_base_info';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, String(shopId));

  const formattedItemIds = Array.isArray(itemIdList) ? itemIdList.join(',') : String(itemIdList);

  const url = buildShopeeUrl(host, apiPath, {
    partner_id: partnerId,
    timestamp: timestamp,
    sign: sign,
    access_token: accessToken,
    shop_id: shopId,
    item_id_list: formattedItemIds
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [];
  }

  if (data.error && data.error !== '') {
    return [];
  }

  return data.response?.item_list || [];
}

async function getItemExtraInfo(itemIdList, shopId, accessToken) {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';

  const apiPath = '/api/v2/product/get_model_list';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, String(shopId));

  const results = {};

  for (const itemId of itemIdList) {
    const url = buildShopeeUrl(host, apiPath, {
      partner_id: partnerId,
      timestamp: timestamp,
      sign: sign,
      access_token: accessToken,
      shop_id: shopId,
      item_id: itemId
    });

    try {
      const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      if (data.response?.model) {
        results[itemId] = data.response.model;
      }
    } catch (e) {
      // Ignore individual model fetch failures
    }
  }

  return results;
}

async function syncCatalog() {
  console.log('⚡ Starting fast Shopee full catalog & variation sync...\n');

  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';

  try {
    const shopeeAccounts = await prisma.shopeeAccount.findMany();

    if (shopeeAccounts.length === 0) {
      console.warn('⚠️ No accounts found in the ShopeeAccount table.');
      process.exit(0);
    }

    for (const account of shopeeAccounts) {
      const shopId = String(account.shopId || account.shop_id);
      const accessToken = account.accessToken || account.access_token;
      const accountName = account.shopName || account.name || `Shop ID ${shopId}`;

      console.log(`========================================`);
      console.log(`SHOP: ${accountName} (ID: ${shopId})`);

      if (!accessToken) {
        console.warn(`⚠️ SKIPPED: Access token missing for shop ${shopId}.`);
        console.log(`========================================\n`);
        continue;
      }

      let offset = 0;
      let hasMore = true;
      let allItemIds = [];
      const pageSize = 50;

      while (hasMore) {
        const apiPath = '/api/v2/product/get_item_list';
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);

        const url = buildShopeeUrl(host, apiPath, {
          partner_id: partnerId,
          timestamp: timestamp,
          sign: sign,
          access_token: accessToken,
          shop_id: shopId,
          item_status: 'NORMAL',
          page_size: pageSize,
          offset: offset
        });

        const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          break;
        }

        if (data.error && data.error !== '') break;

        const itemsBatch = data.response?.item || [];
        allItemIds.push(...itemsBatch.map(i => i.item_id));

        hasMore = data.response?.has_next_page || false;
        if (hasMore) offset += pageSize;
      }

      if (allItemIds.length === 0) {
        console.log(`✅ Synced 0 products for Shop ID ${shopId} (Catalog empty).`);
        console.log(`========================================\n`);
        continue;
      }

      console.log(`Found ${allItemIds.length} item IDs. Processing base info & variations...`);

      let syncedCount = 0;
      const chunkSize = 50;

      for (let i = 0; i < allItemIds.length; i += chunkSize) {
        const chunk = allItemIds.slice(i, i + chunkSize);
        const items = await getItemBaseInfo(chunk, shopId, accessToken);
        const modelsMap = await getItemExtraInfo(chunk, shopId, accessToken);

        for (const item of items) {
          try {
            const primaryImage = item.image?.image_url_list?.[0] || item.image?.image_id_list?.[0] || '';
            const price = item.price_info?.[0]?.current_price || item.price_info?.[0]?.original_price || 0;
            const sku = item.item_sku || `SHOPEE-${item.item_id}`;

            const existingProduct = await prisma.product.findFirst({
              where: {
                OR: [
                  { sku: sku },
                  { shopeeItemId: String(item.item_id) }
                ]
              }
            });

            let productId;

            if (existingProduct) {
              const updated = await prisma.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: item.item_name,
                  sku: sku,
                  price: price,
                  image: primaryImage,
                  shopeeItemId: String(item.item_id),
                  updatedAt: new Date()
                }
              });
              productId = updated.id;
            } else {
              const created = await prisma.product.create({
                data: {
                  shopeeItemId: String(item.item_id),
                  name: item.item_name,
                  sku: sku,
                  price: price,
                  costPrice: 0,
                  stock: item.stock_summary?.normal_stock || 0,
                  minStock: 0,
                  image: primaryImage,
                  status: 'ACTIVE'
                }
              });
              productId = created.id;
            }

            // Sync variations matching actual Prisma schema fields (omitting stock)
            const models = modelsMap[item.item_id] || [];
            if (models.length > 0 && prisma.productVariation) {
              for (const model of models) {
                const varSku = model.model_sku || `${sku}-${model.model_id}`;
                const varPrice = model.price_info?.[0]?.current_price || price;

                const existingVar = await prisma.productVariation.findFirst({
                  where: { sku: varSku }
                });

                if (existingVar) {
                  await prisma.productVariation.update({
                    where: { id: existingVar.id },
                    data: {
                      name: model.name || 'Default',
                      sku: varSku,
                      price: varPrice
                    }
                  });
                } else {
                  await prisma.productVariation.create({
                    data: {
                      productId: productId,
                      name: model.name || 'Default',
                      sku: varSku,
                      price: varPrice
                    }
                  });
                }
              }
            }

            syncedCount++;
          } catch (itemErr) {
            console.error(`⚠️ Failed to sync Item ID ${item.item_id}: ${itemErr.message}`);
          }
        }
      }

      console.log(`✅ Successfully synced ${syncedCount} / ${allItemIds.length} products with variations for Shop ID ${shopId}.`);
      console.log(`========================================\n`);
    }
  } catch (err) {
    console.error('❌ Critical script error:', err.message);
  } finally {
    await prisma.$disconnect();
    console.log('Catalog sync execution complete.');
  }
}

syncCatalog();