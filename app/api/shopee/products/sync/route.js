import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopeeGet } from "@/lib/shopee";

export async function GET() {
  try {
    const shops = await prisma.shopeeAccount.findMany();

    if (shops.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No Shopee accounts connected."
      });
    }

    let imported = 0;

    for (const shop of shops) {
      let offset = 0;
      let more = true;

      while (more) {
        const result = await shopeeGet(
          shop.shopId.toString(),
          "/api/v2/product/get_item_list",
          {
            offset,
            page_size: 100,
            item_status: "NORMAL"
          }
        );

        const response = result.response || {};
        const items = response.item || [];

        for (const item of items) {
          const exists = await prisma.product.findFirst({
            where: {
              sku: String(item.item_id)
            }
          });

          if (exists) continue;

          await prisma.product.create({
            data: {
              sku: String(item.item_id),
              name: item.item_name || `Shopee Item ${item.item_id}`,
              price: 0,
              stock: 0,

              // Replace with a valid Brand ID from your database
              brandId: "cms9qvp590000tolobesw721q"
            }
          });

          imported++;
        }

        more = response.has_next_page === true;

        if (more) {
          offset += 100;
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}