import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopeeGet } from "@/lib/shopee";

export async function GET() {
  try {
    // Get all authorized Shopee accounts
    const shops = await prisma.shopeeAccount.findMany();

    if (shops.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No Shopee accounts connected.",
      });
    }

    let imported = 0;

    for (const shop of shops) {
      try {
        // TODO:
        // Replace this endpoint with the actual Shopee Reviews endpoint
        const response = await shopeeGet(
          shop.shopId.toString(),
          "/api/v2/xxxxxxxxxxxxx",
          {}
        );

        const reviews = response.response?.reviews || [];

        for (const review of reviews) {
          const exists = await prisma.review.findUnique({
            where: {
              reviewId: String(review.review_id),
            },
          });

          if (exists) continue;

          await prisma.review.create({
            data: {
              reviewId: String(review.review_id),
              marketplace: "SHOPEE",
              storeName: shop.shopId.toString(),
              orderNumber: review.order_sn || null,
              productName: review.item_name || "",
              productSku: review.model_sku || null,
              customerName: review.author_username || "Customer",
              rating: review.rating_star || 5,
              reviewText: review.comment || "",
              status: "PENDING",
            },
          });

          imported++;
        }
      } catch (err) {
        console.error(
          `Shop ${shop.shopId} sync failed`,
          err
        );
      }
    }

    return NextResponse.json({
      success: true,
      imported,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}