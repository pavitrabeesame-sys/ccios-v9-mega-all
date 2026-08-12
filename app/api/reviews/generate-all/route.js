import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// CONFIGURATION
// ============================================================

const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 2000;

// ============================================================
// HELPERS
// ============================================================

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

  return PLACEHOLDER_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

// ============================================================
// ERROR HELPERS
// ============================================================

function getErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getErrorText(error) {
  return getErrorMessage(error).toLowerCase();
}

function isRateLimitError(error) {
  const text = getErrorText(error);

  return (
    text.includes('rate_limit_exceeded') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('tokens per day') ||
    text.includes('daily token') ||
    text.includes('tpd') ||
    text.includes('429') ||
    text.includes('quota')
  );
}

function isRetryableError(error) {
  const text = getErrorText(error);

  if (isRateLimitError(error)) {
    return false;
  }

  return (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('network') ||
    text.includes('fetch failed') ||
    text.includes('502') ||
    text.includes('503') ||
    text.includes('504')
  );
}

// ============================================================
// REVIEW ELIGIBILITY
// ============================================================

function isRegenerationCandidate(review) {
  if (!review) {
    return false;
  }

  // NEVER regenerate a review that has already
  // been posted/replied to.
  if (review.status === 'REPLIED') {
    return false;
  }

  // Generate when:
  // 1. No AI reply exists
  // OR
  // 2. Existing AI reply contains a placeholder
  return (
    !review.aiReply ||
    hasPlaceholder(review.aiReply)
  );
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildPrompt(review) {
  const textContent =
    review.reviewText?.trim() || '';

  const rating =
    Number(review.rating) || 5;

  const brandName =
    review.brand?.trim() || 'our store';

  const reviewDisplay =
    textContent
      ? `"${textContent}"`
      : '[No written review provided]';

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
// GEMINI
// ============================================================

async function askGemini(prompt) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  const model =
    process.env.GEMINI_MODEL ||
    'gemini-2.5-flash-lite';

  if (
    !apiKey ||
    apiKey === 'YOUR_GEMINI_API_KEY'
  ) {
    throw new Error(
      'Gemini API key is not configured.'
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response =
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                'You are a professional ecommerce customer service assistant. Return ONLY the final customer reply. Never explain your reasoning.',
            },
          ],
        },

        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        },
      }),
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Gemini ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || '')
      .join('')
      .trim();

  if (!text) {
    throw new Error(
      'Gemini returned an empty response.'
    );
  }

  return text;
}

// ============================================================
// GROQ
// ============================================================

async function askGroqSafe(prompt) {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (
    !apiKey ||
    apiKey === 'YOUR_GROQ_API_KEY'
  ) {
    throw new Error(
      'Groq API key is not configured.'
    );
  }

  const model =
    process.env.GROQ_MODEL ||
    'llama-3.1-8b-instant';

  console.log(
    `[AI] Trying Groq model: ${model}`
  );

  const reply =
    await askGroq(prompt);

  if (
    !reply ||
    !reply.trim()
  ) {
    throw new Error(
      'Groq returned an empty response.'
    );
  }

  return reply.trim();
}

// ============================================================
// OLLAMA
// ============================================================

async function askOllama(prompt) {
  const apiUrl =
    process.env.OLLAMA_API_URL ||
    'http://127.0.0.1:11434/api/chat';

  const model =
    process.env.OLLAMA_MODEL ||
    'qwen3:4b';

  // If env accidentally points to /api/generate,
  // normalize it to the chat endpoint.
  const url =
    apiUrl.replace(
      /\/api\/generate\/?$/,
      '/api/chat'
    );

  console.log(
    `[AI] Trying Ollama model: ${model}`
  );

  const response =
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        model,

        messages: [
          {
            role: 'system',
            content:
              'You are a professional ecommerce customer service assistant. Return ONLY the final customer reply. Never explain your reasoning.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],

        stream: false,

        options: {
          temperature: 0.3,
        },
      }),
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Ollama ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const text =
    data?.message?.content?.trim();

  if (!text) {
    throw new Error(
      'Ollama returned an empty response.'
    );
  }

  return text;
}

// ============================================================
// AI FALLBACK ENGINE
//
// Priority:
// 1. Gemini
// 2. Groq 8B
// 3. Ollama
// ============================================================

async function generateWithFallback(
  prompt
) {
  const providers = [
    {
      name: 'Gemini',
      run: () =>
        askGemini(prompt),
    },

    {
      name: 'Groq',
      run: () =>
        askGroqSafe(prompt),
    },

    {
      name: 'Ollama',
      run: () =>
        askOllama(prompt),
    },
  ];

  const providerErrors = [];

  for (
    const provider of providers
  ) {
    try {
      console.log(
        `[AI] Trying ${provider.name}...`
      );

      const reply =
        await provider.run();

      if (
        !reply ||
        !reply.trim()
      ) {
        throw new Error(
          `${provider.name} returned an empty reply.`
        );
      }

      const cleaned =
        reply.trim();

      if (
        hasPlaceholder(cleaned)
      ) {
        throw new Error(
          `${provider.name} generated an unresolved placeholder.`
        );
      }

      console.log(
        `[AI] SUCCESS: ${provider.name}`
      );

      return {
        reply: cleaned,
        provider: provider.name,
        errors: providerErrors,
      };
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.warn(
        `[AI] ${provider.name} failed: ${message}`
      );

      providerErrors.push({
        provider: provider.name,
        error: message,
      });

      // IMPORTANT:
      // Do NOT stop on rate limit.
      // Immediately try the next provider.
      continue;
    }
  }

  throw new Error(
    `All AI providers failed: ${JSON.stringify(
      providerErrors
    )}`
  );
}

// ============================================================
// POST /api/reviews/generate-all
// ============================================================

export async function POST(req) {
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
      typeof body?.limit === 'number' &&
      body.limit > 0
        ? Math.floor(body.limit)
        : null;

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

    if (hasExplicitIds) {
      console.log(
        '[Bulk AI] IDs:',
        ids
      );
    }

    // ========================================================
    // BUILD DATABASE QUERY
    // ========================================================

    let candidates = [];

    if (hasExplicitIds) {
      // ------------------------------------------------------
      // SELECTED MODE
      //
      // IMPORTANT:
      // shopId is NOT required here.
      // ------------------------------------------------------

      const uniqueIds = [
        ...new Set(
          ids
            .filter(
              (id) =>
                typeof id === 'string' &&
                id.trim() !== ''
            )
            .map((id) =>
              id.trim()
            )
        ),
      ];

      if (
        uniqueIds.length === 0
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
    // FILTER REVIEWS
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
    // NOTHING TO GENERATE
    // ========================================================

    if (total === 0) {
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

    let generatedCount = 0;
    let failedCount = 0;

    const errors = [];

    // ========================================================
    // SEQUENTIAL PROCESSING
    // ========================================================

    for (
      const review of reviewsToProcess
    ) {
      let success = false;
      let lastError = null;

      // ------------------------------------------------------
      // ATTEMPTS
      // ------------------------------------------------------

      for (
        let attempt = 1;
        attempt <= MAX_RETRIES + 1;
        attempt++
      ) {
        try {
          console.log(
            `[Bulk AI] Processing review ${review.id}, attempt ${attempt}`
          );

          const prompt =
            buildPrompt(review);

          // --------------------------------------------------
          // GEMINI → GROQ → OLLAMA
          // --------------------------------------------------

          const result =
            await generateWithFallback(
              prompt
            );

          const cleanedReply =
            result.reply;

          const provider =
            result.provider;

          // --------------------------------------------------
          // FINAL SAFETY
          // --------------------------------------------------

          if (
            !cleanedReply ||
            !cleanedReply.trim()
          ) {
            throw new Error(
              'Received empty response from AI service.'
            );
          }

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
            `[Bulk AI] Review ${review.id} generated successfully using ${provider}.`
          );

          success = true;

          break;
        } catch (error) {
          lastError =
            getErrorMessage(error);

          console.warn(
            `[Bulk AI] Review ${review.id} attempt ${attempt} failed: ${lastError}`
          );

          // --------------------------------------------------
          // RETRY ONLY TEMPORARY ERRORS
          // --------------------------------------------------

          if (
            attempt <= MAX_RETRIES &&
            isRetryableError(error)
          ) {
            const retryDelay =
              RETRY_BASE_DELAY_MS *
              attempt;

            console.log(
              `[Bulk AI] Temporary error. Retrying in ${retryDelay}ms.`
            );

            await delay(
              retryDelay
            );

            continue;
          }

          break;
        }
      }

      // ======================================================
      // SUCCESS / FAILURE
      // ======================================================

      if (success) {
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
      // DELAY
      // ======================================================

      await delay(
        REQUEST_DELAY_MS
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
      success:
        failedCount === 0,

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
    // TOP LEVEL ERROR
    // ========================================================

    const message =
      getErrorMessage(error);

    console.error(
      '[Generate-All Top-Level Error]:',
      message
    );

    return NextResponse.json(
      {
        success: false,

        generated: 0,

        failed: 0,

        total: 0,

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