import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SHOP_BRANDS: Record<string, string> = {
  '74401016': 'RAV',
  '115383763': 'RAV',
  '170808053': 'JOHN_LANGFORD',
  '170811257': 'BHPC',
  '282544493': 'HUSH',
  '469553987': 'OBERMAIN',
  '1637647671': 'OBERMAIN',
  '1747523033': 'OBERMAIN',
  '1747523036': 'OBERMAIN',
  '190669704': 'NICOLE',
  '66854646': 'NICOLE',
  '1770621264': 'RAV',
  '1770621271': 'RAV',
};

const MAX_PAGES_PER_CALL = 5;
const MAX_SHOPS_PER_CALL = 2;
const PAGE_SIZE = 50;

function cleanText(val: any, fallback: string): string {
  if (!val || typeof val !== 'string' || val.trim() === '') {
    return fallback;
  }

  return val.trim();
}

async function refreshAccessToken(
  partnerId: string,
  partnerKey: string,
  refreshToken: string,
  shopId: number
) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';

    const baseString = `${partnerId}${path}${timestamp}`;

    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');

    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${partnerId}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partner_id: Number(partnerId),
        refresh_token: refreshToken,
        shop_id: Number(shopId),
      }),
    });

    const data = await res.json();

    console.log(
      `[Shopee Token Refresh] shop=${shopId}`,
      JSON.stringify(data, null, 2)
    );

    if (data.access_token) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
      };
    }

    console.error(
      `[Shopee Token Refresh FAILED] shop=${shopId}`,
      JSON.stringify(data, null, 2)
    );
  } catch (e) {
    console.error(
      `[Shopee Token Refresh ERROR] shop=${shopId}:`,
      e
    );
  }

  return null;
}

async function processShop(
  account: any,
  partnerId: string,
  partnerKey: string,
  requestedPageNo?: number
) {
  const shopId = Number(account.shopId);

  let accessToken = account.accessToken;
  const refreshToken = account.refreshToken;

  const assignedBrand =
    SHOP_BRANDS[String(shopId)] || 'BHPC';

  let syncedCount = 0;
  let shopHasError = false;

  const failedReasons: string[] = [];

  if (!accessToken) {
    return {
      shopId,
      brand: assignedBrand,
      synced: 0,
      error: 'No access token available',
      hasMore: false,
      pageNo: null,
      nextPageNo: null,
      pagesProcessed: 0,
      reviewSyncDone: false,
    };
  }

  /*
   * If pageNo is explicitly supplied, use it.
   * Otherwise use the saved page for this shop.
   */
  let pageNo =
    Number.isInteger(requestedPageNo) &&
    Number(requestedPageNo) > 0
      ? Number(requestedPageNo)
      : Number(account.nextReviewPage || 1);

  if (pageNo < 1) {
    pageNo = 1;
  }

  let hasMore = true;
  let pagesProcessed = 0;

  console.log(
    `[Shopee Sync] shop=${shopId} starting page=${pageNo}`
  );

  while (
    hasMore &&
    pagesProcessed < MAX_PAGES_PER_CALL
  ) {
    pagesProcessed++;

    const currentPage = pageNo;

    const timestamp = Math.floor(Date.now() / 1000);

    const path =
      '/api/v2/product/get_comment';

    const baseString =
      `${partnerId}${path}${timestamp}${accessToken}${shopId}`;

    const sign = crypto
      .createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');

    const url =
      `https://partner.shopeemobile.com${path}` +
      `?partner_id=${partnerId}` +
      `&timestamp=${timestamp}` +
      `&access_token=${accessToken}` +
      `&shop_id=${shopId}` +
      `&sign=${sign}` +
      `&page_size=${PAGE_SIZE}` +
      `&page_no=${currentPage}`;

    try {
      let res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let shopeeResponse = await res.json();

      const errorText =
        `${shopeeResponse?.error || ''} ` +
        `${shopeeResponse?.message || ''}`.toLowerCase();

      // ==========================================
      // TOKEN REFRESH
      // ==========================================

      if (
        errorText.includes('token') ||
        errorText.includes('auth') ||
        errorText.includes('access_token')
      ) {
        if (refreshToken) {
          const refreshed =
            await refreshAccessToken(
              partnerId,
              partnerKey,
              refreshToken,
              shopId
            );

          if (refreshed) {
            accessToken = refreshed.accessToken;

            await prisma.shopeeAccount.updateMany({
              where: {
                shopId: BigInt(shopId),
              },
              data: {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
              },
            });

            const newTimestamp =
              Math.floor(Date.now() / 1000);

            const newBaseString =
              `${partnerId}${path}${newTimestamp}${accessToken}${shopId}`;

            const newSign = crypto
              .createHmac('sha256', partnerKey)
              .update(newBaseString)
              .digest('hex');

            const newUrl =
              `https://partner.shopeemobile.com${path}` +
              `?partner_id=${partnerId}` +
              `&timestamp=${newTimestamp}` +
              `&access_token=${accessToken}` +
              `&shop_id=${shopId}` +
              `&sign=${newSign}` +
              `&page_size=${PAGE_SIZE}` +
              `&page_no=${currentPage}`;

            const retryRes = await fetch(newUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            shopeeResponse =
              await retryRes.json();
          } else {
            failedReasons.push(
              'Token refresh failed'
            );

            shopHasError = true;
            break;
          }
        } else {
          failedReasons.push(
            'Token expired and no refresh token available'
          );

          shopHasError = true;
          break;
        }
      }

      // ==========================================
      // SHOPEE API ERROR
      // ==========================================

      if (shopeeResponse?.error) {
        failedReasons.push(
          `Page ${currentPage}: ${shopeeResponse.error} - ${
            shopeeResponse.message || ''
          }`
        );

        shopHasError = true;
        break;
      }

      // ==========================================
      // COMMENT LIST
      // ==========================================

      const commentList =
        shopeeResponse?.response?.item_comment_list ||
        shopeeResponse?.response?.comment_list ||
        shopeeResponse?.response?.list;

      if (
        commentList &&
        Array.isArray(commentList) &&
        commentList.length > 0
      ) {
        for (
          let idx = 0;
          idx < commentList.length;
          idx++
        ) {
          const item = commentList[idx];

          const reviewIdStr = String(
            item.comment_id ||
              `${shopId}-${currentPage}-${idx}`
          );

          const resolvedProductName =
            cleanText(
              item.item_name ||
                item.product_name ||
                item.model_name ||
                item.name ||
                (
                  item.item_id
                    ? `Shopee Product ${item.item_id}`
                    : ''
                ),
              'Unknown Product'
            );

          const resolvedProductSku =
            cleanText(
              item.item_sku ||
                item.model_sku,
              ''
            );

          const resolvedCustomerName =
            cleanText(
              item.buyer_username ||
                item.author_name,
              'Shopee Buyer'
            );

          const resolvedReviewText =
            cleanText(
              item.comment ||
                item.review ||
                item.content,
              ''
            );

          const resolvedRating =
            Number(
              item.rating_star ||
                item.rating ||
                5
            );

          // ==========================================
          // SAVE REVIEW
          // ==========================================

          await prisma.review.upsert({
            where: {
              reviewId: reviewIdStr,
            },

            update: {
              shopId: BigInt(shopId),

              marketplace: 'SHOPEE',

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
                `${assignedBrand} Official Store (${shopId})`,
            },

            create: {
              reviewId: reviewIdStr,

              marketplace: 'SHOPEE',

              shopId: BigInt(shopId),

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

              status: 'PENDING',

              brand:
                assignedBrand,

              storeName:
                `${assignedBrand} Official Store (${shopId})`,
            },
          });

          syncedCount++;
        }

        // ==========================================
        // PAGINATION
        // ==========================================

        const apiHasMore =
          Boolean(
            shopeeResponse?.response?.more
          );

        if (
          commentList.length < PAGE_SIZE ||
          !apiHasMore
        ) {
          /*
           * This shop reached the end.
           *
           * Mark it complete and reset its page
           * for the next complete sync cycle.
           */
          hasMore = false;

          await prisma.shopeeAccount.update({
            where: {
              shopId: BigInt(shopId),
            },
            data: {
              nextReviewPage: 1,
              reviewSyncDone: true,
            },
          });

          console.log(
            `[Shopee Sync COMPLETE] shop=${shopId} reached end.`
          );
        } else {
          /*
           * More pages exist.
           *
           * Save the next page immediately.
           */
          pageNo = currentPage + 1;

          await prisma.shopeeAccount.update({
            where: {
              shopId: BigInt(shopId),
            },
            data: {
              nextReviewPage: pageNo,
              reviewSyncDone: false,
            },
          });

          console.log(
            `[Shopee Sync PROGRESS] shop=${shopId} saved next page=${pageNo}`
          );
        }
      } else {
        /*
         * No comments means pagination is complete.
         */
        hasMore = false;

        await prisma.shopeeAccount.update({
          where: {
            shopId: BigInt(shopId),
          },
          data: {
            nextReviewPage: 1,
            reviewSyncDone: true,
          },
        });

        console.log(
          `[Shopee Sync COMPLETE] shop=${shopId} returned no more reviews.`
        );
      }
    } catch (err: any) {
      console.error(
        `[Shopee Sync ERROR] shop=${shopId} page=${currentPage}:`,
        err
      );

      failedReasons.push(
        `Page ${currentPage}: ${
          err?.message ||
          'Unknown network error'
        }`
      );

      shopHasError = true;

      /*
       * Do NOT advance the page after an error.
       */
      break;
    }
  }

  // ==========================================
  // READ SAVED STATE
  // ==========================================

  const savedAccount =
    await prisma.shopeeAccount.findUnique({
      where: {
        shopId: BigInt(shopId),
      },
      select: {
        nextReviewPage: true,
        reviewSyncDone: true,
      },
    });

  const savedNextPage =
    Number(
      savedAccount?.nextReviewPage || 1
    );

  const reviewSyncDone =
    Boolean(
      savedAccount?.reviewSyncDone
    );

  const finalHasMore =
    !shopHasError &&
    !reviewSyncDone;

  return {
    shopId,
    brand: assignedBrand,
    synced: syncedCount,

    error: shopHasError
      ? failedReasons.join('; ')
      : null,

    hasMore: finalHasMore,

    pageNo:
      savedNextPage > 1
        ? savedNextPage - 1
        : null,

    nextPageNo:
      finalHasMore
        ? savedNextPage
        : null,

    pagesProcessed,

    reviewSyncDone,
  };
}

// ==========================================
// POST /api/reviews/sync
// ==========================================

export async function POST(
  request: Request
) {
  console.log(
    '=== REVIEW SYNC START ==='
  );

  try {
    // ==========================================
    // SHOPEE CREDENTIALS
    // ==========================================

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

    // ==========================================
    // QUERY PARAMETERS
    // ==========================================

    const {
      searchParams,
    } = new URL(request.url);

    const shopIdParam =
      searchParams.get('shopId');

    /*
     * Optional manual page override.
     *
     * Normally don't provide this.
     * The database remembers the page.
     */
    const pageNoParam =
      searchParams.get('pageNo');

    const requestedPageNo =
      pageNoParam &&
      Number(pageNoParam) > 0
        ? Number(pageNoParam)
        : undefined;

    // ==========================================
    // LOAD ACCOUNTS
    // ==========================================

    const accounts =
      await prisma.shopeeAccount.findMany({
        orderBy: {
          createdAt: 'asc',
        },
      });

    console.log(
      'Accounts found:',
      accounts.length
    );

    if (
      !accounts ||
      accounts.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No Shopee accounts found. Please authorize your Shopee shops first.',
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // SELECT TARGET SHOPS
    // ==========================================

    let targetAccounts = shopIdParam
      ? accounts.filter(
          (account) =>
            String(account.shopId) ===
            String(shopIdParam)
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

    // ==========================================
    // ALL-SHOP ROTATION
    // ==========================================
    //
    // For a manual shopId request:
    //   Process that exact shop.
    //
    // For an all-shop request:
    //   1. Incomplete shops first
    //   2. Lowest nextReviewPage first
    //   3. Oldest account first
    //
    // This means shops that have not started yet
    // naturally get priority over shops already
    // being synced.
    //
    // Maximum 2 shops per request keeps the
    // operation safely below Vercel timeout.
    // ==========================================

    const totalAuthorizedShops =
      targetAccounts.length;

    if (!shopIdParam) {
      targetAccounts = [...targetAccounts]
        .sort((a, b) => {
          // Incomplete shops first
          const doneA =
            a.reviewSyncDone ? 1 : 0;

          const doneB =
            b.reviewSyncDone ? 1 : 0;

          if (doneA !== doneB) {
            return doneA - doneB;
          }

          // Lower page first
          const pageA =
            Number(
              a.nextReviewPage || 1
            );

          const pageB =
            Number(
              b.nextReviewPage || 1
            );

          if (pageA !== pageB) {
            return pageA - pageB;
          }

          // Stable account order
          return (
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
          );
        })
        .slice(
          0,
          MAX_SHOPS_PER_CALL
        );
    }

    console.log(
      '[Shopee Sync] Selected shops:',
      targetAccounts.map(
        (account) =>
          `${account.shopId}:page=${account.nextReviewPage}:done=${account.reviewSyncDone}`
      )
    );

    // ==========================================
    // PROCESS SHOPS
    // ==========================================

    const results: any[] = [];

    for (
      const account of targetAccounts
    ) {
      console.log(
        'Processing shop:',
        account.shopId,
        'savedPage:',
        account.nextReviewPage,
        'manualPage:',
        requestedPageNo || 'none'
      );

      const result =
        await processShop(
          account,
          partnerId,
          partnerKey,
          requestedPageNo
        );

      results.push(result);
    }

    // ==========================================
    // SUMMARY
    // ==========================================

    const syncedCount =
      results.reduce(
        (sum, result) =>
          sum +
          Number(result.synced || 0),
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

    // ==========================================
    // RESPONSE
    // ==========================================

    console.log(
      '=== REVIEW SYNC END ==='
    );

    return NextResponse.json({
      success: true,

      syncedCount,

      processedShops:
        targetAccounts.length,

      totalAuthorizedShops,

      successfulShops,

      failedShopCount:
        failedShops.length,

      failedShops,

      completedShops,

      hasMore,

      manualPageNo:
        requestedPageNo || null,

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