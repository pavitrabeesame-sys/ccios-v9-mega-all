import { prisma as db } from '@/lib/prisma';
import { askGroq } from '@/services/ai/GroqService';

/*
============================================================
CCIOS — REVIEW AI SERVICE
============================================================

Exports:
- loadBrandProfile
- generateReviewReply
- validateReply
- autoPostReply

AI FLOW:
1. Gemini primary
2. Groq fallback
3. Ollama fallback handled by GroqService

Supports:
- Brand profiles
- Brand voice
- Malaysian Malay
- Review topic detection
- Specificity validation
- 4/5 star auto-posting handled by caller
- 1/2/3 star manual approval handled by caller
- Natural paraphrasing
- Delivery/service/quality specificity
============================================================
*/


/*
============================================================
CONFIGURATION
============================================================
*/

const GEMINI_QUOTA_COOLDOWN_MS = 60 * 1000;


/*
============================================================
GLOBAL GEMINI STATE
============================================================
*/

const GLOBAL_STATE =
  globalThis.__CCIOS_GEMINI_STATE__ ||
  {
    quotaUntil: 0,
  };

globalThis.__CCIOS_GEMINI_STATE__ = GLOBAL_STATE;


function isGeminiQuotaBlocked() {
  return Date.now() < GLOBAL_STATE.quotaUntil;
}


function blockGeminiQuota() {
  GLOBAL_STATE.quotaUntil =
    Date.now() + GEMINI_QUOTA_COOLDOWN_MS;

  console.warn(
    '[ReviewAI] Gemini quota cooldown activated.'
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
BRAND REGISTRY
============================================================
*/

const BRAND_ALIASES = [
  {
    canonical: 'RAV Design',

    match: [
      'RAV',
      'RAV DESIGN',
    ],

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
    canonical: 'JOHN LANGFORD OF LONDON',

    match: [
      'JOHN LANGFORD',
      'JOHN LANGFORD OF LONDON',
      'LANGFORD',
    ],

    voice:
      'Classic, formal and sophisticated. Focus on timeless style, craftsmanship, refinement and distinguished quality.',
  },
];


/*
============================================================
NORMALIZE BRAND
============================================================
*/

function normalizeBrand(rawBrand) {
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

  for (const item of BRAND_ALIASES) {
    if (
      item.match.some(
        (match) =>
          cleaned.includes(match) ||
          match.includes(cleaned)
      )
    ) {
      return item.canonical;
    }
  }

  return (
    String(rawBrand)
      .replace(/\(.*?\)/g, '')
      .trim() ||
    'Our Store'
  );
}


/*
============================================================
DEFAULT BRAND VOICE
============================================================
*/

function getDefaultBrandVoice(brandName) {
  const brand = BRAND_ALIASES.find(
    (item) =>
      item.canonical.toLowerCase() ===
      String(brandName).toLowerCase()
  );

  return (
    brand?.voice ||
    'Professional, warm, natural and customer-focused.'
  );
}


/*
============================================================
BRAND KEYWORDS
============================================================
*/

function getBrandKeywords(brandName) {
  const brand = BRAND_ALIASES.find(
    (item) =>
      item.canonical.toLowerCase() ===
      String(brandName).toLowerCase()
  );

  if (!brand) {
    return [
      String(brandName).toLowerCase(),
    ];
  }

  return [
    brand.canonical.toLowerCase(),
    ...brand.match.map(
      (match) => match.toLowerCase()
    ),
  ];
}


/*
============================================================
LANGUAGE DETECTION
============================================================
*/

function detectLanguage(text) {
  const value = String(text || '').trim();

  if (!value) {
    return 'English';
  }

  /*
  ----------------------------------------------------------
  CHINESE
  ----------------------------------------------------------
  */

  if (/[\u4e00-\u9fff]/.test(value)) {
    return 'Simplified Chinese';
  }


  /*
  ----------------------------------------------------------
  MALAY
  ----------------------------------------------------------
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

  const lower = value.toLowerCase();

  const matches = malayWords.filter(
    (word) => lower.includes(word)
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

  const text = String(reviewText || '').toLowerCase();

  const sections = String(knowledgeBase)
    .split('===')
    .map((section) => section.trim())
    .filter(Boolean);

  if (!sections.length) {
    return String(knowledgeBase);
  }

  const keywords = [];


  /*
  ----------------------------------------------------------
  WARRANTY
  ----------------------------------------------------------
  */

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


  /*
  ----------------------------------------------------------
  SIZE
  ----------------------------------------------------------
  */

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


  /*
  ----------------------------------------------------------
  RETURN
  ----------------------------------------------------------
  */

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


  /*
  ----------------------------------------------------------
  DELIVERY
  ----------------------------------------------------------
  */

  if (
    text.includes('ship') ||
    text.includes('shipping') ||
    text.includes('delivery') ||
    text.includes('late') ||
    text.includes('slow') ||
    text.includes('penghantaran') ||
    text.includes('sampai') ||
    text.includes('courier') ||
    text.includes('parcel') ||
    text.includes('arrived') ||
    text.includes('delivered')
  ) {
    keywords.push(
      'shipping',
      'delivery',
      'sla',
      'penghantaran'
    );
  }


  /*
  ----------------------------------------------------------
  NO TOPIC
  ----------------------------------------------------------
  */

  if (!keywords.length) {
    return sections
      .slice(0, 5)
      .join('\n===\n');
  }


  /*
  ----------------------------------------------------------
  MATCH KNOWLEDGE
  ----------------------------------------------------------
  */

  const matched = sections.filter(
    (section) => {
      const lowerSection =
        section.toLowerCase();

      return keywords.some(
        (keyword) =>
          lowerSection.includes(keyword)
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
REVIEW TOPIC PHRASES
============================================================
*/

const REVIEW_TOPIC_PHRASES = {
  quality: [
    'quality',
    'kualiti',
    'berkualiti',
    'good quality',
    'great quality',
    'excellent quality',
    'high quality',
    'well made',
    'well-made',
    'made well',
    'good',
    'great',
    'excellent',
    'bagus',
    'baik',
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
    'soft fabric',
    'good material',
  ],

  design: [
    'design',
    'rekaan',
    'style',
    'stylish',
    'cantik',
    'elegant',
    'fashion',
    'look',
    'rupa',
    'beautiful design',
    'nice design',
    'kemas',
  ],

  fit: [
    'fit',
    'size',
    'sizing',
    'saiz',
    'kecil',
    'besar',
    'tight',
    'loose',
    'longgar',
    'ketat',
    'sleeve',
    'tangan',
    'alteration',
    'alter',
    'fits well',
    'good fit',
    'perfect fit',
  ],

  service: [
    'service',
    'servis',
    'seller',
    'penjual',
    'staff',
    'customer service',
    'helpful',
    'friendly',
    'response',
    'respon',
    'fast response',
    'good service',
    'great service',
    'layanan',
  ],

  delivery: [
    'delivery',
    'penghantaran',
    'shipping',
    'shipped',
    'ship',
    'sampai',
    'courier',
    'courier service',
    'pos',
    'parcel',
    'arrived',
    'arrival',
    'delivered',
    'received',
    'received my order',
    'received the order',
    'got my order',
    'order arrived',
    'arrived quickly',
    'arrived safely',
    'delivered quickly',
    'delivered safely',
    'delivered on time',
    'arrived on time',
    'on time delivery',
    'fast delivery',
    'quick delivery',
    'slow delivery',
    'late delivery',
  ],

  price: [
    'price',
    'harga',
    'murah',
    'berbaloi',
    'value',
    'worth',
    'worth it',
    'good value',
    'great value',
    'value for money',
    'berpatutan',
    'affordable',
  ],

  packaging: [
    'packaging',
    'pembungkusan',
    'package',
    'bungkusan',
    'packed',
    'well packed',
    'packed well',
    'securely packed',
    'good packaging',
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
    'comfortable to wear',
    'easy to wear',
  ],
};


/*
============================================================
REVIEW TOPICS
============================================================
*/

const REVIEW_TOPICS = {
  quality: [
    'quality',
    'kualiti',
    'berkualiti',
    'good quality',
    'great quality',
    'excellent quality',
    'high quality',
    'well made',
    'well-made',
    'bagus',
    'baik',
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
    'elegant',
    'fashion',
    'look',
    'rupa',
  ],

  fit: [
    'fit',
    'size',
    'sizing',
    'saiz',
    'kecil',
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
    'customer service',
    'response',
    'respon',
    'layanan',
  ],

  delivery: [
    'delivery',
    'penghantaran',
    'shipping',
    'shipped',
    'ship',
    'sampai',
    'courier',
    'pos',
    'parcel',
    'arrived',
    'arrival',
    'delivered',
    'received',
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
NORMALIZE TEXT
============================================================
*/

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(
      /[^\p{L}\p{N}\s'-]/gu,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}


/*
============================================================
PHRASE MATCH
============================================================
*/

function hasPhrase(text, phrase) {
  const normalizedText =
    normalizeText(text);

  const normalizedPhrase =
    normalizeText(phrase);

  if (
    !normalizedText ||
    !normalizedPhrase
  ) {
    return false;
  }

  return normalizedText.includes(
    normalizedPhrase
  );
}


/*
============================================================
DELIVERY CONTEXT
============================================================
*/

function hasDeliveryContext(review) {
  const text = normalizeText(review);

  const deliveryWords = [
    'delivery',
    'penghantaran',
    'shipping',
    'shipped',
    'courier',
    'parcel',
    'sampai',
    'arrived',
    'arrival',
    'delivered',
    'received',
    'order',
  ];

  const hasDeliveryWord =
    deliveryWords.some(
      (word) => text.includes(word)
    );

  if (hasDeliveryWord) {
    return true;
  }

  const contextualPatterns = [
    'cepat sampai',
    'lambat sampai',
    'cepat dihantar',
    'lambat dihantar',
    'cepat hantar',
    'lambat hantar',
    'cepat dapat',
    'lambat dapat',
  ];

  return contextualPatterns.some(
    (pattern) =>
      text.includes(pattern)
  );
}


/*
============================================================
DETECT REVIEW TOPICS
============================================================
*/

function detectReviewTopics(reviewText) {
  const review =
    normalizeText(reviewText);

  if (!review) {
    return [];
  }

  const detectedTopics = [];

  for (
    const [topic, keywords]
    of Object.entries(REVIEW_TOPICS)
  ) {
    if (
      keywords.some(
        (keyword) =>
          hasPhrase(review, keyword)
      )
    ) {
      detectedTopics.push(topic);
    }
  }

  if (
    !detectedTopics.includes('delivery') &&
    hasDeliveryContext(review)
  ) {
    detectedTopics.push('delivery');
  }

  if (
    detectedTopics.includes('delivery')
  ) {
    const strongDeliverySignals = [
      'delivery',
      'penghantaran',
      'shipping',
      'shipped',
      'courier',
      'parcel',
      'arrived',
      'arrival',
      'delivered',
      'received',
      'sampai',
      'dihantar',
    ];

    const hasStrongSignal =
      strongDeliverySignals.some(
        (signal) =>
          review.includes(signal)
      );

    if (!hasStrongSignal) {
      const deliveryIndex =
        detectedTopics.indexOf(
          'delivery'
        );

      detectedTopics.splice(
        deliveryIndex,
        1
      );
    }
  }

  return detectedTopics;
}


/*
============================================================
GET ADDRESSED TOPICS
============================================================
*/

function getAddressedTopics(
  reply,
  detectedTopics
) {
  const response =
    normalizeText(reply);

  if (
    !response ||
    !detectedTopics.length
  ) {
    return [];
  }

  const addressedTopics = [];

  for (
    const topic of detectedTopics
  ) {
    const phrases =
      REVIEW_TOPIC_PHRASES[topic] ||
      [];

    const directMatch =
      phrases.some(
        (phrase) =>
          hasPhrase(
            response,
            phrase
          )
      );

    if (directMatch) {
      addressedTopics.push(topic);
      continue;
    }

    if (topic === 'delivery') {
      const deliveryResponseSignals = [
        'arrived',
        'arrival',
        'delivered',
        'received',
        'order',
        'parcel',
        'courier',
        'shipping',
        'delivery',
        'penghantaran',
        'sampai',
        'dihantar',
        'pesanan',
      ];

      if (
        deliveryResponseSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'service') {
      const serviceResponseSignals = [
        'service',
        'servis',
        'seller',
        'staff',
        'customer service',
        'helpful',
        'friendly',
        'bantuan',
        'layanan',
        'respon',
        'response',
      ];

      if (
        serviceResponseSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'quality') {
      const qualitySignals = [
        'quality',
        'kualiti',
        'berkualiti',
        'good',
        'great',
        'excellent',
        'bagus',
        'baik',
        'well made',
        'made well',
      ];

      if (
        qualitySignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'design') {
      const designSignals = [
        'design',
        'rekaan',
        'style',
        'stylish',
        'cantik',
        'elegant',
        'beautiful',
        'fashion',
        'look',
      ];

      if (
        designSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'fabric') {
      const fabricSignals = [
        'fabric',
        'kain',
        'material',
        'bahan',
        'cotton',
        'leather',
        'kulit',
        'textile',
      ];

      if (
        fabricSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'fit') {
      const fitSignals = [
        'fit',
        'size',
        'sizing',
        'saiz',
        'fits well',
        'good fit',
        'perfect fit',
        'sesuai',
        'muat',
        'longgar',
        'ketat',
      ];

      if (
        fitSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'price') {
      const priceSignals = [
        'price',
        'harga',
        'value',
        'worth',
        'worth it',
        'value for money',
        'berbaloi',
        'berpatutan',
        'affordable',
        'murah',
      ];

      if (
        priceSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'packaging') {
      const packagingSignals = [
        'packaging',
        'pembungkusan',
        'package',
        'bungkusan',
        'packed',
        'well packed',
        'packed well',
        'securely packed',
      ];

      if (
        packagingSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
        continue;
      }
    }

    if (topic === 'comfort') {
      const comfortSignals = [
        'comfort',
        'comfortable',
        'selesa',
        'soft',
        'lembut',
        'lightweight',
        'ringan',
        'wearable',
      ];

      if (
        comfortSignals.some(
          (signal) =>
            response.includes(signal)
        )
      ) {
        addressedTopics.push(topic);
      }
    }
  }

  return addressedTopics;
}


/*
============================================================
GENERIC RESPONSE CHECK
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
      .replace(/\s+/g, ' ')
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
    'thank you for your feedback',
  ];

  const compact =
    normalized.replace(/\s+/g, '');

  for (
    const pattern of genericPatterns
  ) {
    const patternCompact =
      pattern.replace(
        /[^\p{L}\p{N}]/gu,
        ''
      );

    if (
      compact.includes(patternCompact) &&
      normalized.split(/\s+/).length <= 18
    ) {
      return true;
    }
  }

  return false;
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
    detectReviewTopics(review);

  if (!detectedTopics.length) {
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

  cleaned =
    cleaned.replace(
      /^(reply|response|customer reply|ai reply|final reply|final response)\s*:\s*/i,
      ''
    );

  cleaned =
    cleaned.replace(
      /^ai generated\s*:\s*/i,
      ''
    );

  return cleaned
    .replace(/\s+/g, ' ')
    .trim();
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
BRAND HEADER CHECK
============================================================
*/

function isBrandHeader(
  reply,
  brandName
) {
  const escapedBrand =
    String(brandName || '').replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

  return new RegExp(
    '^' +
      escapedBrand +
      '\\s*[:\\-]\\s*',
    'i'
  ).test(
    String(reply || '').trim()
  );
}


/*
============================================================
VALIDATE REPLY
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


  /*
  ----------------------------------------------------------
  MARKDOWN
  ----------------------------------------------------------
  */

  if (
    cleaned.includes('```') ||
    cleaned.includes('**') ||
    cleaned.includes('__')
  ) {
    return {
      valid: false,
      reason: 'Markdown detected.',
    };
  }


  /*
  ----------------------------------------------------------
  BRAND
  ----------------------------------------------------------
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
  ----------------------------------------------------------
  EMOJI
  ----------------------------------------------------------
  */

  if (
    !containsEmoji(cleaned)
  ) {
    cleaned = `${cleaned} 😊`;
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
  ----------------------------------------------------------
  PUNCTUATION
  ----------------------------------------------------------
  */

  const emojiRegex =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u;

  const emojiMatch =
    cleaned.match(emojiRegex);

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
  ----------------------------------------------------------
  LENGTH
  ----------------------------------------------------------
  */

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
        "Reply is too short for the customer's detailed review.",
    };
  }


  /*
  ----------------------------------------------------------
  INCOMPLETE SENTENCE
  ----------------------------------------------------------
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
    forbiddenEndings.has(lastWord)
  ) {
    return {
      valid: false,
      reason:
        `Response appears incomplete; ends with "${lastWord}".`,
    };
  }


  /*
  ----------------------------------------------------------
  MALAY SAFETY
  ----------------------------------------------------------
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
      lowerCleaned.includes(fragment)
    ) {
      return {
        valid: false,
        reason:
          `Unnatural/incomplete phrase detected: "${fragment}".`,
      };
    }
  }


  /*
  ----------------------------------------------------------
  SPECIFICITY
  ----------------------------------------------------------
  */

  const specificity =
    validateReviewSpecificity(
      cleaned,
      review?.reviewText
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

  const allowedBrandNames =
    getBrandKeywords(
      brandName
    );

  const replyLower =
    cleaned.toLowerCase();

  const hasBrandMatch =
    allowedBrandNames.some(
      (keyword) =>
        replyLower.includes(keyword)
    );

  if (!hasBrandMatch) {
    if (
      /^thank you\b/i.test(cleaned)
    ) {
      cleaned =
        cleaned.replace(
          /^thank you\b/i,
          `Thank you for choosing ${brandName}`
        );
    } else if (
      /^terima kasih\b/i.test(cleaned)
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


  /*
  ----------------------------------------------------------
  FINAL
  ----------------------------------------------------------
  */

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
  review,
  profileCache
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
    profileCache &&
    profileCache.has(cacheKey)
  ) {
    return profileCache.get(cacheKey);
  }

  try {
    const normalized =
      normalizeBrand(rawBrand);

    let brand =
      await db.brand.findFirst({
        where: {
          name: {
            equals: rawBrand,
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
              equals: normalized,
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

    if (profileCache) {
      profileCache.set(
        cacheKey,
        profile
      );
    }

    return profile;
  } catch (error) {
    console.warn(
      '[ReviewAI] Unable to load brand profile:',
      getErrorMessage(error)
    );

    if (profileCache) {
      profileCache.set(
        cacheKey,
        null
      );
    }

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
    Number(review?.rating) || 5;

  const brandName =
    normalizeBrand(
      review?.brand ||
        review?.storeName
    );

  const language =
    detectLanguage(reviewText);

  const detectedTopics =
    detectReviewTopics(reviewText);

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
      ? aiProfile.forbiddenWords.join(', ')
      : String(
          aiProfile?.forbiddenWords ||
            'None'
        );

  const knowledge =
    filterRelevantKnowledge(
      aiProfile?.knowledgeBase || '',
      reviewText
    );


  /*
  ----------------------------------------------------------
  NO WRITTEN COMMENT
  ----------------------------------------------------------
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
  ----------------------------------------------------------
  REQUIRED TOPICS
  ----------------------------------------------------------
  */

  const reviewWordCount =
    reviewText
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const requiredTopicCount =
    reviewWordCount >= 12
      ? Math.min(
          2,
          detectedTopics.length
        )
      : Math.min(
          1,
          detectedTopics.length
        );


  /*
  ----------------------------------------------------------
  MAIN PROMPT
  ----------------------------------------------------------
  */

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
${
  detectedTopics.length
    ? detectedTopics.join(', ')
    : 'No automatic topic detected'
}

Minimum meaningful topics to address:
${requiredTopicCount || 1}

============================================================
BRAND VOICE
============================================================

Default Brand Voice:
${getDefaultBrandVoice(brandName)}

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

For a short review:
- Address at least one meaningful customer detail.

For a detailed review:
- Address at least two meaningful customer details when appropriate.

Meaningful details include:
quality, fabric, material, design, fit, size, alteration, comfort, service, delivery, packaging, price, value, praise, concern, or another specific customer comment.

If the review contains both praise and a concern, acknowledge both naturally when appropriate.

IMPORTANT:
You do NOT need to repeat the customer's exact wording.

Naturally paraphrase the customer's meaning.

For example:

Customer:
"Delivery was very fast."

Good:
"We're glad your order arrived quickly."

Customer:
"Penghantaran sangat cepat."

Good:
"Kami gembira pesanan anda sampai dengan cepat."

Do NOT blindly copy the customer review.

============================================================
BRAND REQUIREMENT
============================================================

The exact brand name:

"${brandName}"

MUST appear naturally in the reply.

GOOD:
"Terima kasih kerana memilih ${brandName}! Kami gembira anda suka kualiti kain dan kemasan baju. 😊"

BAD:
"${brandName}: Thank you..."

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
- Use natural Malaysian ecommerce seller language.
- Use complete Malay sentences.
- Do not end sentences with incomplete words or fragments.

============================================================
STYLE
============================================================

- Natural ecommerce seller
- Warm
- Genuine
- Personal
- Professional
- Concise
- Human
- Usually 1–3 sentences
- 1–2 natural emojis
- No advertisement language

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
- guarantees

Only use information actually provided by the customer review or
the relevant knowledge base.

============================================================
OUTPUT RULES
============================================================

Return ONLY the final customer-facing reply.

No markdown.
No headings.
No bullet points.
No hashtags.
No quotation marks.

${
  isRetry
    ? `
============================================================
RETRY — PREVIOUS RESPONSE FAILED VALIDATION
============================================================

The previous response was rejected.

Reason:
${retryReason}

You MUST correct that exact problem.

Make the new response naturally address the customer's actual
detail instead of merely repeating generic thanks.

Do not repeat the previous response.

Return ONLY the corrected customer-facing reply.
`
    : ''
}
`.trim();
}


/*
============================================================
GEMINI
============================================================
*/

async function askGemini(prompt) {
  const apiKey =
    String(
      process.env.GEMINI_API_KEY || ''
    )
      .trim()
      .replace(/['"]/g, '');

  const model =
    String(
      process.env.GEMINI_MODEL ||
        'gemini-2.5-flash-lite'
    )
      .trim()
      .replace(/['"]/g, '');

  if (
    !apiKey ||
    apiKey === 'YOUR_GEMINI_API_KEY'
  ) {
    throw new Error(
      'Gemini API key is not configured.'
    );
  }

  const baseUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/';

  const url =
    baseUrl +
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
                text:
                  `
You write natural, personalized ecommerce customer review replies.
Return ONLY the final customer-facing reply.
No markdown, no explanation, no headers.
                  `.trim(),
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
GROQ / OLLAMA SAFE WRAPPER
============================================================

IMPORTANT FIX:

Do NOT require GROQ_API_KEY here.

GroqService owns the provider selection and Ollama fallback.

If askGroq() can use Ollama without a Groq key, this wrapper
must allow that path to execute.
============================================================
*/

async function askGroqSafe(prompt) {
  const reply = await askGroq(prompt, {
    skipGemini: true,
  });

  if (!reply || !String(reply).trim()) {
    throw new Error(
      'Groq/Ollama returned an empty response.'
    );
  }

  return String(reply).trim();
}


/*
============================================================
GENERATE REVIEW REPLY
============================================================
*/

async function generateReviewReply(
  review,
  options = {}
) {
  const reviewText =
    String(
      review?.reviewText || ''
    ).trim();


  /*
  ----------------------------------------------------------
  NO COMMENT
  ----------------------------------------------------------
  */

  if (!reviewText) {
    return getNoCommentTemplate(
      normalizeBrand(
        review?.brand ||
          review?.storeName
      ),
      Number(review?.rating) || 5
    );
  }


  /*
  ----------------------------------------------------------
  PROFILE
  ----------------------------------------------------------
  */

  let aiProfile =
    options?.aiProfile || null;

  if (!aiProfile) {
    aiProfile =
      await loadBrandProfile(
        review,
        options?.profileCache
      );
  }


  /*
  ----------------------------------------------------------
  GEMINI PRIMARY
  ----------------------------------------------------------
  */

  if (!isGeminiQuotaBlocked()) {
    try {
      console.log(
        '[ReviewAI] Trying Gemini'
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
        await askGemini(prompt);

      let validation =
        validateReply(
          rawReply,
          review
        );

      if (validation.valid) {
        console.log(
          '[ReviewAI] Gemini validated'
        );

        return validation.cleanedReply;
      }

      console.warn(
        '[ReviewAI] Gemini validation failed:',
        validation.reason
      );


      /*
      --------------------------------------------------------
      GEMINI RETRY
      --------------------------------------------------------
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
        await askGemini(
          retryPrompt
        );

      validation =
        validateReply(
          retryReply,
          review
        );

      if (validation.valid) {
        console.log(
          '[ReviewAI] Gemini retry validated'
        );

        return validation.cleanedReply;
      }

      console.warn(
        '[ReviewAI] Gemini retry validation failed:',
        validation.reason
      );
    } catch (error) {
      console.warn(
        '[ReviewAI] Gemini failed:',
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
      '[ReviewAI] Gemini skipped — cooldown active'
    );
  }


  /*
  ----------------------------------------------------------
  GROQ / OLLAMA FALLBACK
  ----------------------------------------------------------
  */

  try {
    console.log(
      '[ReviewAI] Trying Groq/Ollama fallback'
    );

    const prompt =
      buildPrompt(
        review,
        aiProfile,
        {
          isRetry: true,

          retryReason:
            'Generate a fresh response that follows all personalization, brand and topic rules perfectly.',
        }
      );

    const rawReply =
      await askGroqSafe(prompt);

    const validation =
      validateReply(
        rawReply,
        review
      );

    if (validation.valid) {
      console.log(
        '[ReviewAI] Groq/Ollama validated'
      );

      return validation.cleanedReply;
    }

    throw new Error(
      `Groq/Ollama validation failed: ${validation.reason}`
    );
  } catch (error) {
    console.warn(
      '[ReviewAI] Groq/Ollama failed:',
      getErrorMessage(error)
    );

    throw error;
  }
}


/*
============================================================
APP URL
============================================================
*/

function getAppUrl() {
  const configuredUrl =
    String(
      process.env.NEXT_PUBLIC_APP_URL || ''
    ).trim();

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/+$/,
      ''
    );
  }

  return (
    'https://ccios-v9-mega-all.vercel.app'
  );
}


/*
============================================================
AUTO POST SHOPEE REPLY
============================================================
*/

async function autoPostReply(
  review,
  reply
) {
  if (!review) {
    throw new Error(
      'Cannot auto-post without a review.'
    );
  }

  if (
    !reply ||
    !String(reply).trim()
  ) {
    throw new Error(
      'Cannot auto-post an empty reply.'
    );
  }


  /*
  ----------------------------------------------------------
  SHOPEE COMMENT ID
  ----------------------------------------------------------
  */

  const commentId =
    review.reviewId ??
    review.commentId ??
    review.shopeeCommentId ??
    review.comment_id ??
    review.shopee_comment_id ??
    null;

  if (
    commentId === null ||
    commentId === undefined ||
    String(commentId).trim() === ''
  ) {
    throw new Error(
      `No Shopee comment ID found for review ${review.id}.`
    );
  }

  const numericCommentId =
    Number(commentId);

  if (
    !Number.isFinite(
      numericCommentId
    ) ||
    numericCommentId <= 0
  ) {
    throw new Error(
      `Invalid Shopee comment ID "${commentId}" for review ${review.id}.`
    );
  }

  const appUrl =
    getAppUrl();

  const endpoint =
    `${appUrl}/api/shopee/reply-comment`;

  console.log(
    `[ReviewAI] Auto-posting review ${review.id}, comment ${numericCommentId}`
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
          commentId:
            numericCommentId,

          comment:
            String(reply).trim(),
        }),

        cache: 'no-store',
      }
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Shopee reply API responded with status ${response.status}: ${responseText}`
    );
  }

  console.log(
    `[ReviewAI] Successfully auto-posted comment ${numericCommentId}`
  );

  return true;
}


/*
============================================================
PUBLIC EXPORTS
============================================================
*/

export {
  loadBrandProfile,
  generateReviewReply,
  validateReply,
  autoPostReply,
};