import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
============================================================
CCIOS REVIEW AI GENERATOR
Single-review generation with Straight-Through Processing
============================================================
*/

const MAX_ATTEMPTS = 2;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function isRateLimit(error) {
  const text = getErrorMessage(error).toLowerCase();
  return (
    text.includes('429') || text.includes('quota') || text.includes('rate limit') ||
    text.includes('rate_limit') || text.includes('resource_exhausted') ||
    text.includes('tokens per day') || text.includes('tpd')
  );
}

/*
============================================================
BRAND REGISTRY & ALIAS NORMALIZATION (ALL 6 BRANDS)
============================================================
*/

const BRAND_ALIASES = [
  {
    canonical: 'RAV Design',
    match: ['RAV', 'RAV DESIGN'],
    voice: 'Premium, masculine, rugged yet sophisticated. Natural, confident and refined.'
  },
  {
    canonical: 'Nicole Collection',
    match: ['NICOLE', 'NICOLE COLLECTION'],
    voice: 'Elegant, feminine, modern and refined. Warm, graceful and natural.'
  },
  {
    canonical: 'Hush Puppies Accessories',
    match: ['HUSH PUPPIES', 'HUSH PUPPIES ACCESSORIES', 'HUSH'],
    voice: 'Friendly, warm, trustworthy and professional. Comfortable and approachable.'
  },
  {
    canonical: 'Obermain',
    match: ['OBERMAIN', 'OBERMAIN ACCESSORIES'],
    voice: 'Premium, refined and practical. Sophisticated but still warm and natural.'
  },
  {
    canonical: 'Beverly Hills Polo Club',
    match: ['BHPC', 'BEVERLY HILLS', 'BEVERLY HILLS POLO CLUB'],
    voice: 'Classic, sporty, prestigious and casual luxury. Focus on heritage, comfort, timeless appeal and premium quality.'
  },
  {
    canonical: 'JOHN LANGFORD OF LONDON',
    match: ['JOHN LANGFORD', 'JOHN LANGFORD OF LONDON', 'LANGFORD'],
    voice: 'Classic, formal, sophisticated and timeless. Polished but warm.'
  }
];

function normalizeBrand(rawBrand) {
  if (!rawBrand) return 'Our Store';
  
  const cleaned = String(rawBrand)
    .replace(/\(.*?\)/g, '')
    .replace(/official\s*store/gi, '')
    .replace(/boutique/gi, '')
    .replace(/accessories/gi, '')
    .trim()
    .toUpperCase();

  for (const item of BRAND_ALIASES) {
    if (item.match.some(m => cleaned.includes(m) || m.includes(cleaned))) {
      return item.canonical;
    }
  }

  return String(rawBrand).replace(/\(.*?\)/g, '').trim() || 'Our Store';
}

function getBrandVoice(brandName) {
  const brand = BRAND_ALIASES.find(b => b.canonical.toLowerCase() === String(brandName).toLowerCase());
  return brand?.voice || 'Warm, professional, genuine and customer-focused.';
}

function getBrandKeywords(brandName) {
  const brand = BRAND_ALIASES.find(b => b.canonical.toLowerCase() === String(brandName).toLowerCase());
  if (!brand) return [String(brandName).toLowerCase()];
  return [brand.canonical.toLowerCase(), ...brand.match.map(m => m.toLowerCase())];
}

/*
============================================================
LANGUAGE
============================================================
*/

function detectLanguage(text) {
  const value = String(text || '').trim();
  if (!value) return 'English';
  if (/[\u3400-\u9fff]/.test(value)) return 'Simplified Chinese';

  const malayWords = ['sangat', 'bagus', 'cantik', 'terima', 'kasih', 'kualiti', 'barang', 'produk', 'sampai', 'cepat', 'penghantaran', 'puas', 'hati', 'sesuai', 'selesa', 'harga', 'berbaloi', 'kemas', 'seller', 'penjual'];
  const lower = value.toLowerCase();
  const matches = malayWords.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(lower)).length;

  if (matches >= 1) return 'Malaysian Malay';
  return 'English';
}

/*
============================================================
PROMPT BUILDER
============================================================
*/

function buildPrompt(review, attempt = 1) {
  const reviewText = String(review.reviewText || '').trim();
  const rating = Number(review.rating) || 5;
  const brandName = normalizeBrand(review.brand || review.storeName);
  const brandVoice = getBrandVoice(brandName);
  const language = detectLanguage(reviewText);

  let languageRule = 'Reply naturally in English.';
  if (language === 'Simplified Chinese') languageRule = 'Reply naturally in Simplified Chinese.';
  if (language === 'Malaysian Malay') languageRule = 'Reply naturally in Malaysian Malay. Do not translate English word-for-word. Do not use incomplete phrases like "atas u".';

  return `
You are the official Shopee customer-service representative for ${brandName}.

BRAND VOICE:
${brandVoice}

CUSTOMER RATING:
${rating}/5

CUSTOMER REVIEW:
"${reviewText}"

LANGUAGE:
${languageRule}

YOUR JOB:
Write a natural seller reply specifically for this customer review.

VERY IMPORTANT:
- Read the actual review carefully and reply to what the customer actually said.
- Do not use a generic reply when the customer mentioned something specific.
- Never invent information, warranty, or delivery promises.

BRAND MENTION — REQUIRED:
- You MUST naturally mention the brand name "${brandName}" in the reply.
- Do NOT put the brand as a heading. Do NOT write "${brandName}:" at the beginning.

STYLE:
- Warm, natural, professional, personal.
- Short and concise (Normally 1-2 short sentences).
- Thank the customer naturally.

EMOJI:
- MUST include 1-2 natural emojis.

DO NOT USE:
- hashtags, markdown, bullet points, headings, "Reply:", "AI Generated:"
- overly formal corporate language

OUTPUT:
Return ONLY the final customer-facing reply.

Attempt ${attempt}.
${attempt > 1 ? `
The previous response was rejected. Rewrite the reply.
Make sure the brand name "${brandName}" is included naturally, it addresses the actual customer review, contains 1-2 emojis, and has proper punctuation.
Return ONLY the corrected customer reply.` : ''}
`.trim();
}

/*
============================================================
GEMINI
============================================================
*/

async function askGemini(prompt) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim().replace(/['"]/g, '');
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim().replace(/['"]/g, '');

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') throw new Error('Gemini API key is not configured.');

  const baseUrl = 'https://' + 'generativelanguage.googleapis.com' + '/v1beta/models/';
  const url = baseUrl + model + ':generateContent?key=' + encodeURIComponent(apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'You write natural, complete Shopee customer-service replies. Return only the final reply. Never return analysis, headings, markdown or emojis as headers.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.45, topP: 0.9, maxOutputTokens: 250 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini ${response.status}: ${error}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim();

  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

/*
============================================================
GROQ
============================================================
*/

async function askGroqSafe(prompt) {
  const apiKey = String(process.env.GROQ_API_KEY || '').trim().replace(/['"]/g, '');
  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') throw new Error('Groq API key is not configured.');

  const reply = await askGroq(prompt, { skipGemini: true });
  if (!reply || !String(reply).trim()) throw new Error('Groq returned an empty response.');
  return String(reply).trim();
}

/*
============================================================
CLEAN RESPONSE & VALIDATION
============================================================
*/

function cleanReply(text) {
  if (!text || typeof text !== 'string') return '';
  let reply = text.trim();
  reply = reply.replace(/^```[a-zA-Z]*\s*/i, '').replace(/\s*```$/i, '').trim();
  reply = reply.replace(/^(reply|response|answer|ai reply)\s*:\s*/i, '').trim();
  reply = reply.replace(/^["“”']+/, '').replace(/["“”']+$/, '').trim();
  reply = reply.replace(/\s+/g, ' ').trim();
  return reply;
}

function validateReply(text, reviewText, brandName) {
  let reply = cleanReply(text);
  if (!reply) return { valid: false, reason: 'Empty reply.' };

  if (/```/.test(reply) || /^\s*[-•]\s+/m.test(reply)) return { valid: false, reason: 'Markdown detected.' };

  if (!/[.!?。！？]$/.test(reply) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]$/u.test(reply)) {
    reply += '.';
  }

  if (reply.length < 20) return { valid: false, reason: 'Reply is too short.' };

  const reviewWords = String(reviewText || '').trim().split(/\s+/).filter(Boolean);
  if (reviewWords.length >= 8 && reply.split(/\s+/).length < 8) {
    return { valid: false, reason: "Reply is too short for the customer's detailed review." };
  }

  // Smart Brand Check & Auto-Fix
  const allowedBrandNames = getBrandKeywords(brandName);
  const replyLower = reply.toLowerCase();
  const hasBrandMatch = allowedBrandNames.some(keyword => replyLower.includes(keyword));

  if (!hasBrandMatch) {
    if (/^thank you\b/i.test(reply)) {
      reply = reply.replace(/^thank you\b/i, `Thank you for choosing ${brandName}`);
    } else if (/^terima kasih\b/i.test(reply)) {
      reply = reply.replace(/^terima kasih\b/i, `Terima kasih kerana memilih ${brandName}`);
    } else {
      reply = `Thank you for choosing ${brandName}! ${reply}`;
    }
  }

  return { valid: true, reply };
}

/*
============================================================
NO COMMENT TEMPLATE
============================================================
*/

function noCommentReply(rating, brandName) {
  if (rating >= 5) return `Thank you so much for your 5-star rating and for choosing ${brandName}. We really appreciate your support and hope you continue to enjoy your purchase. 😊`;
  if (rating === 4) return `Thank you for your 4-star rating and for choosing ${brandName}. We appreciate your support and are glad to know you had a positive experience. 😊`;
  if (rating === 3) return `Thank you for taking the time to leave us a rating, and for choosing ${brandName}. We appreciate your feedback and will continue working to provide an even better experience.`;
  if (rating === 2) return `Thank you for sharing your rating with us. We are sorry that your experience with ${brandName} did not fully meet expectations and appreciate the opportunity to improve.`;
  return `Thank you for your feedback. We are sorry that your experience with ${brandName} did not meet expectations and appreciate the opportunity to serve you better.`;
}

/*
============================================================
POST HANDLER
============================================================
*/

export async function POST(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    const reviewId = body.reviewId;
    let review = null;

    if (reviewId) {
      review = await db.review.findUnique({ where: { id: reviewId } });
    }

    if (!review) {
      review = {
        id: reviewId || null,
        reviewText: body.reviewText || '',
        rating: body.rating || 5,
        brand: body.brand || body.brandName || body.storeName || '',
        storeName: body.storeName || '',
      };
    }

    if (!review) return NextResponse.json({ success: false, error: 'Review not found.' }, { status: 404 });

    const reviewText = String(review.reviewText || '').trim();
    const rating = Number(review.rating) || 5;
    const brandName = normalizeBrand(review.brand || review.storeName || '');

    /*
    ----------------------------------------------------------
    NO COMMENT HANDLING
    ----------------------------------------------------------
    */
    if (!reviewText) {
      const reply = noCommentReply(rating, brandName);

      if (review.id) {
        // STRAIGHT-THROUGH PROCESSING (AUTO-POST 4/5 STARS FOR BLANK REVIEWS)
        if (rating >= 4) {
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || '[https://ccios-v9-mega-all.vercel.app](https://ccios-v9-mega-all.vercel.app)';
            const postResponse = await fetch(`${appUrl}/api/shopee/reply-comment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reviewId: review.id, reply: reply })
            });

            if (postResponse.ok) {
              await db.review.update({ where: { id: review.id }, data: { aiReply: reply, status: 'REPLIED' } });
              return NextResponse.json({ success: true, generatedReply: reply, brand: brandName, provider: 'template', status: 'REPLIED' });
            }
          } catch (e) {
            console.warn(`[AI Single] Auto-post failed for ${review.id}, saving as GENERATED.`);
          }
        }

        // Default / Fallback save
        await db.review.update({ where: { id: review.id }, data: { aiReply: reply, status: 'GENERATED' } });
      }

      return NextResponse.json({ success: true, generatedReply: reply, brand: brandName, provider: 'template', status: 'GENERATED' });
    }

    /*
    ----------------------------------------------------------
    AI GENERATION
    ----------------------------------------------------------
    */
    let geminiQuotaExhausted = false;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const prompt = buildPrompt(review, attempt);
      let rawReply = null;

      if (!geminiQuotaExhausted) {
        try {
          console.log(`[AI Single] Trying Gemini, attempt ${attempt}`);
          rawReply = await askGemini(prompt);
          console.log('[AI Single] SUCCESS: Gemini');
        } catch (error) {
          lastError = getErrorMessage(error);
          console.error('[AI Single] Gemini failed:', lastError);
          if (isRateLimit(error)) geminiQuotaExhausted = true;
        }
      }

      if (!rawReply) {
        try {
          console.log(`[AI Single] Trying Groq, attempt ${attempt}`);
          rawReply = await askGroqSafe(prompt);
          console.log('[AI Single] SUCCESS: Groq');
        } catch (error) {
          lastError = getErrorMessage(error);
          console.error('[AI Single] Groq failed:', lastError);
        }
      }

      if (rawReply) {
        const validation = validateReply(rawReply, reviewText, brandName);

        if (validation.valid) {
          const finalReply = validation.reply;

          if (review.id) {
            // STRAIGHT-THROUGH PROCESSING (AUTO-POST 4/5 STARS FOR WRITTEN REVIEWS)
            if (rating >= 4) {
              try {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || '[https://ccios-v9-mega-all.vercel.app](https://ccios-v9-mega-all.vercel.app)';
                const postResponse = await fetch(`${appUrl}/api/shopee/reply-comment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reviewId: review.id, reply: finalReply })
                });

                if (postResponse.ok) {
                  await db.review.update({ where: { id: review.id }, data: { aiReply: finalReply, status: 'REPLIED' } });
                  console.log(`[AI Single] 🟢 AUTO-POSTED 4/5 Star Review: ${review.id}`);
                  return NextResponse.json({ success: true, generatedReply: finalReply, brand: brandName, provider: geminiQuotaExhausted ? 'groq' : 'gemini', status: 'REPLIED' });
                }
              } catch (e) {
                console.warn(`[AI Single] ⚠️ Auto-post failed for ${review.id}, saving as GENERATED.`);
              }
            }

            // Default / Fallback save
            await db.review.update({ where: { id: review.id }, data: { aiReply: finalReply, status: 'GENERATED' } });
          }

          console.log(`[AI Single] VALIDATED: ${finalReply}`);
          return NextResponse.json({ success: true, generatedReply: finalReply, brand: brandName, provider: geminiQuotaExhausted ? 'groq' : 'gemini', status: 'GENERATED' });
        }

        lastError = validation.reason;
        console.warn(`[AI Single] Response rejected: ${validation.reason}`);
      }

      if (attempt < MAX_ATTEMPTS) await delay(500);
    }

    return NextResponse.json({ success: false, error: lastError || 'AI generation failed validation.' }, { status: 422 });
  } catch (error) {
    console.error('[AI Single] FATAL:', getErrorMessage(error));
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}