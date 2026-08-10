import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

// Rate limit configuration for Groq Free Tier (30 RPM limit safety margin)
const REQUEST_DELAY_MS = 2500; // ~24 req/min, safely below 30 RPM
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 3000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ids, limit } = body;

    const batchLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;

    let reviewsToProcess = [];

    if (ids && Array.isArray(ids) && ids.length > 0) {
      reviewsToProcess = await db.review.findMany({
        where: {
          id: { in: ids },
          aiReply: null,
        },
        take: batchLimit,
      });
    } else {
      reviewsToProcess = await db.review.findMany({
        where: {
          aiReply: null,
        },
        take: batchLimit,
      });
    }

    const total = reviewsToProcess.length;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending reviews found.',
        generated: 0,
        failed: 0,
        total: 0,
      });
    }

    let generatedCount = 0;
    let failedCount = 0;
    const errors = [];

    // Production-safe sequential processing queue
    // with retry & rate-limit protection.
    for (const review of reviewsToProcess) {
      let success = false;
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
          const textContent = review.reviewText?.trim() || '';
          const rating = review.rating || 5;
          const brandName = review.brand || 'our store';

          /*
           * IMPORTANT:
           * The AI must respond to the actual customer review.
           * Do not replace an empty review with invented review content.
           */
          const prompt = `
You are writing an official customer-service reply for ${brandName}.

CUSTOMER REVIEW
Rating: ${rating}/5
Review:
"${textContent || '[No written review provided]'}"

REVIEW REPLY SOP

1. Read the customer's actual review carefully before writing the reply.

2. Identify the specific thing the customer mentioned.

3. Respond directly to that specific point.
   Examples:
   - If they mention leather quality, acknowledge the leather quality.
   - If they mention comfort, respond to the comfort.
   - If they mention size or fitting, respond to that.
   - If they mention delivery, acknowledge the delivery experience.
   - If they mention design, colour, material, packaging, value, or service, respond to that specific point.
   - If they mention a problem or complaint, acknowledge the actual problem.

4. Do NOT give the same generic reply to different reviews.

5. Match the customer's language when appropriate.

6. Sound natural, warm, human, and genuine.
   Do not sound like a corporate template.

7. Keep the reply concise.
   Normally use 1 short paragraph or 2 short paragraphs.

8. Avoid repetitive corporate filler such as:
   "Your satisfaction is our priority."
   "We value your feedback."
   "Thank you for your kind review."
   "We look forward to serving you again."

   These phrases should NOT be used unless they genuinely fit the customer's review.

9. For positive reviews:
   - Thank the customer naturally.
   - Mention the specific thing they liked whenever possible.
   - Do not invent additional product details.

10. For negative reviews:
    - Acknowledge the actual concern.
    - Be empathetic.
    - Do not pretend the customer is satisfied.
    - Do not make promises about refunds, replacements, compensation, warranties, or policies unless those facts are explicitly provided in the review.

11. For a review with no written comment:
    - Thank the customer for the rating.
    - Do not invent anything they said or experienced.

12. Never invent:
    - product specifications
    - warranties
    - guarantees
    - refunds
    - replacements
    - discounts
    - compensation
    - policies
    - delivery promises
    - facts about the customer's order
    - facts not contained in the review

13. Never mention:
    - AI
    - prompts
    - models
    - instructions
    - internal systems
    - generation
    - automation

14. NEVER use placeholders.

15. NEVER write:
    [Company Name]
    [Your Company Name]
    [Customer Service Team]
    [Your Customer Service Team]
    [Customer Service]
    [Brand Name]
    [Store Name]
    [Your Store Name]

16. NEVER leave any square-bracket template variable unresolved.

17. Do not add notes, explanations, analysis, or labels.

18. Return ONLY the final customer reply.

19. If a sign-off is appropriate, use:
    Best regards,
    Customer Service Team

20. The customer's actual words and meaning must determine the response.

Write the final customer reply now.
`;

          const aiReplyText = await askGroq(prompt);

          if (!aiReplyText || !aiReplyText.trim()) {
            throw new Error('Received empty response from AI service.');
          }

          const cleanedReply = aiReplyText.trim();

          /*
           * Final safety check before saving the generated reply.
           */
          const placeholderPatterns = [
            /\[Company Name\]/i,
            /\[Your Company Name\]/i,
            /\[Customer Service Team\]/i,
            /\[Your Customer Service Team\]/i,
            /\[Customer Service\]/i,
            /\[Brand Name\]/i,
            /\[Store Name\]/i,
            /\[Your Store Name\]/i,
            /\[[^\]]+\]/,
          ];

          const containsPlaceholder = placeholderPatterns.some((pattern) =>
            pattern.test(cleanedReply)
          );

          if (containsPlaceholder) {
            throw new Error(
              'AI generated a reply containing an unresolved placeholder.'
            );
          }

          /*
           * Update database record with generated AI reply.
           */
          await db.review.update({
            where: { id: review.id },
            data: {
              aiReply: cleanedReply,
            },
          });

          success = true;
          break;
        } catch (err) {
          lastError = err?.message || String(err);

          console.warn(
            `[Bulk AI] Review ID ${review.id} attempt ${attempt} failed: ${lastError}`
          );

          if (attempt <= MAX_RETRIES) {
            await delay(RETRY_BASE_DELAY_MS * attempt);
          }
        }
      }

      if (success) {
        generatedCount++;
      } else {
        failedCount++;

        errors.push({
          id: review.id,
          error: lastError,
        });
      }

      /*
       * Rest between requests to protect against Groq RPM limits.
       */
      await delay(REQUEST_DELAY_MS);
    }

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      failed: failedCount,
      total,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Generate-All Top-Level Error]:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      {
        status: 500,
      }
    );
  }
}