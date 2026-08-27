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
============================================================
*/

const SHOPEE_HOST =
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
SHOP ID → BRAND
============================================================
*/

const SHOP_ID_TO_BRAND_MAP: Record<string, string> = {

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

/*
============================================================
SETTINGS
============================================================
*/

const PAGE_SIZE = 50;
const MAX_PAGES = 100;

/*
============================================================
ERROR
============================================================
*/

function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

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
SIGNATURE
============================================================
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
}) {
  const baseString =
    String(partnerId) +
    String(path) +
    String(timestamp) +
    String(accessToken) +
    String(shopId);

  return crypto
    .createHmac('sha256', partnerKey)
    .update(baseString)
    .digest('hex');
}

/*
============================================================
SHOPEE COMMENT REQUEST
============================================================
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

  const timestamp =
    Math.floor(Date.now() / 1000);

  const signature =
    createShopeeSignature({
      partnerId: SHOPEE_PARTNER_ID,
      partnerKey: SHOPEE_PARTNER_KEY,
      path: SHOPEE_COMMENT_PATH,
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

  const response =
    await fetch(requestUrl, {
      method: 'GET',
      cache: 'no-store',
    });

  const responseText =
    await response.text();

  let data: any;

  try {
    data = JSON.parse(
      responseText
    );
  } catch {
    throw new Error(
      `Shopee returned invalid JSON: ${responseText}`
    );
  }

  /*
  ----------------------------------------------------------
  DEBUG
  ----------------------------------------------------------
  */

  console.log(
    '[Shopee Debug] Comment response summary:',
    {
      shopId,
      httpStatus: response.status,
      error: data?.error ?? null,
      message: data?.message ?? null,
      requestId:
        data?.request_id ?? null,
      commentCount:
        Array.isArray(
          data?.response?.item_comment_list
        )
          ? data.response
              .item_comment_list.length
          : 0,
      more:
        data?.response?.more ?? false,
      nextCursor:
        data?.response?.next_cursor ?? '',
    }
  );

  if (!response.ok) {
    throw new Error(
      `Shopee HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  if (data?.error) {
    throw new Error(
      `Shopee API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

/*
============================================================
POST
============================================================
*/

export async function POST(
  req: Request
) {

  const startedAt =
    Date.now();

  try {

    /*
    --------------------------------------------------------
    SHOP ID
    --------------------------------------------------------
    */

    const urlObj =
      new URL(req.url);

    const shopIdParam =
      urlObj.searchParams.get(
        'shopId'
      );

    if (!shopIdParam) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing shopId parameter.',
        },
        { status: 400 }
      );
    }

    const normalizedShopId =
      shopIdParam
        .trim()
        .replace(/['"]/g, '');

    if (!/^\d+$/.test(
      normalizedShopId
    )) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid shopId: ${shopIdParam}`,
        },
        { status: 400 }
      );
    }

    /*
    --------------------------------------------------------
    ENVIRONMENT
    --------------------------------------------------------
    */

    if (!SHOPEE_PARTNER_ID) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SHOPEE_PARTNER_ID is missing.',
        },
        { status: 500 }
      );
    }

    if (!SHOPEE_PARTNER_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            'SHOPEE_PARTNER_KEY is missing.',
        },
        { status: 500 }
      );
    }

    /*
    --------------------------------------------------------
    LOAD ACCOUNT
    --------------------------------------------------------
    */

    const account =
      await db.shopeeAccount.findUnique({
        where: {
          shopId:
            BigInt(normalizedShopId),
        },
      });

    /*
    IMPORTANT:
    Do not use shopId here.
    It is declared below.
    */

    console.log(
      '[Shopee Debug] Account found:',
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

        hasAccessToken:
          Boolean(
            account?.accessToken
          ),

        accessTokenPrefix:
          account?.accessToken
            ? `${account.accessToken.slice(0, 8)}...`
            : null,
      }
    );

    if (
      !account ||
      !account.accessToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No active Shopee account found for shopId ${normalizedShopId}.`,
        },
        { status: 404 }
      );
    }

    /*
    --------------------------------------------------------
    FINAL ACCOUNT VALUES
    --------------------------------------------------------
    */

    const shopId =
      String(account.shopId);

    const accessToken =
      account.accessToken;

    const storeName =
      account.shopName ||
      `Shop ${shopId}`;

    const resolvedBrand =
      SHOP_ID_TO_BRAND_MAP[shopId];

    if (!resolvedBrand) {
      return NextResponse.json(
        {
          success: false,
          error:
            `No brand mapping found for shopId ${shopId}.`,
        },
        { status: 400 }
      );
    }

    console.log(
      `[Shopee Sync] START — Shop ${shopId} — ${resolvedBrand}`
    );

    /*
    --------------------------------------------------------
    COUNTERS
    --------------------------------------------------------
    */

    let cursor = '';

    let hasMore = true;

    let totalSynced = 0;

    let totalSeen = 0;

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
      !reached2026Boundary &&
      pagesProcessed < MAX_PAGES
    ) {

      console.log(
        `[Shopee Sync] Shop ${shopId} (${resolvedBrand}) — fetching page ${
          pagesProcessed + 1
        }...`
      );

      const data =
        await fetchShopeeComments({
          shopId,
          accessToken,
          cursor,
        });

      /*
      IMPORTANT:
      Count the API request as a processed page.
      */

      pagesProcessed++;

      const reviewList =
        Array.isArray(
          data?.response
            ?.item_comment_list
        )
          ? data.response
              .item_comment_list
          : [];

      /*
      ------------------------------------------------------
      EMPTY PAGE
      ------------------------------------------------------
      */

      if (
        reviewList.length === 0
      ) {

        console.log(
          `[Shopee Sync] Shop ${shopId} returned 0 reviews on page ${pagesProcessed}.`
        );

        hasMore =
          data?.response?.more === true;

        cursor =
          data?.response
            ?.next_cursor || '';

        break;
      }

      /*
      ------------------------------------------------------
      PROCESS REVIEWS
      ------------------------------------------------------
      */

      for (
        const rawReview
        of reviewList
      ) {

        totalSeen++;

        const reviewTimeSec =
          Number(
            rawReview?.create_time ??
            rawReview?.comment_time ??
            0
          );

        if (!reviewTimeSec) {
          totalSkipped++;
          continue;
        }

        /*
        PRE-2026
        */

        if (
          reviewTimeSec <
          START_2026_SEC
        ) {

          reached2026Boundary =
            true;

          console.log(
            `[Shopee Sync] Reached pre-2026 reviews.`
          );

          break;
        }

        /*
        2027+
        */

        if (
          reviewTimeSec >=
          START_2027_SEC
        ) {

          reached2027Boundary =
            true;

          totalSkipped++;

          continue;
        }

        /*
        REVIEW ID
        */

        const reviewId =
          rawReview?.comment_id ??
          rawReview?.id ??
          null;

        if (
          reviewId === null ||
          reviewId === undefined ||
          String(reviewId).trim() === ''
        ) {

          totalSkipped++;

          continue;
        }

        const reviewIdStr =
          String(reviewId);

        /*
        REVIEW TEXT
        */

        const reviewText =
          String(
            rawReview?.comment ??
            rawReview?.review_text ??
            ''
          ).trim();

        /*
        RATING
        */

        const rating =
          Number(
            rawReview?.rating_star ??
            rawReview?.rating ??
            5
          ) || 5;

        /*
        CUSTOMER
        */

        const customerName =
          String(
            rawReview?.buyer_username ??
            rawReview?.author_username ??
            'Shopee Customer'
          );

        /*
        PRODUCT IDENTIFIERS
        */

        const itemId =
          rawReview?.item_id
            ? String(
                rawReview.item_id
              )
            : '';

        const modelId =
          rawReview?.model_id
            ? String(
                rawReview.model_id
              )
            : '';

        /*
        NOTE:
        get_comment does not appear to provide
        product name/SKU in your actual response.
        Therefore don't pretend that it does.
        */

        const productName =
          rawReview?.item_name ??
          rawReview?.product_name ??
          rawReview?.name ??
          rawReview?.item_brief
            ?.item_name ??
          null;

        const productSku =
          rawReview?.model_name ??
          rawReview?.item_sku ??
          rawReview?.model_sku ??
          null;

        /*
        ----------------------------------------------------
        UPSERT
        ----------------------------------------------------
        */

        await db.review.upsert({

          where: {
            reviewId:
              reviewIdStr,
          },

          update: {

            reviewText,

            rating,

            customerName,

            brand:
              resolvedBrand,

            shopId:
              BigInt(shopId),

            storeName,

            ...(productSku
              ? { productSku }
              : {}),

            ...(productName
              ? { productName }
              : {}),
          },

          create: {

            reviewId:
              reviewIdStr,

            marketplace:
              'SHOPEE',

            storeName,

            customerName,

            rating,

            reviewText,

            status:
              'PENDING',

            brand:
              resolvedBrand,

            shopId:
              BigInt(shopId),

            productSku:
              productSku || null,

            productName:
              productName || null,

            createdAt:
              new Date(
                reviewTimeSec * 1000
              ),
          },
        });

        totalSynced++;
      }

      /*
      ------------------------------------------------------
      STOP AT 2026
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
        data?.response?.more === true;

      cursor =
        data?.response
          ?.next_cursor || '';

      if (
        hasMore &&
        !cursor
      ) {

        console.warn(
          `[Shopee Sync] Shopee reported more=true but next_cursor is empty.`
        );

        break;
      }
    }

    /*
    --------------------------------------------------------
    COMPLETE
    --------------------------------------------------------
    */

    const durationMs =
      Date.now() - startedAt;

    console.log(
      `[Shopee Sync] COMPLETE — ` +
      `Shop ${shopId} — ${resolvedBrand} — ` +
      `synced=${totalSynced}, ` +
      `seen=${totalSeen}, ` +
      `skipped=${totalSkipped}, ` +
      `pages=${pagesProcessed}, ` +
      `duration=${durationMs}ms`
    );

    return NextResponse.json(
      {
        success: true,

        marketplace:
          'SHOPEE',

        shopId,

        brand:
          resolvedBrand,

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

        emptyResult:
          totalSeen === 0,

        durationMs,

        message:
          totalSeen === 0
            ? `Shopee returned no reviews for ${resolvedBrand} / shop ${shopId}.`
            : `Successfully synced ${totalSynced} reviews for ${resolvedBrand} (2026).`,
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
      getErrorMessage(error);

    console.error(
      '[Shopee Sync] FATAL ERROR:',
      message
    );

    return NextResponse.json(
      {
        success: false,

        error: message,

        durationMs:
          Date.now() - startedAt,
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