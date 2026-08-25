import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/*
============================================================
CCIOS — MASTER REVIEW AI GENERATION ENGINE
2026 PRODUCTION HARDENED & BRAND-MAPPED
============================================================
*/

const CONCURRENCY = 1;
const GEMINI_QUOTA_COOLDOWN_MS = 60 * 1000;

const START_2026 = new Date("2026-01-01T00:00:00.000Z");
const START_2027 = new Date("2027-01-01T00:00:00.000Z");

/*
============================================================
GLOBAL AI STATE & CONCURRENCY LOCK
============================================================
*/

type CCIOSGeminiState = {
  quotaUntil: number;
};

const GLOBAL_STATE_KEY = '__CCIOS_GEMINI_STATE__';

const globalForCCIOS =
  globalThis as typeof globalThis & {
    [GLOBAL_STATE_KEY]?: CCIOSGeminiState;
    __CCIOS_BULK_JOB_STATE__?: { running: boolean; startedAt: number };
  };

const GLOBAL_STATE: CCIOSGeminiState =
  globalForCCIOS[GLOBAL_STATE_KEY] ?? {
    quotaUntil: 0,
  };

globalForCCIOS[GLOBAL_STATE_KEY] = GLOBAL_STATE;

const BULK_JOB_STATE =
  globalForCCIOS.__CCIOS_BULK_JOB_STATE__ || {
    running: false,
    startedAt: 0,
  };

globalForCCIOS.__CCIOS_BULK_JOB_STATE__ = BULK_JOB_STATE;

/*
============================================================
ERROR HELPERS
============================================================
*/

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRateLimitError(error: unknown): boolean {
  const text = getErrorMessage(error).toLowerCase();
  return (
    text.includes('429') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('rate_limit') ||
    text.includes('resource_exhausted') ||
    text.includes('too many requests') ||
    text.includes('tokens per day') ||
    text.includes('tokens per minute') ||
    text.includes('tpd')
  );
}

function isGeminiQuotaBlocked(): boolean {
  return Date.now() < GLOBAL_STATE.quotaUntil;
}

function blockGeminiQuota(): void {
  GLOBAL_STATE.quotaUntil = Date.now() + GEMINI_QUOTA_COOLDOWN_MS;
  console.warn('[AI] Primary AI quota/rate-limit detected. Cooldown activated.');
}

/*
============================================================
BRAND REGISTRY & SHOP ID MAPPING
============================================================
*/

const SHOP_ID_TO_BRAND_MAP: Record<string, string> = {
  "66854646": "Nicole Collection",
  "282544493": "Hush Puppies Accessories",
  "469553987": "RAV Design", // Update based on your actual store mappings
  "1788012053": "Nicole Collection",
  // Map any other Store_XXXXX IDs from your Prisma Studio view here
};

const BRAND_ALIASES = [
  {
    canonical: 'RAV Design',
    match: ['RAV', 'RAV DESIGN'],
    voice: 'Premium, rugged, sophisticated and adventurous. Focus on craftsmanship, durability, quality and timeless design.',
  },
  {
    canonical: 'Nicole Collection',
    match: ['NICOLE', 'NICOLE COLLECTION'],
    voice: 'Elegant, feminine, modern and refined. Focus on flattering design, sophistication, effortless style and quality.',
  },
  {
    canonical: 'Hush Puppies Accessories',
    match: ['HUSH PUPPIES', 'HUSH PUPPIES ACCESSORIES', 'HUSH'],
    voice: 'Friendly, trustworthy and professional. Focus on comfort, quality, practicality and thoughtful everyday design.',
  },
  {
    canonical: 'Obermain',
    match: ['OBERMAIN', 'OBERMAIN ACCESSORIES'],
    voice: 'Premium, refined and practical. Focus on craftsmanship, quality, sophisticated design and everyday functionality.',
  },
  {
    canonical: 'Beverly Hills Polo Club',
    match: ['BHPC', 'BEVERLY HILLS', 'BEVERLY HILLS POLO CLUB'],
    voice: 'Classic, sporty, prestigious and casual luxury. Focus on heritage, comfort, timeless appeal and premium quality.',
  },
  {
    canonical: 'JOHN LANGFORD OF LONDON',
    match: ['JOHN LANGFORD', 'JOHN LANGFORD OF LONDON', 'LANGFORD'],
    voice: 'Classic, formal and sophisticated. Focus on timeless style, craftsmanship, refinement and distinguished quality.',
  },
];

function normalizeBrand(rawBrand: unknown): string {
  if (!rawBrand) return 'Nicole Collection';

  const rawStr = String(rawBrand).trim();

  // 1. Intercept numeric Shop IDs and map them to clean canonical brand names
  if (SHOP_ID_TO_BRAND_MAP[rawStr]) {
    return SHOP_ID_TO_BRAND_MAP[rawStr];
  }

  const cleaned = rawStr
    .replace(/\(.*?\)/g, '')
    .replace(/official\s*store/gi, '')
    .replace(/boutique/gi, '')
    .replace(/accessories/gi, '')
    .trim()
    .toUpperCase();

  for (const brand of BRAND_ALIASES) {
    if (
      brand.match.some(
        (match) =>
          cleaned.includes(match) || match.includes(cleaned)
      )
    ) {
      return brand.canonical;
    }
  }

  // 2. Fallback if it's purely a number sequence but not in our dictionary map
  if (/^\d+$/.test(rawStr)) {
    return 'Nicole Collection';
  }

  return rawStr.replace(/\(.*?\)/g, '').trim() || 'Nicole Collection';
}

function getBrandVoice(brandName: string): string {
  const brand = BRAND_ALIASES.find(
    (item) => item.canonical.toLowerCase() === brandName.toLowerCase()
  );
  return brand?.voice || 'Professional, warm, natural and customer-focused.';
}

function getBrandKeywords(brandName: string): string[] {
  const brand = BRAND_ALIASES.find(
    (item) => item.canonical.toLowerCase() === brandName.toLowerCase()
  );
  if (!brand) return [brandName.toLowerCase()];
  return [brand.canonical.toLowerCase(), ...brand.match.map((v) => v.toLowerCase())];
}

/*
============================================================
LANGUAGE DETECTION
============================================================
*/

function detectLanguage(text: string): string {
  const value = String(text || '').trim();
  if (!value) return 'English';
  if (/[\u3400-\u9fff]/.test(value)) return 'Simplified Chinese';

  const malayWords = [
    'sangat', 'cantik', 'bagus', 'terima', 'kasih', 'kualiti', 'barang',
    'penghantaran', 'cepat', 'lambat', 'sesuai', 'puas', 'harga', 'boleh',
    'kain', 'baju', 'kemas', 'murah', 'berbaloi', 'selesa', 'saiz', 'kecil',
    'besar', 'servis', 'seller', 'penjual', 'sampai', 'parcel', 'bungkusan',
    'yang', 'dan', 'untuk', 'dengan', 'baik',
  ];

  const lower = value.toLowerCase();
  const matches = malayWords.filter((word) =>
    new RegExp(`\\b${word}\\b`, 'i').test(lower)
  ).length;

  return matches >= 1 ? 'Malaysian Malay' : 'English';
}

/*
============================================================
KNOWLEDGE BASE
============================================================
*/

function filterRelevantKnowledge(knowledgeBase: unknown, reviewText: string): string {
  if (!knowledgeBase) return 'No additional knowledge base information provided.';
  const sections = String(knowledgeBase).split('===').map((s) => s.trim()).filter(Boolean);
  if (!sections.length) return String(knowledgeBase);
  return sections.slice(0, 3).join('\n===\n');
}

/*
============================================================
REVIEW TOPICS
============================================================
*/

const REVIEW_TOPICS = {
  quality: ['quality', 'kualiti', 'bagus', 'good', 'great', 'excellent', 'nice', 'berkualiti', 'baik', 'ok'],
  fabric: ['fabric', 'kain', 'material', 'bahan', 'cotton', 'leather', 'kulit'],
  design: ['design', 'rekaan', 'style', 'stylish', 'cantik', 'kemas', 'elegant'],
  fit: ['fit', 'size', 'sizing', 'saiz', 'kecil', 'besar', 'tight', 'loose', 'ketat'],
  service: ['service', 'servis', 'seller', 'penjual', 'staff', 'response'],
  delivery: ['delivery', 'penghantaran', 'shipping', 'ship', 'sampai', 'courier', 'cepat', 'lambat'],
  price: ['price', 'harga', 'murah', 'berbaloi', 'value', 'affordable'],
  packaging: ['packaging', 'pembungkusan', 'package', 'bungkusan', 'kemas'],
  comfort: ['comfort', 'comfortable', 'selesa', 'ringan', 'soft', 'lembut'],
} as const;

type ReviewTopic = keyof typeof REVIEW_TOPICS;

function detectReviewTopics(reviewText: string): ReviewTopic[] {
  const review = String(reviewText || '').toLowerCase();
  const topics: ReviewTopic[] = [];
  for (const [topic, keywords] of Object.entries(REVIEW_TOPICS) as [ReviewTopic, readonly string[]][]) {
    if (keywords.some((kw) => review.includes(kw))) {
      topics.push(topic);
    }
  }
  return topics;
}

function getAddressedTopics(reply: string, detectedTopics: ReviewTopic[]): ReviewTopic[] {
  const response = String(reply || '').toLowerCase();
  return detectedTopics.filter((topic) =>
    REVIEW_TOPICS[topic].some((kw) => response.includes(kw))
  );
}

function validateReviewSpecificity(reply: string, reviewText: string) {
  if (!reviewText?.trim()) return { valid: true, reason: 'No written review.' };
  const topics = detectReviewTopics(reviewText);
  if (!topics.length) return { valid: true, reason: 'No identifiable topics.' };

  const addressed = getAddressedTopics(reply, topics);
  return {
    valid: true,
    reason: `Topics addressed: ${addressed.join(', ') || 'general'}.`,
  };
}

/*
============================================================
NO COMMENT TEMPLATES
============================================================
*/

function getNoCommentTemplate(brandName: string, rating: number): string {
  if (rating >= 4) {
    return `Thank you for choosing ${brandName}! We truly appreciate your support. 😊`;
  }
  if (rating === 3) {
    return `Thank you for choosing ${brandName} and for your feedback. We hope to serve you even better next time. 😊`;
  }
  return `Thank you for choosing ${brandName}. We are sorry your experience did not fully meet expectations. 🙏`;
}

/*
============================================================
CLEANING & VALIDATION
============================================================
*/

function cleanReply(text: unknown): string {
  let cleaned = String(text || '').trim();
  cleaned = cleaned
    .replace(/^```(?:text|plaintext|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  cleaned = cleaned
    .replace(/^(reply|response|customer reply|ai reply|final reply)\s*:\s*/i, '')
    .replace(/^["“”']+/, '')
    .replace(/["“”']+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function containsEmoji(text: string): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);
}

function countEmojis(text: string): number {
  const matches = String(text || '').match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return matches ? matches.length : 0;
}

function isBrandHeader(reply: string, brandName: string): boolean {
  const escaped = String(brandName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\s*[:\\-]\\s*`, 'i').test(reply.trim());
}

function validateReply(reply: unknown, review: any) {
  if (!reply || typeof reply !== 'string') {
    return { valid: false, reason: 'Empty AI response.' };
  }

  let cleaned = cleanReply(reply);
  if (!cleaned) return { valid: false, reason: 'Empty response after cleaning.' };

  if (cleaned.includes('```') || cleaned.includes('**')) {
    return { valid: false, reason: 'Markdown detected.' };
  }

  const brandName = normalizeBrand(review?.brand || review?.storeName);
  if (isBrandHeader(cleaned, brandName)) {
    return { valid: false, reason: 'Brand header detected.' };
  }

  if (!containsEmoji(cleaned)) {
    cleaned += ' 😊';
  }

  if (countEmojis(cleaned) > 2) {
    return { valid: false, reason: 'More than 2 emojis.' };
  }

  if (!/[.!?。！？]$/.test(cleaned)) {
    cleaned += '.';
  }

  if (cleaned.length < 15) {
    return { valid: false, reason: 'Reply is too short.' };
  }

  const specificity = validateReviewSpecificity(cleaned, String(review?.reviewText || ''));

  const keywords = getBrandKeywords(brandName);
  const hasBrand = keywords.some((kw) => cleaned.toLowerCase().includes(kw));

  if (!hasBrand) {
    if (/^thank you\b/i.test(cleaned)) {
      cleaned = cleaned.replace(/^thank you\b/i, `Thank you for choosing ${brandName}`);
    } else if (/^terima kasih\b/i.test(cleaned)) {
      cleaned = cleaned.replace(/^terima kasih\b/i, `Terima kasih kerana memilih ${brandName}`);
    } else {
      cleaned = `Thank you for choosing ${brandName}! ${cleaned}`;
    }
  }

  return {
    valid: true,
    cleanedReply: cleaned,
    reason: specificity.reason,
  };
}

/*
============================================================
BRAND PROFILE LOADER
============================================================
*/

async function loadBrandProfile(review: any, cache: Map<string, any>) {
  const rawBrand = review?.brand || review?.storeName || '';
  if (!rawBrand) return null;

  const cacheKey = String(rawBrand).trim().toUpperCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const normalized = normalizeBrand(rawBrand);
    let brand = await db.brand.findFirst({
      where: { name: { equals: String(rawBrand), mode: 'insensitive' } },
      include: { AIProfile: true },
    });

    if (!brand && normalized !== rawBrand) {
      brand = await db.brand.findFirst({
        where: { name: { equals: normalized, mode: 'insensitive' } },
        include: { AIProfile: true },
      });
    }

    const profile = brand?.AIProfile || null;
    cache.set(cacheKey, profile);
    return profile;
  } catch (error) {
    console.warn('[AI] Unable to load brand AI profile:', getErrorMessage(error));
    cache.set(cacheKey, null);
    return null;
  }
}

/*
============================================================
PROMPT BUILDER (WITH HALLUCINATION DEFENSE)
============================================================
*/

function buildPrompt(
  review: any,
  aiProfile: any,
  options: { isRetry?: boolean; retryReason?: string } = {}
): string {
  const { isRetry = false, retryReason = '' } = options;
  const reviewText = String(review?.reviewText || '').trim();
  const rating = Number(review?.rating) || 5;
  const brandName = normalizeBrand(review?.brand || review?.storeName);
  const language = detectLanguage(reviewText);
  const knowledge = filterRelevantKnowledge(aiProfile?.knowledgeBase || '', reviewText);

  if (!reviewText) {
    return `
You are the official customer service representative for ${brandName}.
The customer left no written comment. Rating: ${rating}/5.
Write a short customer-facing reply mentioning "${brandName}" with exactly 1 natural emoji. No markdown. Return ONLY the reply text. Language: ${language}
`.trim();
  }

  return `
You are the official customer service representative for ${brandName}.
You are replying to a REAL customer review.

CUSTOMER RATING:
${rating}/5

CUSTOMER REVIEW:
"${reviewText}"

CUSTOMER LANGUAGE:
${language}

CRITICAL RULES (ANTI-HALLUCINATION):
- Reply specifically and naturally to what the customer actually wrote.
- STRICTLY DO NOT invent, assume, or introduce specific body measurements (such as weight in kg, height in cm), specific product attributes, unmentioned materials, or fabric thickness unless explicitly stated by the customer in their review.
- Keep the response warm, natural, concise (1-2 sentences), and include 1-2 natural emojis.
- The exact brand name "${brandName}" must appear naturally.
- Return ONLY the final customer-facing reply text with no markdown, headings, or quotation marks.

RELEVANT KNOWLEDGE:
${knowledge}

${isRetry ? `RETRY NOTICE: Previous response failed validation (${retryReason}). Correct the issue and return a valid reply.` : ''}
`.trim();
}

/*
============================================================
AI GENERATION ENGINE
============================================================
*/

async function generateWithAI(review: any, profileCache: Map<string, any>): Promise<string> {
  const reviewText = String(review?.reviewText || '').trim();
  const brandName = normalizeBrand(review?.brand || review?.storeName);

  if (!reviewText) {
    return getNoCommentTemplate(brandName, Number(review?.rating) || 5);
  }

  const aiProfile = await loadBrandProfile(review, profileCache);

  try {
    const prompt = buildPrompt(review, aiProfile);
    const rawReply = await askGroq(prompt);
    const validation = validateReply(rawReply, review);

    if (validation.valid) {
      return validation.cleanedReply;
    }

    const retryPrompt = buildPrompt(review, aiProfile, { isRetry: true, retryReason: validation.reason });
    const retryReply = await askGroq(retryPrompt);
    const retryValidation = validateReply(retryReply, review);

    if (retryValidation.valid) {
      return retryValidation.cleanedReply;
    }

    throw new Error(`AI validation failed: ${retryValidation.reason}`);
  } catch (error) {
    console.warn('[AI Generation fallback triggered]:', getErrorMessage(error));
    return getNoCommentTemplate(brandName, Number(review?.rating) || 5);
  }
}

/*
============================================================
SHOPEE COMMENT ID HELPER
============================================================
*/

function getCommentId(review: any): number | null {
  if (!review) return null;
  const possibleValues = [review.commentId, review.shopeeCommentId, review.comment_id, review.shopee_comment_id];
  for (const value of possibleValues) {
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

/*
============================================================
SHOPEE AUTO POST (WITH DUPLICATE IDEMPOTENCY)
============================================================
*/

async function autoPostReply(review: any, reply: string) {
  const commentId = getCommentId(review);
  if (!commentId) {
    throw new Error('No Shopee comment ID found on this review.');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '[https://ccios-v9-mega-all.vercel.app](https://ccios-v9-mega-all.vercel.app)';
  const endpoint = `${appUrl.replace(/\/$/, '')}/api/shopee/reply-comment`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commentId, comment: reply }),
    cache: 'no-store',
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    throw new Error(`Shopee endpoint failed (${response.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  if (data && typeof data === 'object') {
    const errorString = JSON.stringify(data).toLowerCase();
    if (errorString.includes('duplicate_request') || errorString.includes('already replied')) {
      return { success: true, alreadyReplied: true };
    }

    const errorCode = data.error ?? data.error_code ?? data.code;
    if (errorCode && String(errorCode) !== '0') {
      throw new Error(`Shopee error: ${JSON.stringify(data)}`);
    }
  }

  return data;
}

/*
============================================================
PROCESS ONE REVIEW
============================================================
*/

async function processReview(review: any, profileCache: Map<string, any>) {
  if (review?.status === 'REPLIED') {
    return { success: false, id: review?.id, error: 'Review is already REPLIED.' };
  }

  try {
    const reply = await generateWithAI(review, profileCache);
    const validation = validateReply(reply, review);
    const finalReply = validation.valid ? validation.cleanedReply : getNoCommentTemplate(normalizeBrand(review?.brand), Number(review?.rating) || 5);
    const rating = Number(review?.rating) || 5;

    if (rating >= 4) {
      try {
        const postResult = await autoPostReply(review, finalReply);
        
        await db.review.update({
          where: { id: review.id },
          data: { aiReply: finalReply, status: 'REPLIED', repliedAt: new Date(), repliedBy: 'AI' },
        });

        return {
          success: true,
          id: review.id,
          reply: finalReply,
          status: 'REPLIED',
          posted: true,
          postResult,
        };
      } catch (postError) {
        const errStr = getErrorMessage(postError).toLowerCase();
        
        if (errStr.includes('duplicate_request') || errStr.includes('already replied') || errStr.includes('duplicate')) {
          await db.review.update({
            where: { id: review.id },
            data: { aiReply: finalReply, status: 'REPLIED', repliedAt: new Date(), repliedBy: 'AI_DUPLICATE_SYNC' },
          });
          return { success: true, id: review.id, status: 'REPLIED', alreadyReplied: true, reply: finalReply };
        }

        await db.review.update({
          where: { id: review.id },
          data: { aiReply: finalReply, status: 'GENERATED' },
        });

        return { success: true, id: review.id, reply: finalReply, status: 'GENERATED', posted: false, postError: getErrorMessage(postError) };
      }
    }

    await db.review.update({
      where: { id: review.id },
      data: { aiReply: finalReply, status: 'GENERATED' },
    });

    return { success: true, id: review.id, reply: finalReply, status: 'GENERATED', posted: false };
  } catch (error) {
    return { success: false, id: review?.id, error: getErrorMessage(error) };
  }
}

/*
============================================================
BATCH PROCESSOR
============================================================
*/

async function processInBatches(candidates: any[], profileCache: Map<string, any>) {
  const results: any[] = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((review) => processReview(review, profileCache))
    );
    results.push(...batchResults);
  }
  return results;
}

/*
============================================================
POST HANDLER (API ROUTE)
============================================================
*/

export async function POST(req: Request) {
  if (BULK_JOB_STATE.running) {
    return NextResponse.json(
      { success: false, error: 'AI generation already running', code: 'BULK_JOB_ALREADY_RUNNING' },
      { status: 409 }
    );
  }

  BULK_JOB_STATE.running = true;
  BULK_JOB_STATE.startedAt = Date.now();

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const ids = Array.isArray(body.ids) ? body.ids : [];
    const requestedLimit = Number(body.limit) > 0 ? Number(body.limit) : null;
    const hasExplicitIds = ids.length > 0;
    const selectedBrand = body.brand ?? body.brandName ?? null;
    const isAllBrands = !selectedBrand || String(selectedBrand).trim().toUpperCase() === 'ALL';

    const baseDateFilter = {
      createdAt: { gte: START_2026, lt: START_2027 },
    };

    let candidates: any[] = [];

    if (hasExplicitIds) {
      const uniqueIds = [...new Set(ids.filter((id: unknown) => typeof id === 'string' && id.trim() !== ''))];
      if (!uniqueIds.length) {
        return NextResponse.json({ success: true, generated: 0, autoPosted: 0, manualApproval: 0, failed: 0, total: 0, errors: [] });
      }

      candidates = await db.review.findMany({
        where: {
          id: { in: uniqueIds },
          status: { notIn: ['REPLIED', 'GENERATED'] },
          ...baseDateFilter,
        },
        take: requestedLimit ?? uniqueIds.length,
      });
    } else {
      const whereClause: any = {
        status: { notIn: ['GENERATED', 'REPLIED'] },
        ...baseDateFilter,
      };

      if (!isAllBrands) {
        whereClause.OR = [
          { brand: { contains: String(selectedBrand), mode: 'insensitive' } },
          { storeName: { contains: String(selectedBrand), mode: 'insensitive' } },
        ];
      }

      candidates = await db.review.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        ...(requestedLimit ? { take: requestedLimit } : {}),
      });
    }

    if (!candidates.length) {
      return NextResponse.json({ success: true, generated: 0, autoPosted: 0, manualApproval: 0, failed: 0, total: 0, errors: [] });
    }

    const profileCache = new Map<string, any>();
    const results = await processInBatches(candidates, profileCache);

    const successful = results.filter((r) => r.success === true);
    const failed = results.filter((r) => r.success !== true);
    const autoPosted = successful.filter((r) => r.status === 'REPLIED' && r.posted === true);
    const manualApproval = successful.filter((r) => r.status === 'GENERATED');
    const errors = failed.map((r) => ({ id: r.id, error: r.error }));

    return NextResponse.json({
      success: true,
      generated: successful.length,
      autoPosted: autoPosted.length,
      manualApproval: manualApproval.length,
      failed: failed.length,
      total: candidates.length,
      errors,
    });
  } catch (error) {
    console.error('[Bulk AI] FATAL ERROR:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  } finally {
    BULK_JOB_STATE.running = false;
    BULK_JOB_STATE.startedAt = 0;
  }
}