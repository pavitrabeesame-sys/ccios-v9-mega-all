import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
============================================================
CCIOS — MASTER REVIEW AI GENERATION ENGINE
============================================================
*/

const GEMINI_QUOTA_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 3;

/* ============================================================
   GLOBAL GEMINI QUOTA STATE
   ============================================================ */

const GLOBAL_STATE = globalThis.__CCIOS_GEMINI_STATE__ || {
  quotaUntil: 0,
};

globalThis.__CCIOS_GEMINI_STATE__ = GLOBAL_STATE;

function isGeminiQuotaBlocked() {
  return Date.now() < GLOBAL_STATE.quotaUntil;
}

function blockGeminiQuota() {
  GLOBAL_STATE.quotaUntil = Date.now() + GEMINI_QUOTA_COOLDOWN_MS;
  console.warn('[AI] Gemini quota blocked for 24 hours.');
}

/* ============================================================
   HELPERS
   ============================================================ */

function getErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
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
    text.includes('quota') ||
    text.includes('resource_exhausted')
  );
}

/* ============================================================
   BRAND NORMALIZATION
   ============================================================ */

function normalizeBrand(rawBrand) {
  const value = String(rawBrand || '').trim();
  const aliases = {
    RAV: 'RAV Design',
    'RAV DESIGN': 'RAV Design',
    NICOLE: 'Nicole Collection',
    'NICOLE COLLECTION': 'Nicole Collection',
    'HUSH PUPPIES': 'Hush Puppies Accessories',
    'HUSH PUPPIES ACCESSORIES': 'Hush Puppies Accessories',
    OBERMAIN: 'Obermain',
    'OBERMAIN ACCESSORIES OFFICIAL STORE': 'Obermain',
    'JOHN LANGFORD': 'JOHN LANGFORD OF LONDON',
    'JOHN LANGFORD OF LONDON': 'JOHN LANGFORD OF LONDON',
  };
  return aliases[value.toUpperCase()] || value || 'Our Store';
}

/* ============================================================
   DEFAULT BRAND VOICES
   ============================================================ */

function getDefaultBrandVoice(brandName) {
  const voices = {
    'RAV Design': 'Premium, rugged, sophisticated and adventurous. Focus on craftsmanship, durability, quality and timeless design.',
    'Nicole Collection': 'Elegant, feminine, modern and refined. Focus on flattering design, sophistication, effortless style and quality.',
    'Hush Puppies Accessories': 'Friendly, trustworthy and professional. Focus on comfort, quality, practicality and thoughtful everyday design.',
    Obermain: 'Premium, refined and practical. Focus on craftsmanship, quality, sophisticated design and everyday functionality.',
    'JOHN LANGFORD OF LONDON': 'Classic, formal and sophisticated. Focus on timeless style, craftsmanship, refinement and distinguished quality.',
  };
  return voices[brandName] || 'Professional, warm, natural and customer-focused.';
}

/* ============================================================
   LANGUAGE
   ============================================================ */

function detectLanguage(text) {
  const value = String(text || '');
  if (/[\u4e00-\u9fff]/.test(value)) return 'Simplified Chinese';

  const malayWords = [
    'sangat', 'cantik', 'bagus', 'terima kasih', 'kualiti', 'barang',
    'penghantaran', 'cepat', 'lambat', 'sesuai', 'puas', 'harga', 'boleh'
  ];
  const lower = value.toLowerCase();
  const matches = malayWords.filter((word) => lower.includes(word)).length;
  
  if (matches >= 1) return 'Malaysian Malay';
  return 'English';
}

/* ============================================================
   KNOWLEDGE BASE
   ============================================================ */

function filterRelevantKnowledge(knowledgeBase, reviewText) {
  if (!knowledgeBase) return 'No additional knowledge base information provided.';
  const text = String(reviewText || '').toLowerCase();
  const sections = String(knowledgeBase).split('===').map((s) => s.trim()).filter(Boolean);

  if (!sections.length) return String(knowledgeBase);

  const keywords = [];
  if (text.includes('warranty') || text.includes('guarantee') || text.includes('repair')) keywords.push('warranty', 'guarantee', 'repair');
  if (text.includes('size') || text.includes('small') || text.includes('tight') || text.includes('big') || text.includes('large') || text.includes('fit')) keywords.push('size', 'fitting', 'fit');
  if (text.includes('return') || text.includes('refund') || text.includes('broken') || text.includes('damaged')) keywords.push('return', 'refund', 'damage');
  if (text.includes('ship') || text.includes('shipping') || text.includes('delivery') || text.includes('late') || text.includes('slow')) keywords.push('shipping', 'delivery', 'sla');

  if (!keywords.length) return sections.slice(0, 5).join('\n===\n');

  const matched = sections.filter((section) => {
    const lowerSection = section.toLowerCase();
    return keywords.some((keyword) => lowerSection.includes(keyword));
  });

  return matched.length ? matched.join('\n===\n') : sections.slice(0, 5).join('\n===\n');
}

/* ============================================================
   NO COMMENT TEMPLATE
   ============================================================ */

function getNoCommentTemplate(brandName, rating) {
  if (rating >= 5) return `Thank you for choosing ${brandName} and for your 5-star rating! We truly appreciate your support. 😊`;
  if (rating === 4) return `Thank you for choosing ${brandName} and for your 4-star rating! We really appreciate your support. 😊`;
  if (rating === 3) return `Thank you for choosing ${brandName} and for your feedback. We appreciate your support and hope to serve you even better next time. 😊`;
  return `Thank you for choosing ${brandName}. We are sorry your experience did not fully meet expectations and we are here to help. 🙏`;
}

/* ============================================================
   STOP WORDS & REVIEW TERMS
   ============================================================ */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'very', 'good', 'great', 'nice', 'item', 'product', 'really', 'was', 'are', 'is', 'it', 'to', 'of', 'a', 'an', 'in', 'on', 'my', 'i', 'we', 'you', 'your', 'our', 'so', 'as', 'at', 'from', 'be', 'have', 'had', 'has', 'easy', 'quality'
]);

function extractReviewTerms(reviewText) {
  const normalized = String(reviewText || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return normalized.split(/\s+/).map((w) => w.trim()).filter(Boolean).filter((w) => w.length >= 4).filter((w) => !STOP_WORDS.has(w)).slice(0, 12);
}

function isGenericRatingOnlyReply(reply, reviewText) {
  if (!reviewText || !String(reviewText).trim()) return false;
  const normalized = String(reply || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const genericPatterns = [
    'thank you for your 5 star review', 'thank you for your 5 star rating', 'thank you for your 5-star review', 'thank you for your 5-star rating', 'thank you for your five star review', 'thank you for your five star rating', 'thank you for your rating', 'thank you for the rating', 'thank you for the 5 star review'
  ];
  const compact = normalized.replace(/\s+/g, '');
  for (const pattern of genericPatterns) {
    const patternCompact = pattern.replace(/[^\p{L}\p{N}]/gu, '').replace(/\s+/g, '');
    if (compact.includes(patternCompact) && normalized.split(/\s+/).length <= 15) return true;
  }
  return false;
}

function validateReviewSpecificity(reply, reviewText) {
  if (!reviewText || !String(reviewText).trim()) {
    return {
      valid: true,
      reason: 'No written review; specificity check not required.',
    };
  }

  if (isGenericRatingOnlyReply(reply, reviewText)) {
    return {
      valid: false,
      reason: 'Generic rating-only response detected for a written review.',
    };
  }

  // Do not require exact keyword matching.
  // AI may naturally use synonyms while still addressing the review.
  return {
    valid: true,
    reason: 'Written review addressed by AI response.',
  };
}

/* ============================================================
   CLEAN & FORMAT
   ============================================================ */

function cleanReply(text) {
  let cleaned = String(text || '').trim();
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  cleaned = cleaned.replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim();
  cleaned = cleaned.replace(/^(reply|response|customer reply|ai reply)\s*:\s*/i, '');
  return cleaned.trim();
}

function containsEmoji(text) {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);
}

function countEmojis(text) {
  const matches = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
  return matches ? matches.length : 0;
}

function ensureBrandMention(reply, brandName) {
  let cleaned = String(reply || '').trim();
  if (!cleaned || !brandName) return cleaned;
  
  if (cleaned.toLowerCase().includes(brandName.toLowerCase())) return cleaned;
  if (/^thank you\b/i.test(cleaned)) {
    return cleaned.replace(/^thank you\b/i, `Thank you for choosing ${brandName}`);
  }
  return `Thank you for choosing ${brandName}! ${cleaned}`;
}

/* ============================================================
   VALIDATION GATE (DYNAMIC LENGTH FIX)
   ============================================================ */

function validateReply(reply, review) {
  if (!reply || typeof reply !== 'string') return { valid: false, reason: 'Empty AI response.' };
  
  let cleaned = cleanReply(reply);
  if (!cleaned) return { valid: false, reason: 'Empty response after cleaning.' };
  if (cleaned.includes('```') || cleaned.includes('**') || cleaned.includes('__')) return { valid: false, reason: 'Markdown detected.' };

  const brandName = normalizeBrand(review?.brand || review?.storeName);
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const brandHeaderRegex = new RegExp('^' + escapedBrand + '\\s*[:\\-]\\s*', 'i');
  
  if (brandHeaderRegex.test(cleaned)) return { valid: false, reason: 'Brand header detected.' };

  const brandName = normalizeBrand(review?.brand || review?.storeName);

  if (!containsEmoji(cleaned)) cleaned = `${cleaned} 😊`;
  if (countEmojis(cleaned) > 2) return { valid: false, reason: 'Reply contains more than 2 emojis.' };

  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u;
  const emojiMatch = cleaned.match(emojiRegex);
  if (emojiMatch) {
    const emoji = emojiMatch[0];
    const textWithoutEmoji = cleaned.slice(0, -emoji.length).trimEnd();
    if (!/[.!?。！？]$/.test(textWithoutEmoji)) cleaned = `${textWithoutEmoji}.${emoji}`;
  } else if (!/[.!?。！？]$/.test(cleaned)) {
    cleaned += '.';
  }

  // DYNAMIC LENGTH CHECK
  if (cleaned.length < 20) {
    return { valid: false, reason: 'Reply is too short (under 20 characters).' };
  }
  
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const reviewWords = String(review?.reviewText || "").trim().split(/\s+/).filter(Boolean);
  
  if (reviewWords.length >= 8 && wordCount < 8) {
    return { valid: false, reason: "Reply is too short for the customer's detailed review." };
  }

  const words = cleaned.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1];
  const forbiddenEndings = new Set(['to', 'for', 'that', 'we', 'our', 'your', 'the', 'and', 'because', 'if', 'when', 'hear', 'appreciate', 'delighted', 'glad', 'is', 'are', 'of', 'with']);

  if (forbiddenEndings.has(lastWord)) return { valid: false, reason: `Response appears incomplete; ends with "${lastWord}".` };

  const specificity = validateReviewSpecificity(cleaned, review?.reviewText);
  if (!specificity.valid) return { valid: false, reason: specificity.reason };

  if (
  !cleaned
    .toLowerCase()
    .includes(brandName.toLowerCase())
) {
  return {
    valid: false,
    reason:
      `Reply must mention the brand "${brandName}".`,
  };
}

  return { valid: true, cleanedReply: cleaned, reason: specificity.reason };
}

/* ============================================================
   BRAND PROFILE CACHE
   ============================================================ */

async function loadBrandProfile(review, cache) {
  const rawBrand = review?.brand || review?.storeName || '';
  if (!rawBrand) return null;
  const cacheKey = String(rawBrand).trim().toUpperCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const brand = await db.brand.findFirst({
      where: { name: { equals: rawBrand, mode: 'insensitive' } },
      include: { AIProfile: true },
    });
    const profile = brand?.AIProfile || null;
    cache.set(cacheKey, profile);
    return profile;
  } catch (error) {
    console.warn('[AI] Unable to load brand AI profile:', getErrorMessage(error));
    cache.set(cacheKey, null);
    return null;
  }
}

/* ============================================================
   PROMPT BUILDER
   ============================================================ */

function buildPrompt(review, aiProfile, isRetry = false) {
  const reviewText = String(review?.reviewText || '').trim();
  const rating = Number(review?.rating) || 5;
  const brandName = normalizeBrand(review?.brand || review?.storeName);
  const language = detectLanguage(reviewText);
  const tone = aiProfile?.tone || 'Warm, professional and natural';
  const personality = aiProfile?.personality || 'Helpful, genuine ecommerce customer service representative.';
  const replyStyle = aiProfile?.replyStyle || 'Natural, concise, personalized and customer-focused.';
  const brandRules = aiProfile?.brandRules || 'Be polite, sincere, specific and helpful.';
  const forbiddenWords = Array.isArray(aiProfile?.forbiddenWords) ? aiProfile.forbiddenWords.join(', ') : String(aiProfile?.forbiddenWords || 'None');
  const knowledge = filterRelevantKnowledge(aiProfile?.knowledgeBase || '', reviewText);

  if (!reviewText) {
    return `
You are the official customer service representative for ${brandName}.
The customer left NO written comment.
Customer rating: ${rating}/5
Return ONLY a short natural customer-facing reply.

RULES:
- MUST mention the brand name "${brandName}" naturally.
- MUST include 1-2 natural emojis.
- Do not invent product details.
- No markdown, store-name headers, or quotes.
- Complete sentences only.
- Reply in ${language}.
`.trim();
  }

  return `
You are the official customer service representative for ${brandName}.
THIS IS A WRITTEN CUSTOMER REVIEW.
You MUST respond to the customer's actual words.

============================================================
CUSTOMER REVIEW
============================================================
Rating: ${rating}/5
Customer Review: "${reviewText}"
Language: ${language}

============================================================
BRAND VOICE & RULES
============================================================
Default Brand Voice: ${getDefaultBrandVoice(brandName)}
Configured Tone: ${tone}
Configured Personality: ${personality}
Configured Reply Style: ${replyStyle}
Configured Brand Rules: ${brandRules}
Forbidden Words: ${forbiddenWords}

============================================================
RELEVANT KNOWLEDGE
============================================================
${knowledge}

============================================================
MANDATORY RULES
============================================================
1. Return ONLY the final customer-facing reply.
2. Address the actual written review gracefully.
3. NEVER return a generic rating-only response.
4. MUST mention the brand name "${brandName}" naturally in the sentence.
5. Do NOT begin with "${brandName}:" or use it as a header.
6. Address at least one meaningful detail (quality, material, fit, delivery, concern).
7. Do not invent facts, warranty promises, or discounts.
8. MUST include 1-2 natural emojis.
9. No hashtags, bullet points, or markdown.
10. Keep the reply SHORT (1-2 sentences).
11. Every sentence must be complete and natural.

${isRetry ? `\nWARNING: Your previous response was rejected. Ensure it is a complete, well-formed sentence ending with proper punctuation without stopping abruptly.` : ''}
`.trim();
}

/* ============================================================
   AI PROVIDERS
   ============================================================ */

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') throw new Error('Gemini API key is not configured.');

const url =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  model +
  ':generateContent?key=' +
  encodeURIComponent(apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'You write short, natural ecommerce customer review replies. Address specific details. Never use markdown, headers, or generic filler. Always write complete sentences.' }],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 200 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

async function askGroqSafe(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') throw new Error('Groq API key is not configured.');
  const reply = await askGroq(prompt, { skipGemini: true });
  if (!reply || !String(reply).trim()) throw new Error('Groq returned an empty response.');
  return String(reply).trim();
}

/* ============================================================
   GENERATION ENGINE
   ============================================================ */

async function generateReviewReply(review, aiState, profileCache) {
  const reviewText = String(review?.reviewText || '').trim();
  if (!reviewText) {
    return getNoCommentTemplate(normalizeBrand(review?.brand || review?.storeName), Number(review?.rating) || 5);
  }

  const aiProfile = await loadBrandProfile(review, profileCache);

  /* ==========================================================
     GEMINI FIRST & RETRY
     ========================================================== */

  if (!aiState.geminiQuotaExhausted && !isGeminiQuotaBlocked()) {
    try {
      console.log('[AI] Trying Gemini');
      const prompt = buildPrompt(review, aiProfile, false);
      const rawReply = await askGemini(prompt);

      console.log('[AI] SUCCESS: Gemini');

      let validation = validateReply(rawReply, review);

      if (validation.valid) {
        console.log('[AI] GEMINI VALIDATED:', validation.cleanedReply);
        return validation.cleanedReply;
      }

      console.warn('[AI] Gemini validation failed:', validation.reason);

      /*
       * GEMINI RETRY
       * Do not immediately fall back to Groq.
       * Give Gemini one opportunity to correct the response.
       */
      console.log('[AI] Retrying Gemini with corrected instructions');

      const retryPrompt = buildPrompt(review, aiProfile, true);
      const retryReply = await askGemini(retryPrompt);

      console.log('[AI] Gemini retry succeeded');

      validation = validateReply(retryReply, review);

      if (validation.valid) {
        console.log('[AI] GEMINI RETRY VALIDATED:', validation.cleanedReply);
        return validation.cleanedReply;
      }

      console.warn('[AI] Gemini retry validation failed:', validation.reason);

    } catch (error) {
      console.warn('[AI] Gemini failed:', getErrorMessage(error));

      if (isRateLimitError(error)) {
        aiState.geminiQuotaExhausted = true;
        blockGeminiQuota();
      }
    }
  } else {
    console.log('[AI] Gemini skipped — quota cooldown active');
  }

  /* ==========================================================
     GROQ FALLBACK
     ========================================================== */

  try {
    console.log('[AI] Trying Groq fallback');
    const prompt = buildPrompt(review, aiProfile, true);
    const rawReply = await askGroqSafe(prompt);
    console.log('[AI] SUCCESS: Groq');

    const validation = validateReply(rawReply, review);
    if (validation.valid) {
      console.log('[AI] GROQ VALIDATED:', validation.cleanedReply);
      return validation.cleanedReply;
    }
    throw new Error(`Groq validation failed: ${validation.reason}`);
  } catch (error) {
    console.warn('[AI] Groq failed:', getErrorMessage(error));
    throw error;
  }
}

async function processReview(review, aiState, profileCache) {
  console.log(`[Bulk AI] Processing review ${review?.id}`);
  if (review?.status === 'REPLIED') return { success: false, id: review?.id, error: 'Review is already REPLIED.' };

  try {
    const reply = await generateReviewReply(review, aiState, profileCache);
    const finalValidation = validateReply(reply, review);
    if (!finalValidation.valid) throw new Error(`Final validation failed: ${finalValidation.reason}`);

    await db.review.update({
      where: { id: review.id },
      data: { aiReply: finalValidation.cleanedReply, status: 'GENERATED' },
    });
    console.log('[Bulk AI] DATABASE SAVED:', review.id);
    return { success: true, id: review.id, reply: finalValidation.cleanedReply };
  } catch (error) {
    console.warn(`[Bulk AI] FAILED ${review?.id}:`, getErrorMessage(error));
    return { success: false, id: review?.id, error: getErrorMessage(error) };
  }
}

async function processInBatches(candidates, aiState, profileCache) {
  const results = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    console.log(`[Bulk AI] Batch ${Math.floor(i / CONCURRENCY) + 1} — ${batch.length} reviews`);
    const batchResults = await Promise.all(batch.map((review) => processReview(review, aiState, profileCache)));
    results.push(...batchResults);
  }
  return results;
}

/* ============================================================
   POST HANDLER
   ============================================================ */

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch {}

    const ids = Array.isArray(body.ids) ? body.ids : [];
    const requestedLimit = Number(body.limit) || null;
    const hasExplicitIds = ids.length > 0;

    console.log('================================================');
    console.log('[Bulk AI] START');
    const aiState = { geminiQuotaExhausted: isGeminiQuotaBlocked() };

    let candidates = [];
    if (hasExplicitIds) {
      const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))];
      if (!uniqueIds.length) return NextResponse.json({ success: true, generated: 0, failed: 0, total: 0, errors: [] });

      candidates = await db.review.findMany({
        where: { id: { in: uniqueIds }, status: { not: 'REPLIED' } },
        take: requestedLimit || uniqueIds.length,
      });
    } else {
      candidates = await db.review.findMany({
        where: { status: { notIn: ['GENERATED', 'REPLIED'] } },
        orderBy: { createdAt: 'desc' },
        ...(requestedLimit ? { take: requestedLimit } : {}),
      });
    }

    if (!candidates.length) return NextResponse.json({ success: true, generated: 0, failed: 0, total: 0, errors: [] });

    const profileCache = new Map();
    const results = await processInBatches(candidates, aiState, profileCache);

    const generatedCount = results.filter((r) => r.success).length;
    const failedResults = results.filter((r) => !r.success);
    const errors = failedResults.map((r) => ({ id: r.id, error: r.error }));

    console.log('[Bulk AI] COMPLETE');
    console.log('[Bulk AI] Generated:', generatedCount);
    console.log('[Bulk AI] Failed:', failedResults.length);
    console.log('================================================');

    return NextResponse.json({
      success: true,
      generated: generatedCount,
      failed: failedResults.length,
      total: candidates.length,
      errors,
      geminiQuotaExhausted: aiState.geminiQuotaExhausted,
    });
  } catch (error) {
    console.error('[Bulk AI] FATAL ERROR:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}