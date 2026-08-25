import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/src/services/ai/GroqService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Bump from 60 to 300 seconds

/*
============================================================
CCIOS — MASTER REVIEW AI GENERATION ENGINE
============================================================

4–5 STAR:
Generate → Validate → Auto-post → REPLIED
                         ↓ failure
                      GENERATED

1–3 STAR:
Generate → Validate → GENERATED
                    → Manual approval

AI:
Primary gateway → Direct Groq fallback

IMPORTANT:
A review is ONLY marked REPLIED after the Shopee
reply endpoint confirms success.
============================================================
*/

/*
============================================================
CONFIG
============================================================
*/

const CONCURRENCY = 1;
const GEMINI_QUOTA_COOLDOWN_MS = 60 * 1000;

/*
============================================================
GLOBAL AI STATE
============================================================
*/

type CCIOSGeminiState = {
  quotaUntil: number;
};

const GLOBAL_STATE_KEY =
  '__CCIOS_GEMINI_STATE__';

const globalForCCIOS =
  globalThis as typeof globalThis & {
    [GLOBAL_STATE_KEY]?: CCIOSGeminiState;
  };

const GLOBAL_STATE: CCIOSGeminiState =
  globalForCCIOS[GLOBAL_STATE_KEY] ?? {
    quotaUntil: 0,
  };

globalForCCIOS[GLOBAL_STATE_KEY] =
  GLOBAL_STATE;

/*
============================================================
ERROR HELPERS
============================================================
*/

function getErrorMessage(
  error: unknown
): string {
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

function isRateLimitError(
  error: unknown
): boolean {
  const text =
    getErrorMessage(error).toLowerCase();

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
  return (
    Date.now() <
    GLOBAL_STATE.quotaUntil
  );
}

function blockGeminiQuota(): void {
  GLOBAL_STATE.quotaUntil =
    Date.now() +
    GEMINI_QUOTA_COOLDOWN_MS;

  console.warn(
    '[AI] Primary AI quota/rate-limit detected. Cooldown activated.'
  );
}

/*
============================================================
BRAND REGISTRY
============================================================
*/

const BRAND_ALIASES = [
  {
    canonical: 'RAV Design',
    match: ['RAV', 'RAV DESIGN'],
    voice:
      'Premium, rugged, sophisticated and adventurous. Focus on craftsmanship, durability, quality and timeless design.',
  },
  {
    canonical: 'Nicole Collection',
    match: [
      'NICOLE',
      'NICOLE COLLECTION',
    ],
    voice:
      'Elegant, feminine, modern and refined. Focus on flattering design, sophistication, effortless style and quality.',
  },
  {
    canonical: 'Hush Puppies Accessories',
    match: [
      'HUSH PUPPIES',
      'HUSH PUPPIES ACCESSORIES',
      'HUSH',
    ],
    voice:
      'Friendly, trustworthy and professional. Focus on comfort, quality, practicality and thoughtful everyday design.',
  },
  {
    canonical: 'Obermain',
    match: [
      'OBERMAIN',
      'OBERMAIN ACCESSORIES',
    ],
    voice:
      'Premium, refined and practical. Focus on craftsmanship, quality, sophisticated design and everyday functionality.',
  },
  {
    canonical: 'Beverly Hills Polo Club',
    match: [
      'BHPC',
      'BEVERLY HILLS',
      'BEVERLY HILLS POLO CLUB',
    ],
    voice:
      'Classic, sporty, prestigious and casual luxury. Focus on heritage, comfort, timeless appeal and premium quality.',
  },
  {
    canonical:
      'JOHN LANGFORD OF LONDON',
    match: [
      'JOHN LANGFORD',
      'JOHN LANGFORD OF LONDON',
      'LANGFORD',
    ],
    voice:
      'Classic, formal and sophisticated. Focus on timeless style, craftsmanship, refinement and distinguished quality.',
  },
];

function normalizeBrand(
  rawBrand: unknown
): string {
  if (!rawBrand) {
    return 'Our Store';
  }

  const cleaned = String(rawBrand)
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
          cleaned.includes(match) ||
          match.includes(cleaned)
      )
    ) {
      return brand.canonical;
    }
  }

  return (
    String(rawBrand)
      .replace(/\(.*?\)/g, '')
      .trim() || 'Our Store'
  );
}

function getBrandVoice(
  brandName: string
): string {
  const brand =
    BRAND_ALIASES.find(
      (item) =>
        item.canonical.toLowerCase() ===
        brandName.toLowerCase()
    );

  return (
    brand?.voice ||
    'Professional, warm, natural and customer-focused.'
  );
}

function getBrandKeywords(
  brandName: string
): string[] {
  const brand =
    BRAND_ALIASES.find(
      (item) =>
        item.canonical.toLowerCase() ===
        brandName.toLowerCase()
    );

  if (!brand) {
    return [
      brandName.toLowerCase(),
    ];
  }

  return [
    brand.canonical.toLowerCase(),
    ...brand.match.map((value) =>
      value.toLowerCase()
    ),
  ];
}

/*
============================================================
LANGUAGE DETECTION
============================================================
*/

function detectLanguage(
  text: string
): string {
  const value =
    String(text || '').trim();

  if (!value) {
    return 'English';
  }

  if (/[\u3400-\u9fff]/.test(value)) {
    return 'Simplified Chinese';
  }

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
        new RegExp(
          `\\b${word}\\b`,
          'i'
        ).test(lower)
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
  knowledgeBase: unknown,
  reviewText: string
): string {
  if (!knowledgeBase) {
    return 'No additional knowledge base information provided.';
  }

  const sections =
    String(knowledgeBase)
      .split('===')
      .map((section) =>
        section.trim()
      )
      .filter(Boolean);

  if (!sections.length) {
    return String(knowledgeBase);
  }

  const text =
    String(reviewText || '')
      .toLowerCase();

  const keywords: string[] = [];

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
        const lower =
          section.toLowerCase();

        return keywords.some(
          (keyword) =>
            lower.includes(keyword)
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
} as const;

type ReviewTopic =
  keyof typeof REVIEW_TOPICS;

function detectReviewTopics(
  reviewText: string
): ReviewTopic[] {
  const review =
    String(reviewText || '')
      .toLowerCase();

  const topics: ReviewTopic[] = [];

  for (const [
    topic,
    keywords,
  ] of Object.entries(
    REVIEW_TOPICS
  ) as [
    ReviewTopic,
    readonly string[]
  ][]) {
    if (
      keywords.some(
        (keyword) =>
          review.includes(keyword)
      )
    ) {
      topics.push(topic);
    }
  }

  return topics;
}

function getAddressedTopics(
  reply: string,
  detectedTopics: ReviewTopic[]
): ReviewTopic[] {
  const response =
    String(reply || '')
      .toLowerCase();

  return detectedTopics.filter(
    (topic) =>
      REVIEW_TOPICS[topic].some(
        (keyword) =>
          response.includes(keyword)
      )
  );
}

/*
============================================================
SPECIFICITY
============================================================
*/

function isGenericRatingOnlyReply(
  reply: string,
  reviewText: string
): boolean {
  if (!reviewText?.trim()) {
    return false;
  }

  const normalized =
    String(reply)
      .toLowerCase()
      .replace(
        /[^\p{L}\p{N}\s]/gu,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

  const patterns = [
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

  const wordCount =
    normalized
      .split(/\s+/)
      .filter(Boolean)
      .length;

  return patterns.some(
    (pattern) => {
      const compactPattern =
        pattern
          .replace(
            /[^\p{L}\p{N}]/gu,
            ''
          )
          .replace(/\s+/g, '');

      const compactReply =
        normalized.replace(
          /\s+/g,
          ''
        );

      return (
        compactReply.includes(
          compactPattern
        ) &&
        wordCount <= 18
      );
    }
  );
}

function validateReviewSpecificity(
  reply: string,
  reviewText: string
) {
  if (!reviewText?.trim()) {
    return {
      valid: true,
      reason: 'No written review.',
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
        'Generic rating-only response detected.',
    };
  }

  const topics =
    detectReviewTopics(reviewText);

  if (!topics.length) {
    return {
      valid: true,
      reason:
        'No identifiable topics; natural response accepted.',
    };
  }

  const addressed =
    getAddressedTopics(
      reply,
      topics
    );

  const reviewWordCount =
    String(reviewText)
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const required =
    reviewWordCount >= 12
      ? Math.min(2, topics.length)
      : 1;

  if (addressed.length < required) {
    return {
      valid: false,
      reason:
        `Reply addresses ${addressed.length} topic(s), ` +
        `but ${required} required. Topics: ` +
        `${topics.join(', ')}.`,
    };
  }

  return {
    valid: true,
    reason:
      `Topics addressed: ${addressed.join(', ')}.`,
  };
}

/*
============================================================
NO COMMENT
============================================================
*/

function getNoCommentTemplate(
  brandName: string,
  rating: number
): string {
  if (rating >= 5) {
    return (
      `Thank you for choosing ${brandName}! ` +
      `We truly appreciate your support. 😊`
    );
  }

  if (rating === 4) {
    return (
      `Thank you for choosing ${brandName}! ` +
      `We really appreciate your support. 😊`
    );
  }

  if (rating === 3) {
    return (
      `Thank you for choosing ${brandName} ` +
      `and for your feedback. We hope to serve you ` +
      `even better next time. 😊`
    );
  }

  return (
    `Thank you for choosing ${brandName}. ` +
    `We are sorry your experience did not fully ` +
    `meet expectations. 🙏`
  );
}

/*
============================================================
CLEANING
============================================================
*/

function cleanReply(
  text: unknown
): string {
  let cleaned =
    String(text || '')
      .trim();

  cleaned = cleaned
    .replace(
      /^```(?:text|plaintext|markdown)?\s*/i,
      ''
    )
    .replace(
      /\s*```$/i,
      ''
    )
    .trim();

  cleaned = cleaned
    .replace(
      /^(reply|response|customer reply|ai reply|final reply|final response)\s*:\s*/i,
      ''
    )
    .replace(
      /^ai generated\s*:\s*/i,
      ''
    );

  cleaned = cleaned
    .replace(/^["“”']+/, '')
    .replace(/["“”']+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

function containsEmoji(
  text: string
): boolean {
  return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(
    text
  );
}

function countEmojis(
  text: string
): number {
  const matches =
    String(text || '').match(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
    );

  return matches
    ? matches.length
    : 0;
}

function isBrandHeader(
  reply: string,
  brandName: string
): boolean {
  const escaped =
    String(brandName).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

  return new RegExp(
    `^${escaped}\\s*[:\\-]\\s*`,
    'i'
  ).test(reply.trim());
}

/*
============================================================
VALIDATION
============================================================
*/

function validateReply(
  reply: unknown,
  review: any
) {
  if (
    !reply ||
    typeof reply !== 'string'
  ) {
    return {
      valid: false,
      reason: 'Empty AI response.',
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

  if (!containsEmoji(cleaned)) {
    cleaned += ' 😊';
  }

  if (countEmojis(cleaned) > 2) {
    return {
      valid: false,
      reason:
        'More than 2 emojis.',
    };
  }

  const trailingEmoji =
    cleaned.match(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u
    );

  if (trailingEmoji) {
    const emoji =
      trailingEmoji[0];

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

  if (cleaned.length < 25) {
    return {
      valid: false,
      reason:
        'Reply is too short.',
    };
  }

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

  if (
    reviewWords.length >= 8 &&
    wordCount < 8
  ) {
    return {
      valid: false,
      reason:
        "Reply is too short for customer's detailed review.",
    };
  }

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
    words[words.length - 1];

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

  const suspiciousFragments = [
    'atas u',
    'terima kasih atas u',
    'terima kasih atas',
    'kami gembira atas',
    'kami hargai atas',
    'terima kasih untuk',
  ];

  const lower =
    cleaned.toLowerCase();

  for (
    const fragment of
    suspiciousFragments
  ) {
    if (
      lower.includes(fragment)
    ) {
      return {
        valid: false,
        reason:
          `Unnatural phrase detected: "${fragment}".`,
      };
    }
  }

  const specificity =
    validateReviewSpecificity(
      cleaned,
      String(
        review?.reviewText || ''
      )
    );

  if (!specificity.valid) {
    return {
      valid: false,
      reason:
        specificity.reason,
    };
  }

  /*
  ----------------------------------------------------------
  BRAND CHECK
  ----------------------------------------------------------
  */

  const keywords =
    getBrandKeywords(
      brandName
    );

  const hasBrand =
    keywords.some(
      (keyword) =>
        cleaned
          .toLowerCase()
          .includes(keyword)
    );

  if (!hasBrand) {
    if (
      /^thank you\b/i.test(
        cleaned
      )
    ) {
      cleaned =
        cleaned.replace(
          /^thank you\b/i,
          `Thank you for choosing ${brandName}`
        );
    } else if (
      /^terima kasih\b/i.test(
        cleaned
      )
    ) {
      cleaned =
        cleaned.replace(
          /^terima kasih\b/i,
          `Terima kasih kerana memilih ${brandName}`
        );
    } else {
      cleaned =
        `Thank you for choosing ${brandName}! ${cleaned}`;
    }
  }

  return {
    valid: true,
    cleanedReply: cleaned,
    reason:
      specificity.reason,
  };
}

/*
============================================================
BRAND PROFILE
============================================================
*/

async function loadBrandProfile(
  review: any,
  cache: Map<string, any>
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
    return cache.get(cacheKey);
  }

  try {
    const normalized =
      normalizeBrand(
        rawBrand
      );

    let brand =
      await db.brand.findFirst({
        where: {
          name: {
            equals:
              String(rawBrand),
            mode: 'insensitive',
          },
        },
        include: {
          AIProfile: true,
        },
      });

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
              mode: 'insensitive',
            },
          },
          include: {
            AIProfile: true,
          },
        });
    }

    const profile =
      brand?.AIProfile || null;

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
PROMPT
============================================================
*/

function buildPrompt(
  review: any,
  aiProfile: any,
  options: {
    isRetry?: boolean;
    retryReason?: string;
  } = {}
): string {
  const {
    isRetry = false,
    retryReason = '',
  } = options;

  const reviewText =
    String(
      review?.reviewText || ''
    ).trim();

  const rating =
    Number(review?.rating) || 5;

  const brandName =
    normalizeBrand(
      review?.brand ||
        review?.storeName
    );

  const language =
    detectLanguage(
      reviewText
    );

  const topics =
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

  if (!reviewText) {
    return `
You are the official customer service representative for ${brandName}.

The customer left no written comment.

Rating:
${rating}/5

Write a short customer-facing reply.

Rules:
- Naturally mention "${brandName}".
- Include exactly 1 natural emoji.
- Do not invent product details.
- No markdown.
- No heading.
- No quotation marks.
- Complete sentence.
- Do not sound like an advertisement.
- Return ONLY the final customer reply.

Language:
${language}
`.trim();
  }

  const reviewWordCount =
    reviewText
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const requiredTopicCount =
    reviewWordCount >= 12
      ? Math.min(
          2,
          topics.length
        )
      : Math.min(
          1,
          topics.length
        );

  return `
You are the official customer service representative for ${brandName}.

You are replying to a REAL customer review.

CUSTOMER RATING:
${rating}/5

CUSTOMER REVIEW:
"${reviewText}"

CUSTOMER LANGUAGE:
${language}

DETECTED TOPICS:
${
  topics.length
    ? topics.join(', ')
    : 'None'
}

MINIMUM TOPICS TO ADDRESS:
${requiredTopicCount || 1}

BRAND VOICE:
${getBrandVoice(
  brandName
)}

CONFIGURED TONE:
${tone}

CONFIGURED PERSONALITY:
${personality}

CONFIGURED REPLY STYLE:
${replyStyle}

CONFIGURED BRAND RULES:
${brandRules}

FORBIDDEN WORDS:
${forbiddenWords}

RELEVANT KNOWLEDGE:
${knowledge}

PERSONALIZATION:
- Read the entire review.
- Reply specifically to what the customer said.
- Do not write a generic rating response.
- Address meaningful details from the review.
- If there is both praise and a concern, acknowledge both naturally.
- Do not invent facts, warranties, returns, refunds, compensation, discounts or delivery promises.

BRAND:
The exact brand name "${brandName}" must appear naturally.
Never use the brand as a heading.

LANGUAGE:
Reply primarily in ${language}.

For Malaysian Malay:
- Use natural Malaysian Malay.
- Do not translate English word-for-word.
- Do not randomly mix languages.
- Use complete sentences.
- Never use incomplete phrases such as "atas u".

STYLE:
- Warm
- Genuine
- Personal
- Professional
- Concise
- Normally 1–2 sentences
- 1–2 natural emojis
- No advertising language

OUTPUT:
Return ONLY the final customer-facing reply.
No markdown.
No heading.
No bullet points.
No hashtags.
No quotation marks.

${
  isRetry
    ? `
RETRY:
The previous response failed validation.

Reason:
${retryReason}

Correct the specific problem and return a completely valid customer reply.
`
    : ''
}
`.trim();
}

/*
============================================================
AI GENERATION
============================================================
*/

async function generateWithAI(
  review: any,
  profileCache: Map<string, any>
): Promise<string> {
  const reviewText =
    String(
      review?.reviewText || ''
    ).trim();

  const brandName =
    normalizeBrand(
      review?.brand ||
        review?.storeName
    );

  if (!reviewText) {
    return getNoCommentTemplate(
      brandName,
      Number(review?.rating) || 5
    );
  }

  const aiProfile =
    await loadBrandProfile(
      review,
      profileCache
    );

  /*
  ----------------------------------------------------------
  PRIMARY AI GATEWAY
  ----------------------------------------------------------
  */

  if (
    !isGeminiQuotaBlocked()
  ) {
    try {
      console.log(
        '[AI] Trying primary AI gateway'
      );

      const prompt =
        buildPrompt(
          review,
          aiProfile
        );

      const rawReply =
        await askGroq(prompt);

      const validation =
        validateReply(
          rawReply,
          review
        );

      if (
        validation.valid
      ) {
        return validation.cleanedReply;
      }

      console.warn(
        '[AI] Primary validation failed:',
        validation.reason
      );

      /*
      Retry through the primary gateway with
      explicit correction instructions.
      */

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
        await askGroq(
          retryPrompt
        );

      const retryValidation =
        validateReply(
          retryReply,
          review
        );

      if (
        retryValidation.valid
      ) {
        return retryValidation.cleanedReply;
      }

      throw new Error(
        `Primary AI validation failed: ${retryValidation.reason}`
      );
    } catch (error) {
      console.warn(
        '[AI] Primary AI path failed:',
        getErrorMessage(error)
      );

      if (
        isRateLimitError(error)
      ) {
        blockGeminiQuota();
      }
    }
  } else {
    console.log(
      '[AI] Primary AI cooldown active; using direct Groq fallback.'
    );
  }

  /*
  ----------------------------------------------------------
  DIRECT GROQ FALLBACK
  ----------------------------------------------------------
  */

  try {
    console.log(
      '[AI] Trying direct Groq fallback'
    );

    const prompt =
      buildPrompt(
        review,
        aiProfile,
        {
          isRetry: true,
          retryReason:
            'Generate a fresh response following all brand, language and specificity requirements.',
        }
      );

    const rawReply =
      await askGroq(
        prompt,
        {
          skipGemini: true,
        }
      );

    const validation =
      validateReply(
        rawReply,
        review
      );

    if (
      !validation.valid
    ) {
      throw new Error(
        `Groq validation failed: ${validation.reason}`
      );
    }

    return validation.cleanedReply;
  } catch (error) {
    console.warn(
      '[AI] Direct Groq fallback failed:',
      getErrorMessage(error)
    );

    throw error;
  }
}

/*
============================================================
SHOPEE COMMENT ID
============================================================
*/

function getCommentId(
  review: any
): number | null {
  if (!review) {
    return null;
  }

  const possibleValues = [
    review.commentId,
    review.shopeeCommentId,
    review.comment_id,
    review.shopee_comment_id,
  ];

  for (
    const value of possibleValues
  ) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {
      continue;
    }

    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return null;
}

/*
============================================================
SHOPEE AUTO POST
============================================================
*/

async function autoPostReply(
  review: any,
  reply: string
) {
  const commentId =
    getCommentId(review);

  if (!commentId) {
    throw new Error(
      'No Shopee comment ID found on this review. Reply was generated but cannot be auto-posted.'
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://ccios-v9-mega-all.vercel.app';

  const endpoint =
    `${appUrl.replace(/\/$/, '')}/api/shopee/reply-comment`;

  console.log(
    `[Shopee] Posting reply for review ${review.id}, comment ${commentId}`
  );

  const response =
    await fetch(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          commentId,
          comment: reply,
        }),
        cache: 'no-store',
      }
    );

  const responseText =
    await response.text();

  let data: any = null;

  try {
    data =
      JSON.parse(
        responseText
      );
  } catch {
    data =
      responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Shopee reply endpoint failed (${response.status}): ${
        typeof data === 'string'
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  if (
    data &&
    typeof data === 'object'
  ) {
    const errorCode =
      data.error ??
      data.error_code ??
      data.code;

    if (
      errorCode &&
      String(errorCode) !== '0'
    ) {
      throw new Error(
        `Shopee reply failed: ${JSON.stringify(data)}`
      );
    }

    if (
      data.success === false
    ) {
      throw new Error(
        `Shopee reply failed: ${JSON.stringify(data)}`
      );
    }
  }

  return data;
}

/*
============================================================
PROCESS ONE REVIEW
============================================================
*/

async function processReview(
  review: any,
  profileCache: Map<string, any>
) {
  console.log(
    `[Bulk AI] Processing review ${review?.id}`
  );

  if (
    review?.status === 'REPLIED'
  ) {
    return {
      success: false,
      id: review?.id,
      error:
        'Review is already REPLIED.',
    };
  }

  try {
    /*
    --------------------------------------------------------
    GENERATE
    --------------------------------------------------------
    */

    const reply =
      await generateWithAI(
        review,
        profileCache
      );

    /*
    --------------------------------------------------------
    FINAL VALIDATION
    --------------------------------------------------------
    */

    const validation =
      validateReply(
        reply,
        review
      );

    if (
      !validation.valid
    ) {
      throw new Error(
        `Final validation failed: ${validation.reason}`
      );
    }

    const finalReply =
      validation.cleanedReply;

    const rating =
      Number(review?.rating) || 5;

    /*
    --------------------------------------------------------
    4/5 STAR AUTO POST
    --------------------------------------------------------
    */

    if (rating >= 4) {
      try {
        const postResult =
          await autoPostReply(
            review,
            finalReply
          );

        await db.review.update({
          where: {
            id: review.id,
          },
          data: {
            aiReply: finalReply,
            status: 'REPLIED',
          },
        });

        console.log(
          `[Bulk AI] AUTO-POSTED ${rating} STAR: ${review.id}`
        );

        return {
          success: true,
          id: review.id,
          reply: finalReply,
          status: 'REPLIED',
          posted: true,
          postResult,
        };
      } catch (postError) {
        /*
        NEVER mark REPLIED if Shopee posting fails.
        */

        console.warn(
          `[Bulk AI] Auto-post failed for ${review.id}:`,
          getErrorMessage(
            postError
          )
        );

        await db.review.update({
          where: {
            id: review.id,
          },
          data: {
            aiReply: finalReply,
            status: 'GENERATED',
          },
        });

        return {
          success: true,
          id: review.id,
          reply: finalReply,
          status: 'GENERATED',
          posted: false,
          postError:
            getErrorMessage(
              postError
            ),
        };
      }
    }

    /*
    --------------------------------------------------------
    1/2/3 STAR — MANUAL APPROVAL
    --------------------------------------------------------
    */

    await db.review.update({
      where: {
        id: review.id,
      },
      data: {
        aiReply: finalReply,
        status: 'GENERATED',
      },
    });

    console.log(
      `[Bulk AI] Saved for manual approval: ${review.id}`
    );

    return {
      success: true,
      id: review.id,
      reply: finalReply,
      status: 'GENERATED',
      posted: false,
    };
  } catch (error) {
    console.warn(
      `[Bulk AI] FAILED ${review?.id}:`,
      getErrorMessage(error)
    );

    return {
      success: false,
      id: review?.id,
      error:
        getErrorMessage(error),
    };
  }
}

/*
============================================================
BATCH PROCESSOR
============================================================
*/

async function processInBatches(
  candidates: any[],
  profileCache: Map<string, any>
) {
  const results: any[] = [];

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
      } — ${batch.length} review(s)`
    );

    const batchResults =
      await Promise.all(
        batch.map(
          (review) =>
            processReview(
              review,
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
  req: Request
) {
  try {
    let body: any = {};

    try {
      body =
        await req.json();
    } catch {
      body = {};
    }

    const ids =
      Array.isArray(body.ids)
        ? body.ids
        : [];

    const requestedLimit =
      Number(body.limit) > 0
        ? Number(body.limit)
        : null;

    const hasExplicitIds =
      ids.length > 0;

    const selectedBrand =
      body.brand ??
      body.brandName ??
      null;

    const isAllBrands =
      !selectedBrand ||
      String(selectedBrand)
        .trim()
        .toUpperCase() ===
        'ALL';

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
      '[Bulk AI] Requested IDs:',
      ids.length
    );

    console.log(
      '[Bulk AI] Limit:',
      requestedLimit
    );

    if (!isAllBrands) {
      console.log(
        '[Bulk AI] Brand filter:',
        selectedBrand
      );
    }

    /*
    ========================================================
    EXPLICIT IDS
    ========================================================
    */

    let candidates: any[] = [];

    if (hasExplicitIds) {
      const uniqueIds = [
        ...new Set(
          ids
            .filter(
              (id: unknown) =>
                typeof id === 'string' &&
                id.trim() !== ''
            )
            .map(
              (id: string) =>
                id.trim()
            )
        ),
      ];

      if (!uniqueIds.length) {
        return NextResponse.json({
          success: true,
          generated: 0,
          autoPosted: 0,
          manualApproval: 0,
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
              notIn: [
                'REPLIED',
                'GENERATED',
              ],
            },
          },
          take:
            requestedLimit ??
            uniqueIds.length,
        });
    }

    /*
    ========================================================
    FILTERED BULK
    ========================================================
    */

    else {
      const whereClause: any = {
        status: {
          notIn: [
            'GENERATED',
            'REPLIED',
          ],
        },
      };

      if (!isAllBrands) {
        whereClause.OR = [
          {
            brand: {
              contains:
                String(
                  selectedBrand
                ),
              mode: 'insensitive',
            },
          },
          {
            storeName: {
              contains:
                String(
                  selectedBrand
                ),
              mode: 'insensitive',
            },
          },
        ];
      }

      candidates =
        await db.review.findMany({
          where: whereClause,

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

    console.log(
      '[Bulk AI] Candidates:',
      candidates.length
    );

    if (!candidates.length) {
      return NextResponse.json({
        success: true,
        generated: 0,
        autoPosted: 0,
        manualApproval: 0,
        failed: 0,
        total: 0,
        errors: [],
      });
    }

    /*
    ========================================================
    PROCESS
    ========================================================
    */

    const profileCache =
      new Map<string, any>();

    const results =
      await processInBatches(
        candidates,
        profileCache
      );

    /*
    ========================================================
    RESULTS
    ========================================================
    */

    const successful =
      results.filter(
        (result) =>
          result.success === true
      );

    const failed =
      results.filter(
        (result) =>
          result.success !== true
      );

    const autoPosted =
      successful.filter(
        (result) =>
          result.status ===
            'REPLIED' &&
          result.posted === true
      );

    const manualApproval =
      successful.filter(
        (result) =>
          result.status ===
          'GENERATED'
      );

    const errors =
      failed.map(
        (result) => ({
          id: result.id,
          error: result.error,
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
      successful.length
    );

    console.log(
      '[Bulk AI] Auto-posted:',
      autoPosted.length
    );

    console.log(
      '[Bulk AI] Manual approval:',
      manualApproval.length
    );

    console.log(
      '[Bulk AI] Failed:',
      failed.length
    );

    console.log(
      '[Bulk AI] Total:',
      candidates.length
    );

    console.log(
      '================================================'
    );

    return NextResponse.json({
      success: true,

      generated:
        successful.length,

      autoPosted:
        autoPosted.length,

      manualApproval:
        manualApproval.length,

      failed:
        failed.length,

      total:
        candidates.length,

      errors,
    });
  } catch (error) {
    console.error(
      '[Bulk AI] FATAL ERROR:',
      getErrorMessage(error)
    );

    return NextResponse.json(
      {
        success: false,
        error:
          getErrorMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}