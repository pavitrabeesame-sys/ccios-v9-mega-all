import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
============================================================
CCIOS — MASTER REVIEW AI GENERATION ENGINE
============================================================

REVIEW REPLY ENGINE

FLOW:

Gemini
  ↓
Validation
  ↓
Gemini Retry with exact correction reason
  ↓
Validation
  ↓
Groq fallback
  ↓
Validation
  ↓
Database

CORE RULES:

- Brand must appear naturally
- Written reviews must address actual review
- Detailed reviews must address 2 meaningful details
- Correct customer language
- Natural ecommerce seller tone
- 1–2 short sentences
- Short and human
- 1–2 natural emojis
- No markdown
- No headers
- No hashtags
- No generic rating-only replies
- No invented information
- No automatic awkward brand injection
- Gemini quota cooldown
- Brand AI profiles
- Controlled parallel processing
- REPLIED reviews never regenerated

============================================================
*/

const GEMINI_QUOTA_COOLDOWN_MS =
  24 * 60 * 60 * 1000;

const CONCURRENCY = 3;

/*
============================================================
GLOBAL GEMINI QUOTA STATE
============================================================
*/

const GLOBAL_STATE =
  globalThis.__CCIOS_GEMINI_STATE__ || {
    quotaUntil: 0,
  };

globalThis.__CCIOS_GEMINI_STATE__ =
  GLOBAL_STATE;

function isGeminiQuotaBlocked() {
  return Date.now() < GLOBAL_STATE.quotaUntil;
}

function blockGeminiQuota() {
  GLOBAL_STATE.quotaUntil =
    Date.now() + GEMINI_QUOTA_COOLDOWN_MS;

  console.warn(
    '[AI] Gemini quota blocked for 24 hours.'
  );
}

/*
============================================================
ERROR HELPERS
============================================================
*/

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
    text.includes('quota') ||
    text.includes('resource_exhausted')
  );
}

/*
============================================================
BRAND NORMALIZATION
============================================================
*/

function normalizeBrand(rawBrand) {
  const value =
    String(rawBrand || '').trim();

  const aliases = {
    RAV: 'RAV Design',

    'RAV DESIGN':
      'RAV Design',

    NICOLE:
      'Nicole Collection',

    'NICOLE COLLECTION':
      'Nicole Collection',

    'NICOLE OFFICIAL STORE':
      'Nicole Collection',

    'HUSH PUPPIES':
      'Hush Puppies Accessories',

    'HUSH PUPPIES ACCESSORIES':
      'Hush Puppies Accessories',

    OBERMAIN:
      'Obermain',

    'OBERMAIN ACCESSORIES OFFICIAL STORE':
      'Obermain',

    'JOHN LANGFORD':
      'JOHN LANGFORD OF LONDON',

    'JOHN LANGFORD OF LONDON':
      'JOHN LANGFORD OF LONDON',
  };

  return (
    aliases[value.toUpperCase()] ||
    value ||
    'Our Store'
  );
}

/*
============================================================
DEFAULT BRAND VOICES
============================================================
*/

function getDefaultBrandVoice(brandName) {
  const voices = {
    'RAV Design':
      'Premium, rugged, sophisticated and adventurous. Focus on craftsmanship, durability, quality and timeless design.',

    'Nicole Collection':
      'Elegant, feminine, modern and refined. Focus on flattering design, sophistication, effortless style and quality.',

    'Hush Puppies Accessories':
      'Friendly, trustworthy and professional. Focus on comfort, quality, practicality and thoughtful everyday design.',

    Obermain:
      'Premium, refined and practical. Focus on craftsmanship, quality, sophisticated design and everyday functionality.',

    'JOHN LANGFORD OF LONDON':
      'Classic, formal and sophisticated. Focus on timeless style, craftsmanship, refinement and distinguished quality.',
  };

  return (
    voices[brandName] ||
    'Professional, warm, natural and customer-focused.'
  );
}

/*
============================================================
LANGUAGE DETECTION
============================================================
*/

function detectLanguage(text) {
  const value =
    String(text || '').trim();

  if (!value) {
    return 'English';
  }

  /*
   * Chinese
   */
  if (
    /[\u4e00-\u9fff]/.test(value)
  ) {
    return 'Simplified Chinese';
  }

  /*
   * Malaysian Malay
   *
   * We intentionally include common Shopee-style
   * Malaysian Malay words.
   */
  const malayWords = [
    'sangat',
    'cantik',
    'bagus',
    'terima',
    'kasih',
    'kualiti',
    'barang',
    'penghantaran',
    'pengiriman',
    'cepat',
    'lambat',
    'sesuai',
    'puas',
    'harga',
    'boleh',
    'kain',
    'baju',
    'kemas',
    'murah',
    'berbaloi',
    'selesa',
    'saiz',
    'kecil',
    'besar',
    'tangan',
    'servis',
    'seller',
    'penjual',
    'sampai',
    'parcel',
    'bungkusan',
    'rekaan',
    'cantik',
    'memang',
    'dah',
    'dengan',
    'untuk',
    'yang',
    'dan',
    'pun',
    'juga',
    'ok',
    'baik',
  ];

  const lower =
    value.toLowerCase();

  const matches =
    malayWords.filter(
      (word) =>
        lower.includes(word)
    ).length;

  if (matches >= 1) {
    return 'Malaysian Malay';
  }

  return 'English';
}

/*
============================================================
KNOWLEDGE BASE
============================================================
*/

function filterRelevantKnowledge(
  knowledgeBase,
  reviewText
) {
  if (!knowledgeBase) {
    return 'No additional knowledge base information provided.';
  }

  const text =
    String(reviewText || '')
      .toLowerCase();

  const sections =
    String(knowledgeBase)
      .split('===')
      .map(
        (section) =>
          section.trim()
      )
      .filter(Boolean);

  if (!sections.length) {
    return String(knowledgeBase);
  }

  const keywords = [];

  if (
    text.includes('warranty') ||
    text.includes('guarantee') ||
    text.includes('repair') ||
    text.includes('waranti')
  ) {
    keywords.push(
      'warranty',
      'guarantee',
      'repair',
      'waranti'
    );
  }

  if (
    text.includes('size') ||
    text.includes('small') ||
    text.includes('tight') ||
    text.includes('big') ||
    text.includes('large') ||
    text.includes('fit') ||
    text.includes('saiz') ||
    text.includes('kecil') ||
    text.includes('besar')
  ) {
    keywords.push(
      'size',
      'fitting',
      'fit',
      'saiz'
    );
  }

  if (
    text.includes('return') ||
    text.includes('refund') ||
    text.includes('broken') ||
    text.includes('damaged') ||
    text.includes('rosak')
  ) {
    keywords.push(
      'return',
      'refund',
      'damage',
      'rosak'
    );
  }

  if (
    text.includes('ship') ||
    text.includes('shipping') ||
    text.includes('delivery') ||
    text.includes('late') ||
    text.includes('slow') ||
    text.includes('penghantaran') ||
    text.includes('sampai')
  ) {
    keywords.push(
      'shipping',
      'delivery',
      'sla',
      'penghantaran'
    );
  }

  if (!keywords.length) {
    return sections
      .slice(0, 5)
      .join('\n===\n');
  }

  const matched =
    sections.filter(
      (section) => {
        const lowerSection =
          section.toLowerCase();

        return keywords.some(
          (keyword) =>
            lowerSection.includes(
              keyword
            )
        );
      }
    );

  return matched.length
    ? matched.join('\n===\n')
    : sections
        .slice(0, 5)
        .join('\n===\n');
}

/*
============================================================
NO COMMENT TEMPLATE
============================================================
*/

function getNoCommentTemplate(
  brandName,
  rating
) {
  if (rating >= 5) {
    return `Thank you for choosing ${brandName}! We truly appreciate your support. 😊`;
  }

  if (rating === 4) {
    return `Thank you for choosing ${brandName}! We really appreciate your support. 😊`;
  }

  if (rating === 3) {
    return `Thank you for choosing ${brandName} and for your feedback. We hope to serve you even better next time. 😊`;
  }

  return `Thank you for choosing ${brandName}. We are sorry your experience did not fully meet expectations. 🙏`;
}

/*
============================================================
GENERIC REVIEW CHECK
============================================================
*/

function isGenericRatingOnlyReply(
  reply,
  reviewText
) {
  if (
    !reviewText ||
    !String(reviewText).trim()
  ) {
    return false;
  }

  const normalized =
    String(reply || '')
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  const genericPatterns = [
    'thank you for your 5 star review',
    'thank you for your 5 star rating',
    'thank you for your five star review',
    'thank you for your five star rating',
    'thank you for your rating',
    'thank you for the rating',
    'thank you for the review',
    'thanks for your review',
    'thanks for the review',
  ];

  const compact =
    normalized.replace(
      /\s+/g,
      ''
    );

  for (
    const pattern of genericPatterns
  ) {
    const patternCompact =
      pattern
        .replace(
          /[^\p{L}\p{N}]/gu,
          ''
        )
        .replace(
          /\s+/g,
          ''
        );

    if (
      compact.includes(
        patternCompact
      ) &&
      normalized.split(/\s+/).length <= 18
    ) {
      return true;
    }
  }

  return false;
}

/*
============================================================
REVIEW TOPICS
============================================================
*/

const REVIEW_TOPICS = {
  quality: [
    'quality',
    'kualiti',
    'bagus',
    'good',
    'great',
    'excellent',
    'nice',
    'berkualiti',
    'baik',
    'ok',
  ],

  fabric: [
    'fabric',
    'kain',
    'material',
    'bahan',
    'cotton',
    'leather',
    'kulit',
    'textile',
  ],

  design: [
    'design',
    'rekaan',
    'style',
    'stylish',
    'cantik',
    'kemas',
    'look',
    'rupa',
    'fashion',
    'elegant',
  ],

  fit: [
    'fit',
    'size',
    'sizing',
    'saiz',
    'kecil',
    'kecilkan',
    'besarkan',
    'besar',
    'tight',
    'loose',
    'longgar',
    'ketat',
    'tangan',
    'sleeve',
    'alteration',
    'alter',
  ],

  service: [
    'service',
    'servis',
    'seller',
    'penjual',
    'staff',
    'layanan',
    'response',
    'respon',
    'customer service',
  ],

  delivery: [
    'delivery',
    'penghantaran',
    'shipping',
    'ship',
    'sampai',
    'courier',
    'pos',
    'parcel',
    'cepat',
    'lambat',
    'arrived',
    'arrival',
  ],

  price: [
    'price',
    'harga',
    'murah',
    'berbaloi',
    'value',
    'worth',
    'berpatutan',
    'affordable',
  ],

  packaging: [
    'packaging',
    'pembungkusan',
    'package',
    'bungkusan',
    'kemas',
    'packed',
  ],

  comfort: [
    'comfort',
    'comfortable',
    'selesa',
    'ringan',
    'soft',
    'lembut',
    'wear',
    'wearable',
  ],
};

/*
============================================================
DETECT REVIEW TOPICS
============================================================
*/

function detectReviewTopics(reviewText) {
  const review =
    String(reviewText || '')
      .toLowerCase();

  const detectedTopics = [];

  for (
    const [topic, keywords] of Object.entries(
      REVIEW_TOPICS
    )
  ) {
    const found =
      keywords.some(
        (keyword) =>
          review.includes(
            keyword
          )
      );

    if (found) {
      detectedTopics.push(topic);
    }
  }

  return detectedTopics;
}

/*
============================================================
CHECK ADDRESSED TOPICS
============================================================
*/

function getAddressedTopics(
  reply,
  detectedTopics
) {
  const response =
    String(reply || '')
      .toLowerCase();

  const addressedTopics = [];

  for (
    const topic of detectedTopics
  ) {
    const keywords =
      REVIEW_TOPICS[topic];

    const addressed =
      keywords.some(
        (keyword) =>
          response.includes(
            keyword
          )
      );

    if (addressed) {
      addressedTopics.push(
        topic
      );
    }
  }

  return addressedTopics;
}

/*
============================================================
REVIEW SPECIFICITY
============================================================
*/

function validateReviewSpecificity(
  reply,
  reviewText
) {
  if (
    !reviewText ||
    !String(reviewText).trim()
  ) {
    return {
      valid: true,
      reason:
        'No written review; specificity check not required.',
    };
  }

  if (
    isGenericRatingOnlyReply(
      reply,
      reviewText
    )
  ) {
    return {
      valid: false,
      reason:
        'Generic rating-only response detected for a written review.',
    };
  }

  const review =
    String(reviewText)
      .toLowerCase()
      .trim();

  const detectedTopics =
    detectReviewTopics(
      review
    );

  /*
   * If the language/topic is unknown,
   * don't automatically reject.
   */
  if (
    !detectedTopics.length
  ) {
    return {
      valid: true,
      reason:
        'No identifiable review topics; natural response accepted.',
    };
  }

  const addressedTopics =
    getAddressedTopics(
      reply,
      detectedTopics
    );

  const reviewWordCount =
    review
      .split(/\s+/)
      .filter(Boolean)
      .length;

  /*
   * Detailed review:
   *
   * 12+ words = 2 topics
   *
   * Short review = 1 topic
   */
  const requiredTopics =
    reviewWordCount >= 12
      ? Math.min(
          2,
          detectedTopics.length
        )
      : 1;

  if (
    addressedTopics.length <
    requiredTopics
  ) {
    return {
      valid: false,
      reason:
        `Reply addresses only ${addressedTopics.length} review topic(s), but ${requiredTopics} meaningful detail(s) are required. Review topics: ${detectedTopics.join(', ')}. Addressed: ${addressedTopics.join(', ') || 'none'}.`,
    };
  }

  return {
    valid: true,
    reason:
      `Review topics addressed: ${addressedTopics.join(', ')}.`,
  };
}

/*
============================================================
CLEAN REPLY
============================================================
*/

function cleanReply(text) {
  let cleaned =
    String(text || '').trim();

  /*
   * Remove code fences.
   */
  cleaned =
    cleaned
      .replace(
        /^```(?:text|plaintext)?\s*/i,
        ''
      )
      .replace(
        /\s*```$/i,
        ''
      )
      .trim();

  /*
   * Remove accidental quotation marks.
   */
  cleaned =
    cleaned
      .replace(
        /^["“”']+/,
        ''
      )
      .replace(
        /["“”']+$/,
        ''
      )
      .trim();

  /*
   * Remove accidental prefixes.
   */
  cleaned =
    cleaned.replace(
      /^(reply|response|customer reply|ai reply|final reply|final response)\s*:\s*/i,
      ''
    );

  /*
   * Remove accidental "AI Generated:".
   */
  cleaned =
    cleaned.replace(
      /^ai generated\s*:\s*/i,
      ''
    );

  /*
   * Normalize whitespace.
   */
  cleaned =
    cleaned
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  return cleaned;
}

/*
============================================================
EMOJI
============================================================
*/

function containsEmoji(text) {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(
    text
  );
}

function countEmojis(text) {
  const matches =
    String(text || '').match(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
    );

  return matches
    ? matches.length
    : 0;
}

/*
============================================================
BRAND CHECK
============================================================
*/

function containsBrand(
  reply,
  brandName
) {
  return String(reply || '')
    .toLowerCase()
    .includes(
      String(brandName || '')
        .toLowerCase()
    );
}

/*
============================================================
BRAND HEADER CHECK
============================================================
*/

function isBrandHeader(
  reply,
  brandName
) {
  const escapedBrand =
    String(brandName || '')
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

  const regex =
    new RegExp(
      '^' +
        escapedBrand +
        '\\s*[:\\-]\\s*',
      'i'
    );

  return regex.test(
    String(reply || '').trim()
  );
}

/*
============================================================
VALIDATION GATE
============================================================
*/

function validateReply(
  reply,
  review
) {
  if (
    !reply ||
    typeof reply !== 'string'
  ) {
    return {
      valid: false,
      reason:
        'Empty AI response.',
    };
  }

  let cleaned =
    cleanReply(reply);

  if (!cleaned) {
    return {
      valid: false,
      reason:
        'Empty response after cleaning.',
    };
  }

  /*
   * Markdown
   */
  if (
    cleaned.includes('```') ||
    cleaned.includes('**') ||
    cleaned.includes('__')
  ) {
    return {
      valid: false,
      reason:
        'Markdown detected.',
    };
  }

  /*
   * Brand
   */
  const brandName =
    normalizeBrand(
      review?.brand ||
        review?.storeName
    );

  if (
    isBrandHeader(
      cleaned,
      brandName
    )
  ) {
    return {
      valid: false,
      reason:
        'Brand header detected.',
    };
  }

  /*
   * Emoji
   */
  if (
    !containsEmoji(cleaned)
  ) {
    cleaned =
      `${cleaned} 😊`;
  }

  if (
    countEmojis(cleaned) > 2
  ) {
    return {
      valid: false,
      reason:
        'Reply contains more than 2 emojis.',
    };
  }

  /*
   * Punctuation
   */
  const emojiRegex =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u;

  const emojiMatch =
    cleaned.match(
      emojiRegex
    );

  if (emojiMatch) {
    const emoji =
      emojiMatch[0];

    const textWithoutEmoji =
      cleaned
        .slice(
          0,
          -emoji.length
        )
        .trimEnd();

    if (
      !/[.!?。！？]$/.test(
        textWithoutEmoji
      )
    ) {
      cleaned =
        `${textWithoutEmoji}. ${emoji}`;
    }
  } else if (
    !/[.!?。！？]$/.test(
      cleaned
    )
  ) {
    cleaned += '.';
  }

  /*
   * Minimum length
   */
  if (
    cleaned.length < 25
  ) {
    return {
      valid: false,
      reason:
        'Reply is too short.',
    };
  }

  /*
   * Word count
   */
  const wordCount =
    cleaned
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const reviewWords =
    String(
      review?.reviewText || ''
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  /*
   * Detailed review cannot receive
   * an ultra-short response.
   */
  if (
    reviewWords.length >= 8 &&
    wordCount < 8
  ) {
    return {
      valid: false,
      reason:
        "Reply is too short for the customer's detailed review.",
    };
  }

  /*
   * Incomplete ending
   */
  const words =
    cleaned
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ''
      )
      .split(/\s+/)
      .filter(Boolean);

  const lastWord =
    words[
      words.length - 1
    ];

  const forbiddenEndings =
    new Set([
      'to',
      'for',
      'that',
      'we',
      'our',
      'your',
      'the',
      'and',
      'because',
      'if',
      'when',
      'hear',
      'appreciate',
      'delighted',
      'glad',
      'is',
      'are',
      'of',
      'with',
      'u',
      'atas',
      'yang',
      'dan',
      'untuk',
      'dengan',
      'kerana',
      'kerana',
    ]);

  if (
    forbiddenEndings.has(
      lastWord
    )
  ) {
    return {
      valid: false,
      reason:
        `Response appears incomplete; ends with "${lastWord}".`,
    };
  }

  /*
   * Suspicious unfinished Malay fragments.
   */
  const suspiciousFragments = [
    'atas u',
    'terima kasih atas u',
    'terima kasih atas',
    'kami gembira atas',
    'kami hargai atas',
    'terima kasih untuk',
  ];

  const lowerCleaned =
    cleaned.toLowerCase();

  for (
    const fragment of suspiciousFragments
  ) {
    if (
      lowerCleaned.includes(
        fragment
      )
    ) {
      return {
        valid: false,
        reason:
          `Unnatural/incomplete phrase detected: "${fragment}".`,
      };
    }
  }

  /*
   * Written review specificity
   */
  const specificity =
    validateReviewSpecificity(
      cleaned,
      review?.reviewText
    );

  if (
    !specificity.valid
  ) {
    return {
      valid: false,
      reason:
        specificity.reason,
    };
  }

  /*
   ============================================================
   SMART BRAND CHECK & AUTO-FIX
   ============================================================
   */
  const shortName = brandName.split(' ')[0];
  const hasFullBrand = cleaned.toLowerCase().includes(brandName.toLowerCase());
  const hasShortBrand = cleaned.toLowerCase().includes(shortName.toLowerCase());

  if (!hasFullBrand && !hasShortBrand) {
    // If the brand is completely missing, auto-inject it safely instead of failing the reply
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
BRAND PROFILE CACHE
============================================================
*/

async function loadBrandProfile(
  review,
  cache
) {
  const rawBrand =
    review?.brand ||
    review?.storeName ||
    '';

  if (!rawBrand) {
    return null;
  }

  const cacheKey =
    String(rawBrand)
      .trim()
      .toUpperCase();

  if (
    cache.has(cacheKey)
  ) {
    return cache.get(
      cacheKey
    );
  }

  try {
    /*
     * First try exact normalized database brand.
     */
    const normalized =
      normalizeBrand(
        rawBrand
      );

    let brand =
      await db.brand.findFirst({
        where: {
          name: {
            equals:
              rawBrand,
            mode:
              'insensitive',
          },
        },
        include: {
          AIProfile: true,
        },
      });

    /*
     * If raw store name did not match,
     * try normalized brand.
     */
    if (
      !brand &&
      normalized !== rawBrand
    ) {
      brand =
        await db.brand.findFirst({
          where: {
            name: {
              equals:
                normalized,
              mode:
                'insensitive',
            },
          },
          include: {
            AIProfile: true,
          },
        });
    }

    const profile =
      brand?.AIProfile ||
      null;

    cache.set(
      cacheKey,
      profile
    );

    return profile;
  } catch (error) {
    console.warn(
      '[AI] Unable to load brand AI profile:',
      getErrorMessage(error)
    );

    cache.set(
      cacheKey,
      null
    );

    return null;
  }
}

/*
============================================================
PROMPT BUILDER
============================================================
*/

function buildPrompt(
  review,
  aiProfile,
  options = {}
) {
  const {
    isRetry = false,
    retryReason = '',
  } = options;

  const reviewText =
    String(
      review?.reviewText || ''
    ).trim();

  const rating =
    Number(
      review?.rating
    ) || 5;

  const brandName =
    normalizeBrand(
      review?.brand ||
        review?.storeName
    );

  const language =
    detectLanguage(
      reviewText
    );

  const detectedTopics =
    detectReviewTopics(
      reviewText
    );

  const tone =
    aiProfile?.tone ||
    'Warm, professional and natural';

  const personality =
    aiProfile?.personality ||
    'Helpful, genuine ecommerce customer service representative.';

  const replyStyle =
    aiProfile?.replyStyle ||
    'Natural, concise, personalized and customer-focused.';

  const brandRules =
    aiProfile?.brandRules ||
    'Be polite, sincere, specific and helpful.';

  const forbiddenWords =
    Array.isArray(
      aiProfile?.forbiddenWords
    )
      ? aiProfile.forbiddenWords.join(
          ', '
        )
      : String(
          aiProfile?.forbiddenWords ||
            'None'
        );

  const knowledge =
    filterRelevantKnowledge(
      aiProfile?.knowledgeBase ||
        '',
      reviewText
    );

  /*
   * NO WRITTEN REVIEW
   */
  if (!reviewText) {
    return `
You are the official customer service representative for ${brandName}.

The customer left NO written comment.

Customer rating:
${rating}/5

Write a short, natural customer-facing reply.

MANDATORY:

- Naturally mention "${brandName}".
- Include exactly 1 natural emoji.
- Do not invent product details.
- No markdown.
- No header.
- No quotation marks.
- Complete sentence.
- Do not sound like an advertisement.
- Return ONLY the final customer reply.

Language:
${language}
`.trim();
  }

  /*
   * REQUIRED TOPICS
   */
  const requiredTopicCount =
    reviewText
      .split(/\s+/)
      .filter(Boolean)
      .length >= 12
      ? Math.min(
          2,
          detectedTopics.length
        )
      : Math.min(
          1,
          detectedTopics.length
        );

  return `
You are the official customer service representative for ${brandName}.

You are replying to a REAL customer review.

============================================================
CUSTOMER REVIEW
============================================================

Rating:
${rating}/5

Customer Review:
"${reviewText}"

Customer Language:
${language}

Detected Review Topics:
${detectedTopics.length
  ? detectedTopics.join(', ')
  : 'No automatic topic detected'}

Minimum meaningful topics to address:
${requiredTopicCount || 1}

============================================================
BRAND VOICE
============================================================

Default Brand Voice:
${getDefaultBrandVoice(
  brandName
)}

Configured Tone:
${tone}

Configured Personality:
${personality}

Configured Reply Style:
${replyStyle}

Configured Brand Rules:
${brandRules}

Forbidden Words:
${forbiddenWords}

============================================================
RELEVANT KNOWLEDGE
============================================================

${knowledge}

============================================================
PERSONALIZATION REQUIREMENTS
============================================================

Read the ENTIRE customer review before writing.

You MUST respond to what the customer actually said.

For a detailed review, address AT LEAST TWO meaningful
details from the review.

Meaningful details include:

- quality
- fabric
- material
- design
- fit
- size
- alteration
- comfort
- service
- delivery
- packaging
- price
- value
- praise
- concern
- any other specific customer comment

If the review contains both praise and a concern,
acknowledge both naturally when appropriate.

Do NOT write a generic rating response.

Do NOT write only:
"Thank you for your review."

Do NOT write only:
"Thank you for the 5-star rating."

Do NOT blindly copy the customer review.

Naturally paraphrase the customer's actual meaning.

============================================================
BRAND REQUIREMENT
============================================================

The exact brand name:

"${brandName}"

MUST appear naturally in the reply.

GOOD:
"Terima kasih kerana memilih ${brandName}! Kami gembira anda suka kualiti kain dan kemasan baju. 😊"

GOOD:
"Thank you for choosing ${brandName}! We're glad you liked the quality and design. 😊"

BAD:
"${brandName}: Thank you..."

BAD:
"Brand: ${brandName}"

Do NOT use the brand as a heading.

Do NOT add the brand mechanically after writing the reply.

You must write the brand naturally yourself.

============================================================
LANGUAGE REQUIREMENT
============================================================

Reply primarily in:

${language}

If the customer writes Malaysian Malay:

- Reply in natural Malaysian Malay.
- Do not randomly mix English and Malay.
- Do not translate word-for-word.
- Use natural Malaysian ecommerce seller language.
- Use complete Malay sentences.
- Do not produce fragments such as:
  "Terima kasih banyak atas u."
- Do not end sentences with incomplete words.

If the customer writes English:

- Reply naturally in English.

If the customer writes Simplified Chinese:

- Reply naturally in Simplified Chinese.

============================================================
STYLE
============================================================

- Natural ecommerce seller
- Warm
- Genuine
- Personal
- Professional
- Short
- Human
- 1–2 sentences
- Approximately 15–35 words for detailed reviews
- 1–2 natural emojis
- No excessive marketing
- No advertisement language
- No corporate filler
- No repetitive wording

============================================================
DO NOT INVENT
============================================================

Never invent:

- product specifications
- warranty
- returns
- refunds
- discounts
- delivery promises
- compensation
- policies
- facts not present in the review or knowledge base

============================================================
OUTPUT RULES
============================================================

Return ONLY the final customer-facing reply.

No:

- markdown
- headings
- bullet points
- hashtags
- quotation marks
- "Reply:"
- "AI Generated:"
- explanations
- reasoning
- notes

The reply must:

✓ address the customer's actual review
✓ address ${requiredTopicCount || 1} meaningful detail(s)
✓ naturally mention ${brandName}
✓ use the correct language
✓ use 1–2 emojis
✓ contain complete sentences
✓ end naturally
✓ sound human

============================================================
${isRetry ? `
RETRY — PREVIOUS RESPONSE FAILED VALIDATION
============================================================

The previous response was rejected.

Reason:
${retryReason || 'The response did not satisfy the personalization requirements.'}

You MUST correct that exact problem.

Do not repeat the previous response.

Pay special attention to:

- actual review details
- meaningful topic coverage
- natural ${language} wording
- natural brand placement
- complete sentences
- no fragments
- proper punctuation
- 1–2 emojis

Return ONLY the corrected customer-facing reply.

` : ''}
============================================================

FINAL INSTRUCTION

Write the final customer-facing reply now.

Return ONLY the reply.
`.trim();
}

/*
============================================================
GEMINI
============================================================
*/

async function askGemini(
  prompt
) {
  const apiKey =
    String(process.env.GEMINI_API_KEY || '').trim();

  const model =
    String(process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite')
      .trim()
      .replace(/['"]/g, '');

  if (
    !apiKey ||
    apiKey ===
      'YOUR_GEMINI_API_KEY'
  ) {
    throw new Error(
      'Gemini API key is not configured.'
    );
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    model +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
You are CCIOS Review Intelligence.

You write natural, personalized ecommerce customer review replies.

MANDATORY RULES:

1. Read the customer's entire review.

2. Respond to the customer's actual words.

3. Never produce a generic rating-only reply.

4. For a detailed review, address at least TWO meaningful
   details from the review.

5. Meaningful details include:
   quality, fabric, material, design, fit, size, alteration,
   comfort, service, delivery, packaging, price, value,
   praise, criticism or another specific customer comment.

6. The exact brand name supplied in the prompt must appear
   naturally inside a sentence.

7. Never use the brand as a heading.

8. Never invent facts.

9. Never invent warranty promises.

10. Never invent discounts.

11. Never invent delivery promises.

12. Never invent product specifications.

13. Reply primarily in the customer's detected language.

14. If the customer writes Malaysian Malay:
    - use natural Malaysian Malay
    - do not randomly mix English and Malay
    - do not translate word-for-word
    - use complete natural sentences
    - avoid incomplete fragments

15. Use 1–2 natural emojis.

16. Keep the reply short and human.

17. Use 1–2 complete sentences.

18. No markdown.

19. No headings.

20. No hashtags.

21. No quotation marks around the reply.

22. No explanation.

23. Return ONLY the final customer-facing reply.

Before answering, silently verify:

✓ actual review addressed
✓ meaningful details addressed
✓ correct language
✓ brand naturally included
✓ complete sentences
✓ natural punctuation
✓ 1–2 emojis
✓ no invented information
✓ no generic rating response
`,
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
            temperature: 0.35,
            maxOutputTokens: 500,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }
    );

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
    data?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) =>
          part?.text || ''
      )
      .join('')
      .trim();

  if (!text) {
    throw new Error(
      'Gemini returned an empty response.'
    );
  }

  return text;
}

/*
============================================================
GROQ
============================================================
*/

async function askGroqSafe(
  prompt
) {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (
    !apiKey ||
    apiKey ===
      'YOUR_GROQ_API_KEY'
  ) {
    throw new Error(
      'Groq API key is not configured.'
    );
  }

  const reply =
    await askGroq(
      prompt,
      {
        skipGemini: true,
      }
    );

  if (
    !reply ||
    !String(reply).trim()
  ) {
    throw new Error(
      'Groq returned an empty response.'
    );
  }

  return String(
    reply
  ).trim();
}

/*
============================================================
GENERATION ENGINE
============================================================
*/

async function generateReviewReply(
  review,
  aiState,
  profileCache
) {
  const reviewText =
    String(
      review?.reviewText ||
        ''
    ).trim();

  /*
   * BLANK REVIEW
   */
  if (!reviewText) {
    return getNoCommentTemplate(
      normalizeBrand(
        review?.brand ||
          review?.storeName
      ),
      Number(
        review?.rating
      ) || 5
    );
  }

  const aiProfile =
    await loadBrandProfile(
      review,
      profileCache
    );

  /*
   ============================================================
   GEMINI FIRST
   ============================================================
   */

  if (
    !aiState.geminiQuotaExhausted &&
    !isGeminiQuotaBlocked()
  ) {
    try {
      console.log(
        '[AI] Trying Gemini'
      );

      const prompt =
        buildPrompt(
          review,
          aiProfile,
          {
            isRetry: false,
          }
        );

      const rawReply =
        await askGemini(
          prompt
        );

      console.log(
        '[AI] SUCCESS: Gemini'
      );

      let validation =
        validateReply(
          rawReply,
          review
        );

      if (
        validation.valid
      ) {
        console.log(
          '[AI] GEMINI VALIDATED:',
          validation.cleanedReply
        );

        return validation.cleanedReply;
      }

      console.warn(
        '[AI] Gemini validation failed:',
        validation.reason
      );

      /*
       ========================================================
       GEMINI RETRY
       ========================================================
       */

      console.log(
        '[AI] Retrying Gemini with corrected instructions'
      );

      const retryPrompt =
        buildPrompt(
          review,
          aiProfile,
          {
            isRetry: true,
            retryReason:
              validation.reason,
          }
        );

      const retryReply =
        await askGemini(
          retryPrompt
        );

      console.log(
        '[AI] Gemini retry succeeded'
      );

      validation =
        validateReply(
          retryReply,
          review
        );

      if (
        validation.valid
      ) {
        console.log(
          '[AI] GEMINI RETRY VALIDATED:',
          validation.cleanedReply
        );

        return validation.cleanedReply;
      }

      console.warn(
        '[AI] Gemini retry validation failed:',
        validation.reason
      );

    } catch (error) {
      console.warn(
        '[AI] Gemini failed:',
        getErrorMessage(
          error
        )
      );

      if (
        isRateLimitError(
          error
        )
      ) {
        aiState.geminiQuotaExhausted =
          true;

        blockGeminiQuota();
      }
    }
  } else {
    console.log(
      '[AI] Gemini skipped — quota cooldown active'
    );
  }

  /*
   ============================================================
   GROQ FALLBACK
   ============================================================
   */

  try {
    console.log(
      '[AI] Trying Groq fallback'
    );

    const prompt =
      buildPrompt(
        review,
        aiProfile,
        {
          isRetry: true,
          retryReason:
            'Gemini could not produce a validated response. Generate a fresh response that strictly follows all personalization, language, brand and topic requirements.',
        }
      );

    const rawReply =
      await askGroqSafe(
        prompt
      );

    console.log(
      '[AI] SUCCESS: Groq'
    );

    const validation =
      validateReply(
        rawReply,
        review
      );

    if (
      validation.valid
    ) {
      console.log(
        '[AI] GROQ VALIDATED:',
        validation.cleanedReply
      );

      return validation.cleanedReply;
    }

    throw new Error(
      `Groq validation failed: ${validation.reason}`
    );

  } catch (error) {
    console.warn(
      '[AI] Groq failed:',
      getErrorMessage(
        error
      )
    );

    throw error;
  }
}

/*
============================================================
PROCESS ONE REVIEW
============================================================
*/

async function processReview(
  review,
  aiState,
  profileCache
) {
  console.log(
    `[Bulk AI] Processing review ${review?.id}`
  );

  /*
   * Never regenerate replied reviews.
   */
  if (
    review?.status ===
    'REPLIED'
  ) {
    return {
      success: false,
      id: review?.id,
      error:
        'Review is already REPLIED.',
    };
  }

  try {
    const reply =
      await generateReviewReply(
        review,
        aiState,
        profileCache
      );

    /*
     * FINAL VALIDATION
     *
     * This is the final gate before DB.
     */
    const finalValidation =
      validateReply(
        reply,
        review
      );

    if (
      !finalValidation.valid
    ) {
      throw new Error(
        `Final validation failed: ${finalValidation.reason}`
      );
    }

    await db.review.update({
      where: {
        id: review.id,
      },

      data: {
        aiReply:
          finalValidation.cleanedReply,

        status:
          'GENERATED',
      },
    });

    console.log(
      '[Bulk AI] DATABASE SAVED:',
      review.id
    );

    return {
      success: true,
      id: review.id,
      reply:
        finalValidation.cleanedReply,
    };

  } catch (error) {
    console.warn(
      `[Bulk AI] FAILED ${review?.id}:`,
      getErrorMessage(
        error
      )
    );

    return {
      success: false,
      id: review?.id,
      error:
        getErrorMessage(
          error
        ),
    };
  }
}

/*
============================================================
CONCURRENT PROCESSOR
============================================================
*/

async function processInBatches(
  candidates,
  aiState,
  profileCache
) {
  const results = [];

  for (
    let i = 0;
    i < candidates.length;
    i += CONCURRENCY
  ) {
    const batch =
      candidates.slice(
        i,
        i + CONCURRENCY
      );

    console.log(
      `[Bulk AI] Batch ${
        Math.floor(
          i / CONCURRENCY
        ) + 1
      } — ${batch.length} reviews`
    );

    const batchResults =
      await Promise.all(
        batch.map(
          (review) =>
            processReview(
              review,
              aiState,
              profileCache
            )
        )
      );

    results.push(
      ...batchResults
    );
  }

  return results;
}

/*
============================================================
POST HANDLER
============================================================
*/

export async function POST(
  req
) {
  try {
    let body = {};

    try {
      body =
        await req.json();
    } catch {
      body = {};
    }

    const ids =
      Array.isArray(
        body.ids
      )
        ? body.ids
        : [];

    const requestedLimit =
      Number(
        body.limit
      ) || null;

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

    const aiState = {
      geminiQuotaExhausted:
        isGeminiQuotaBlocked(),
    };

    console.log(
      '[Bulk AI] Gemini blocked:',
      aiState.geminiQuotaExhausted
    );

    let candidates = [];

    /*
     ============================================================
     EXPLICIT IDS
     ============================================================
     */

    if (
      hasExplicitIds
    ) {
      const uniqueIds =
        [
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
        !uniqueIds.length
      ) {
        return NextResponse.json({
          success: true,
          generated: 0,
          failed: 0,
          total: 0,
          errors: [],
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

      /*
       ========================================================
       NORMAL BULK
       ========================================================
       */

      candidates =
        await db.review.findMany({
          where: {
            status: {
              notIn: [
                'GENERATED',
                'REPLIED',
              ],
            },
          },

          orderBy: {
            createdAt:
              'desc',
          },

          ...(requestedLimit
            ? {
                take:
                  requestedLimit,
              }
            : {}),
        });
    }

    console.log(
      '[Bulk AI] Candidates found:',
      candidates.length
    );

    if (
      !candidates.length
    ) {
      console.log(
        '[Bulk AI] No reviews require generation.'
      );

      return NextResponse.json({
        success: true,
        generated: 0,
        failed: 0,
        total: 0,
        errors: [],
      });
    }

    /*
     ============================================================
     PROFILE CACHE
     ============================================================
     */

    const profileCache =
      new Map();

    /*
     ============================================================
     PROCESS
     ============================================================
     */

    const results =
      await processInBatches(
        candidates,
        aiState,
        profileCache
      );

    /*
     ============================================================
     RESULTS
     ============================================================
     */

    const generatedCount =
      results.filter(
        (result) =>
          result.success
      ).length;

    const failedResults =
      results.filter(
        (result) =>
          !result.success
      );

    const errors =
      failedResults.map(
        (result) => ({
          id:
            result.id,

          error:
            result.error,
        })
      );

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
      failedResults.length
    );

    console.log(
      '[Bulk AI] Total:',
      candidates.length
    );

    console.log(
      '[Bulk AI] Gemini quota exhausted:',
      aiState.geminiQuotaExhausted
    );

    console.log(
      '[Bulk AI] Gemini cooldown active:',
      isGeminiQuotaBlocked()
    );

    console.log(
      '================================================'
    );

    return NextResponse.json({
      success: true,

      generated:
        generatedCount,

      failed:
        failedResults.length,

      total:
        candidates.length,

      errors,

      geminiQuotaExhausted:
        aiState.geminiQuotaExhausted,

      geminiCooldownActive:
        isGeminiQuotaBlocked(),
    });

  } catch (error) {
    console.error(
      '[Bulk AI] FATAL ERROR:',
      getErrorMessage(
        error
      )
    );

    return NextResponse.json(
      {
        success: false,

        error:
          getErrorMessage(
            error
          ),
      },
      {
        status: 500,
      }
    );
  }
}