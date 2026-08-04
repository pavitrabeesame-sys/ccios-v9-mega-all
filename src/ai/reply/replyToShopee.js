import { PrismaClient } from "@prisma/client";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

const prisma = new PrismaClient();

export async function replyToShopee() {

  const account = await prisma.shopeeAccount.findFirst();

  if (!account) {
    throw new Error("No Shopee account found.");
  }

  const reviews = await prisma.review.findMany({
    where: {
      status: "APPROVED",
    },
  });

  const results = [];

  for (const review of reviews) {

    const url = buildShopApiUrl(
      "/api/v2/product/reply_comment",
      account.accessToken,
      account.shopId.toString()
    );

    const body = {
      comment_id: Number(review.reviewId),
      comment_reply: review.aiReply,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.error) {

      await prisma.review.update({
        where: {
          reviewId: review.reviewId,
        },
        data: {
          status: "REPLIED",
          finalReply: review.aiReply,
          repliedAt: new Date(),
        },
      });

    }

    results.push({
      reviewId: review.reviewId,
      response: data,
    });

  }

  return results;
}

export default replyToShopee;