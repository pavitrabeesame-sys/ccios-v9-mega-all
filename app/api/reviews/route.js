import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    // Build dynamic where clause for Prisma
    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          customerName: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          productName: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          productSku: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          reviewText: {
            contains: search,
            mode: "insensitive"
          }
        }
      ];
    }

    const reviews = await prisma.review.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      }
    });

    const formattedReviews = await Promise.all(
      reviews.map(async (review) => {
        let productName = review.productName;
        let productInfo = null;

        // FIND PRODUCT USING SKU
        if (review.productSku) {
          productInfo = await prisma.product.findUnique({
            where: {
              sku: review.productSku
            },
            include: {
              brand: true,
              category: true
            }
          });

          if (
            (!productName || productName.trim() === "")
            && productInfo
          ) {
            productName = productInfo.name;
          }
        }

        return {
          // ORIGINAL REVIEW DATA
          id: review.id,
          reviewId: review.reviewId,
          marketplace: review.marketplace,
          customerName: review.customerName || "Unknown Customer",
          rating: review.rating,
          reviewText: review.reviewText || "No review text",
          aiReply: review.aiReply,
          finalReply: review.finalReply,
          status: review.status || "PENDING",
          createdAt: review.createdAt,

          // PRODUCT DATA
          productName: productName || `SKU: ${review.productSku || "Unknown"}`,
          productSku: review.productSku || "-",

          // PRODUCT INTELLIGENCE & BRAND
          productId: productInfo?.id || null,
          brand: productInfo?.brand?.name || null, // Mapped for CCIOS UI tags
          productCategory: productInfo?.category?.name || null,
          productPrice: productInfo?.price || 0,
          productStock: productInfo?.stock || 0,
          shopeeItemId: productInfo?.shopeeItemId
            ? productInfo.shopeeItemId.toString()
            : null,
          productMarketplace: productInfo?.marketplace || review.marketplace,
          lastSync: productInfo?.lastSync || null
        };
      })
    );

    return Response.json({
      reviews: formattedReviews
    });

  } catch (error) {
    console.error("REVIEWS API ERROR:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}