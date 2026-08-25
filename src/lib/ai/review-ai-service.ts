import { prisma as db } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export function hasIncompleteThankYouPhrase(reply: string): boolean {
  const text = String(reply || '').trim().replace(/\s+/g, ' ');
  return /\bterima kasih atas[.!?,]?\s*$/i.test(text);
}

export function hasIncompleteStructuralEnding(reply: string): boolean {
  const incompleteEndings = [
    'and',
    'or',
    'but',
    'because',
    'with',
    'for',
    'to',
    'of',
    'the',
    'a',
    'an',
    'yang',
    'dan',
    'atau',
    'karena',
    'untuk',
    'dari',
    'ke',
    'di',
  ];

  const lastWord = String(reply || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/, '')
    .split(/\s+/)
    .pop();

  return !!lastWord && incompleteEndings.includes(lastWord);
}

export function cleanGeneratedReply(value: unknown): string {
  let text = String(value || '').trim();

  // Remove markdown code fences.
  text = text.replace(/^```(?:text|txt)?\s*/i, '');
  text = text.replace(/\s*```$/i, '');

  // Remove common AI prefixes.
  text = text.replace(
    /^(reply|response|customer reply|answer)\s*:\s*/i,
    ''
  );

  // Remove surrounding quotes.
  text = text.replace(/^["'`]+|["'`]+$/g, '');

  // Remove excessive whitespace.
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export function validateReply(
  rawReply: string,
  reviewContext?: any
): {
  valid: boolean;
  code?: string;
  reason?: string;
  cleanedReply?: string;
} {
  const cleaned = cleanGeneratedReply(rawReply);

  if (!cleaned) {
    return {
      valid: false,
      code: 'EMPTY',
      reason: 'Reply is empty.',
    };
  }

  if (hasIncompleteThankYouPhrase(cleaned)) {
    return {
      valid: false,
      code: 'INCOMPLETE_PHRASE',
      reason: 'Unnatural/incomplete phrase detected: "terima kasih atas".',
    };
  }

  if (hasIncompleteStructuralEnding(cleaned)) {
    return {
      valid: false,
      code: 'INCOMPLETE_STRUCTURE',
      reason: 'Response appears structurally incomplete.',
    };
  }

  if (cleaned.length < 15) {
    return {
      valid: false,
      code: 'TOO_GENERIC',
      reason: 'Reply is too short.',
    };
  }

  if (cleaned.length > 500) {
    return {
      valid: false,
      code: 'TOO_LONG',
      reason: 'Reply exceeds maximum length.',
    };
  }

  return {
    valid: true,
    code: 'VALID',
    cleanedReply: cleaned,
  };
}

export async function loadBrandProfile(
  review: any,
  profileCache?: Map<string, Promise<any>>
) {
  if (!review?.brand) return null;

  const cacheKey = String(review.brand).trim();

  if (profileCache?.has(cacheKey)) {
    return profileCache.get(cacheKey);
  }

  const lookup = db.aIProfile.findFirst({
    where: {
      Brand: {
        name: {
          equals: cacheKey,
          mode: 'insensitive',
        },
      },
    },
  });

  if (profileCache) {
    profileCache.set(cacheKey, lookup);
  }

  return await lookup;
}

let geminiCooldownUntil = 0;
let groqCooldownUntil = 0;

const COOLDOWN_MS = 5 * 60 * 1000;

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({
      apiKey: process.env.GROQ_API_KEY,
    })
  : null;

/**
 * ------------------------------------------------------------
 * GEMINI
 * ------------------------------------------------------------
 */

async function executeGeminiCall(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction,
  });

  const result = await model.generateContent({
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
      maxOutputTokens: 250,
      temperature: 0.4,
    },
  });

  return (await result.response).text();
}

/**
 * ------------------------------------------------------------
 * GROQ
 * ------------------------------------------------------------
 *
 * Current verified model:
 *
 * openai/gpt-oss-20b
 *
 * Do NOT use old llama models.
 */

async function executeGroqCall(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  if (!groq) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const model =
    process.env.GROQ_REVIEW_MODEL || 'openai/gpt-oss-20b';

  console.log(`[AI] Groq model → ${model}`);

  const completion = await groq.chat.completions.create({
    model,

    messages: [
      {
        role: 'system',
        content: `${systemInstruction}

STRICT OUTPUT RULES:

1. Return ONLY the final customer reply.
2. Do NOT explain your reasoning.
3. Do NOT provide analysis.
4. Do NOT use markdown.
5. Do NOT use quotation marks around the reply.
6. Do NOT write "Reply:" or "Response:".
7. Do NOT include multiple alternatives.
8. Do NOT include bullet points.
9. The reply must be a complete natural sentence.
10. Keep the reply between 20 and 400 characters.
11. Reply in the same language as the customer review when possible.
12. Sound warm, professional and human.
13. Mention the brand/product naturally when appropriate.
14. Never invent discounts, refunds, guarantees, specifications or facts not present in the review.
15. End with a complete sentence.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],

    max_completion_tokens: 300,

    // GPT-OSS supports reasoning. Keep reasoning controlled so that
    // the returned content remains suitable for direct customer reply.
    reasoning_effort: 'low',
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Groq returned an empty response.');
  }

  const cleaned = cleanGeneratedReply(content);

  console.log(`[AI] Groq raw length → ${String(content).length}`);
  console.log(`[AI] Groq cleaned → ${cleaned}`);

  const validation = validateReply(cleaned);

  if (!validation.valid) {
    throw new Error(
      `Groq generated an invalid reply: ${validation.code} - ${validation.reason}`
    );
  }

  return validation.cleanedReply || cleaned;
}

/**
 * ------------------------------------------------------------
 * OLLAMA
 * ------------------------------------------------------------
 */

async function executeOllamaCall(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const host =
    process.env.OLLAMA_HOST || 'http://localhost:11434';

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_REVIEW_MODEL || 'qwen3:4b',
      system: `${systemInstruction}

Return ONLY the final customer reply.
Do not explain your reasoning.
Do not use markdown.
Do not write "Reply:".
Write one complete natural customer-facing response.
Keep it concise and professional.`,

      prompt,

      stream: false,

      options: {
        num_predict: 200,
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const data = await response.json();

  const reply = cleanGeneratedReply(data?.response);

  if (!reply) {
    throw new Error('Ollama returned an empty response.');
  }

  return reply;
}

/**
 * ------------------------------------------------------------
 * MAIN REVIEW GENERATION ENGINE
 * ------------------------------------------------------------
 */

export async function generateReviewReply(
  review: any,
  options: {
    aiProfile?: any;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const brandName =
    String(review?.brand || '').trim() || 'RAV Design';

  const systemInstruction = [
    review?._generationInstruction ||
      'You are a professional customer support executive.',

    `Brand: ${brandName}`,

    options.aiProfile?.brandRules
      ? `Brand Guidelines: ${options.aiProfile.brandRules}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Customer Review:
"${String(
    review?.reviewText || 'Produk baik.'
  ).trim()}"

Customer Rating:
${review?.rating || 5}

Brand:
${brandName}

Write the final customer-facing reply now.`;

  let rawReply = '';

  const now = Date.now();

  /**
   * ----------------------------------------------------------
   * 1. GEMINI
   * ----------------------------------------------------------
   */

  if (
    now > geminiCooldownUntil &&
    String(process.env.GEMINI_REVIEW_ENABLED) !== 'false'
  ) {
    try {
      console.log(`[AI] Gemini → ${brandName}`);

      rawReply = await executeGeminiCall(
        prompt,
        systemInstruction
      );

      const validation = validateReply(rawReply, review);

      if (!validation.valid) {
        console.log(
          `[AI] Gemini invalid → ${brandName}: ${validation.reason}`
        );

        rawReply = '';
      }
    } catch (error: any) {
      console.log(
        `[AI] Gemini FAILED → ${brandName}:`,
        error?.message || error
      );

      const message = String(error?.message || '');

      if (
        message.includes('429') ||
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('rate limit')
      ) {
        geminiCooldownUntil = now + COOLDOWN_MS;
      }

      rawReply = '';
    }
  }

  /**
   * ----------------------------------------------------------
   * 2. GROQ
   * ----------------------------------------------------------
   */

  if (
    !rawReply &&
    now > groqCooldownUntil &&
    String(process.env.GROQ_REVIEW_ENABLED) !== 'false'
  ) {
    try {
      console.log(`[AI] Groq → ${brandName}`);

      rawReply = await executeGroqCall(
        prompt,
        systemInstruction
      );
    } catch (error: any) {
      console.log(
        `[AI] Groq FAILED → ${brandName}:`,
        error?.message || error
      );

      const message = String(error?.message || '').toLowerCase();

      if (
        message.includes('rate limit') ||
        message.includes('tokens per day') ||
        message.includes('quota') ||
        message.includes('too many requests')
      ) {
        groqCooldownUntil = now + COOLDOWN_MS;
      }

      rawReply = '';
    }
  }

  /**
   * ----------------------------------------------------------
   * 3. OLLAMA FALLBACK
   * ----------------------------------------------------------
   */

  if (
    !rawReply &&
    String(process.env.OLLAMA_REVIEW_ENABLED) !== 'false'
  ) {
    try {
      console.log(`[AI] Ollama → ${brandName}`);

      rawReply = await executeOllamaCall(
        prompt,
        systemInstruction
      );
    } catch (error: any) {
      console.log(
        `[AI] Ollama FAILED → ${brandName}:`,
        error?.message || error
      );

      rawReply = '';
    }
  }

  if (!rawReply) {
    throw new Error(
      'All configured AI providers failed or generated invalid replies.'
    );
  }

  /**
   * Final validation regardless of provider.
   */

  const validation = validateReply(rawReply, review);

  if (!validation.valid) {
    throw new Error(
      `Validation failed: ${validation.reason}`
    );
  }

  return (
    validation.cleanedReply ||
    cleanGeneratedReply(rawReply)
  );
}