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
          const textContent = review.reviewText || 'Great product!';
          const rating = review.rating || 5;
          const brandName = review.brand || 'our store';

          const prompt = `
Write a professional customer service reply to this ecommerce customer review.

Brand: ${brandName}
Rating: ${rating}/5
Customer Review: "${textContent}"

Rules:
- Return ONLY the final customer reply.
- Be warm, natural, concise, and professional.
- Match the customer's language when appropriate.
- Respond directly to the customer's actual review.
- Do not invent facts, policies, warranties, refunds, replacements, discounts, compensation, or other promises.
- Do not mention AI, prompts, instructions, models, or internal systems.
- NEVER use placeholders.
- NEVER write "[Company Name]".
- NEVER write "[Your Company Name]".
- NEVER write "[Customer Service Team]".
- NEVER write "[Your Customer Service Team]".
- NEVER write "[Customer Service]".
- NEVER write "[Brand Name]".
- NEVER write "[Store Name]".
- NEVER write "[Your Store Name]".
- NEVER leave square-bracket template variables unresolved.
- If a sign-off is appropriate, use "Best regards," followed by "Customer Service Team".
- Do not include notes or explanations outside the customer reply.

Write the final customer reply now.
`;

          const aiReplyText = await askGroq(prompt);

          if (!aiReplyText) {
            throw new Error('Received empty response from AI service.');
          }

          // Final safety check before saving the generated reply.
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
            pattern.test(aiReplyText)
          );

          if (containsPlaceholder) {
            throw new Error(
              'AI generated a reply containing an unresolved placeholder.'
            );
          }

          // Update database record with generated AI reply.
          await db.review.update({
            where: { id: review.id },
            data: {
              aiReply: aiReplyText,
            },
          });

          success = true;
          break;
        } catch (err) {
          lastError = err.message;

          console.warn(
            `[Bulk AI] Review ID ${review.id} attempt ${attempt} failed: ${err.message}`
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

      // Rest between requests to protect against Groq RPM limits.
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
        error: error.message || 'Internal server error',
      },
      {
        status: 500,
      }
    );
  }
}