import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await prisma.shopeeAccount.findFirst();

    if (!account) {
      return NextResponse.json({
        success: false,
        error: "No Shopee account found.",
      });
    }

    const url = buildShopApiUrl(
      "/api/v2/product/get_comment",
      account.accessToken,
      account.shopId.toString(),
      {
        cursor: "",
        page_size: 100,
      }
    );

    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      return NextResponse.json({
        success: false,
        error: json.message,
      });
    }

    const comments = json.response?.item_comment_list || [];

    let imported = 0;

    for (const item of comments) {
      const reviewId = String(item.comment_id);
      
      const exists = await prisma.review.findUnique({
        where: { reviewId },
      });

      if (exists) continue;

      // Look up the product in your database to find its actual brand
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: String(item.item_id) },
            { id: String(item.item_id) }
          ]
        },
        include: { brand: true }, // Assumes your Product model has a relation to Brand
      });

      // Dynamically assign the brand name if found, otherwise fallback safely
      const brandName = product?.brand?.name || product?.brand || "Obermain";

      await prisma.review.create({
        data: {
          reviewId,
          marketplace: "SHOPEE",
          brand: brandName, // Dynamic brand assignment!
          storeName: "Shopee",
          orderNumber: item.order_sn,
          productName: String(item.item_id),
          customerName: item.buyer_username,
          rating: item.rating_star,
          reviewText: item.comment || "",
          status: "PENDING",
        },
      });

      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      total: comments.length,
    });

  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, {
      status: 500,
    });
  }
}