import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

/**
 * ============================================================
 * CCIOS — SHOPEE LIVE REVIEW SYNC ENGINE
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * Sync Shopee reviews from ALL connected Shopee accounts into
 * the Prisma Review table.
 *
 * DEFAULT:
 *   POST /api/cron/shopee-reviews
 *
 * SINGLE SHOP:
 *   POST /api/cron/shopee-reviews?shopId=469553987
 *
 * FEATURES
 * ------------------------------------------------------------
 * - Syncs every connected ShopeeAccount
 * - Optional single-shop sync
 * - 2026-only review filtering
 * - Shopee pagination
 * - Per-shop error isolation
 * - Duplicate-safe Prisma upsert
 * - Preserves existing review status/reply data
 * - Never defaults unknown shops to Nicole Collection
 * - Refreshes Shopee timestamp on every API request
 *
 * ============================================================
 */

const SHOPEE_HOST =
  process.env.SHOPEE_HOST ||
  'https://partner.shopeemobile.com';

const SHOPEE_COMMENT_PATH =
  '/api/v2/product/get_comment';

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

/**
 * ============================================================
 * KNOWN SHOP → BRAND MAP
 * ============================================================
 *
 * This remains as a safety mapping for known Shopee shops.
 *
 * IMPORTANT:
 * Unknown shops are NOT automatically assigned to Nicole.
 *
 * ============================================================
 */

const SHOP_ID_TO_BRAND_MAP = {
  // OBERMAIN
  '115383763': 'Obermain',
  '1637647671': 'Obermain',
  '1747523033': 'Obermain',
  '1747523036': 'Obermain',

  // RAV DESIGN
  '469553987': 'RAV Design',
  '1770621264': 'RAV Design',
  '1770621266': 'RAV Design',
  '1770621271': 'RAV Design',

  // HUSH PUPPIES
  '282544493': 'Hush Puppies Accessories',

  // BEVERLY HILLS POLO CLUB
  '170811257': 'Beverly Hills Polo Club',
  '74401016': 'Beverly Hills Polo Club',
  '190669704': 'Beverly Hills Polo Club',

  // JOHN LANGFORD
  '170808053': 'JOHN LANGFORD OF LONDON',

  // NICOLE COLLECTION
  '66854646': 'Nicole Collection',
};

/**
 * ============================================================
 * DATE RANGE
 * ============================================================
 *
 * Sync reviews from:
 *
 * 2026-01-01 00:00:00 UTC
 *
 * until:
 *
 * 2027-01-01 00:00:00 UTC
 *
 * ============================================================
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

/**
 * ============================================================
 * SYNC SETTINGS
 * ============================================================
 */

const PAGE_SIZE = 50;
const MAX_PAGES = 100;

/**
 * ============================================================
 * ERROR HELPER
 * ============================================================
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

/**
 * ============================================================
 * SHOP ID NORMALIZER
 * ============================================================
 */

function normalizeShopId(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/['"]/g, '');
}

/**
 * ============================================================
 * BRAND NORMALIZER
 * ============================================================
 */

function normalizeBrandName(
  value: unknown
): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * ============================================================
 * BRAND RESOLUTION
 * ============================================================
 *
 * Priority:
 *
 * 1. Exact known shop ID
 * 2. Shop/account name
 * 3. Existing DB brand
 * 4. Safe generated shop name
 *
 * NEVER:
 *
 * unknown shop → Nicole Collection
 *
 * ============================================================
 */

function resolveBrand(
  shopId: string,
  shopName: unknown,
  existingBrand?: unknown
): string {
  const normalizedShopId =
    normalizeShopId(shopId);

  /**
   * ----------------------------------------------------------
   * 1. Exact shop ID mapping
   * ----------------------------------------------------------
   */

  const mappedBrand =
    SHOP_ID_TO_BRAND_MAP[
      normalizedShopId
    ];

  if (mappedBrand) {
    return mappedBrand;
  }

  /**
   * ----------------------------------------------------------
   * 2. Existing database brand
   * ----------------------------------------------------------
   *
   * If the shop is already associated with a brand in the
   * database, preserve it.
   */

  const dbBrand =
    normalizeBrandName(
      existingBrand
    );

  if (dbBrand) {
    return dbBrand;
  }

  /**
   * ----------------------------------------------------------
   * 3. Shop name
   * ----------------------------------------------------------
   */

  const name =
    normalizeBrandName(
      shopName
    );

  if (name) {
    const upper =
      name.toUpperCase();

    if (
      upper.includes('RAV') ||
      upper.includes('RAV DESIGN')
    ) {
      return 'RAV Design';
    }

    if (
      upper.includes('HUSH PUPPIES')
    ) {
      return 'Hush Puppies Accessories';
    }

    if (
      upper.includes('OBERMAIN')
    ) {
      return 'Obermain';
    }

    if (
      upper.includes('BEVERLY HILLS') ||
      upper.includes('BHPC')
    ) {
      return 'Beverly Hills Polo Club';
    }

    if (
      upper.includes('JOHN LANGFORD') ||
      upper.includes('LANGFORD')
    ) {
      return 'JOHN LANGFORD OF LONDON';
    }

    if (
      upper.includes('NICOLE')
    ) {
      return 'Nicole Collection';
    }

    /**
     * Unknown shop with a real shop name.
     *
     * Use the shop name rather than guessing a brand.
     */
    return name;
  }

  /**
   * ----------------------------------------------------------
   * 4. Safe unknown-shop fallback
   * ----------------------------------------------------------
   */

  return `Shopee Shop ${normalizedShopId}`;
}

/**
 * ============================================================
 * SHOPEE SIGNATURE
 * ============================================================
 */

function createShopeeSignature({
  partnerId,
  partnerKey,
  path,
  timestamp,
  accessToken,
  shopId,
}: {
  partnerId: string;
  partnerKey: string;
  path: string;
  timestamp: number;
  accessToken: string;
  shopId: string;
}): string {
  const baseString =
    String(partnerId) +
    String(path) +
    String(timestamp) +
    String(accessToken) +
    String(shopId);

  return crypto
    .createHmac(
      'sha256',
      partnerKey
    )
    .update(baseString)
    .digest('hex');
}

/**
 * ============================================================
 * FETCH SHOPEE COMMENTS
 * ============================================================
 */

async function fetchShopeeComments({
  shopId,
  accessToken,
  cursor,
}: {
  shopId: string;
  accessToken: string;
  cursor: string;
}) {
  /**
   * IMPORTANT:
   *
   * Generate a fresh timestamp for every API request.
   */

  const timestamp =
    Math.floor(
      Date.now() / 1000
    );

  const signature =
    createShopeeSignature({
      partnerId:
        SHOPEE_PARTNER_ID,

      partnerKey:
        SHOPEE_PARTNER_KEY,

      path:
        SHOPEE_COMMENT_PATH,

      timestamp,

      accessToken,

      shopId,
    });

  const params =
    new URLSearchParams();

  params.set(
    'partner_id',
    SHOPEE_PARTNER_ID
  );

  params.set(
    'timestamp',
    String(timestamp)
  );

  params.set(
    'access_token',
    accessToken
  );

  params.set(
    'shop_id',
    shopId
  );

  params.set(
    'sign',
    signature
  );

  params.set(
    'page_size',
    String(PAGE_SIZE)
  );

  if (cursor) {
    params.set(
      'cursor',
      cursor
    );
  }

  const requestUrl =
    `${SHOPEE_HOST}${SHOPEE_COMMENT_PATH}?${params.toString()}`;

  console.log(
    `[Shopee Sync] API request shop=${shopId} cursor=${cursor || 'FIRST'}`
  );

  const response =
    await fetch(
      requestUrl,
      {
        method: 'GET',
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
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `Shopee API returned HTTP ${response.status}: ${
        data
          ? JSON.stringify(data)
          : responseText
      }`
    );
  }

  if (!data) {
    throw new Error(
      `Shopee API returned invalid JSON: ${responseText}`
    );
  }

  if (
    data.error &&
    String(data.error) !== '0'
  ) {
    throw new Error(
      `Shopee API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * ============================================================
 * EXTRACT REVIEW DATA
 * ============================================================
 */

function extractReview(
  rawReview: any
) {
  if (!rawReview) {
    return null;
  }

  const commentId =
    rawReview.comment_id ??
    rawReview.id ??
    rawReview.commentId ??
    null;

  if (
    commentId === null ||
    commentId === undefined ||
    String(commentId).trim() === ''
  ) {
    return null;
  }

  const reviewTime =
    Number(
      rawReview.create_time ??
      rawReview.comment_time ??
      rawReview.created_at ??
      0
    );

  const reviewText =
    rawReview.comment ??
    rawReview.review_text ??
    rawReview.review ??
    '';

  const ratingValue =
    rawReview.rating_star ??
    rawReview.rating ??
    rawReview.ratingStar ??
    5;

  const rating =
    Number(ratingValue) || 5;

  const customerName =
    rawReview.buyer_username ??
    rawReview.author_username ??
    rawReview.username ??
    'Shopee Customer';

 const productName = 
  rawReview.item_name || 
  rawReview.product_name || 
  rawReview.name || 
  rawReview.item_brief?.item_name || 
  'Unknown Product';

const productSku = 
  rawReview.model_name || 
  rawReview.item_sku || 
  rawReview.model_sku || 
  '';

  return {
    reviewId:
      String(commentId),

    reviewTime,

    reviewText:
      String(
        reviewText || ''
      ).trim(),

    rating,

    customerName:
      String(
        customerName ||
          'Shopee Customer'
      ),

    productSku:
      String(
        productSku || ''
      ).trim(),

    productName:
      String(
        productName || ''
      ).trim(),
  };
}

/**
 * ============================================================
 * UPSERT REVIEW
 * ============================================================
 *
 * IMPORTANT:
 *
 * Existing status/reply information is NOT overwritten.
 *
 * This prevents a previously replied review from being reset
 * to PENDING during a later synchronization.
 *
 * ============================================================
 */

async function upsertReview({
  review,
  shopId,
  storeName,
  brand,
}: {
  review: {
    reviewId: string;
    reviewTime: number;
    reviewText: string;
    rating: number;
    customerName: string;
    productSku: string;
    productName: string;
  };

  shopId: string;

  storeName: string;

  brand: string;
}) {
  const reviewData = {
    reviewText:
      review.reviewText,

    rating:
      review.rating,

    customerName:
      review.customerName,

    brand,

    shopId:
      BigInt(shopId),

    storeName,

    ...(review.productSku
      ? {
          productSku:
            review.productSku,
        }
      : {}),

    ...(review.productName
      ? {
          productName:
            review.productName,
        }
      : {}),
  };

  await db.review.upsert({
    where: {
      reviewId:
        review.reviewId,
    },

    /**
     * UPDATE ONLY REVIEW INFORMATION.
     *
     * Do NOT update:
     * - status
     * - aiReply
     * - finalReply
     * - repliedAt
     * - repliedBy
     *
     * This protects existing workflow state.
     */
    update:
      reviewData,

    create: {
      reviewId:
        review.reviewId,

      marketplace:
        'SHOPEE',

      storeName,

      customerName:
        review.customerName,

      rating:
        review.rating,

      reviewText:
        review.reviewText,

      status:
        'PENDING',

      brand,

      shopId:
        BigInt(shopId),

      productSku:
        review.productSku ||
        null,

      productName:
        review.productName ||
        null,

      createdAt:
        review.reviewTime > 0
          ? new Date(
              review.reviewTime *
                1000
            )
          : new Date(),
    },
  });
}

/**
 * ============================================================
 * SYNC ONE SHOP
 * ============================================================
 */

async function syncOneShop({
  account,
}: {
  account: any;
}) {
  const startedAt =
    Date.now();

  const shopId =
    normalizeShopId(
      account.shopId
    );

  if (!shopId) {
    throw new Error(
      'Shopee account has no valid shopId.'
    );
  }

  const accessToken =
    String(
      account.accessToken ||
        account.access_token ||
        ''
    ).trim();

  if (!accessToken) {
    throw new Error(
      `Shopee access token missing for shop ${shopId}.`
    );
  }

  const storeName =
    normalizeBrandName(
      account.shopName ||
        account.storeName ||
        ''
    ) ||
    `Shop ${shopId}`;

  const existingBrand =
    normalizeBrandName(
      account.brand
    );

  const brand =
    resolveBrand(
      shopId,
      storeName,
      existingBrand
    );

  console.log(
    `[Shopee Sync] ================================================`
  );

  console.log(
    `[Shopee Sync] START shop=${shopId}`
  );

  console.log(
    `[Shopee Sync] store=${storeName}`
  );

  console.log(
    `[Shopee Sync] brand=${brand}`
  );

  /**
   * ----------------------------------------------------------
   * Counters
   * ----------------------------------------------------------
   */

  let cursor = '';

  let hasMore = true;

  let totalSeen = 0;

  let totalSynced = 0;

  let totalSkipped = 0;

  let pagesProcessed = 0;

  let reached2026Boundary = false;

  let reached2027Boundary = false;

  /**
   * ----------------------------------------------------------
   * Pagination
   * ----------------------------------------------------------
   */

  while (
    hasMore &&
    pagesProcessed <
      MAX_PAGES &&
    !reached2026Boundary
  ) {
    const pageNumber =
      pagesProcessed + 1;

    console.log(
      `[Shopee Sync] shop=${shopId} page=${pageNumber}`
    );

    const data =
      await fetchShopeeComments({
        shopId,
        accessToken,
        cursor,
      });

    const response =
      data?.response || {};

    const reviewList =
      Array.isArray(
        response.item_comment_list
      )
        ? response.item_comment_list
        : [];

    console.log(
      `[Shopee Sync] shop=${shopId} page=${pageNumber} reviews=${reviewList.length}`
    );

    /**
     * --------------------------------------------------------
     * Empty page
     * --------------------------------------------------------
     */

    if (
      reviewList.length === 0
    ) {
      console.log(
        `[Shopee Sync] shop=${shopId} returned no reviews.`
      );

      break;
    }

    /**
     * --------------------------------------------------------
     * Process page
     * --------------------------------------------------------
     */

    for (
      const rawReview of
        reviewList
    ) {
      totalSeen++;

      const review =
        extractReview(
          rawReview
        );

      if (!review) {
        totalSkipped++;
        continue;
      }

      /**
       * ------------------------------------------------------
       * Date validation
       * ------------------------------------------------------
       */

      if (
        !review.reviewTime
      ) {
        totalSkipped++;

        console.warn(
          `[Shopee Sync] Missing review time review=${review.reviewId}`
        );

        continue;
      }

      /**
       * Older than 2026
       */

      if (
        review.reviewTime <
        START_2026_SEC
      ) {
        reached2026Boundary =
          true;

        console.log(
          `[Shopee Sync] shop=${shopId} reached pre-2026 boundary.`
        );

        break;
      }

      /**
       * Future / 2027+
       */

      if (
        review.reviewTime >=
        START_2027_SEC
      ) {
        reached2027Boundary =
          true;

        totalSkipped++;

        continue;
      }

      /**
       * ------------------------------------------------------
       * UPSERT
       * ------------------------------------------------------
       */

      try {
        await upsertReview({
          review,
          shopId,
          storeName,
          brand,
        });

        totalSynced++;
      } catch (
        dbError
      ) {
        totalSkipped++;

        console.error(
          `[Shopee Sync] DB upsert failed shop=${shopId} review=${review.reviewId}:`,
          getErrorMessage(
            dbError
          )
        );
      }
    }

    /**
     * --------------------------------------------------------
     * Stop when 2026 boundary reached
     * --------------------------------------------------------
     */

    if (
      reached2026Boundary
    ) {
      break;
    }

    /**
     * --------------------------------------------------------
     * Pagination
     * --------------------------------------------------------
     */

    hasMore =
      response.more === true;

    cursor =
      response.next_cursor ||
      response.nextCursor ||
      '';

    pagesProcessed++;

    /**
     * --------------------------------------------------------
     * Safety
     * --------------------------------------------------------
     */

    if (
      hasMore &&
      !cursor
    ) {
      console.warn(
        `[Shopee Sync] shop=${shopId} Shopee reported more=true but no next_cursor was returned.`
      );

      break;
    }
  }

  const durationMs =
    Date.now() -
    startedAt;

  console.log(
    `[Shopee Sync] COMPLETE shop=${shopId} brand=${brand} synced=${totalSynced} seen=${totalSeen} skipped=${totalSkipped} pages=${pagesProcessed} duration=${durationMs}ms`
  );

  return {
    success: true,

    shopId,

    brand,

    storeName,

    syncedCount:
      totalSynced,

    reviewsSeen:
      totalSeen,

    skippedCount:
      totalSkipped,

    pagesProcessed,

    reached2026Boundary,

    reached2027Boundary,

    hasMore,

    durationMs,
  };
}

/**
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    /**
     * --------------------------------------------------------
     * Validate environment
     * --------------------------------------------------------
     */

    if (!SHOPEE_PARTNER_ID) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SHOPEE_PARTNER_ID is missing.',
        },
        {
          status: 500,
        }
      );
    }

    if (!SHOPEE_PARTNER_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SHOPEE_PARTNER_KEY is missing.',
        },
        {
          status: 500,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * Read optional shopId
     * --------------------------------------------------------
     *
     * If provided:
     *
     *   ?shopId=469553987
     *
     * only that shop is synchronized.
     *
     * Otherwise:
     *
     * ALL connected Shopee accounts are synchronized.
     * --------------------------------------------------------
     */

    const requestUrl =
      new URL(
        request.url
      );

    const requestedShopId =
      normalizeShopId(
        requestUrl.searchParams.get(
          'shopId'
        )
      );

    if (
      requestedShopId &&
      !/^\d+$/.test(
        requestedShopId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid shopId: ${requestedShopId}`,
        },
        {
          status: 400,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * Load ALL Shopee accounts
     * --------------------------------------------------------
     */

    let accounts;

    if (requestedShopId) {
      accounts =
        await db.shopeeAccount.findMany(
          {
            where: {
              shopId:
                BigInt(
                  requestedShopId
                ),
            },
          }
        );
    } else {
      accounts =
        await db.shopeeAccount.findMany(
          {
            orderBy: {
              shopId:
                'asc',
            },
          }
        );
    }

    console.log(
      `[Shopee Sync] Connected Shopee accounts found=${accounts.length}`
    );

    /**
     * --------------------------------------------------------
     * No accounts
     * --------------------------------------------------------
     */

    if (
      accounts.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            requestedShopId
              ? `No Shopee account found for shop ${requestedShopId}.`
              : 'No connected Shopee accounts found.',

          shopsProcessed:
            0,

          shopsSucceeded:
            0,

          shopsFailed:
            0,
        },
        {
          status: 404,
        }
      );
    }

    /**
     * --------------------------------------------------------
     * Results
     * --------------------------------------------------------
     */

    const shopResults: any[] =
      [];

    /**
     * --------------------------------------------------------
     * Process every account
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * A failure in one shop does NOT stop other shops.
     * --------------------------------------------------------
     */

    for (
      const account of
        accounts
    ) {
      const shopId =
        normalizeShopId(
          account.shopId
        );

      if (!shopId) {
        shopResults.push({
          success: false,

          shopId: null,

          error:
            'Shopee account has no shopId.',
        });

        continue;
      }

      try {
        const result =
          await syncOneShop({
            account,
          });

        shopResults.push(
          result
        );
      } catch (
        error
      ) {
        const message =
          getErrorMessage(
            error
          );

        console.error(
          `[Shopee Sync] SHOP FAILED shop=${shopId}:`,
          message
        );

        shopResults.push({
          success: false,

          shopId,

          brand:
            resolveBrand(
              shopId,
              account.shopName ||
                account.storeName ||
                '',
              account.brand
            ),

          storeName:
            account.shopName ||
            account.storeName ||
            `Shop ${shopId}`,

          syncedCount:
            0,

          reviewsSeen:
            0,

          skippedCount:
            0,

          pagesProcessed:
            0,

          error:
            message,
        });
      }
    }

    /**
     * --------------------------------------------------------
     * Summary
     * --------------------------------------------------------
     */

    const shopsProcessed =
      shopResults.length;

    const shopsSucceeded =
      shopResults.filter(
        (item) =>
          item.success ===
          true
      ).length;

    const shopsFailed =
      shopResults.filter(
        (item) =>
          item.success !==
          true
      ).length;

    const totalSynced =
      shopResults.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.syncedCount ||
              0
          ),
        0
      );

    const totalSeen =
      shopResults.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.reviewsSeen ||
              0
          ),
        0
      );

    const totalSkipped =
      shopResults.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.skippedCount ||
              0
          ),
        0
      );

    const durationMs =
      Date.now() -
      startedAt;

    console.log(
      `[Shopee Sync] ============================================================`
    );

    console.log(
      `[Shopee Sync] ALL SHOPS COMPLETE`
    );

    console.log(
      `[Shopee Sync] shops=${shopsProcessed}`
    );

    console.log(
      `[Shopee Sync] succeeded=${shopsSucceeded}`
    );

    console.log(
      `[Shopee Sync] failed=${shopsFailed}`
    );

    console.log(
      `[Shopee Sync] synced=${totalSynced}`
    );

    console.log(
      `[Shopee Sync] seen=${totalSeen}`
    );

    console.log(
      `[Shopee Sync] skipped=${totalSkipped}`
    );

    console.log(
      `[Shopee Sync] duration=${durationMs}ms`
    );

    /**
     * --------------------------------------------------------
     * Response
     * --------------------------------------------------------
     */

    return NextResponse.json(
      {
        success:
          shopsFailed ===
            0,

        partialSuccess:
          shopsSucceeded >
            0 &&
          shopsFailed >
            0,

        marketplace:
          'SHOPEE',

        requestedShopId:
          requestedShopId ||
          null,

        shopsProcessed,

        shopsSucceeded,

        shopsFailed,

        totalSynced,

        totalReviewsSeen:
          totalSeen,

        totalSkipped,

        durationMs,

        message:
          requestedShopId
            ? `Shopee review sync completed for shop ${requestedShopId}.`
            : `Shopee review sync completed for all ${shopsProcessed} connected shops.`,

        shops:
          shopResults,
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
  } catch (
    error
  ) {
    const message =
      getErrorMessage(
        error
      );

    console.error(
      '[Shopee Sync] FATAL ERROR:',
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
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
}