export async function replyShopee(reviewId, reply) {

  // TODO:
  // Replace with Shopee OpenAPI endpoint

  console.log("Shopee Reply");

  console.log({
    reviewId,
    reply,
  });

  return {
    success: true,
    marketplace: "SHOPEE",
    reviewId,
    reply,
  };

}