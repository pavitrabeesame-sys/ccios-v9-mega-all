import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ============================================================
 * CCIOS — SHOPEE REVIEW SYNC ENGINE
 * ============================================================
 *
 * FULL CURSOR + INCREMENTAL VERSION
 *
 * Historical sync:
 *   - Uses cursor pagination
 *   - Saves cursor between requests
 *   - Processes up to 5 pages / shop / request
 *
 * Completed shop:
 *   - Does NOT re-download full history
 *   - Checks only the newest page
 *   - Creates genuinely new reviews
 *   - Does not modify existing reviews unnecessarily
 *
 * Existing review protection:
 *   - status is preserved
 *   - aiReply is preserved
 *   - all AI/reply workflow fields are preserved
 *
 * ============================================================
 */

/**
 * ============================================================
 * SHOP → BRAND MAPPING
 * ============================================================
 */

const SHOP_BRANDS: Record<string, string> = {
  // BHPC
  '74401016': 'BHPC',
  '1770621266': 'BHPC',

  // JOHN LANGFORD
  '170808053': 'JOHN_LANGFORD',

  // HUSH
  '170811257': 'HUSH',
  '282544493': 'HUSH',

  // OBERMAIN
  '469553987': 'OBERMAIN',
  '1637647671': 'OBERMAIN',
  '1747523033': 'OBERMAIN',
  '1747523036': 'OBERMAIN',

  // NICOLE
  '66854646': 'NICOLE',
  '190669704': 'NICOLE',

  // RAV
  '115383763': 'RAV',
  '1770621264': 'RAV',
  '1770621271': 'RAV',
};

/**
 * Historical cursor batches.
 */
const MAX_PAGES_PER_CALL = 5;

/**
 * Maximum shops processed per automatic call.
 */
const MAX_SHOPS_PER_CALL = 2;

/**
 * Shopee maximum page size.
 */
const PAGE_SIZE = 100;

/**
 * Completed shops only scan newest page.
 */
const INCREMENTAL_PAGES = 1;

/**
 * Small delay between Shopee calls.
 */
const REQUEST_DELAY_MS = 100;

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(
  value: unknown,
  fallback: string
): string {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    return fallback;
  }

  return value.trim();
}

function getBrandForShop(shopId: number): string {
  return (
    SHOP_BRANDS[String(shopId)] ||
    'BHPC'
  );
}

/**
 * ============================================================
 * TOKEN REFRESH
 * ============================================================
 */

async function refreshAccessToken(
  partnerId: string,
  partnerKey: string,
  refreshToken: string,
  shopId: number
) {
  try {
    const timestamp =
      Math.floor(Date.now() / 1000);

    const path =
      '/api/v2/auth/access_token/get';

    const baseString =
      `${partnerId}${path}${timestamp}`;

    const sign =
      crypto
        .createHmac(
          'sha256',
          partnerKey
        )
        .update(baseString)
        .digest('hex');

    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${encodeURIComponent(partnerId)}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const response =
      await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          partner_id:
            Number(partnerId),

          refresh_token:
            refreshToken,

          shop_id:
            Number(shopId),
        }),
      });

    const data =
      await response.json();

    console.log(
      `[Shopee Token Refresh] shop=${shopId}`,
      JSON.stringify(
        data,
        null,
        2
      )
    );

    if (
      data?.access_token
    ) {
      return {
        accessToken:
          data.access_token,

        refreshToken:
          data.refresh_token ||
          refreshToken,
      };
    }

    console.error(
      `[Shopee Token Refresh FAILED] shop=${shopId}`,
      JSON.stringify(
        data,
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      `[Shopee Token Refresh ERROR] shop=${shopId}:`,
      error
    );
  }

  return null;
}

/**
 * ============================================================
 * SHOPEE COMMENT URL
 * ============================================================
 */

function buildCommentUrl(
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: number,
  cursor: string
) {
  const timestamp =
    Math.floor(Date.now() / 1000);

  const path =
    '/api/v2/product/get_comment';

  const baseString =
    `${partnerId}${path}${timestamp}${accessToken}${shopId}`;

  const sign =
    crypto
      .createHmac(
        'sha256',
        partnerKey
      )
      .update(baseString)
      .digest('hex');

  const params =
    new URLSearchParams({
      partner_id:
        partnerId,

      timestamp:
        String(timestamp),

      access_token:
        accessToken,

      shop_id:
        String(shopId),

      sign,

      page_size:
        String(PAGE_SIZE),

      cursor:
        cursor || '',
    });

  return (
    `https://partner.shopeemobile.com${path}` +
    `?${params.toString()}`
  );
}

/**
 * ============================================================
 * TOKEN ERROR
 * ============================================================
 */

function isTokenError(
  response: any
): boolean {
  const text =
    `${response?.error || ''} ` +
    `${response?.message || ''}`
      .toLowerCase();

  return (
    text.includes('token') ||
    text.includes('auth') ||
    text.includes('access_token') ||
    text.includes('invalid access') ||
    text.includes('expired')
  );
}

/**
 * ============================================================
 * COMMENT EXTRACTION
 * ============================================================
 */

function extractCommentList(
  responseBody: any
): any[] {
  if (
    Array.isArray(
      responseBody?.item_comment_list
    )
  ) {
    return responseBody.item_comment_list;
  }

  if (
    Array.isArray(
      responseBody?.comment_list
    )
  ) {
    return responseBody.comment_list;
  }

  if (
    Array.isArray(
      responseBody?.list
    )
  ) {
    return responseBody.list;
  }

  return [];
}

/**
 * ============================================================
 * SAVE ONE REVIEW
 * ============================================================
 *
 * IMPORTANT:
 *
 * Existing reviews are NOT blindly updated.
 *
 * This prevents:
 *
 *     772 updated
 *
 * every time the incremental sync runs.
 *
 * Existing review status / AI reply are untouched.
 * ============================================================
 */

async function saveReview(
  item: any,
  shopId: number,
  assignedBrand: string
) {
  const reviewIdStr =
    String(
      item?.comment_id ||
      ''
    ).trim();

  if (!reviewIdStr) {
    throw new Error(
      `Shopee review missing comment_id for shop ${shopId}`
    );
  }

  const resolvedProductName =
    cleanText(
      item?.item_name ||
      item?.product_name ||
      item?.model_name ||
      item?.name ||
      (
        item?.item_id
          ? `Shopee Product ${item.item_id}`
          : ''
      ),
      'Unknown Product'
    );

  const resolvedProductSku =
    cleanText(
      item?.item_sku ||
      item?.model_sku,
      ''
    );

  const resolvedCustomerName =
    cleanText(
      item?.buyer_username ||
      item?.author_name,
      'Shopee Buyer'
    );

  const resolvedReviewText =
    cleanText(
      item?.comment ||
      item?.review ||
      item?.content,
      ''
    );

  const resolvedRating =
    Number(
      item?.rating_star ??
      item?.rating ??
      5
    );

  const resolvedStoreName =
    `${assignedBrand} Official Store (${shopId})`;

  /**
   * Find existing review.
   */

  const existing =
    await prisma.review.findUnique({
      where: {
        reviewId:
          reviewIdStr,
      },

      select: {
        id: true,
        shopId: true,
        marketplace: true,
        reviewText: true,
        rating: true,
        customerName: true,
        productName: true,
        productSku: true,
        brand: true,
        storeName: true,

        /**
         * Explicitly selected only for protection/debug.
         * Never modified here.
         */
        status: true,
        aiReply: true,
      },
    });

  /**
   * ==========================================================
   * NEW REVIEW
   * ==========================================================
   */

  if (!existing) {
    await prisma.review.create({
      data: {
        reviewId:
          reviewIdStr,

        marketplace:
          'SHOPEE',

        shopId:
          BigInt(shopId),

        productName:
          resolvedProductName,

        productSku:
          resolvedProductSku,

        customerName:
          resolvedCustomerName,

        rating:
          resolvedRating,

        reviewText:
          resolvedReviewText,

        status:
          'PENDING',

        brand:
          assignedBrand,

        storeName:
          resolvedStoreName,
      },
    });

    return {
      created: 1,
      updated: 0,
      skipped: 0,
      reviewId:
        reviewIdStr,
    };
  }

  /**
   * ==========================================================
   * EXISTING REVIEW
   * ==========================================================
   *
   * Only update marketplace/source fields if something
   * actually changed.
   *
   * status and aiReply are NEVER touched.
   */

  const changed =
    existing.shopId !== BigInt(shopId) ||
    existing.marketplace !== 'SHOPEE' ||
    existing.reviewText !== resolvedReviewText ||
    Number(existing.rating) !== resolvedRating ||
    existing.customerName !== resolvedCustomerName ||
    existing.productName !== resolvedProductName ||
    existing.productSku !== resolvedProductSku ||
    existing.brand !== assignedBrand ||
    existing.storeName !== resolvedStoreName;

  if (!changed) {
    return {
      created: 0,
      updated: 0,
      skipped: 1,
      reviewId:
        reviewIdStr,
    };
  }

  await prisma.review.update({
    where: {
      reviewId:
        reviewIdStr,
    },

    data: {
      shopId:
        BigInt(shopId),

      marketplace:
        'SHOPEE',

      reviewText:
        resolvedReviewText,

      rating:
        resolvedRating,

      customerName:
        resolvedCustomerName,

      productName:
        resolvedProductName,

      productSku:
        resolvedProductSku,

      brand:
        assignedBrand,

      storeName:
        resolvedStoreName,
    },
  });

  return {
    created: 0,
    updated: 1,
    skipped: 0,
    reviewId:
      reviewIdStr,
  };
}

/**
 * ============================================================
 * PROCESS ONE SHOP
 * ============================================================
 */

async function processShop(
  account: any,
  partnerId: string,
  partnerKey: string
) {
  const shopId =
    Number(account.shopId);

  let accessToken =
    account.accessToken;

  const refreshToken =
    account.refreshToken;

  const assignedBrand =
    getBrandForShop(shopId);

  const wasAlreadyCompleted =
    Boolean(
      account.reviewSyncDone
    );

  let syncedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  let shopHasError = false;

  const failedReasons: string[] = [];

  if (!accessToken) {
    return {
      shopId,
      brand: assignedBrand,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      error: 'No access token available',
      hasMore: false,
      cursorSaved: false,
      pagesProcessed: 0,
      reviewSyncDone: false,
    };
  }

  /**
   * Completed shops:
   *
   * Start from newest reviews only.
   *
   * IMPORTANT:
   *
   * We intentionally DO NOT save a new cursor here.
   * This keeps the shop in incremental mode.
   */

  let cursor =
    wasAlreadyCompleted
      ? ''
      : String(
          account.reviewCursor ||
          ''
        ).trim();

  const maxPages =
    wasAlreadyCompleted
      ? INCREMENTAL_PAGES
      : MAX_PAGES_PER_CALL;

  let hasMore =
    true;

  let pagesProcessed =
    0;

  console.log(
    '================================================'
  );

  console.log(
    `[Shopee Sync] shop=${shopId}`
  );

  console.log(
    `[Shopee Sync] brand=${assignedBrand}`
  );

  console.log(
    `[Shopee Sync] mode=${
      wasAlreadyCompleted
        ? 'INCREMENTAL'
        : 'HISTORICAL'
    }`
  );

  console.log(
    `[Shopee Sync] starting cursor=${
      cursor
        ? '[SAVED CURSOR]'
        : '[FIRST REQUEST]'
    }`
  );

  console.log(
    '================================================'
  );

  /**
   * ==========================================================
   * CURSOR LOOP
   * ==========================================================
   */

  while (
    hasMore &&
    pagesProcessed < maxPages
  ) {
    pagesProcessed++;

    const currentCursor =
      cursor;

    try {
      console.log(
        `[Shopee Sync] FETCH shop=${shopId} brand=${assignedBrand} batch=${pagesProcessed} mode=${
          wasAlreadyCompleted
            ? 'INCREMENTAL'
            : 'HISTORICAL'
        } cursor=${
          currentCursor
            ? '[CURSOR]'
            : '[FIRST]'
        }`
      );

      let url =
        buildCommentUrl(
          partnerId,
          partnerKey,
          accessToken,
          shopId,
          currentCursor
        );

      let response =
        await fetch(url, {
          method: 'GET',

          headers: {
            'Content-Type':
              'application/json',
          },

          cache:
            'no-store',
        });

      let shopeeResponse =
        await response.json();

      /**
       * ========================================================
       * TOKEN REFRESH
       * ========================================================
       */

      if (
        !response.ok ||
        isTokenError(
          shopeeResponse
        )
      ) {
        console.log(
          `[Shopee Sync] Token/API authentication issue shop=${shopId}`
        );

        if (!refreshToken) {
          failedReasons.push(
            'Token expired and no refresh token available'
          );

          shopHasError =
            true;

          break;
        }

        const refreshed =
          await refreshAccessToken(
            partnerId,
            partnerKey,
            refreshToken,
            shopId
          );

        if (!refreshed) {
          failedReasons.push(
            'Token refresh failed'
          );

          shopHasError =
            true;

          break;
        }

        accessToken =
          refreshed.accessToken;

        await prisma.shopeeAccount.updateMany({
          where: {
            shopId:
              BigInt(shopId),
          },

          data: {
            accessToken:
              refreshed.accessToken,

            refreshToken:
              refreshed.refreshToken,
          },
        });

        url =
          buildCommentUrl(
            partnerId,
            partnerKey,
            accessToken,
            shopId,
            currentCursor
          );

        response =
          await fetch(url, {
            method: 'GET',

            headers: {
              'Content-Type':
                'application/json',
            },

            cache:
              'no-store',
          });

        shopeeResponse =
          await response.json();
      }

      /**
       * ========================================================
       * FINAL API ERROR CHECK
       * ========================================================
       */

      if (
        !response.ok ||
        shopeeResponse?.error
      ) {
        const reason =
          `Cursor batch ${pagesProcessed}: ` +
          `${
            shopeeResponse?.error ||
            'HTTP ' + response.status
          }` +
          `${
            shopeeResponse?.message
              ? ` - ${shopeeResponse.message}`
              : ''
          }`;

        console.error(
          `[Shopee Sync ERROR] shop=${shopId}`,
          reason
        );

        failedReasons.push(
          reason
        );

        shopHasError =
          true;

        break;
      }

      /**
       * ========================================================
       * RESPONSE
       * ========================================================
       */

      const responseBody =
        shopeeResponse?.response ||
        {};

      const commentList =
        extractCommentList(
          responseBody
        );

      const apiHasMore =
        Boolean(
          responseBody?.more
        );

      const nextCursor =
        String(
          responseBody?.next_cursor ||
          ''
        ).trim();

      console.log(
        `[Shopee Reviews DEBUG] shop=${shopId} brand=${assignedBrand} batch=${pagesProcessed}`,
        JSON.stringify(
          {
            mode:
              wasAlreadyCompleted
                ? 'INCREMENTAL'
                : 'HISTORICAL',

            commentCount:
              commentList.length,

            more:
              apiHasMore,

            nextCursor:
              nextCursor
                ? '[PRESENT]'
                : null,
          },
          null,
          2
        )
      );

      /**
       * ========================================================
       * EMPTY
       * ========================================================
       */

      if (
        commentList.length === 0
      ) {
        hasMore =
          false;

        /**
         * Historical mode:
         * complete the shop.
         */

        if (!wasAlreadyCompleted) {
          await prisma.shopeeAccount.update({
            where: {
              shopId:
                BigInt(shopId),
            },

            data: {
              reviewCursor:
                null,

              nextReviewPage:
                1,

              reviewSyncDone:
                true,
            },
          });
        }

        break;
      }

      /**
       * ========================================================
       * SAVE REVIEWS
       * ========================================================
       */

      for (
        let index = 0;
        index < commentList.length;
        index++
      ) {
        const item =
          commentList[index];

        try {
          const saveResult =
            await saveReview(
              item,
              shopId,
              assignedBrand
            );

          syncedCount +=
            saveResult.created +
            saveResult.updated;

          createdCount +=
            saveResult.created;

          updatedCount +=
            saveResult.updated;

          skippedCount +=
            saveResult.skipped;

          if (
            saveResult.created
          ) {
            console.log(
              `[Shopee Reviews CREATED] shop=${shopId} brand=${assignedBrand} review=${saveResult.reviewId}`
            );
          } else if (
            saveResult.updated
          ) {
            console.log(
              `[Shopee Reviews UPDATED] shop=${shopId} brand=${assignedBrand} review=${saveResult.reviewId}`
            );
          }
        } catch (error: any) {
          const reason =
            `Review ${
              item?.comment_id ||
              `index-${index}`
            }: ${
              error?.message ||
              'Save failed'
            }`;

          console.error(
            `[Shopee Reviews SAVE ERROR] shop=${shopId}`,
            reason
          );

          failedReasons.push(
            reason
          );
        }
      }

      /**
       * ========================================================
       * HISTORICAL PAGINATION
       * ========================================================
       */

      if (!wasAlreadyCompleted) {
        if (
          !apiHasMore ||
          !nextCursor
        ) {
          hasMore =
            false;

          await prisma.shopeeAccount.update({
            where: {
              shopId:
                BigInt(shopId),
            },

            data: {
              reviewCursor:
                null,

              nextReviewPage:
                1,

              reviewSyncDone:
                true,
            },
          });

          console.log(
            `[Shopee Sync COMPLETE] shop=${shopId} brand=${assignedBrand}`
          );
        } else {
          cursor =
            nextCursor;

          await prisma.shopeeAccount.update({
            where: {
              shopId:
                BigInt(shopId),
            },

            data: {
              reviewCursor:
                cursor,

              reviewSyncDone:
                false,
            },
          });

          console.log(
            `[Shopee Sync PROGRESS] shop=${shopId} brand=${assignedBrand} saved next cursor`
          );
        }
      } else {
        /**
         * ======================================================
         * INCREMENTAL MODE
         * ======================================================
         *
         * NEVER turn completed shop back to incomplete.
         *
         * NEVER save the newest-page cursor.
         *
         * Next run checks newest reviews again.
         */

        hasMore =
          false;

        console.log(
          `[Shopee Sync INCREMENTAL COMPLETE] shop=${shopId} checked newest page only`
        );
      }

      if (
        hasMore &&
        pagesProcessed < maxPages
      ) {
        await delay(
          REQUEST_DELAY_MS
        );
      }
    } catch (error: any) {
      console.error(
        `[Shopee Sync ERROR] shop=${shopId} brand=${assignedBrand} batch=${pagesProcessed}:`,
        error
      );

      failedReasons.push(
        `Cursor batch ${pagesProcessed}: ${
          error?.message ||
          'Unknown error'
        }`
      );

      shopHasError =
        true;

      break;
    }
  }

  /**
   * ==========================================================
   * DATABASE COUNT
   * ==========================================================
   */

  let databaseCount =
    0;

  try {
    databaseCount =
      await prisma.review.count({
        where: {
          shopId:
            BigInt(shopId),

          marketplace:
            'SHOPEE',

          brand:
            assignedBrand,
        },
      });
  } catch (error) {
    console.error(
      `[Shopee Reviews COUNT ERROR] shop=${shopId}:`,
      error
    );
  }

  /**
   * ==========================================================
   * READ FINAL ACCOUNT STATE
   * ==========================================================
   */

  const savedAccount =
    await prisma.shopeeAccount.findUnique({
      where: {
        shopId:
          BigInt(shopId),
      },

      select: {
        reviewCursor:
          true,

        nextReviewPage:
          true,

        reviewSyncDone:
          true,
      },
    });

  const savedCursor =
    String(
      savedAccount?.reviewCursor ||
      ''
    ).trim();

  const reviewSyncDone =
    Boolean(
      savedAccount?.reviewSyncDone
    );

  const finalHasMore =
    !shopHasError &&
    !reviewSyncDone &&
    Boolean(savedCursor);

  console.log(
    '------------------------------------------------'
  );

  console.log(
    `[Shopee Sync RESULT] shop=${shopId}`
  );

  console.log(
    `[Shopee Sync RESULT] brand=${assignedBrand}`
  );

  console.log(
    `[Shopee Sync RESULT] mode=${
      wasAlreadyCompleted
        ? 'INCREMENTAL'
        : 'HISTORICAL'
    }`
  );

  console.log(
    `[Shopee Sync RESULT] synced=${syncedCount}`
  );

  console.log(
    `[Shopee Sync RESULT] created=${createdCount}`
  );

  console.log(
    `[Shopee Sync RESULT] updated=${updatedCount}`
  );

  console.log(
    `[Shopee Sync RESULT] skipped=${skippedCount}`
  );

  console.log(
    `[Shopee Sync RESULT] databaseCount=${databaseCount}`
  );

  console.log(
    `[Shopee Sync RESULT] cursorSaved=${
      savedCursor
        ? 'YES'
        : 'NO'
    }`
  );

  console.log(
    `[Shopee Sync RESULT] done=${reviewSyncDone}`
  );

  console.log(
    '------------------------------------------------'
  );

  return {
    shopId,

    brand:
      assignedBrand,

    mode:
      wasAlreadyCompleted
        ? 'INCREMENTAL'
        : 'HISTORICAL',

    synced:
      syncedCount,

    created:
      createdCount,

    updated:
      updatedCount,

    skipped:
      skippedCount,

    databaseCount,

    error:
      shopHasError
        ? failedReasons.join('; ')
        : null,

    hasMore:
      finalHasMore,

    cursorSaved:
      Boolean(savedCursor),

    pagesProcessed,

    reviewSyncDone,
  };
}

/**
 * ============================================================
 * POST /api/reviews/sync
 * ============================================================
 */

export async function POST(
  request: Request
) {
  console.log(
    '=== REVIEW SYNC START ==='
  );

  try {
    const partnerId =
      process.env.SHOPEE_PARTNER_ID;

    const partnerKey =
      process.env.SHOPEE_PARTNER_KEY;

    if (
      !partnerId ||
      !partnerKey
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'Missing Shopee API partner credentials in environment variables.',
        },

        {
          status: 400,
        }
      );
    }

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const shopIdParam =
      searchParams.get(
        'shopId'
      );

    if (
      searchParams.has(
        'pageNo'
      )
    ) {
      console.log(
        '[Shopee Sync] pageNo ignored — cursor pagination active'
      );
    }

    /**
     * ========================================================
     * LOAD ACCOUNTS
     * ========================================================
     */

    const accounts =
      await prisma.shopeeAccount.findMany({
        orderBy: {
          createdAt:
            'asc',
        },
      });

    console.log(
      'Accounts found:',
      accounts.length
    );

    if (
      accounts.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            'No Shopee accounts found.',
        },

        {
          status: 400,
        }
      );
    }

    /**
     * ========================================================
     * SPECIFIC SHOP
     * ========================================================
     */

    let targetAccounts =
      shopIdParam
        ? accounts.filter(
            (account) =>
              String(
                account.shopId
              ) ===
              String(
                shopIdParam
              )
          )
        : accounts;

    if (
      shopIdParam &&
      targetAccounts.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Shop ${shopIdParam} not found among authorized accounts.`,
        },

        {
          status: 404,
        }
      );
    }

    /**
     * ========================================================
     * AUTOMATIC ROTATION
     * ========================================================
     *
     * CRITICAL FIX:
     *
     * DO NOT select completed shops for historical rotation.
     *
     * Only:
     *
     *   reviewSyncDone = false
     *
     * shops are selected here.
     *
     * This prevents:
     *
     *   completed → cursor null → full history again
     */

    const totalAuthorizedShops =
      accounts.length;

    if (!shopIdParam) {
      targetAccounts =
        accounts
          .filter(
            (account) =>
              !account.reviewSyncDone
          )
          .sort(
            (a, b) => {
              /**
               * Cursor shops first.
               */

              const cursorA =
                a.reviewCursor
                  ? 0
                  : 1;

              const cursorB =
                b.reviewCursor
                  ? 0
                  : 1;

              if (
                cursorA !==
                cursorB
              ) {
                return (
                  cursorA -
                  cursorB
                );
              }

              return (
                new Date(
                  a.createdAt
                ).getTime() -
                new Date(
                  b.createdAt
                ).getTime()
              );
            }
          )
          .slice(
            0,
            MAX_SHOPS_PER_CALL
          );
    }

    /**
     * ========================================================
     * ALL SHOPS COMPLETE
     * ========================================================
     */

    if (
      !shopIdParam &&
      targetAccounts.length === 0
    ) {
      console.log(
        '[Shopee Sync] All historical shops completed. Nothing to process.'
      );

      return NextResponse.json({
        success: true,

        syncedCount: 0,

        createdCount: 0,

        updatedCount: 0,

        skippedCount: 0,

        processedShops: 0,

        totalAuthorizedShops,

        successfulShops: 0,

        failedShopCount: 0,

        failedShops: [],

        completedShops: 0,

        hasMore: false,

        shopResults: [],

        message:
          `All ${totalAuthorizedShops} Shopee shops are already historically synchronized.`,
      });
    }

    /**
     * ========================================================
     * LOG TARGET SHOPS
     * ========================================================
     */

    console.log(
      '[Shopee Sync] Selected shops:',
      targetAccounts.map(
        (account) =>
          `${account.shopId}` +
          `:cursor=${
            account.reviewCursor
              ? 'SAVED'
              : 'FIRST'
          }` +
          `:done=${
            account.reviewSyncDone
          }` +
          `:brand=${
            getBrandForShop(
              Number(
                account.shopId
              )
            )
          }`
      )
    );

    /**
     * ========================================================
     * PROCESS
     * ========================================================
     */

    const results: any[] = [];

    for (
      const account of
        targetAccounts
    ) {
      const result =
        await processShop(
          account,
          partnerId,
          partnerKey
        );

      results.push(
        result
      );
    }

    /**
     * ========================================================
     * SUMMARY
     * ========================================================
     */

    const syncedCount =
      results.reduce(
        (total, result) =>
          total +
          Number(
            result.synced ||
            0
          ),
        0
      );

    const createdCount =
      results.reduce(
        (total, result) =>
          total +
          Number(
            result.created ||
            0
          ),
        0
      );

    const updatedCount =
      results.reduce(
        (total, result) =>
          total +
          Number(
            result.updated ||
            0
          ),
        0
      );

    const skippedCount =
      results.reduce(
        (total, result) =>
          total +
          Number(
            result.skipped ||
            0
          ),
        0
      );

    const successfulShops =
      results.filter(
        (result) =>
          !result.error
      ).length;

    const failedShops =
      results
        .filter(
          (result) =>
            result.error
        )
        .map(
          (result) =>
            `${result.shopId}: ${result.error}`
        );

    const hasMore =
      results.some(
        (result) =>
          result.hasMore
      );

    const completedShops =
      results.filter(
        (result) =>
          result.reviewSyncDone
      ).length;

    console.log(
      '================================================'
    );

    console.log(
      '[Shopee Sync SUMMARY]'
    );

    console.log(
      `Synced: ${syncedCount}`
    );

    console.log(
      `Created: ${createdCount}`
    );

    console.log(
      `Updated: ${updatedCount}`
    );

    console.log(
      `Skipped: ${skippedCount}`
    );

    console.log(
      `Successful shops: ${successfulShops}/${targetAccounts.length}`
    );

    console.log(
      `Completed shops: ${completedShops}`
    );

    console.log(
      `Has more: ${hasMore}`
    );

    console.log(
      '================================================'
    );

    console.log(
      '=== REVIEW SYNC END ==='
    );

    return NextResponse.json({
      success: true,

      syncedCount,

      createdCount,

      updatedCount,

      skippedCount,

      processedShops:
        targetAccounts.length,

      totalAuthorizedShops,

      successfulShops,

      failedShopCount:
        failedShops.length,

      failedShops,

      completedShops,

      hasMore,

      shopResults:
        results,

      message:
        `Synchronized ${syncedCount} reviews across ${successfulShops}/${targetAccounts.length} shop(s).`,
    });
  } catch (error: any) {
    console.error(
      'Shopee Sync Error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          'Unknown error',
      },

      {
        status: 500,
      }
    );
  }
}