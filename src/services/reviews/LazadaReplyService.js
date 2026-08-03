export async function replyLazada(reviewId, reply) {

  // TODO:
  // Replace with Lazada Open Platform API

  console.log("Lazada Reply");

  console.log({
    reviewId,
    reply,
  });

  return {
    success: true,
    marketplace: "LAZADA",
    reviewId,
    reply,
  };

}