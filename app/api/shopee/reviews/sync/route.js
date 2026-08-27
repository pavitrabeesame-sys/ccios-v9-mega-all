import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

/*
============================================================
CCIOS — SHOPEE LIVE REVIEW SYNC ENGINE
2026 PRODUCTION

AUTHORITATIVE SHOPEE SHOP → BRAND MAPPING

RAV DESIGN
115383763

OBERMAIN
469553987

HUSH PUPPIES
282544493

JOHN LANGFORD
170808053

BEVERLY HILLS POLO CLUB
170811257

NICOLE
66854646
============================================================
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

/*
============================================================
AUTHORITATIVE SHOP ID → BRAND
============================================================

IMPORTANT:
These are the ONLY authoritative Shopee mappings.

Do not use the old duplicate IDs.
============================================================
*/

const SHOP_ID_TO_BRAND_MAP = {
  '115383763': 'RAV Design',
  '469553987': 'Obermain',
  '282544493': 'Hush Puppies',
  '170808053': 'JOHN LANGFORD OF LONDON',
  '170811257': 'Beverly Hills Polo Club',
  '66854646': 'Nicole Collection',
};

/*
============================================================
SHOP ID → STORE NAME
============================================================
*/

const STORE_NAME_MAP = {
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
2026 DATE RANGE
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

/*
============================================================
SYNC SETTINGS
============================================================
*/

const PAGE_SIZE = 50;
const MAX_PAGES = 100;

/*
============================================================
ERROR HELPER
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

/*
============================================================
SHOP ID NORMALIZER
============================================================
*/

function normalizeShopId(value) {
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

/*
============================================================
SHOPEE SIGNATURE
============================================================
*/

function createShopeeSignature({
  partnerId,
  partnerKey,
  path,
  timestamp,
  accessToken,
  shopId,
}) {
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

/*
============================================================
FETCH SHOPEE COMMENTS
============================================================
*/

async function fetchShopeeComments({
  shopId,
  accessToken,
  cursor = '',
}) {
  const timestamp = Math.floor(
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
    'page_size',
    String(PAGE_SIZE)
  );

  params.set(
    'sign',
    signature
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
    '[Shopee Debug] Request:',
    {
      shopId,
      timestamp,
      hasAccessToken:
        Boolean(accessToken),
      hasSignature:
        Boolean(signature),
      cursor:
        cursor || null,
    }
  );

  const response =
    await fetch(requestUrl, {
      method: 'GET',
      cache: 'no-store',
    });

  const responseText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(responseText);
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

  if (data.error) {
    throw new Error(
      `Shopee API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

/*
============================================================
EXTRACT REVIEW DATA
============================================================
*/

function extractReview(rawReview) {
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

  const productSku =
    rawReview.model_name ??
    rawReview.item_sku ??
    rawReview.model_sku ??
    '';

  const productName =
    rawReview.item_name ??
    rawReview.product_name ??
    rawReview.name ??
    rawReview.item_brief?.item_name ??
    '';

  const itemId =
    rawReview.item_id ??
    rawReview.itemId ??
    rawReview.item?.item_id ??
    null;

  const orderNumber =
    rawReview.order_sn ??
    rawReview.order_id ??
    null;

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
      ).trim(),

    productSku:
      String(
        productSku || ''
      ).trim(),

    productName:
      String(
        productName || ''
      ).trim(),

    itemId:
      itemId !== null &&
      itemId !== undefined
        ? String(itemId)
        : '',

    orderNumber:
      orderNumber
        ? String(orderNumber)
        : null,
  };
}

/*
============================================================
PRODUCT RESOLUTION
============================================================
*/

async function resolveProduct(review) {
  /*
  1. Shopee supplied product name
  */

  if (review.productName) {
    return {
      productName:
        review.productName,

      productSku:
        review.productSku ||
        null,
    };
  }

  /*
  2. SKU lookup
  */

  if (review.productSku) {
    try {
      const product =
        await db.product.findFirst({
          where: {
            sku:
              review.productSku,
          },
        });

      if (product) {
        return {
          productName:
            product.name,

          productSku:
            review.productSku ||
            product.sku ||
            null,
        };
      }
    } catch (error) {
      console.warn(
        '[Shopee Sync] SKU product lookup failed:',
        getErrorMessage(error)
      );
    }
  }

  /*
  3. Shopee item ID lookup
  */

  if (
    review.itemId &&
    /^\d+$/.test(
      review.itemId
    )
  ) {
    try {
      const product =
        await db.product.findFirst({
          where: {
            shopeeItemId:
              BigInt(
                review.itemId
              ),
          },
        });

      if (product) {
        return {
          productName:
            product.name,

          productSku:
            review.productSku ||
            product.sku ||
            null,
        };
      }
    } catch (error) {
      console.warn(
        '[Shopee Sync] shopeeItemId lookup failed:',
        getErrorMessage(error)
      );
    }
  }

  /*
  4. Fallback
  */

  return {
    productName:
      review.itemId
        ? `Shopee Product ${review.itemId}`
        : null,

    productSku:
      review.productSku ||
      null,
  };
}

/*
============================================================
UPSERT REVIEW
============================================================
*/

async function upsertReview({
  review,
  shopId,
  storeName,
  brand,
}) {
  const product =
    await resolveProduct(
      review
    );

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

    productSku:
      product.productSku,

    productName:
      product.productName,

    ...(review.orderNumber
      ? {
          orderNumber:
            review.orderNumber,
        }
      : {}),
  };

  await db.review.upsert({
    where: {
      reviewId:
        review.reviewId,
    },

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
        product.productSku,

      productName:
        product.productName,

      orderNumber:
        review.orderNumber,

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

/*
============================================================
POST
============================================================
*/

export async function POST(request) {
  const startedAt =
    Date.now();

  try {
    /*
    --------------------------------------------------------
    READ SHOP ID
    --------------------------------------------------------
    */

    const requestUrl =
      new URL(request.url);

    const shopIdParam =
      requestUrl.searchParams.get(
        'shopId'
      );

    if (!shopIdParam) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Missing shopId parameter. Example: ?shopId=115383763',
        },
        {
          status: 400,
        }
      );
    }

    /*
    --------------------------------------------------------
    NORMALIZE SHOP ID
    --------------------------------------------------------
    */

    const normalizedShopId =
      normalizeShopId(
        shopIdParam
      );

    if (
      !/^\d+$/.test(
        normalizedShopId
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Invalid shopId: ${normalizedShopId}`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    --------------------------------------------------------
    AUTHORITATIVE BRAND
    --------------------------------------------------------
    */

    const brand =
      SHOP_ID_TO_BRAND_MAP[
        normalizedShopId
      ];

    if (!brand) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Shopee shop ${normalizedShopId} is not configured in the authoritative shop mapping.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
    --------------------------------------------------------
    ENVIRONMENT CHECK
    --------------------------------------------------------
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

    /*
    --------------------------------------------------------
    LOAD SHOPEE ACCOUNT
    --------------------------------------------------------
    */

    const account =
      await db.shopeeAccount.findUnique({
        where: {
          shopId:
            BigInt(
              normalizedShopId
            ),
        },
      });

    console.log(
      '[Shopee Debug] Account:',
      {
        requestedShopId:
          normalizedShopId,

        accountId:
          account?.id ?? null,

        accountShopId:
          account?.shopId
            ?.toString?.() ?? null,

        shopName:
          account?.shopName ?? null,

        resolvedBrand:
          brand,

        hasAccessToken:
          Boolean(
            account?.accessToken
          ),
      }
    );

    /*
    --------------------------------------------------------
    ACCOUNT NOT FOUND
    --------------------------------------------------------
    */

    if (!account) {
      return NextResponse.json(
        {
          success: false,

          error:
            `No Shopee account found for shopId ${normalizedShopId}.`,
        },
        {
          status: 404,
        }
      );
    }

    /*
    --------------------------------------------------------
    ACCESS TOKEN
    --------------------------------------------------------
    */

    const accessToken =
      account.accessToken ||
      null;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Shopee access token missing for shop ${normalizedShopId}.`,
        },
        {
          status: 401,
        }
      );
    }

    /*
    --------------------------------------------------------
    FINAL SHOP ID
    --------------------------------------------------------
    */

    const shopId =
      account.shopId.toString();

    /*
    --------------------------------------------------------
    SHOP ID SAFETY CHECK
    --------------------------------------------------------
    */

    if (
      shopId !==
      normalizedShopId
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Shop ID mismatch. Requested ${normalizedShopId}, account contains ${shopId}.`,
        },
        {
          status: 409,
        }
      );
    }

    /*
    --------------------------------------------------------
    STORE NAME
    --------------------------------------------------------
    */

    const storeName =
      STORE_NAME_MAP[shopId] ||
      account.shopName ||
      `Shopee Shop (${shopId})`;

    /*
    --------------------------------------------------------
    START
    --------------------------------------------------------
    */

    console.log(
      `[Shopee Sync] START — Shop ${shopId} — ${brand}`
    );

    /*
    --------------------------------------------------------
    COUNTERS
    --------------------------------------------------------
    */

    let cursor = '';
    let hasMore = true;

    let totalSeen = 0;
    let totalSynced = 0;
    let totalSkipped = 0;

    let pagesProcessed = 0;

    let reached2026Boundary =
      false;

    let reached2027Boundary =
      false;

    /*
    --------------------------------------------------------
    PAGINATION
    --------------------------------------------------------
    */

    while (
      hasMore &&
      pagesProcessed <
        MAX_PAGES &&
      !reached2026Boundary
    ) {
      const currentPage =
        pagesProcessed + 1;

      console.log(
        `[Shopee Sync] Shop ${shopId} (${brand}) — fetching page ${currentPage}...`
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
        `[Shopee Sync] Shop ${shopId} — page ${currentPage} returned ${reviewList.length} reviews.`
      );

      /*
      Count page even if it contains zero reviews.
      */

      pagesProcessed++;

      if (
        reviewList.length === 0
      ) {
        console.log(
          `[Shopee Sync] No reviews returned on page ${currentPage}.`
        );

        hasMore = false;

        break;
      }

      /*
      ------------------------------------------------------
      PROCESS REVIEWS
      ------------------------------------------------------
      */

      for (
        const rawReview of reviewList
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

        /*
        Missing timestamp
        */

        if (
          !review.reviewTime
        ) {
          totalSkipped++;
          continue;
        }

        /*
        ----------------------------------------------------
        PRE-2026
        ----------------------------------------------------
        */

        if (
          review.reviewTime <
          START_2026_SEC
        ) {
          reached2026Boundary =
            true;

          console.log(
            `[Shopee Sync] Shop ${shopId} reached pre-2026 reviews.`
          );

          break;
        }

        /*
        ----------------------------------------------------
        2027+
        ----------------------------------------------------
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

        /*
        ----------------------------------------------------
        DATABASE UPSERT
        ----------------------------------------------------
        */

        try {
          await upsertReview({
            review,

            shopId,

            storeName,

            brand,
          });

          totalSynced++;
        } catch (dbError) {
          totalSkipped++;

          console.error(
            `[Shopee Sync] Database upsert failed for review ${review.reviewId}:`,
            getErrorMessage(
              dbError
            )
          );
        }
      }

      /*
      ------------------------------------------------------
      STOP AT 2026 BOUNDARY
      ------------------------------------------------------
      */

      if (
        reached2026Boundary
      ) {
        break;
      }

      /*
      ------------------------------------------------------
      NEXT PAGE
      ------------------------------------------------------
      */

      hasMore =
        response.more === true;

      cursor =
        response.next_cursor ||
        response.nextCursor ||
        '';

      if (
        hasMore &&
        !cursor
      ) {
        console.warn(
          `[Shopee Sync] Shopee reported more pages but no next_cursor was returned.`
        );

        hasMore = false;

        break;
      }
    }

    /*
    --------------------------------------------------------
    FINISH
    --------------------------------------------------------
    */

    const duration =
      Date.now() -
      startedAt;

    console.log(
      `[Shopee Sync] COMPLETE — ` +
      `Shop ${shopId} — ${brand} — ` +
      `synced=${totalSynced}, ` +
      `seen=${totalSeen}, ` +
      `skipped=${totalSkipped}, ` +
      `pages=${pagesProcessed}, ` +
      `duration=${duration}ms`
    );

    /*
    --------------------------------------------------------
    RESPONSE
    --------------------------------------------------------
    */

    return NextResponse.json(
      {
        success: true,

        marketplace:
          'SHOPEE',

        shopId,

        requestedShopId:
          normalizedShopId,

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

        durationMs:
          duration,

        message:
          `Successfully synced ${totalSynced} reviews for ${brand} from 2026.`,
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
      '[Shopee Sync] FATAL ERROR:',
      message
    );

    return NextResponse.json(
      {
        success: false,

        error: message,

        durationMs:
          Date.now() -
          startedAt,
      },
      {
        status: 500,

        headers: {
          'Cache-Control':
            'no-store',
          'Pragma':
            'no-cache',
        },
      }
    );
  }
}