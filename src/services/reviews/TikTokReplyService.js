export async function replyTikTok(reviewId, reply) {

  // TODO:
  // Replace with TikTok Shop Partner API

  console.log("TikTok Reply");

  console.log({
    reviewId,
    reply,
  });

  return {
    success: true,
    marketplace: "TIKTOK",
    reviewId,
    reply,
  };

}