import { prisma } from "@/lib/prisma";
import { replyShopeeReview } from "../shopee/ReviewService";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BRAND_VOICE = {
  BEE_SAME: "Friendly Malaysian seller. Use 'dear' and 'thank you'. Add emoji.",
  NICOLE: "Elegant fashion brand. Polite and warm.",
  HUSH_PUPPIES: "Professional premium footwear brand.",
  RAV: "Casual trendy streetwear.",
  CHAMPION: "Sporty energetic.",
  OBERMAIN: "Classic premium menswear.",
  BHPC: "Elegant polo brand.",
  JOHN_LANGFORD: "Formal business menswear."
}

function getBrandVoice(brand) {
  return BRAND_VOICE[brand] || BRAND_VOICE.BEE_SAME;
}

export async function generateAIReply(comment, brand = "BEE_SAME") {
  if (!comment) return "Thank you dear for your feedback!";

  const voice = getBrandVoice(brand);
  const prompt = `You are customer service for ${brand}. ${voice}
  Reply to this customer review in 2 sentences max. Be grateful and solve problem if negative: "${comment}"`;

  try {
    const chat = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 150,
    });
    return chat.choices[0]?.message?.content?.trim() || "Thank you for your review!";
  } catch (error) {
    console.error("[AIReply] Groq error:", error.message);
    return "Thank you dear for your feedback! We appreciate you.";
  }
}

export async function analyzeReview(comment) {
  if (!comment) return { sentiment: "NEUTRAL" };
  const lower = comment.toLowerCase();
  if(lower.includes("good") || lower.includes("nice") || lower.includes("cantik") || lower.includes("love")) return { sentiment: "POSITIVE" };
  if(lower.includes("bad") || lower.includes("rosak") || lower.includes("teruk") || lower.includes("worst")) return { sentiment: "NEGATIVE" };
  return { sentiment: "NEUTRAL" };
}

export async function processPendingReplies() {
  // Fix: go through Store -> shopeeShop because that's how your schema is
  const reviews = await prisma.review.findMany({
    where: { status: "PENDING", aiReply: null },
    take: 20,
    include: {
      store: {
        include: { shopeeShop: true }
      }
    }
  });

  let stats = { processed: 0, posted: 0, failed: 0 };

  for (const review of reviews) {
    try {
      const brand = review.store?.brand || "BEE_SAME";
      const analysis = await analyzeReview(review.reviewText || review.comment);
      const aiReply = await generateAIReply(review.reviewText || review.comment, brand);
      let postStatus = "GENERATED";

      const shop = review.store?.shopeeShop;
      if(shop?.accessToken && shop?.shopId) {
        const result = await replyShopeeReview(shop, review.reviewId, aiReply);
        postStatus = result.success? "APPROVED" : "GENERATED";
        if(postStatus === "APPROVED") stats.posted++;
      }

      await prisma.review.update({
        where: { id: review.id },
        data: {
         ...analysis,
          aiReply,
          finalReply: aiReply,
          status: postStatus
        }
      });
      stats.processed++;
    } catch (error) {
      console.error(`[Cron] Failed review ${review.id}:`, error.message);
      stats.failed++;
    }
  }
  return stats;
}

export async function approveReview(reviewId) {
  return prisma.review.update({ where: { id: reviewId }, data: { status: "APPROVED" } });
}

export async function rejectReview(reviewId) {
  return prisma.review.update({ where: { id: reviewId }, data: { status: "REJECTED" } });
}

// Compatibility exports
export const generateReply = generateAIReply;