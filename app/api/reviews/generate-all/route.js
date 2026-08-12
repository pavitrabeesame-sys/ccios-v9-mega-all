import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ============================================================
// CONFIG
// ============================================================

const REQUEST_DELAY_MS = 500;
const MAX_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 2000;

// ============================================================
// HELPERS
// ============================================================

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error) {
  if (!error) return 'Unknown error';

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

// ============================================================
// PLACEHOLDER PROTECTION
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
  if (!text) return false;

  return PLACEHOLDER_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

// ============================================================
// ERROR TYPES
// ============================================================

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
    text.includes('quota') ||
    text.includes('resource_exhausted')
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
  if (!review) return false;

  // Never regenerate already replied reviews
  if (review.status === 'REPLIED') {
    return false;
  }

  // Generate if no reply exists
  // OR existing reply contains a placeholder
  return (
    !review.aiReply ||
    hasPlaceholder(review.aiReply)
  );
}

// ============================================================
// BRAND + PROMPT
// ============================================================

function buildPrompt(review) {
  const reviewText =
    (review.reviewText || '').trim();

  const rating =
    Number(review.rating) || 5;

  const rawBrand =
    (review.brand || review.storeName || '').trim();

  const brandAliases = {
    RAV: 'RAV Design',
    'RAV DESIGN': 'RAV Design',

    NICOLE: 'Nicole Collection',
    'NICOLE COLLECTION': 'Nicole Collection',

    'HUSH PUPPIES':
      'Hush Puppies Accessories',

    'HUSH PUPPIES ACCESSORIES':
      'Hush Puppies Accessories',

    OBERMAIN:
      'Obermain Accessories Official Store',

    'OBERMAIN ACCESSORIES OFFICIAL STORE':
      'Obermain Accessories Official Store',

    'JOHN LANGFORD':
      'JOHN LANGFORD OF LONDON',

    'JOHN LANGFORD OF LONDON':
      'JOHN LANGFORD OF LONDON',
  };

  const brandName =
    brandAliases[rawBrand.toUpperCase()] ||
    rawBrand ||
    'Our Store';

  const brandVoices = {
    'RAV Design': `
Premium, rugged, confident and sophisticated.
Focus on quality, craftsmanship, durability and practical everyday style.
Use confident professional language.
Never sound cute, overly casual or overly emotional.
`,

    'Nicole Collection': `
Elegant, feminine, modern and refined.
Focus on flattering style, elegance, quality and effortless fashion.
Use warm but polished language.
Never sound rugged or corporate.
`,

    'Hush Puppies Accessories': `
Friendly, trustworthy and professional.
Focus on comfort, quality, thoughtful design and everyday usability.
Sound warm and approachable while remaining polished.
`,

    'Obermain Accessories Official Store': `
Premium, refined and practical.
Focus on craftsmanship, quality, sophisticated design and everyday functionality.
Use mature, polished and professional language.
`,

    'JOHN LANGFORD OF LONDON': `
Classic, distinguished, formal and sophisticated.
Focus on timeless style, refinement, craftsmanship and quality.
Use elegant professional language.
Avoid casual, cute or overly enthusiastic expressions.
`,
  };

  const brandVoice =
    brandVoices[brandName] ||
    `
Professional, warm and brand-appropriate.
`;

  const hasComment =
    Boolean(reviewText);

  const reviewDisplay =
    hasComment
      ? `"${reviewText}"`
      : '[NO WRITTEN COMMENT]';

  let actionRule = '';

  if (rating >= 5 && !hasComment) {
    actionRule = `
5-STAR WITH NO COMMENT:
Use a concise professional appreciation reply.
Do NOT invent what the customer liked.
`;
  } else if (
    rating === 4 &&
    !hasComment
  ) {
    actionRule = `
4-STAR WITH NO COMMENT:
Thank the customer for the rating and support.
Do not imply that anything went wrong.
Leave a positive opening for future service.
`;
  } else if (
    rating === 3 &&
    !hasComment
  ) {
    actionRule = `
3-STAR WITH NO COMMENT:
Remain neutral and professional.
Thank the customer for taking the time to rate the store.
Do not assume dissatisfaction or invent a problem.
`;
  } else if (
    rating === 2 &&
    !hasComment
  ) {
    actionRule = `
2-STAR WITH NO COMMENT:
Be polite and mildly apologetic.
Acknowledge that the experience may not have met expectations.
Do not guess what the problem was.
Invite the customer to contact the store if assistance is needed.
`;
  } else if (
    rating <= 1 &&
    !hasComment
  ) {
    actionRule = `
1-STAR WITH NO COMMENT:
Be professional, respectful and apologetic.
Do not guess what went wrong.
Invite the customer to contact the store for assistance.
`;
  } else if (
    rating >= 4 &&
    hasComment
  ) {
    actionRule = `
POSITIVE REVIEW WITH COMMENT:
Read the customer's actual words carefully.
Identify the specific things they mentioned positively.
Thank them and directly acknowledge those points.
Do NOT fall back to a generic star-only reply.
`;
  } else {
    actionRule = `
REVIEW WITH COMMENT AND RATING 1-3:
Handle carefully.
Acknowledge the customer's actual concern.
Do not argue or become defensive.
Do not invent facts.
Do not promise compensation, replacement, refund or policy exceptions.
`;
  }

  return `
You are the official customer-service representative for:

${brandName}

BRAND VOICE:
${brandVoice}

CUSTOMER RATING:
${rating}/5

CUSTOMER REVIEW:
${reviewDisplay}

RESPONSE RULE:
${actionRule}

LANGUAGE:
Reply in the same language used by the customer.

For Malaysian Malay:
Use natural Malaysian Malay.

For Chinese:
Use natural Simplified Chinese suitable for Malaysian customers.

Do not use unnatural literal translation.

PRODUCT INFORMATION:
Only use product information supplied by the system.
Never invent:
- material
- specifications
- features
- warranty
- delivery promises
- refund policy
- replacement policy
- product claims

IMPORTANT RULES:

- Start the reply with the exact brand name:
  ${brandName}

- No emojis.
- No hashtags.
- No markdown.
- No bullet points.
- No quotation marks around the reply.
- Do not mention AI.
- Do not mention automation.
- Do not mention prompts.
- Do not mention models.
- Do not use placeholders.
- Do not invent customer experiences.
- Do not invent product facts.
- Do not claim a problem the customer did not mention.
- Do not promise anything unverifiable.
- Keep the reply concise.
- Keep it natural.
- Avoid repetitive wording.
- Make the wording different between brands.
- The reply must sound like ${brandName}.

Return ONLY the final customer reply.
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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

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
// IMPORTANT:
// Gemini quota state belongs to THIS bulk request.
// Once Gemini returns 429/quota,
// all remaining reviews go directly to Groq.
// ============================================================

async function generateWithFallback(
  prompt,
  state
) {
  const errors = [];

  // ----------------------------------------------------------
  // GEMINI
  // ----------------------------------------------------------

  if (!state.geminiQuotaExhausted) {
    try {
      console.log(
        '[AI] Trying Gemini...'
      );

      const reply =
        await askGemini(prompt);

      if (
        !reply?.trim() ||
        hasPlaceholder(reply)
      ) {
        throw new Error(
          'Gemini generated an invalid reply.'
        );
      }

      console.log(
        '[AI] SUCCESS: Gemini'
      );

      return {
        reply: reply.trim(),
        provider: 'Gemini',
        errors,
      };
    } catch (error) {
      const message =
        getErrorMessage(error);

      console.warn(
        `[AI] Gemini failed: ${message}`
      );

      errors.push({
        provider: 'Gemini',
        error: message,
      });

      // CRITICAL FIX:
      // Once Gemini quota is exhausted,
      // never call Gemini again during this bulk run.
      if (isRateLimitError(error)) {
        state.geminiQuotaExhausted = true;

        console.log(
          '[AI] Gemini quota exhausted.'
        );

        console.log(
          '[AI] Switching remaining reviews directly to Groq.'
        );
      }
    }
  }

  // ----------------------------------------------------------
  // GROQ
  // ----------------------------------------------------------

  try {
    console.log(
      '[AI] Trying Groq...'
    );

    const reply =
      await askGroqSafe(prompt);

    if (
      !reply?.trim() ||
      hasPlaceholder(reply)
    ) {
      throw new Error(
        'Groq generated an invalid reply.'
      );
    }

    console.log(
      '[AI] SUCCESS: Groq'
    );

    return {
      reply: reply.trim(),
      provider: 'Groq',
      errors,
    };
  } catch (error) {
    const message =
      getErrorMessage(error);

    console.warn(
      `[AI] Groq failed: ${message}`
    );

    errors.push({
      provider: 'Groq',
      error: message,
    });
  }

  // ----------------------------------------------------------
  // OLLAMA
  // ----------------------------------------------------------

  try {
    console.log(
      '[AI] Trying Ollama...'
    );

    const reply =
      await askOllama(prompt);

    if (
      !reply?.trim() ||
      hasPlaceholder(reply)
    ) {
      throw new Error(
        'Ollama generated an invalid reply.'
      );
    }

    console.log(
      '[AI] SUCCESS: Ollama'
    );

    return {
      reply: reply.trim(),
      provider: 'Ollama',
      errors,
    };
  } catch (error) {
    const message =
      getErrorMessage(error);

    console.warn(
      `[AI] Ollama failed: ${message}`
    );

    errors.push({
      provider: 'Ollama',
      error: message,
    });
  }

  throw new Error(
    `All AI providers failed: ${JSON.stringify(
      errors
    )}`
  );
}

// ============================================================
// POST /api/reviews/generate-all
// ============================================================

export async function POST(req) {
  try {
    // --------------------------------------------------------
    // REQUEST
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // GEMINI STATE FOR THIS BULK RUN
    // --------------------------------------------------------

    const aiState = {
      geminiQuotaExhausted: false,
    };

    // --------------------------------------------------------
    // DATABASE QUERY
    // --------------------------------------------------------

    let candidates = [];

    if (hasExplicitIds) {
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

    // --------------------------------------------------------
    // FILTER
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // NOTHING TO GENERATE
    // --------------------------------------------------------

    if (total === 0) {
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

    // --------------------------------------------------------
    // COUNTERS
    // --------------------------------------------------------

    let generatedCount = 0;
    let failedCount = 0;

    const errors = [];

    // --------------------------------------------------------
    // PROCESS ONE BY ONE
    // --------------------------------------------------------

    for (
      const review of reviewsToProcess
    ) {
      let success = false;
      let lastError = null;

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

          const result =
            await generateWithFallback(
              prompt,
              aiState
            );

          const cleanedReply =
            result.reply;

          const provider =
            result.provider;

          // --------------------------------------------------
          // SAFETY CHECK
          // --------------------------------------------------

          if (
            !cleanedReply ||
            !cleanedReply.trim()
          ) {
            throw new Error(
              'AI returned an empty response.'
            );
          }

          if (
            hasPlaceholder(
              cleanedReply
            )
          ) {
            throw new Error(
              'AI generated a reply containing a placeholder.'
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

          // Retry ONLY temporary errors
          if (
            attempt <= MAX_RETRIES &&
            isRetryableError(error)
          ) {
            const retryDelay =
              RETRY_BASE_DELAY_MS *
              attempt;

            console.log(
              `[Bulk AI] Retrying in ${retryDelay}ms...`
            );

            await delay(
              retryDelay
            );

            continue;
          }

          break;
        }
      }

      // --------------------------------------------------------
      // RESULT
      // --------------------------------------------------------

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

      await delay(
        REQUEST_DELAY_MS
      );
    }

    // --------------------------------------------------------
    // FINAL
    // --------------------------------------------------------

    console.log(
      '================================================'
    );

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
      '[Bulk AI] Gemini quota exhausted:',
      aiState.geminiQuotaExhausted
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
        `Generated ${generatedCount} selected AI replies${
          failedCount > 0
            ? `, ${failedCount} failed`
            : ''
        }.`,
    });
  } catch (error) {
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