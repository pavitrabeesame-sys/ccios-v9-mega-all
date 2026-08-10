import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

// Groq free-tier rate-limit protection.
const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 3000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PLACEHOLDER_PATTERNS = [
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

function hasPlaceholder(text) {
  if (!text) return false;

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function isRegenerationCandidate(review) {
  if (!review) return false;
  if (review.status === 'REPLIED') return false;
  if (review.shopId === null || review.shopId === undefined) return false;

  // Generate when there is no AI reply OR the existing reply is invalid.
  return !review.aiReply || hasPlaceholder(review.aiReply);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ids, limit } = body;

    const batchLimit =
      typeof limit === 'number' && limit > 0 ? limit : undefined;

    let candidates = [];

    /*
     * IMPORTANT:
     *
     * We intentionally do NOT use:
     *
     *   aiReply: null
     *
     * here.
     *
     * A PENDING review may already contain an old/bad AI reply.
     * Those reviews must also be regeneratable.
     */

    if (ids && Array.isArray(ids) && ids.length > 0) {
      candidates = await db.review.findMany({
        where: {
          id: { in: ids },
          status: { not: 'REPLIED' },
          shopId: { not: null },
        },
        take: batchLimit,
      });
    } else {
      candidates = await db.review.findMany({
        where: {
          status: { not: 'REPLIED' },
          shopId: { not: null },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: batchLimit,
      });
    }

    const reviewsToProcess = candidates.filter(isRegenerationCandidate);

    const total = reviewsToProcess.length;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reviews require AI generation or regeneration.',
        generated: 0,
        failed: 0,
        total: 0,
      });
    }

    let generatedCount = 0;
    let failedCount = 0;

    const errors = [];

    // Sequential processing with retry and rate-limit protection.
    for (const review of reviewsToProcess) {
      let success = false;
      let lastError = null;

      for (
        let attempt = 1;
        attempt <= MAX_RETRIES + 1;
        attempt++
      ) {
        try {
          const textContent = review.reviewText?.trim() || '';
          const rating = review.rating || 5;
          const brandName = review.brand || 'our store';

          /*
           * IMPORTANT:
           *
           * Never invent review content when the customer left
           * only a rating.
           */
          const reviewDisplay = textContent
            ? `"${textContent}"`
            : '[No written review provided]';

          const prompt = `
You are writing an official customer-service reply for ${brandName}.

CUSTOMER REVIEW
Rating: ${rating}/5
Review:
${reviewDisplay}

REVIEW REPLY SOP

1. Read the customer's actual review carefully before writing the reply.

2. Identify the specific thing the customer mentioned.

3. Respond directly to that specific point.

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

Do not use these phrases unless they genuinely fit the customer's review.

9. For positive reviews:
- Thank the customer naturally.
- Mention the specific thing they liked whenever possible.
- Do not invent additional product details.

10. For negative reviews:
- Acknowledge the actual concern.
- Be empathetic.
- Do not pretend the customer is satisfied.
- Do not promise refunds, replacements, compensation, warranties, or policies unless explicitly supported by the review.

11. For a review with NO written comment:
- Thank the customer naturally for the rating.
- Do not claim they liked, enjoyed, received, or experienced anything specific.
- Do not invent product details.
- Keep the reply short.

12. Never invent:
- Never promise, suggest, or speculate that the brand will implement a customer suggestion or release future products.
- If the customer suggests a change, simply acknowledge that the suggestion is helpful or appreciated.
- Do not use phrases such as "we'll consider", "we'll add", "we'll make", "we'll introduce", "we'll come out with", "maybe we'll", or similar future-commitment language.
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

          // Final safety check.
          if (hasPlaceholder(cleanedReply)) {
            throw new Error(
              'AI generated a reply containing an unresolved placeholder.'
            );
          }

          await db.review.update({
            where: {
              id: review.id,
            },
            data: {
              aiReply: cleanedReply,
              status: 'GENERATED',
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