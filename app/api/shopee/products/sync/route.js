import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { buildShopApiUrl, refreshAccessToken } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany();
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: false, error: "No Shopee accounts found." });
    }

    // Load all brands from DB for dynamic mapping
    const brands = await prisma.brand.findMany();
    const brandMap = {};
    brands.forEach(b => {
      brandMap[b.name.toUpperCase()] = b.id;
    });

    let totalImported = 0;
    const summary = [];

    for (let account of accounts) {
      try {
        let accessToken = account.accessToken;
        const shopIdStr = account.shopId.toString();

        // Automatically refresh the token for this account
        try {
          const refreshData = await refreshAccessToken(account.refreshToken, account.shopId);
          if (refreshData && refreshData.access_token) {
            accessToken = refreshData.access_token;
            account = await prisma.shopeeAccount.update({
              where: { id: account.id },
              data: {
                accessToken: refreshData.access_token,
                refreshToken: refreshData.refresh_token || account.refreshToken,
              },
            });
          }
        } catch (refreshErr) {
          console.warn(`Token refresh warning for shop ${shopIdStr}:`, refreshErr.message);
        }

        let allItems = [];
        let offset = 0;
        let hasMore = true;
        const pageSize = 50;

        // Pagination loop to fetch all items for this shop
        while (hasMore && offset < 500) {
          const listUrl = buildShopApiUrl(
            "/api/v2/product/get_item_list",
            accessToken,
            shopIdStr,
            { page_size: pageSize, offset: offset, item_status: "NORMAL" }
          );

          const listRes = await fetch(listUrl);
          const listJson = await listRes.json();

          if (listJson.error) {
            console.warn(`Error fetching items for shop ${shopIdStr}:`, listJson.message || listJson.error);
            break;
          }

          const items = listJson.response?.item || [];
          if (items.length === 0) break;

          allItems.push(...items);
          hasMore = listJson.response?.has_next_page || false;
          offset += pageSize;

          if (!hasMore || items.length < pageSize) break;
        }

        if (allItems.length === 0) {
          summary.push({ shopId: shopIdStr, imported: 0, message: "No items found" });
          continue;
        }

        const itemIds = allItems.map(i => i.item_id);
        const detailedItems = [];

        // Fetch item base details in chunks of 50
        for (let i = 0; i < itemIds.length; i += 50) {
          const chunkIds = itemIds.slice(i, i + 50);
          const infoUrl = buildShopApiUrl(
            "/api/v2/product/get_item_base_info",
            accessToken,
            shopIdStr,
            { item_id_list: chunkIds.join(",") }
          );

          const infoRes = await fetch(infoUrl);
          const infoJson = await infoRes.json();
          if (infoJson.response?.item_list) {
            detailedItems.push(...infoJson.response.item_list);
          }
        }

        let shopImported = 0;

        for (const item of detailedItems) {
          const name = item.item_name || "";
          const sku = item.item_sku || String(item.item_id);
          const text = (name + " " + sku).toUpperCase();

          // Determine brand dynamically based on product title/SKU text
          let brandId = brandMap["OBERMAIN"]; // default fallback
          if (text.includes("HUSH PUPPIES")) brandId = brandMap["HUSH PUPPIES"];
          else if (text.includes("NICOLE")) brandId = brandMap["NICOLE COLLECTION"];
          else if (text.includes("RAV DESIGN")) brandId = brandMap["RAV DESIGN"];
          else if (text.includes("CHAMPION")) brandId = brandMap["CHAMPION"];
          else if (text.includes("JOHN LANGFORD")) brandId = brandMap["JOHN LANGFORD"];
          else if (text.includes("BEVERLY HILLS")) brandId = brandMap["BEVERLY HILLS POLO CLUB"];

          const price = item.price_info?.[0]?.original_price || 0;
          const image = item.image?.image_url_list?.[0] || null;

          await prisma.product.upsert({
            where: { sku: sku },
            update: { name, price, image, brandId },
            create: {
              sku: sku,
              name,
              price,
              image,
              brandId,
              stock: 0,
              marketplace: "SHOPEE",
              status: "ACTIVE",
            },
          });

          shopImported++;
          totalImported++;
        }

        summary.push({ shopId: shopIdStr, imported: shopImported });

      } catch (shopErr) {
        console.error(`Failed to sync shop ${account.shopId}:`, shopErr.message);
        summary.push({ shopId: account.shopId, error: shopErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      totalImported,
      summary,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}