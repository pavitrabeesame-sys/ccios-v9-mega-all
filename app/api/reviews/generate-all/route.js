import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// CONFIGURATION
// ============================================================

// Small delay between successful AI requests.
// This helps avoid hammering Groq during bulk generation.
const REQUEST_DELAY_MS = 1000;

// Only retry transient errors.
// IMPORTANT:
// Daily token quota errors are NEVER retried.
const MAX_RETRIES = 1;

// Delay for normal transient retry.
const RETRY_BASE_DELAY_MS = 3000;

// ============================================================
// HELPERS
// ============================================================

const delay = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

// ============================================================
// PLACEHOLDER DETECTION
// ============================================================

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
  if (!text) {
    return false;
  }

  return PLACEHOLDER_PATTERNS.some(
    (pattern) =>
      pattern.test(text)
  );
}

// ============================================================
// RATE LIMIT DETECTION
// ============================================================

function isRateLimitError(error) {
  if (!error) {
    return false;
  }

  const raw =
    typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const text =
    raw.toLowerCase();

  return (
    text.includes(
      'rate_limit_exceeded'
    ) ||
    text.includes(
      'rate limit reached'
    ) ||
    text.includes(
      'rate limit'
    ) ||
    text.includes(
      'tokens per day'
    ) ||
    text.includes(
      'tpd'
    ) ||
    text.includes(
      'too many requests'
    ) ||
    text.includes(
      '429'
    )
  );
}

// ============================================================
// DAILY TOKEN QUOTA DETECTION
// ============================================================

function isDailyTokenLimit(error) {
  if (!error) {
    return false;
  }

  const raw =
    typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const text =
    raw.toLowerCase();

  return (
    text.includes(
      'tokens per day'
    ) ||
    text.includes(
      'tpd'
    ) ||
    text.includes(
      'daily token'
    ) ||
    text.includes(
      'limit 100000'
    )
  );
}

// ============================================================
// RETRYABLE ERROR DETECTION
// ============================================================

function isRetryableError(error) {
  if (!error) {
    return false;
  }

  // NEVER retry daily token exhaustion.
  if (
    isDailyTokenLimit(error)
  ) {
    return false;
  }

  // NEVER retry generic rate-limit errors
  // from the daily quota path.
  if (
    isRateLimitError(error)
  ) {
    return false;
  }

  const raw =
    typeof error === 'string'
      ? error
      : JSON.stringify(error);

  const text =
    raw.toLowerCase();

  return (
    text.includes(
      'timeout'
    ) ||
    text.includes(
      'timed out'
    ) ||
    text.includes(
      'network'
    ) ||
    text.includes(
      'fetch failed'
    ) ||
    text.includes(
      '502'
    ) ||
    text.includes(
      '503'
    ) ||
    text.includes(
      '504'
    )
  );
}

// ============================================================
// SAFE ERROR STRING
// ============================================================

function getErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (
    typeof error === 'string'
  ) {
    return error;
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  try {
    return JSON.stringify(
      error
    );
  } catch {
    return String(error);
  }
}

// ============================================================
// REVIEW ELIGIBILITY
// ============================================================

function isRegenerationCandidate(
  review
) {
  if (!review) {
    return false;
  }

  // Never regenerate a review that has already
  // been posted/replied to.
  if (
    review.status ===
    'REPLIED'
  ) {
    return false;
  }

  // Shopee review must have shopId.
  if (
    review.shopId === null ||
    review.shopId === undefined
  ) {
    return false;
  }

  // Generate when there is no AI reply
  // OR the existing reply contains a placeholder.
  return (
    !review.aiReply ||
    hasPlaceholder(
      review.aiReply
    )
  );
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildPrompt(review) {
  const textContent =
    review.reviewText?.trim() ||
    '';

  const rating =
    Number(review.rating) || 5;

  const brandName =
    review.brand?.trim() ||
    'our store';

  const reviewDisplay =
    textContent
      ? `"${textContent}"`
      : '[No written review provided]';

  /*
   * IMPORTANT:
   *
   * Keep this prompt intentionally compact.
   *
   * The previous prompt was around 650 input tokens
   * before the model even generated the reply.
   *
   * Shortening the instructions significantly reduces
   * Groq TPD consumption.
   */

  return `
Write a short official customer-service reply for ${brandName}.

Customer rating: ${rating}/5
Customer review:
${reviewDisplay}

Rules:
- Respond to the customer's actual review.
- Be warm, natural, human and concise.
- Match the customer's language when appropriate.
- For positive reviews, thank them and mention their specific feedback when possible.
- For negative reviews, acknowledge the actual concern and be empathetic.
- If there is no written review, only thank them for the rating.
- Never invent product details, orders, policies, warranties, refunds, replacements, compensation, discounts, delivery promises or future commitments.
- Never promise that suggestions will be implemented.
- Never claim the customer experienced something not stated.
- Never mention AI, prompts, models, automation or internal systems.
- Never use placeholders or square-bracket variables.
- Do not add explanations or labels.
- Return ONLY the customer reply.

If a sign-off is appropriate:
Best regards,
Customer Service Team
`.trim();
}

// ============================================================
// POST /api/reviews/generate-all
// ============================================================

export async function POST(
  req
) {
  try {
    // ========================================================
    // READ REQUEST
    // ========================================================

    const body =
      await req
        .json()
        .catch(() => ({}));

    const ids =
      Array.isArray(body?.ids)
        ? body.ids
        : [];

    const requestedLimit =
      typeof body?.limit ===
        'number' &&
      body.limit > 0
        ? Math.floor(
            body.limit
          )
        : null;

    // ========================================================
    // IMPORTANT:
    //
    // If ids are supplied, ONLY those IDs may be processed.
    //
    // There is NO fallback to "all pending reviews".
    // ========================================================

    const hasExplicitIds =
      ids.length > 0;

    console.log(
      '================================================'
    );

    console.log(
      '[Bulk AI] START'
    );

    console.log(
      '[Bulk AI] Explicit IDs:',
      hasExplicitIds
    );

    console.log(
      '[Bulk AI] Requested ID count:',
      ids.length
    );

    if (
      hasExplicitIds
    ) {
      console.log(
        '[Bulk AI] IDs:',
        ids
      );
    }

    // ========================================================
    // BUILD DATABASE QUERY
    // ========================================================

    let candidates = [];

    if (
      hasExplicitIds
    ) {
      // ------------------------------------------------------
      // SELECTED MODE
      // ------------------------------------------------------

      // Remove duplicates while preserving order.
      const uniqueIds = [
        ...new Set(
          ids
            .filter(
              (id) =>
                typeof id ===
                  'string' &&
                id.trim() !== ''
            )
            .map(
              (id) =>
                id.trim()
            )
        ),
      ];

      if (
        uniqueIds.length ===
        0
      ) {
        return NextResponse.json({
          success: true,
          message:
            'No valid review IDs were supplied.',
          generated: 0,
          failed: 0,
          total: 0,
        });
      }

      candidates =
  await db.review.findMany({
    where: {
      id: {
        in: uniqueIds,
      },

      // Selected reviews can be generated regardless
      // of whether shopId is populated.
      // shopId is NOT required for AI generation.
      status: {
        not: 'REPLIED',
      },
    },

    take:
      requestedLimit ||
      uniqueIds.length,
  });
    } else {
      // ------------------------------------------------------
      // GENERATE-ALL MODE
      // ------------------------------------------------------

      candidates =
        await db.review.findMany({
          where: {
            status: {
              not: 'REPLIED',
            },

            shopId: {
              not: null,
            },
          },

          orderBy: {
            createdAt: 'desc',
          },

          ...(requestedLimit
            ? {
                take:
                  requestedLimit,
              }
            : {}),
        });
    }

    // ========================================================
    // FILTER INVALID / ALREADY GENERATED REVIEWS
    // ========================================================

    const reviewsToProcess =
      candidates.filter(
        isRegenerationCandidate
      );

    const total =
      reviewsToProcess.length;

    console.log(
      '[Bulk AI] Candidates found:',
      candidates.length
    );

    console.log(
      '[Bulk AI] Reviews requiring generation:',
      total
    );

    // ========================================================
    // NOTHING TO DO
    // ========================================================

    if (
      total === 0
    ) {
      console.log(
        '[Bulk AI] Nothing to generate.'
      );

      console.log(
        '================================================'
      );

      return NextResponse.json({
        success: true,
        message:
          hasExplicitIds
            ? 'None of the selected reviews require AI generation or regeneration.'
            : 'No reviews require AI generation or regeneration.',
        generated: 0,
        failed: 0,
        total: 0,
      });
    }

    // ========================================================
    // PROCESS
    // ========================================================

    let generatedCount =
      0;

    let failedCount =
      0;

    const errors = [];

    let rateLimited =
      false;

    let rateLimitMessage =
      null;

    // ========================================================
    // SEQUENTIAL PROCESSING
    // ========================================================

    for (
      const review of reviewsToProcess
    ) {
      let success =
        false;

      let lastError =
        null;

      // ------------------------------------------------------
      // ATTEMPTS
      // ------------------------------------------------------

      for (
        let attempt = 1;
        attempt <=
        MAX_RETRIES + 1;
        attempt++
      ) {
        try {
          console.log(
            `[Bulk AI] Processing review ${review.id}, attempt ${attempt}`
          );

          const prompt =
            buildPrompt(
              review
            );

          // --------------------------------------------------
          // CALL GROQ
          // --------------------------------------------------

          const aiReplyText =
            await askGroq(
              prompt
            );

          // --------------------------------------------------
          // EMPTY RESPONSE
          // --------------------------------------------------

          if (
            !aiReplyText ||
            !aiReplyText.trim()
          ) {
            throw new Error(
              'Received empty response from AI service.'
            );
          }

          const cleanedReply =
            aiReplyText.trim();

          // --------------------------------------------------
          // PLACEHOLDER SAFETY
          // --------------------------------------------------

          if (
            hasPlaceholder(
              cleanedReply
            )
          ) {
            throw new Error(
              'AI generated a reply containing an unresolved placeholder.'
            );
          }

          // --------------------------------------------------
          // SAVE
          // --------------------------------------------------

          await db.review.update({
            where: {
              id: review.id,
            },

            data: {
              aiReply:
                cleanedReply,

              status:
                'GENERATED',
            },
          });

          console.log(
            `[Bulk AI] Review ${review.id} generated successfully.`
          );

          success =
            true;

          break;
        } catch (err) {
          lastError =
            getErrorMessage(
              err
            );

          console.warn(
            `[Bulk AI] Review ID ${review.id} attempt ${attempt} failed: ${lastError}`
          );

          // ==================================================
          // DAILY TOKEN LIMIT
          // ==================================================

          if (
            isDailyTokenLimit(
              err
            )
          ) {
            rateLimited =
              true;

            rateLimitMessage =
              lastError;

            console.error(
              '[Bulk AI] GROQ DAILY TOKEN LIMIT REACHED.'
            );

            console.error(
              '[Bulk AI] Stopping entire bulk operation immediately.'
            );

            break;
          }

          // ==================================================
          // OTHER RATE LIMIT
          // ==================================================

          if (
            isRateLimitError(
              err
            )
          ) {
            rateLimited =
              true;

            rateLimitMessage =
              lastError;

            console.error(
              '[Bulk AI] GROQ RATE LIMIT REACHED.'
            );

            console.error(
              '[Bulk AI] Stopping entire bulk operation immediately.'
            );

            break;
          }

          // ==================================================
          // TRANSIENT ERROR
          // ==================================================

          if (
            attempt <=
              MAX_RETRIES &&
            isRetryableError(
              err
            )
          ) {
            const retryDelay =
              RETRY_BASE_DELAY_MS *
              attempt;

            console.log(
              `[Bulk AI] Temporary error. Retrying review ${review.id} in ${retryDelay}ms.`
            );

            await delay(
              retryDelay
            );

            continue;
          }

          // ==================================================
          // NON-RETRYABLE ERROR
          // ==================================================

          break;
        }
      }

      // ======================================================
      // SUCCESS
      // ======================================================

      if (
        success
      ) {
        generatedCount++;
      } else {
        failedCount++;

        errors.push({
          id: review.id,
          error:
            lastError ||
            'Unknown AI generation error.',
        });
      }

      // ======================================================
      // STOP AFTER RATE LIMIT
      // ======================================================

      if (
        rateLimited
      ) {
        break;
      }

      // ======================================================
      // DELAY BETWEEN REVIEWS
      // ======================================================

      await delay(
        REQUEST_DELAY_MS
      );
    }

    // ========================================================
    // RATE LIMITED RESPONSE
    // ========================================================

    if (
      rateLimited
    ) {
      const processed =
        generatedCount +
        failedCount;

      const remaining =
        Math.max(
          0,
          total -
            processed
        );

      const friendlyMessage =
        'Groq AI rate limit reached. ' +
        `Generated ${generatedCount} review(s) before the limit. ` +
        `${remaining} review(s) were not processed. ` +
        'Please wait for the Groq limit to reset before trying again.';

      console.warn(
        '[Bulk AI]',
        friendlyMessage
      );

      console.log(
        '================================================'
      );

      return NextResponse.json(
        {
          success: false,

          rateLimited: true,

          generated:
            generatedCount,

          failed:
            failedCount,

          total,

          remaining,

          message:
            friendlyMessage,

          rateLimitError:
            rateLimitMessage,

          errors:
            errors.length > 0
              ? errors
              : undefined,
        },
        {
          status: 429,
        }
      );
    }

    // ========================================================
    // NORMAL RESPONSE
    // ========================================================

    console.log(
      '[Bulk AI] COMPLETE'
    );

    console.log(
      '[Bulk AI] Generated:',
      generatedCount
    );

    console.log(
      '[Bulk AI] Failed:',
      failedCount
    );

    console.log(
      '[Bulk AI] Total:',
      total
    );

    console.log(
      '================================================'
    );

    return NextResponse.json({
      success: true,

      generated:
        generatedCount,

      failed:
        failedCount,

      total,

      errors:
        errors.length > 0
          ? errors
          : undefined,

      message:
        `Generated ${generatedCount} AI reply/replies${
          failedCount > 0
            ? `, ${failedCount} failed`
            : ''
        }.`,
    });
  } catch (error) {
    // ========================================================
    // TOP-LEVEL ERROR
    // ========================================================

    const message =
      getErrorMessage(
        error
      );

    console.error(
      '[Generate-All Top-Level Error]:',
      message
    );

    // ========================================================
    // TOP-LEVEL RATE LIMIT
    // ========================================================

    if (
      isRateLimitError(
        error
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          rateLimited: true,

          generated: 0,

          failed: 0,

          total: 0,

          message:
            'Groq AI rate limit reached. Please wait for the limit to reset before trying again.',

          error: message,
        },
        {
          status: 429,
        }
      );
    }

    // ========================================================
    // GENERIC ERROR
    // ========================================================

    return NextResponse.json(
      {
        success: false,

        error:
          message ||
          'Internal server error.',
      },
      {
        status: 500,
      }
    );
  }
}

