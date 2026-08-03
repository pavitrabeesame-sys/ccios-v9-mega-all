import { prisma } from "@/lib/prisma";
import { replyShopeeReview } from "../shopee/ReviewService";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BRAND_VOICE = {
  BEE_SAME: "Friendly Malaysian seller. Use 'dear' and 'thank you'.",
  NICOLE: "Elegant fashion brand. Polite and warm.",
  HUSH_PUPPIES: "Professional premium footwear brand.",
  RAV: "Casual trendy streetwear.",
  CHAMPION: "Sporty energetic.",
  OBERMAIN: "Classic premium menswear.",
  BHPC: "Elegant polo brand.",
  JOHN_LANGFORD: "Formal business menswear."
}

export async function generateAIReply(comment, brand) {
  const prompt = `You are customer service for ${brand}. ${BRAND_VOICE[brand] || BRAND_VOICE.BEE_SAME} 
  Reply to this review in 2 sentences max, be grateful: "${comment}"`;
  
  const chat = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant",
  });
  return chat.choices[0].message.content;
}

export async function analyzeReview(comment) {
  const lower = comment.toLowerCase();
  if(lower.includes("good") || lower.includes("nice") || lower.includes("cantik")) return { sentiment: "POSITIVE" };
  if(lower.includes("bad") || lower.includes("rosak") || lower.includes("teruk")) return { sentiment: "NEGATIVE" };
  return { sentiment: "NEUTRAL" };
}

export async function processPendingReplies() {
  const reviews = await prisma.review.findMany({
    where: { status: "PENDING", aiReply: null },
    take: 20,
    include: { shopeeShop: true }
  });

  let stats = { processed: 0, posted: 0 };
  for (const review of reviews) {
    const analysis = await analyzeReview(review.comment);
    const aiReply = await generateAIReply(review.comment, review.brand);
    let postStatus = "APPROVED";
    
    if(review.shopeeShop?.accessToken) {
      const result = await replyShopeeReview(review.shopeeShop, review.reviewId, aiReply);
      postStatus = result.status;
      if(postStatus === "POSTED") stats.posted++;
    }

    await prisma.review.update({
      where: { id: review.id },
      data: { ...analysis, aiReply, status: postStatus }
    });
    stats.processed++;
  }
  return stats;
}

export async function approveReview(reviewId) {
  return prisma.review.update({ where: { id: reviewId }, data: { status: "APPROVED" } });
}

export async function rejectReview(reviewId) {
  return prisma.review.update({ where: { id: reviewId }, data: { status: "REJECTED" } });
}