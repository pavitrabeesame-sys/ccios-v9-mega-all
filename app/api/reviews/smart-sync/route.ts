import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

/*
============================================================
CCIOS — SMART REVIEW SYNC ENGINE
SHOPEE + LAZADA
2026 PRODUCTION

CURRENT STATUS:
- SHOPEE: ENABLED
- LAZADA: DISABLED / ON HOLD
============================================================
*/

/*
============================================================
SHOPEE CONFIG
============================================================
*/

const SHOPEE_PARTNER_ID = String(
  process.env.SHOPEE_PARTNER_ID || ''
)
  .trim()
  .replace(/['"]/g, '');

const SHOPEE_PARTNER_KEY = String(
  process.env.SHOPEE_PARTNER_KEY || ''
)
  .trim()
  .replace(/['"]/g, '');

const SHOPEE_HOST = (
  process.env.SHOPEE_HOST ||
  'https://partner.shopeemobile.com'
).replace(/\/$/, '');

const SHOPEE_COMMENT_PATH =
  '/api/v2/product/get_comment';

const SHOPEE_TOKEN_PATH =
  '/api/v2/auth/access_token/get';

/*
============================================================
AUTHORITATIVE SHOPEE BRAND MAPPING
============================================================
*/

const SHOPEE_BRAND_MAPPING = {
  '115383763': {
    name: 'RAV Design',
    code: 'RAV',
  },

  '469553987': {
    name: 'Obermain',
    code: 'OBERMAIN',
  },

  '282544493': {
    name: 'Hush Puppies',
    code: 'HUSH_PUPPIES',
  },

  '170808053': {
    name: 'John Langford',
    code: 'JOHN_LANGFORD',
  },

  '170811257': {
    name: 'Beverly Hills Polo Club',
    code: 'BHPC',
  },

  '66854646': {
    name: 'Nicole Collection',
    code: 'NICOLE',
  },
};

/*
============================================================
SHOPEE STORE NAMES
============================================================
*/

const SHOPEE_STORE_MAPPING = {
  '115383763':
    'RAV Design Official Store (115383763)',

  '469553987':
    'OBERMAIN Official Store (469553987)',

  '282544493':
    'HUSH Official Store (282544493)',

  '170808053':
    'JOHN LANGFORD Official Store (170808053)',

  '170811257':
    'BHPC Official Store (170811257)',

  '66854646':
    'NICOLE Official Store (66854646)',
};

/*
============================================================
BRAND ALIASES
============================================================
*/

const BRAND_ALIASES = {
  rav: 'RAV',
  'rav design': 'RAV',

  obermain: 'OBERMAIN',

  hush: 'HUSH_PUPPIES',
  'hush puppies': 'HUSH_PUPPIES',
  hush_puppies: 'HUSH_PUPPIES',

  bhpc: 'BHPC',
  'beverly hills polo club': 'BHPC',

  john_langford: 'JOHN_LANGFORD',
  'john langford': 'JOHN_LANGFORD',

  nicole: 'NICOLE',
  'nicole collection': 'NICOLE',
};

/*
============================================================
LAZADA CONFIG
============================================================
*/

const LAZADA_APP_KEY = String(
  process.env.LAZADA_APP_KEY || ''
).trim();

const LAZADA_APP_SECRET = String(
  process.env.LAZADA_APP_SECRET || ''
).trim();

const LAZADA_HOST = (
  process.env.LAZADA_HOST ||
  'https://api.lazada.com.my/rest'
).replace(/\/$/, '');

/*
============================================================
LAZADA SYNC FEATURE FLAG
============================================================
*/

const LAZADA_SYNC_ENABLED = false;

/*
============================================================
LAZADA BRAND MAPPING
============================================================
*/

const LAZADA_BRAND_MAPPING = {
  '300934544102': {
    name: 'Beverly Hills Polo Club',
    code: 'BHPC',
  },

  '300763632066': {
    name: 'Hush Puppies',
    code: 'HUSH_PUPPIES',
  },

  '300749392344': {
    name: 'Obermain',
    code: 'OBERMAIN',
  },

  '100164017': {
    name: 'Nicole',
    code: 'NICOLE',
  },

  '1000055891': {
    name: 'RAV',
    code: 'RAV',
  },
};

/*
============================================================
DATE RANGE
============================================================
*/

const START_2026_SEC = Math.floor(
  new Date(
    '2026-01-01T00:00:00.000Z'
  ).getTime() / 1000
);

const START_2027_SEC = Math.floor(
  new Date(
    '2027-01-01T00:00:00.000Z'
  ).getTime() / 1000
);

const START_2026_MS =
  START_2026_SEC * 1000;

const START_2027_MS =
  START_2027_SEC * 1000;

/*
============================================================
SYNC SETTINGS
============================================================
*/

const SHOPEE_PAGE_SIZE = 50;
const MAX_SHOPEE_PAGES = 100;

const LAZADA_PRODUCT_LIMIT = 50;
const MAX_LAZADA_PRODUCT_PAGES = 20;

const LAZADA_REVIEW_PAGE_SIZE = 50;
const MAX_LAZADA_REVIEW_PAGES = 20;

const REQUEST_TIMEOUT_MS = 15000;

const LAZADA_RETRY_LIMIT = 3;

/*
============================================================
UTILITIES
============================================================
*/

function getErrorMessage(error: unknown) {
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

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
) {
  const controller =
    new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(
  response: Response
) {
  const text =
    await response.text();

  let data: any = null;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON response: ${text.slice(
        0,
        1000
      )}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

/*
============================================================
BRAND FILTER
============================================================
*/

function normalizeBrandFilter(
  brand: unknown
) {
  if (!brand) {
    return null;
  }

  const normalized = String(brand)
    .trim()
    .toLowerCase();

  return (
    BRAND_ALIASES[
      normalized as keyof typeof BRAND_ALIASES
    ] ||
    normalized.toUpperCase()
  );
}

function brandMatches(
  requestedBrand: unknown,
  brandInfo: {
    name: string;
    code: string;
  }
) {
  if (!requestedBrand) {
    return true;
  }

  const normalized =
    normalizeBrandFilter(
      requestedBrand
    );

  const brandNameCode =
    brandInfo.name
      .toUpperCase()
      .replace(/\s+/g, '_');

  return (
    normalized === brandInfo.code ||
    normalized === brandNameCode ||
    normalized ===
      brandInfo.name.toUpperCase()
  );
}

/*
============================================================
SHOPEE SIGNATURE
============================================================
*/

function signShopee(
  baseString: string
) {
  if (!SHOPEE_PARTNER_KEY) {
    throw new Error(
      'SHOPEE_PARTNER_KEY is missing.'
    );
  }

  return crypto
    .createHmac(
      'sha256',
      SHOPEE_PARTNER_KEY
    )
    .update(baseString)
    .digest('hex');
}

/*
============================================================
SHOPEE TOKEN REFRESH
============================================================
*/

async function refreshShopeeAccessToken(
  account: any
) {
  if (!account.refreshToken) {
    throw new Error(
      `No Shopee refresh token for shop ${account.shopId}.`
    );
  }

  const timestamp =
    Math.floor(
      Date.now() / 1000
    );

  const baseString =
    `${SHOPEE_PARTNER_ID}` +
    `${SHOPEE_TOKEN_PATH}` +
    `${timestamp}`;

  const sign =
    signShopee(baseString);

  const url = new URL(
    SHOPEE_HOST +
      SHOPEE_TOKEN_PATH
  );

  url.searchParams.set(
    'partner_id',
    SHOPEE_PARTNER_ID
  );

  url.searchParams.set(
    'timestamp',
    String(timestamp)
  );

  url.searchParams.set(
    'sign',
    sign
  );

  const response =
    await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          refresh_token:
            account.refreshToken,

          shop_id:
            Number(account.shopId),

          partner_id:
            Number(
              SHOPEE_PARTNER_ID
            ),
        }),
      }
    );

  const data =
    await parseJsonResponse(
      response
    );

  if (!data?.access_token) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Shopee token refresh failed: ${JSON.stringify(
          data
        )}`
    );
  }

  const updated =
    await db.shopeeAccount.update({
      where: {
        id: account.id,
      },

      data: {
        accessToken:
          data.access_token,

        refreshToken:
          data.refresh_token ||
          account.refreshToken,

        updatedAt:
          new Date(),
      },
    });

  account.accessToken =
    updated.accessToken;

  account.refreshToken =
    updated.refreshToken;

  return updated.accessToken;
}

/*
============================================================
SHOPEE GET
============================================================
*/

async function shopeeFetchGet(
  account: any,
  path: string,
  params: Record<string, unknown> = {}
) {
  let accessToken =
    account.accessToken;

  if (!accessToken) {
    throw new Error(
      `No Shopee access token for shop ${account.shopId}.`
    );
  }

  const shopId =
    String(account.shopId);

  for (
    let attempt = 0;
    attempt < 2;
    attempt++
  ) {
    const timestamp =
      Math.floor(
        Date.now() / 1000
      );

    const baseString =
      `${SHOPEE_PARTNER_ID}` +
      `${path}` +
      `${timestamp}` +
      `${accessToken}` +
      `${shopId}`;

    const sign =
      signShopee(baseString);

    const url = new URL(
      SHOPEE_HOST + path
    );

    url.searchParams.set(
      'partner_id',
      SHOPEE_PARTNER_ID
    );

    url.searchParams.set(
      'timestamp',
      String(timestamp)
    );

    url.searchParams.set(
      'sign',
      sign
    );

    url.searchParams.set(
      'access_token',
      accessToken
    );

    url.searchParams.set(
      'shop_id',
      shopId
    );

    for (
      const [key, value] of Object.entries(
        params
      )
    ) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        url.searchParams.set(
          key,
          String(value)
        );
      }
    }

    const response =
      await fetchWithTimeout(
        url.toString()
      );

    const data =
      await parseJsonResponse(
        response
      );

    const errorText =
      String(
        data?.error ||
          data?.message ||
          ''
      ).toLowerCase();

    const tokenError =
      errorText.includes(
        'access_token'
      ) ||
      errorText.includes(
        'access token'
      ) ||
      errorText.includes(
        'invalid token'
      ) ||
      errorText.includes(
        'token expired'
      );

    if (
      attempt === 0 &&
      tokenError &&
      account.refreshToken
    ) {
      accessToken =
        await refreshShopeeAccessToken(
          account
        );

      continue;
    }

    return data;
  }

  throw new Error(
    'Shopee request failed after token refresh retry.'
  );
}

/*
============================================================
PRODUCT CACHE
============================================================
*/

const shopeeProductCache =
  new Map<
    string,
    {
      name: string;
      sku: string | null;
    }
  >();

async function resolveShopeeProduct(
  account: any,
  itemId: unknown,
  itemSku: unknown
) {
  const sku = String(itemSku || '').trim();
  const id = String(itemId || '').trim();

  const cacheKey = sku ? `sku:${sku}` : id ? `id:${id}` : 'unknown';

  if (shopeeProductCache.has(cacheKey)) {
    return shopeeProductCache.get(cacheKey)!;
  }

  let result: { name: string; sku: string | null } | null = null;

  // 1. Check local database product table by SKU
  if (sku) {
    const product = await db.product.findFirst({ where: { sku } });
    if (product) {
      result = { name: product.name, sku: product.sku || sku };
    }
  }

  // 2. Check local database product table by Shopee Item ID
  if (!result && id && /^\d+$/.test(id)) {
    try {
      const product = await db.product.findFirst({
        where: { shopeeItemId: BigInt(id) },
      });
      if (product) {
        result = { name: product.name, sku: product.sku || sku || null };
      }
    } catch (error) {
      console.warn('[Smart Sync] Local product lookup failed:', getErrorMessage(error));
    }
  }

  // 3. Fallback: Call Shopee Item Base Info API directly to get the real product name
  if (!result && id && /^\d+$/.test(id)) {
    try {
      const itemRes = await shopeeFetchGet(account, '/api/v2/product/get_item_base_info', {
        item_id_list: JSON.stringify([Number(id)])
      });

      const itemInfo = itemRes?.response?.item_list?.[0];
      if (itemInfo?.item_name) {
        result = {
          name: itemInfo.item_name,
          sku: itemInfo.item_sku || sku || null,
        };
      }
    } catch (apiError) {
      console.warn(`[Smart Sync] Failed to fetch item name from Shopee API for item ${id}:`, getErrorMessage(apiError));
    }
  }

  // 4. Final Fallback placeholder if all lookups fail
  if (!result) {
    result = {
      name: id ? `Shopee Product ${id}` : 'Unknown Product',
      sku: sku || null,
    };
  }

  shopeeProductCache.set(cacheKey, result);
  return result;
}

/*
============================================================
SHOPEE SYNC
============================================================
*/

async function syncShopeeAccount(
  account: any
) {
  const shopId =
    String(account.shopId);

  const brandInfo =
    SHOPEE_BRAND_MAPPING[
      shopId as keyof typeof SHOPEE_BRAND_MAPPING
    ];

  if (!brandInfo) {
    throw new Error(
      `Shop ${shopId} is not configured in the authoritative Shopee mapping.`
    );
  }

  if (!account.accessToken) {
    throw new Error(
      `No Shopee access token for shop ${shopId}.`
    );
  }

  const storeName =
    SHOPEE_STORE_MAPPING[
      shopId as keyof typeof SHOPEE_STORE_MAPPING
    ] ||
    account.shopName ||
    `Shopee Shop (${shopId})`;

  let cursor = '';
  let hasMore = true;

  let pages = 0;
  let synced = 0;
  let seen = 0;
  let skipped = 0;

  let reached2026 = false;

  while (
    hasMore &&
    pages <
      MAX_SHOPEE_PAGES &&
    !reached2026
  ) {
    pages++;

    console.log(
      `[Smart Sync][Shopee] ${shopId} ${brandInfo.name} — page ${pages}`
    );

    const response =
      await shopeeFetchGet(
        account,
        SHOPEE_COMMENT_PATH,
        {
          page_size:
            SHOPEE_PAGE_SIZE,

          ...(cursor
            ? { cursor }
            : {}),
        }
      );

    if (response?.error) {
      throw new Error(
        `Shopee API error: ${JSON.stringify(
          response
        )}`
      );
    }

    const apiResponse =
      response?.response || {};

    const comments =
      Array.isArray(
        apiResponse.item_comment_list
      )
        ? apiResponse.item_comment_list
        : [];

    if (!comments.length) {
      break;
    }

    for (
      const comment of comments
    ) {
      seen++;

      const reviewId =
        comment?.comment_id;

      if (
        reviewId === null ||
        reviewId === undefined
      ) {
        skipped++;
        continue;
      }

      const createTime =
        Number(
          comment.create_time ??
            comment.comment_time ??
            0
        );

      if (!createTime) {
        skipped++;
        continue;
      }

      if (
        createTime <
        START_2026_SEC
      ) {
        reached2026 = true;
        break;
      }

      if (
        createTime >=
        START_2027_SEC
      ) {
        skipped++;
        continue;
      }

      const reviewIdString =
        String(reviewId);

      const customerName =
        String(
          comment.buyer_username ||
            comment.author_username ||
            comment.username ||
            'Anonymous Shopee Buyer'
        ).trim();

      const rating =
        Number(
          comment.rating_star ??
            comment.rating ??
            5
        ) || 5;

      const reviewText =
        String(
          comment.comment ||
            comment.review_text ||
            ''
        ).trim();

      const itemId =
        comment.item_id ??
        comment.item?.item_id ??
        null;

      const itemSku =
        String(
          comment.model_name ??
            comment.item_sku ??
            comment.model_sku ??
            ''
        ).trim();

      const product = await resolveShopeeProduct(
        account, // <-- Ensure account is passed here
        itemId,
        itemSku
      );

      await db.review.upsert({
  where: {
    marketplace_shopId_reviewId: {
      marketplace: 'SHOPEE',
      shopId: BigInt(shopId),
      reviewId: reviewIdString,
    },
  },

  update: {
          rating,

          reviewText,

          customerName,

          brand:
            brandInfo.name,

          shopId:
            BigInt(shopId),

          storeName,

          productName:
            product.name,

          productSku:
            product.sku,

          ...(comment.order_sn
            ? {
                orderNumber:
                  String(
                    comment.order_sn
                  ),
              }
            : {}),

          updatedAt:
            new Date(),
        },

        create: {
          reviewId:
            reviewIdString,

          marketplace:
            'SHOPEE',

          storeName,

          brand:
            brandInfo.name,

          shopId:
            BigInt(shopId),

          customerName,

          rating,

          reviewText,

          productName:
            product.name,

          productSku:
            product.sku,

          orderNumber:
            comment.order_sn
              ? String(
                  comment.order_sn
                )
              : null,

          status:
            'PENDING',

          createdAt:
            new Date(
              createTime * 1000
            ),
        },
      });

      synced++;
    }

    if (reached2026) {
      break;
    }

    hasMore =
      apiResponse.more === true;

    cursor =
      apiResponse.next_cursor ||
      apiResponse.nextCursor ||
      '';

    if (
      hasMore &&
      !cursor
    ) {
      console.warn(
        `[Smart Sync][Shopee] more=true but no cursor returned for ${shopId}.`
      );

      break;
    }
  }

  return {
    marketplace:
      'SHOPEE',

    shopId,

    brand:
      brandInfo.name,

    code:
      brandInfo.code,

    storeName,

    synced,

    seen,

    skipped,

    pages,

    reached2026,

    hasMore,
  };
}

/*
============================================================
LAZADA SIGNING
============================================================
*/

function generateLazadaSign(
  apiPath: string,
  params: Record<string, any>,
  appSecret: string
) {
  if (!appSecret) {
    throw new Error(
      'LAZADA_APP_SECRET is missing.'
    );
  }

  const sortedKeys =
    Object.keys(params).sort();

  let baseString =
    apiPath;

  for (
    const key of sortedKeys
  ) {
    const value =
      params[key];

    if (
      value !== null &&
      value !== undefined
    ) {
      baseString +=
        key +
        String(value);
    }
  }

  return crypto
    .createHmac(
      'sha256',
      appSecret
    )
    .update(baseString)
    .digest('hex')
    .toUpperCase();
}

/*
============================================================
LAZADA GET
============================================================
*/

async function lazadaFetchGet(
  account: any,
  apiPath: string,
  params: Record<string, any> = {}
) {
  if (!LAZADA_APP_KEY) {
    throw new Error(
      'LAZADA_APP_KEY is missing.'
    );
  }

  if (!LAZADA_APP_SECRET) {
    throw new Error(
      'LAZADA_APP_SECRET is missing.'
    );
  }

  if (!account.accessToken) {
    throw new Error(
      `No Lazada access token for seller ${account.sellerId}.`
    );
  }

  const allParams: Record<string, any> = {
    app_key:
      LAZADA_APP_KEY,

    timestamp:
      String(Date.now()),

    sign_method:
      'sha256',

    access_token:
      account.accessToken,

    ...params,
  };

  const sign =
    generateLazadaSign(
      apiPath,
      allParams,
      LAZADA_APP_SECRET
    );

  allParams.sign =
    sign;

  const url = new URL(
    LAZADA_HOST +
      apiPath
  );

  for (
    const [key, value] of Object.entries(
      allParams
    )
  ) {
    if (
      value !== null &&
      value !== undefined
    ) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  const response =
    await fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',

        headers: {
          Accept:
            'application/json',
        },
      }
    );

  return parseJsonResponse(
    response
  );
}

/*
============================================================
LAZADA GET WITH RETRY
============================================================
*/

async function lazadaFetchGetWithRetry(
  account: any,
  apiPath: string,
  params: Record<string, any> = {},
  maxRetries = LAZADA_RETRY_LIMIT
) {
  let lastResult = null;

  for (
    let attempt = 0;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      const result =
        await lazadaFetchGet(
          account,
          apiPath,
          params
        );

      lastResult =
        result;

      const code =
        String(
          result?.code ?? ''
        );

      const message =
        String(
          result?.message ||
            result?.error ||
            ''
        ).toLowerCase();

      const rateLimited =
        code ===
          'ApiCallLimit' ||
        message.includes(
          'limit'
        ) ||
        message.includes(
          'too many'
        );

      if (!rateLimited) {
        return result;
      }

      if (
        attempt >=
        maxRetries
      ) {
        return result;
      }

      await sleep(
        1000 *
          Math.pow(
            2,
            attempt
          )
      );
    } catch (error) {
      if (
        attempt >=
        maxRetries
      ) {
        throw error;
      }

      await sleep(
        1000 *
          Math.pow(
            2,
            attempt
          )
      );
    }
  }

  return lastResult;
}

/*
============================================================
LAZADA PRODUCT EXTRACTION
============================================================
*/

function extractLazadaProducts(
  response: any
) {
  const products =
    response?.data?.products;

  return Array.isArray(
    products
  )
    ? products
    : [];
}

/*
============================================================
LAZADA PRODUCT PAGINATION
============================================================
*/

async function fetchAllLazadaProducts(
  account: any
) {
  const allProducts: any[] = [];

  let offset = 0;

  for (
    let page = 0;
    page <
      MAX_LAZADA_PRODUCT_PAGES;
    page++
  ) {
    const response =
      await lazadaFetchGetWithRetry(
        account,
        '/products/get',
        {
          filter:
            'live',

          limit:
            String(
              LAZADA_PRODUCT_LIMIT
            ),

          offset:
            String(offset),
        }
      );

    const products =
      extractLazadaProducts(
        response
      );

    if (!products.length) {
      break;
    }

    allProducts.push(
      ...products
    );

    if (
      products.length <
      LAZADA_PRODUCT_LIMIT
    ) {
      break;
    }

    offset +=
      products.length;
  }

  return allProducts;
}

/*
============================================================
LAZADA DATE PARSER
============================================================
*/

function getLazadaReviewTimestamp(
  review: any
) {
  const raw =
    review?.review_time ??
    review?.created_at ??
    review?.create_time ??
    review?.date ??
    null;

  if (
    raw === null ||
    raw === undefined ||
    raw === ''
  ) {
    return 0;
  }

  if (
    typeof raw ===
    'number'
  ) {
    return raw < 10000000000
      ? raw * 1000
      : raw;
  }

  const numeric =
    Number(raw);

  if (
    Number.isFinite(
      numeric
    ) &&
    numeric > 0
  ) {
    return numeric <
      10000000000
      ? numeric * 1000
      : numeric;
  }

  const parsed =
    Date.parse(
      String(raw)
    );

  return Number.isNaN(
    parsed
  )
    ? 0
    : parsed;
}

/*
============================================================
LAZADA REVIEW ID
============================================================
*/

function createStableLazadaReviewId(
  review: any,
  itemId: any
) {
  const directId =
    review?.id ??
    review?.review_id ??
    review?.reviewId;

  if (
    directId !== null &&
    directId !== undefined &&
    String(directId).trim()
  ) {
    return String(
      directId
    ).trim();
  }

  const raw =
    JSON.stringify({
      itemId:
        String(
          itemId || ''
        ),

      buyer:
        review?.buyer_name ||
        review?.buyer_username ||
        '',

      content:
        review?.review_content ||
        review?.review ||
        '',

      time:
        review?.review_time ||
        review?.created_at ||
        review?.create_time ||
        '',

      rating:
        review?.ratings
          ?.product_rating ??
        review?.rating ??
        '',
    });

  const hash =
    crypto
      .createHash('sha256')
      .update(raw)
      .digest('hex');

  return `LAZADA_${itemId || 'UNKNOWN'}_${hash}`;
}

/*
============================================================
LAZADA REVIEW GROUP EXTRACTION
============================================================
*/

function extractLazadaReviewGroups(
  response: any
) {
  const data =
    response?.data?.data;

  return Array.isArray(data)
    ? data
    : [];
}

/*
============================================================
LAZADA REVIEW PAGINATION
============================================================
*/

async function fetchAllLazadaReviewsForItem(
  account: any,
  itemId: any
) {
  const allReviews: any[] = [];

  for (
    let current = 1;
    current <=
    MAX_LAZADA_REVIEW_PAGES;
    current++
  ) {
    const response =
      await lazadaFetchGetWithRetry(
        account,
        '/review/seller/list',
        {
          item_id:
            String(itemId),

          page_size:
            String(
              LAZADA_REVIEW_PAGE_SIZE
            ),

          current:
            String(current),
        }
      );

    if (
      String(
        response?.code ?? ''
      ) !== '0'
    ) {
      break;
    }

    const groups =
      extractLazadaReviewGroups(
        response
      );

    if (!groups.length) {
      break;
    }

    let countThisPage = 0;

    for (
      const group of groups
    ) {
      const reviews =
        Array.isArray(
          group?.reviews
        )
          ? group.reviews
          : [];

      allReviews.push(
        ...reviews
      );

      countThisPage +=
        reviews.length;
    }

    if (
      countThisPage <
      LAZADA_REVIEW_PAGE_SIZE
    ) {
      break;
    }
  }

  return allReviews;
}

/*
============================================================
LAZADA SYNC
============================================================
*/

async function syncLazadaAccount(
  account: any
) {
  const sellerId =
    String(account.sellerId);

  const brandInfo =
    LAZADA_BRAND_MAPPING[
      sellerId as keyof typeof LAZADA_BRAND_MAPPING
    ] || {
      name:
        'Unassigned',

      code:
        'UNASSIGNED',
    };

  if (!account.accessToken) {
    return {
      marketplace:
        'LAZADA',

      sellerId,

      brand:
        brandInfo.name,

      code:
        brandInfo.code,

      synced: 0,

      seen: 0,

      skipped: 0,

      products: 0,

      error:
        'Missing access token.',
    };
  }

  let synced = 0;
  let seen = 0;
  let skipped = 0;

  const products =
    await fetchAllLazadaProducts(
      account
    );

  for (
    const product of products
  ) {
    const itemId =
      product?.item_id;

    if (!itemId) {
      continue;
    }

    const productName =
      product?.attributes
        ?.name ||
      product?.name ||
      `Lazada Product ${itemId}`;

    const productSku =
      product?.skus?.[0]
        ?.seller_sku ||
      null;

    const reviews =
      await fetchAllLazadaReviewsForItem(
        account,
        itemId
      );

    for (
      const review of reviews
    ) {
      seen++;

      const timestamp =
        getLazadaReviewTimestamp(
          review
        );

      if (
        timestamp &&
        timestamp <
          START_2026_MS
      ) {
        skipped++;
        continue;
      }

      if (
        timestamp &&
        timestamp >=
          START_2027_MS
      ) {
        skipped++;
        continue;
      }

      const reviewId =
        createStableLazadaReviewId(
          review,
          itemId
        );

      const customerName =
        String(
          review?.buyer_name ||
            review?.buyer_username ||
            'Anonymous Lazada Buyer'
        ).trim();

      const rating =
        Number(
          review?.ratings
            ?.product_rating ??
            review?.rating ??
            5
        ) || 5;

      const reviewText =
        String(
          review?.review_content ||
            review?.review ||
            review?.comment ||
            ''
        ).trim();

      await db.review.upsert({
        where: {
          reviewId,
        },

        update: {
          rating,

          reviewText,

          customerName,

          brand:
            brandInfo.name,

          storeName:
            brandInfo.name,

          productName,

          productSku,

          updatedAt:
            new Date(),
        },

        create: {
          reviewId,

          marketplace:
            'LAZADA',

          storeName:
            brandInfo.name,

          brand:
            brandInfo.name,

          customerName,

          rating,

          reviewText,

          productName,

          productSku,

          status:
            'PENDING',

          createdAt:
            timestamp
              ? new Date(
                  timestamp
                )
              : new Date(),
        },
      });

      synced++;
    }
  }

  return {
    marketplace:
      'LAZADA',

    sellerId,

    brand:
      brandInfo.name,

    code:
      brandInfo.code,

    synced,

    seen,

    skipped,

    products:
      products.length,
  };
}

/*
============================================================
POST
============================================================
*/

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    let body: any = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const requestedBrand =
      body?.brand ||
      null;

    const requestedMarketplace =
      body?.marketplace
        ? String(
            body.marketplace
          )
            .trim()
            .toUpperCase()
        : null;

    if (
      requestedMarketplace &&
      ![
        'SHOPEE',
        'LAZADA',
      ].includes(
        requestedMarketplace
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Unsupported marketplace "${requestedMarketplace}". Use SHOPEE or LAZADA.`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedMarketplace ===
        'LAZADA' &&
      !LAZADA_SYNC_ENABLED
    ) {
      return NextResponse.json(
        {
          success: true,

          message:
            'Lazada Smart Sync is currently disabled and on hold pending approval.',

          requestedBrand,

          requestedMarketplace,

          syncedCount: 0,

          breakdown: {
            shopee: 0,
            lazada: 0,
            total: 0,
          },

          shopeeResults: [],

          lazadaResults: [],

          lazadaEnabled:
            LAZADA_SYNC_ENABLED,

          durationMs:
            Date.now() -
            startedAt,

          timestamp:
            new Date().toISOString(),
        },
        {
          status: 200,

          headers: {
            'Cache-Control':
              'no-store, no-cache, must-revalidate, proxy-revalidate',

            Pragma:
              'no-cache',

            Expires:
              '0',
          },
        }
      );
    }

    const shopeeResults: any[] = [];
    const lazadaResults: any[] = [];

    let totalShopeeReviews = 0;
    let totalLazadaReviews = 0;

    if (
      !requestedMarketplace ||
      requestedMarketplace ===
        'SHOPEE'
    ) {
      const shopeeAccounts =
        await db.shopeeAccount.findMany();

      console.log(
        `[Smart Sync] Found ${shopeeAccounts.length} Shopee accounts.`
      );

      for (
        const account of
          shopeeAccounts
      ) {
        const shopId =
          String(
            account.shopId
          );

        const brandInfo =
          SHOPEE_BRAND_MAPPING[
            shopId as keyof typeof SHOPEE_BRAND_MAPPING
          ];

        if (!brandInfo) {
          console.warn(
            `[Smart Sync] Ignoring unconfigured Shopee shop ${shopId}.`
          );

          continue;
        }

        if (
          !brandMatches(
            requestedBrand,
            brandInfo
          )
        ) {
          continue;
        }

        try {
          const result =
            await syncShopeeAccount(
              account
            );

          totalShopeeReviews +=
            result.synced;

          shopeeResults.push(
            result
          );
        } catch (error) {
          const message =
            getErrorMessage(
              error
            );

          console.error(
            `[Smart Sync][Shopee] ${shopId} failed:`,
            message
          );

          shopeeResults.push({
            marketplace:
              'SHOPEE',

            shopId,

            brand:
              brandInfo.name,

            code:
              brandInfo.code,

            synced: 0,

            seen: 0,

            skipped: 0,

            error:
              message,
          });
        }
      }
    }

    if (
      LAZADA_SYNC_ENABLED &&
      (
        !requestedMarketplace ||
        requestedMarketplace ===
          'LAZADA'
      )
    ) {
      const lazadaAccounts =
        await db.lazadaAccount.findMany();

      console.log(
        `[Smart Sync] Found ${lazadaAccounts.length} Lazada accounts.`
      );

      for (
        const account of
          lazadaAccounts
      ) {
        const sellerId =
          String(
            account.sellerId
          );

        const brandInfo =
          LAZADA_BRAND_MAPPING[
            sellerId as keyof typeof LAZADA_BRAND_MAPPING
          ] || {
            name:
              'Unassigned',

            code:
              'UNASSIGNED',
          };

        if (
          requestedBrand &&
          !brandMatches(
            requestedBrand,
            brandInfo
          )
        ) {
          continue;
        }

        try {
          const result =
            await syncLazadaAccount(
              account
            );

          totalLazadaReviews +=
            result.synced;

          lazadaResults.push(
            result
          );
        } catch (error) {
          const message =
            getErrorMessage(
              error
            );

          console.error(
            `[Smart Sync][Lazada] ${sellerId} failed:`,
            message
          );

          lazadaResults.push({
            marketplace:
              'LAZADA',

            sellerId,

            brand:
              brandInfo.name,

            code:
              brandInfo.code,

            synced: 0,

            seen: 0,

            skipped: 0,

            products: 0,

            error:
              message,
          });
        }
      }
    }

    const totalSynced =
      totalShopeeReviews +
      totalLazadaReviews;

    const duration =
      Date.now() -
      startedAt;

    console.log(
      `[Smart Sync] COMPLETE — synced=${totalSynced}, Shopee=${totalShopeeReviews}, Lazada=${totalLazadaReviews}, duration=${duration}ms`
    );

    return NextResponse.json(
      {
        success: true,

        message:
          'Smart sync completed successfully.',

        requestedBrand,

        requestedMarketplace,

        syncedCount:
          totalSynced,

        breakdown: {
          shopee:
            totalShopeeReviews,

          lazada:
            totalLazadaReviews,

          total:
            totalSynced,
        },

        shopeeResults,

        lazadaResults,

        lazadaEnabled:
          LAZADA_SYNC_ENABLED,

        dateRange: {
          from:
            '2026-01-01T00:00:00.000Z',

          to:
            '2026-12-31T23:59:59.999Z',
        },

        durationMs:
          duration,

        timestamp:
          new Date().toISOString(),
      },
      {
        status: 200,

        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',

          Pragma:
            'no-cache',

          Expires:
            '0',
        },
      }
    );
  } catch (error) {
    const message =
      getErrorMessage(
        error
      );

    console.error(
      '[Smart-Sync API FATAL ERROR]:',
      message
    );

    return NextResponse.json(
      {
        success: false,

        error:
          message,

        durationMs:
          Date.now() -
          startedAt,
      },
      {
        status: 500,

        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

/*
============================================================
GET
============================================================
*/

export async function GET(
  request: Request
) {
  const url =
    new URL(request.url);

  const brand =
    url.searchParams.get(
      'brand'
    );

  const marketplace =
    url.searchParams.get(
      'marketplace'
    );

  const fakeRequest =
    new Request(
      request.url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          brand:
            brand || null,

          marketplace:
            marketplace || null,
        }),
      }
    );

  return POST(
    fakeRequest
  );
}