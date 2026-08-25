import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Bump from 60 to 300 seconds

/*
============================================================
CCIOS — SHOPEE LIVE REVIEW SYNC ENGINE
2026 ONLY
============================================================

Sync window:

  START: 2026-01-01 00:00:00 UTC
  END:   2027-01-01 00:00:00 UTC

Anything outside this window is ignored.

Pagination:
  Maximum 100 pages
  50 reviews per page
  Maximum 5,000 reviews per shop per sync

The sync stops early when Shopee pagination reaches
reviews older than 2026.
============================================================
*/

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const SHOPEE_COMMENT_PATH = '/api/v2/product/get_comment';

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
2026 CALENDAR BOUNDARIES
============================================================
*/

const START_2026_SEC = Math.floor(
  new Date('2026-01-01T00:00:00.000Z').getTime() / 1000
);

const START_2027_SEC = Math.floor(
  new Date('2027-01-01T00:00:00.000Z').getTime() / 1000
);

/*
============================================================
SYNC SAFETY
============================================================
*/

const PAGE_SIZE = 50;
const MAX_PAGES = 100;

/*
============================================================
ERROR HELPER
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
    .createHmac('sha256', partnerKey)
    .update(baseString)
    .digest('hex');
}

/*
============================================================
POST /api/reviews/sync?shopId=XXXX
============================================================
*/

export async function POST(req: Request) {
  try {
    /*
    ========================================================
    1. GET SHOP ID
    ========================================================
    */

    const urlObj = new URL(req.url);
    const shopIdParam = urlObj.searchParams.get('shopId');

    if (!shopIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing shopId parameter.',
        },
        { status: 400 }
      );
    }

    /*
    ========================================================
    2. LOAD SHOPEE ACCOUNT
    ========================================================
    */

    const account = await db.shopeeAccount.findUnique({
      where: {
        shopId: BigInt(shopIdParam),
      },
    });

    if (!account || !account.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: `No active Shopee account found for shopId ${shopIdParam}`,
        },
        { status: 404 }
      );
    }

    const shopId = String(account.shopId);
    const accessToken = account.accessToken;
    const storeName = account.shopName || `Shop ${shopId}`;

    /*
    ========================================================
    3. CREATE SHOPEE SIGNATURE
    ========================================================
    */

    const timestamp = Math.floor(Date.now() / 1000);

    const signature = createShopeeSignature({
      partnerId: SHOPEE_PARTNER_ID,
      partnerKey: SHOPEE_PARTNER_KEY,
      path: SHOPEE_COMMENT_PATH,
      timestamp,
      accessToken,
      shopId,
    });

    /*
    ========================================================
    4. PAGINATION STATE
    ========================================================
    */

    let cursor = '';
    let hasMore = true;

    let totalSynced = 0;
    let totalSeen = 0;
    let pageLimit = 0;

    let reached2026Boundary = false;

    /*
    ========================================================
    5. PAGINATE SHOPEE REVIEWS

    Important:
    - No old 15-page / 750-review limit.
    - Maximum 100 pages.
    - Stops naturally when Shopee returns no more.
    - Stops when reviews become older than 2026.
    ========================================================
    */

    while (
      hasMore &&
      !reached2026Boundary &&
      pageLimit < MAX_PAGES
    ) {
      const fetchUrl =
        `${SHOPEE_HOST}${SHOPEE_COMMENT_PATH}` +
        `?partner_id=${SHOPEE_PARTNER_ID}` +
        `&timestamp=${timestamp}` +
        `&access_token=${encodeURIComponent(accessToken)}` +
        `&shop_id=${shopId}` +
        `&sign=${signature}` +
        `&page_size=${PAGE_SIZE}` +
        `${
          cursor
            ? `&cursor=${encodeURIComponent(cursor)}`
            : ''
        }`;

      console.log(
        `[Shopee Sync] Shop ${shopId} — fetching page ${
          pageLimit + 1
        }...`
      );

      const response = await fetch(fetchUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        const errText = await response.text();

        throw new Error(
          `Shopee API sync failed with status ${response.status}: ${errText}`
        );
      }

      const data = await response.json();

      const reviewList =
        data?.response?.item_comment_list || [];

      /*
      ======================================================
      NO RESULTS
      ======================================================
      */

      if (
        !Array.isArray(reviewList) ||
        reviewList.length === 0
      ) {
        console.log(
          `[Shopee Sync] No more reviews returned for shop ${shopId}.`
        );

        break;
      }

      /*
      ======================================================
      PROCESS PAGE
      ======================================================
      */

      for (const rawReview of reviewList) {
        totalSeen++;

        /*
        ----------------------------------------------------
        Shopee review timestamp
        ----------------------------------------------------
        */

        const reviewTimeSec = Number(
          rawReview.create_time ||
            rawReview.comment_time ||
            0
        );

        /*
        ----------------------------------------------------
        INVALID TIMESTAMP
        ----------------------------------------------------
        */

        if (!reviewTimeSec) {
          console.warn(
            `[Shopee Sync] Review has no valid timestamp. Skipping.`
          );

          continue;
        }

        /*
        ----------------------------------------------------
        PRE-2026 BOUNDARY
        ----------------------------------------------------

        Shopee normally returns reviews newest -> oldest.

        Once we reach a review before Jan 1, 2026,
        there is no reason to request older pages.
        ----------------------------------------------------
        */

        if (reviewTimeSec < START_2026_SEC) {
          console.log(
            `[Shopee Sync] Reached pre-2026 boundary ` +
              `(Timestamp: ${reviewTimeSec}). ` +
              `Halting pagination.`
          );

          reached2026Boundary = true;
          break;
        }

        /*
        ----------------------------------------------------
        2027+ REVIEWS
        ----------------------------------------------------

        Ignore these.

        They should normally not appear because the current
        date is within 2026, but keeping this guard makes
        the sync window strict.
        ----------------------------------------------------
        */

        if (reviewTimeSec >= START_2027_SEC) {
          continue;
        }

        /*
        ----------------------------------------------------
        REVIEW DATA
        ----------------------------------------------------
        */

        const reviewIdStr = String(
          rawReview.comment_id ||
            rawReview.id ||
            ''
        );

        if (!reviewIdStr) {
          console.warn(
            `[Shopee Sync] Review has no comment ID. Skipping.`
          );

          continue;
        }

        const reviewText =
          rawReview.comment ||
          rawReview.review_text ||
          '';

        const rating = Number(
          rawReview.rating_star ||
            rawReview.rating ||
            5
        );

        const customerName =
          rawReview.buyer_username ||
          rawReview.author_username ||
          'Shopee Customer';

        /*
        ====================================================
        UPSERT ONLY REVIEWS FROM 2026
        ====================================================
        */

        await db.review.upsert({
          where: {
            reviewId: reviewIdStr,
          },

          update: {
            reviewText,
            rating,
            customerName,
            shopId: BigInt(shopId),
          },

          create: {
            reviewId: reviewIdStr,
            marketplace: 'SHOPEE',

            storeName,
            customerName,

            rating,
            reviewText,

            status: 'PENDING',

            shopId: BigInt(shopId),

            /*
            IMPORTANT:
            Store the actual Shopee review timestamp.
            */

            createdAt: new Date(
              reviewTimeSec * 1000
            ),
          },
        });

        totalSynced++;
      }

      /*
      ======================================================
      STOP IF 2026 BOUNDARY WAS REACHED
      ======================================================
      */

      if (reached2026Boundary) {
        break;
      }

      /*
      ======================================================
      SHOPEE PAGINATION
      ======================================================
      */

      hasMore =
        data?.response?.more === true;

      cursor =
        data?.response?.next_cursor || '';

      pageLimit++;

      /*
      ======================================================
      SAFETY CHECK
      ======================================================
      */

      if (hasMore && !cursor) {
        console.warn(
          `[Shopee Sync] Shopee reported more=true but ` +
            `returned no next_cursor. Stopping safely.`
        );

        break;
      }
    }

    /*
    ========================================================
    6. REPORT 100-PAGE LIMIT
    ========================================================
    */

    if (pageLimit >= MAX_PAGES && hasMore) {
      console.warn(
        `[Shopee Sync] Reached MAX_PAGES=${MAX_PAGES} ` +
          `for shop ${shopId}. ` +
          `There may be additional reviews remaining.`
      );
    }

    /*
    ========================================================
    7. SUCCESS
    ========================================================
    */

    console.log(
      `[Shopee Sync] Successfully synchronized ` +
        `${totalSynced} reviews from 2026 ` +
        `for shop ${shopId}. ` +
        `Pages: ${pageLimit}. ` +
        `Seen: ${totalSeen}.`
    );

    return NextResponse.json({
      success: true,

      shopId,

      syncedCount: totalSynced,

      pagesProcessed: pageLimit,

      reviewsSeen: totalSeen,

      reached2026Boundary,

      message:
        `Successfully synced ${totalSynced} reviews ` +
        `for calendar year 2026.`,
    });
  } catch (error) {
    console.error(
      '[Shopee Sync] FATAL ERROR:',
      getErrorMessage(error)
    );

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}