import { detectLanguage } from "../language/detectLanguage";
import { analyzeSentiment } from "../sentiment/analyzeSentiment";
import { classifyReview } from "../category/classifyReview";
import { approvalEngine } from "../approval/approvalEngine";
import { getBrandPrompt } from "../prompts";

export async function generateReply(review) {

  const language = detectLanguage(review.reviewText);

  const sentiment = analyzeSentiment(review.reviewText);

  const category = classifyReview(review.reviewText);

  const brandPrompt = getBrandPrompt(review.brand);

  const prompt = `
${brandPrompt}

Customer Language:
${language}

Rating:
${review.rating}

Category:
${category}

Sentiment:
${sentiment}

Customer Review:
${review.reviewText}

Write ONE professional reply.

Requirements:
- Same language as customer
- Under 60 words
- Thank the customer
- Do not mention AI
`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const ai = await response.json();

  const aiReply =
    ai.choices?.[0]?.message?.content?.trim() ||
    "Thank you for your support.";

  const approval = approvalEngine({
    rating: review.rating,
    review: review.reviewText,
    confidence: 1,
    sentiment,
  });

  return {
    language,
    sentiment,
    category,
    aiReply,
    approval,
  };
}

export default generateReply;