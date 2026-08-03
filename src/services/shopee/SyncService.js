import { prisma } from "../../lib/prisma";
import { getReviews } from "./ReviewService";
import { getValidToken } from "./TokenService";

export async function syncShopeeReviews(shopId) {
  // Get a valid Shopee access token
  const token = await getValidToken(shopId);

  // Fetch reviews from Shopee
  const result = await getReviews(
    shopId,
    token.accessToken
  );

  const comments =
    result?.response?.item_comment_list || [];

  let imported = 0;

  for (const item of comments) {
    await prisma.review.upsert({
      where: {
        reviewId: item.comment_id.toString(),
      },

      update: {
        rating: item.rating_star,
        reviewText: item.comment,
        productName: item.item_name || "",
        customerName: item.buyer_username,
      },

      create: {
        reviewId: item.comment_id.toString(),

        marketplace: "SHOPEE",

        storeName: shopId.toString(),

        orderNumber: item.order_sn || null,

        productName: item.item_name || "",

        productSku: item.item_id
          ? item.item_id.toString()
          : null,

        customerName: item.buyer_username || "",

        rating: item.rating_star || 0,

        reviewText: item.comment || "",

        aiReply: null,

        finalReply: null,

        status: "PENDING",
      },
    });

    imported++;
  }

  return {
    success: true,
    imported,
    total: comments.length,
  };
}