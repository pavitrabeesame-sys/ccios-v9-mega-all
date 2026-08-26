import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Bump from 60 to 300 seconds

/**
 * ============================================================
 * CCIOS — SHOPEE BULK REVIEW REPLY
 * ============================================================
 *
 * POST body:
 *
 * {
 *   "ids": [
 *     "DATABASE_REVIEW_ID_1",
 *     "DATABASE_REVIEW_ID_2"
 *   ]
 * }
 *
 * Flow:
 *
 * 1. Load eligible Shopee reviews
 * 2. Validate AI replies
 * 3. Group reviews by review.shopId
 * 4. Get valid Shopee token for each shop
 * 5. Create Shopee signature
 * 6. Send bulk reply_comment request
 * 7. Validate HTTP response
 * 8. Validate per-comment result
 * 9. Treat duplicate_request as already replied
 * 10. Update Prisma only for confirmed success
 *
 * IMPORTANT:
 *
 * - shopId comes directly from Review.shopId
 * - storeName is NEVER used to determine a Shopee shop
 * - Database status is NOT changed before Shopee confirms success
 *
 * ============================================================
 */

const SHOPEE_HOST =
  'https://partner.shopeemobile.com';

const SHOPEE_REPLY_PATH =
  '/api/v2/product/reply_comment';

const SHOPEE_PARTNER_ID =
  String(process.env.SHOPEE_PARTNER_ID || '')
    .trim()
    .replace(/['"]/g, '');

const SHOPEE_PARTNER_KEY =
  String(process.env.SHOPEE_PARTNER_KEY || '')
    .trim()
    .replace(/['"]/g, '');

/**
 * ============================================================
 * ERROR HELPER
 * ============================================================
 */

function getErrorMessage(error: unknown): string {
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
 * CONFIG VALIDATION
 * ============================================================
 */

function validateShopeeConfig() {
  if (!SHOPEE_PARTNER_ID) {
    throw new Error(
      'SHOPEE_PARTNER_ID is not configured.'
    );
  }

  if (!SHOPEE_PARTNER_KEY) {
    throw new Error(
      'SHOPEE_PARTNER_KEY is not configured.'
    );
  }
}

/**
 * ============================================================
 * CREATE SHOPEE SIGNATURE
 * ============================================================
 */

function createShopeeSignature({
  timestamp,
  accessToken,
  shopId,
}: {
  timestamp: number;
  accessToken: string;
  shopId: string;
}) {
  const baseString =
    `${SHOPEE_PARTNER_ID}` +
    `${SHOPEE_REPLY_PATH}` +
    `${timestamp}` +
    `${accessToken}` +
    `${shopId}`;

  return crypto
    .createHmac(
      'sha256',
      SHOPEE_PARTNER_KEY
    )
    .update(baseString)
    .digest('hex');
}

/**
 * ============================================================
 * CREATE SHOPEE URL
 * ============================================================
 */

function createShopeeUrl({
  timestamp,
  accessToken,
  shopId,
  sign,
}: {
  timestamp: number;
  accessToken: string;
  shopId: string;
  sign: string;
}) {
  const params = new URLSearchParams({
    partner_id: SHOPEE_PARTNER_ID,
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: shopId,
    sign,
  });

  return (
    `${SHOPEE_HOST}` +
    `${SHOPEE_REPLY_PATH}` +
    `?${params.toString()}`
  );
}

/**
 * ============================================================
 * PLACEHOLDER VALIDATION
 * ============================================================
 */

function containsPlaceholder(reply: string): boolean {
  const placeholders = [
    '[Company Name]',
    '[Your Company Name]',
    '[Customer Service Team]',
    '[Your Customer Service Team]',
    '[Customer Service]',
    '[Brand Name]',
    '[Your Brand]',
    '[Store Name]',
    '[Customer Name]',
    '[Product Name]',
  ];

  const hasKnownPlaceholder =
    placeholders.some((placeholder) =>
      reply.includes(placeholder)
    );

  /**
   * Reject any remaining bracket placeholders.
   *
   * Examples:
   *
   * [company]
   * [customer]
   * [insert name]
   * [product]
   */
  const hasBracketPlaceholder =
    /\[[^\]]+\]/.test(reply);

  return (
    hasKnownPlaceholder ||
    hasBracketPlaceholder
  );
}

/**
 * ============================================================
 * CLEAN REPLY
 * ============================================================
 */

function cleanReply(
  value: unknown
): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * ============================================================
 * VALIDATE REPLY
 * ============================================================
 */

function validateReply(
  value: unknown
): {
  valid: boolean;
  reply: string;
  reason?: string;
} {
  const reply = cleanReply(value);

  if (!reply) {
    return {
      valid: false,
      reply,
      reason: 'AI reply is empty.',
    };
  }

  if (reply.length < 15) {
    return {
      valid: false,
      reply,
      reason:
        'AI reply is too short.',
    };
  }

  if (reply.length > 500) {
    return {
      valid: false,
      reply,
      reason:
        'AI reply exceeds 500 characters.',
    };
  }

  if (containsPlaceholder(reply)) {
    return {
      valid: false,
      reply,
      reason:
        'AI reply contains placeholder text.',
    };
  }

  return {
    valid: true,
    reply,
  };
}

/**
 * ============================================================
 * EXTRACT RESULT LIST
 * ============================================================
 */

function extractResultList(
  data: any
): any[] {
  const resultList =
    data?.response?.result_list ??
    data?.data?.result_list ??
    data?.result_list ??
    [];

  return Array.isArray(resultList)
    ? resultList
    : [];
}

/**
 * ============================================================
 * DETECT TOP LEVEL SHOPEE ERROR
 * ============================================================
 */

function getShopeeTopLevelError(
  data: any
): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const error =
    data.error;

  const message =
    data.message;

  if (
    error &&
    String(error).toLowerCase() !== '0'
  ) {
    return (
      `${String(error)}` +
      `${message ? `: ${String(message)}` : ''}`
    );
  }

  return null;
}

/**
 * ============================================================
 * CALL SHOPEE BULK REPLY
 * ============================================================
 */

async function callShopeeBulkReply({
  shopId,
  accessToken,
  commentList,
}: {
  shopId: string;
  accessToken: string;
  commentList: Array<{
    comment_id: number;
    comment: string;
  }>;
}) {
  validateShopeeConfig();

  const timestamp =
    Math.floor(
      Date.now() / 1000
    );

  const sign =
    createShopeeSignature({
      timestamp,
      accessToken,
      shopId,
    });

  const url =
    createShopeeUrl({
      timestamp,
      accessToken,
      shopId,
      sign,
    });

  console.log(
    `[Shopee Bulk Reply] Calling Shopee API`
  );

  console.log(
    `[Shopee Bulk Reply] shop=${shopId}`
  );

  console.log(
    `[Shopee Bulk Reply] comments=${commentList.length}`
  );

  console.log(
    '[Shopee Bulk Reply] comment IDs:',
    commentList.map(
      (item) => item.comment_id
    )
  );

  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            comment_list:
              commentList,
          }),
      }
    );

  const rawText =
    await response.text();

  let data: any;

  try {
    data =
      JSON.parse(rawText);
  } catch {
    data = {
      error:
        'INVALID_JSON_RESPONSE',
      message:
        rawText,
    };
  }

  console.log(
    `[Shopee Bulk Reply Response] shop=${shopId} http=${response.status}`,
    JSON.stringify(
      data,
      null,
      2
    )
  );

  return {
    httpStatus:
      response.status,

    ok:
      response.ok,

    data,
  };
}

/**
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  req: Request
) {
  try {
    /**
     * ========================================================
     * CONFIG
     * ========================================================
     */

    validateShopeeConfig();

    /**
     * ========================================================
     * PARSE REQUEST
     * ========================================================
     */

    let body: any;

    try {
      body =
        await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid JSON request body.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * ========================================================
     * IDS
     * ========================================================
     */

    const ids =
      body?.ids;

    if (
      !Array.isArray(ids) ||
      ids.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No review ids provided.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Remove duplicates.
     */

    const uniqueIds =
      Array.from(
        new Set(
          ids
            .filter(
              (id: unknown) =>
                typeof id ===
                  'string' &&
                id.trim()
            )
            .map(
              (id: string) =>
                id.trim()
            )
        )
      );

    if (
      uniqueIds.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No valid review ids provided.',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `[Shopee Bulk Reply] Requested reviews: ${uniqueIds.length}`
    );

    /**
     * ========================================================
     * LOAD REVIEWS
     * ========================================================
     */

    const reviews =
      await prisma.review.findMany({
        where: {
          id: {
            in: uniqueIds,
          },

          marketplace:
            'SHOPEE',

          /**
           * Do not resend reviews already marked REPLIED.
           */

          status: {
            not: 'REPLIED',
          },

          /**
           * AI reply must exist.
           */

          aiReply: {
            not: null,
          },

          /**
           * Shopee shop must exist.
           */

          shopId: {
            not: null,
          },
        },
      });

    /**
     * ========================================================
     * RESULTS
     * ========================================================
     */

    const results: any[] = [];

    /**
     * ========================================================
     * VALIDATE REVIEWS
     * ========================================================
     */

    const eligibleReviews =
      reviews.filter(
        (review) => {
          const validation =
            validateReply(
              review.aiReply
            );

          if (
            !validation.valid
          ) {
            results.push({
              id:
                review.id,

              reviewId:
                review.reviewId,

              success:
                false,

              skipped:
                true,

              error:
                validation.reason ||
                'Invalid AI reply.',
            });

            return false;
          }

          if (
            review.reviewId ===
              null ||
            review.reviewId ===
              undefined ||
            String(
              review.reviewId
            ).trim() === ''
          ) {
            results.push({
              id:
                review.id,

              reviewId:
                review.reviewId,

              success:
                false,

              skipped:
                true,

              error:
                'Missing Shopee reviewId/commentId.',
            });

            return false;
          }

          if (
            review.shopId ===
              null ||
            review.shopId ===
              undefined ||
            String(
              review.shopId
            ).trim() === ''
          ) {
            results.push({
              id:
                review.id,

              reviewId:
                review.reviewId,

              success:
                false,

              skipped:
                true,

              error:
                'Missing Shopee shopId.',
            });

            return false;
          }

          const commentId =
            Number(
              review.reviewId
            );

          if (
            !Number.isSafeInteger(
              commentId
            ) ||
            commentId <= 0
          ) {
            results.push({
              id:
                review.id,

              reviewId:
                review.reviewId,

              success:
                false,

              skipped:
                true,

              error:
                `Invalid Shopee commentId: ${String(
                  review.reviewId
                )}`,
            });

            return false;
          }

          return true;
        }
      );

    /**
     * ========================================================
     * NO ELIGIBLE REVIEWS
     * ========================================================
     */

    if (
      eligibleReviews.length ===
        0
    ) {
      return NextResponse.json(
        {
          success:
            results.some(
              (item) =>
                item.success
            ),

          posted:
            0,

          failed:
            results.length,

          total:
            results.length,

          results,

          message:
            'No eligible Shopee reviews found.',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * ========================================================
     * GROUP BY EXACT SHOP ID
     * ========================================================
     *
     * IMPORTANT:
     *
     * Review.shopId is the source of truth.
     *
     * Never use:
     *
     * - storeName
     * - store.brand
     * - store name
     * - marketplace display name
     *
     */

    const byShop =
      new Map<
        string,
        typeof eligibleReviews
      >();

    for (
      const review of
        eligibleReviews
    ) {
      const shopId =
        String(
          review.shopId
        ).trim();

      if (
        !byShop.has(
          shopId
        )
      ) {
        byShop.set(
          shopId,
          []
        );
      }

      byShop
        .get(shopId)!
        .push(review);
    }

    /**
     * ========================================================
     * PROCESS EACH SHOP
     * ========================================================
     */

    for (
      const [
        shopId,
        shopReviews,
      ] of byShop.entries()
    ) {
      console.log(
        `[Shopee Bulk Reply] Processing shop=${shopId} reviews=${shopReviews.length}`
      );

      /**
       * ======================================================
       * GET VALID ACCESS TOKEN
       * ======================================================
       *
       * Your existing ShopService handles token validity/
       * refresh.
       */

let accessToken: string;

try {
  const account =
    await prisma.shopeeAccount.findUnique({
      where: {
        shopId: BigInt(shopId),
      },
    });

  if (!account) {
    throw new Error(
      `No Shopee account found for shop ${shopId}.`
    );
  }

  if (!account.accessToken) {
    throw new Error(
      `Shopee account ${shopId} has no access token.`
    );
  }

  accessToken = String(
    account.accessToken
  ).trim();

  if (!accessToken) {
    throw new Error(
      `Shopee account ${shopId} has an empty access token.`
    );
  }

  console.log(
    `[Shopee Bulk Reply] Token loaded successfully shop=${shopId}`
  );
} catch (error) {
  const message =
    getErrorMessage(error);

  console.error(
    `[Shopee Bulk Reply] Token error shop=${shopId}:`,
    message
  );

  for (
    const review of shopReviews
  ) {
    results.push({
      id: review.id,
      reviewId: review.reviewId,
      success: false,
      error:
        `Unable to obtain Shopee access token: ${message}`,
    });
  }

  continue;
}

      /**
       * ======================================================
       * BUILD COMMENT LIST
       * ======================================================
       */

      const commentList =
        shopReviews.map(
          (review) => ({
            comment_id:
              Number(
                review.reviewId
              ),

            comment:
              cleanReply(
                review.aiReply
              ),
          })
        );

      console.log(
        `[Shopee Bulk Reply] shop=${shopId} sending ${commentList.length} comments`
      );

      console.log(
        '[Shopee Bulk Reply] Payload summary:',
        JSON.stringify(
          commentList.map(
            (item) => ({
              comment_id:
                item.comment_id,

              comment_length:
                item.comment.length,
            })
          ),
          null,
          2
        )
      );

      /**
       * ======================================================
       * CALL SHOPEE
       * ======================================================
       */

      let callResult: {
        httpStatus: number;
        ok: boolean;
        data: any;
      };

      try {
        callResult =
          await callShopeeBulkReply({
            shopId,

            accessToken,

            commentList,
          });
      } catch (error) {
        const message =
          getErrorMessage(
            error
          );

        console.error(
          `[Shopee Bulk Reply] API call error shop=${shopId}:`,
          message
        );

        for (
          const review of
            shopReviews
        ) {
          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error:
              message,
          });
        }

        continue;
      }

      const shopeeResponse =
        callResult.data;

      /**
       * ======================================================
       * HTTP ERROR
       * ======================================================
       */

      if (
        !callResult.ok
      ) {
        const errorMessage =
          getShopeeTopLevelError(
            shopeeResponse
          ) ||
          `Shopee HTTP ${callResult.httpStatus}.`;

        console.error(
          `[Shopee Bulk Reply] HTTP failure shop=${shopId}`,
          JSON.stringify(
            shopeeResponse,
            null,
            2
          )
        );

        for (
          const review of
            shopReviews
        ) {
          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error:
              errorMessage,

            shopeeResponse,
          });
        }

        continue;
      }

      /**
       * ======================================================
       * TOP LEVEL BUSINESS ERROR
       * ======================================================
       */

      const topLevelError =
        getShopeeTopLevelError(
          shopeeResponse
        );

      if (
        topLevelError
      ) {
        console.error(
          `[Shopee Bulk Reply] Business failure shop=${shopId}: ${topLevelError}`
        );

        for (
          const review of
            shopReviews
        ) {
          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error:
              topLevelError,

            shopeeResponse,
          });
        }

        continue;
      }

      /**
       * ======================================================
       * RESULT LIST
       * ======================================================
       */

      const resultList =
        extractResultList(
          shopeeResponse
        );

      console.log(
        `[Shopee Bulk Reply] shop=${shopId} result count=${resultList.length}`
      );

      console.log(
        `[Shopee Bulk Reply] shop=${shopId} result list:`,
        JSON.stringify(
          resultList,
          null,
          2
        )
      );

      /**
       * ======================================================
       * NEVER ASSUME SUCCESS WITHOUT RESULT LIST
       * ======================================================
       */

      if (
        resultList.length ===
        0
      ) {
        for (
          const review of
            shopReviews
        ) {
          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error:
              'Shopee returned no per-comment result_list.',

            shopeeResponse,
          });
        }

        continue;
      }

      /**
       * ======================================================
       * MATCH EACH REVIEW
       * ======================================================
       */

      for (
        const review of
          shopReviews
      ) {
        const reviewId =
          String(
            review.reviewId
          );

        const result =
          resultList.find(
            (item: any) =>
              String(
                item?.comment_id
              ) ===
              reviewId
          );

        /**
         * ====================================================
         * NO RESULT FOR COMMENT
         * ====================================================
         */

        if (
          !result
        ) {
          console.error(
            `[Shopee Reply] No result returned for review=${reviewId}`
          );

          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error:
              'Shopee returned no result for this comment.',

            shopeeResponse:
              resultList,
          });

          continue;
        }

        /**
         * ====================================================
         * PER-COMMENT FAILURE
         * ====================================================
         */

        if (
          result.fail_error ||
          result.fail_message
        ) {
          const failError =
            String(
              result.fail_error ||
                'UNKNOWN_ERROR'
            );

          const failMessage =
            String(
              result.fail_message ||
                result.message ||
                'Shopee did not provide a failure message.'
            );

          /**
           * ==================================================
           * ALREADY REPLIED
           * ==================================================
           *
           * Shopee:
           *
           * product.duplicate_request
           *
           * means the comment has already been replied to.
           *
           * Treat as successful synchronization.
           */

          if (
            failError ===
            'product.duplicate_request'
          ) {
            console.log(
              `[Shopee Reply ALREADY REPLIED] review=${reviewId} shop=${shopId}`
            );

            try {
              await prisma.review.update({
                where: {
                  id:
                    review.id,
                },

                data: {
                  status:
                    'REPLIED',

                  repliedAt:
                    review.repliedAt ||
                    new Date(),

                  finalReply:
                    review.finalReply ||
                    cleanReply(
                      review.aiReply
                    ),

                  repliedBy:
                    'AI',
                },
              });

              results.push({
                id:
                  review.id,

                reviewId:
                  review.reviewId,

                success:
                  true,

                alreadyReplied:
                  true,

                error:
                  null,

                message:
                  failMessage,
              });
            } catch (dbError) {
              results.push({
                id:
                  review.id,

                reviewId:
                  review.reviewId,

                success:
                  false,

                error:
                  `Shopee says already replied, but database update failed: ${getErrorMessage(
                    dbError
                  )}`,
              });
            }

            continue;
          }

          /**
           * ==================================================
           * REAL SHOPEE FAILURE
           * ==================================================
           */

          console.error(
            `[Shopee Reply FAILED] review=${reviewId}`,
            JSON.stringify(
              result,
              null,
              2
            )
          );

          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            error: {
              failError,
              failMessage,
            },

            shopeeResponse:
              result,
          });

          continue;
        }

        /**
         * ====================================================
         * SUCCESS
         * ====================================================
         *
         * No fail_error/fail_message means Shopee accepted
         * this comment.
         */

        try {
          await prisma.review.update({
            where: {
              id:
                review.id,
            },

            data: {
              status:
                'REPLIED',

              repliedAt:
                new Date(),

              finalReply:
                cleanReply(
                  review.aiReply
                ),

              repliedBy:
                'AI',
            },
          });

          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              true,

            alreadyReplied:
              false,

            error:
              null,
          });

          console.log(
            `[Shopee Reply SUCCESS] review=${reviewId} shop=${shopId}`
          );
        } catch (dbError) {
          /**
           * Important:
           *
           * Shopee succeeded but database update failed.
           *
           * Do NOT pretend the entire operation failed.
           * Report the special state so it can be reconciled.
           */

          console.error(
            `[Shopee Reply] Database update failed after Shopee success review=${reviewId}:`,
            dbError
          );

          results.push({
            id:
              review.id,

            reviewId:
              review.reviewId,

            success:
              false,

            shopeePosted:
              true,

            error:
              `Shopee reply succeeded, but database update failed: ${getErrorMessage(
                dbError
              )}`,
          });
        }
      }
    }

    /**
     * ========================================================
     * REQUESTED IDS THAT WERE NOT LOADED
     * ========================================================
     *
     * This catches:
     *
     * - wrong IDs
     * - already REPLIED reviews
     * - non-Shopee reviews
     * - missing AI replies
     * - missing shopId
     */

    const loadedIds =
      new Set(
        reviews.map(
          (review) =>
            review.id
        )
      );

    for (
      const id of
        uniqueIds
    ) {
      if (
        !loadedIds.has(id)
      ) {
        results.push({
          id,
          success:
            false,
          skipped:
            true,
          error:
            'Review was not eligible for Shopee bulk reply. It may not exist, may not be a Shopee review, may already be REPLIED, may have no AI reply, or may have no shopId.',
        });
      }
    }

    /**
     * ========================================================
     * SUMMARY
     * ========================================================
     */

    const succeeded =
      results.filter(
        (result) =>
          result.success ===
          true
      ).length;

    const failed =
      results.length -
      succeeded;

    const alreadyReplied =
      results.filter(
        (result) =>
          result.alreadyReplied ===
          true
      ).length;

    const shopeePostedButDbFailed =
      results.filter(
        (result) =>
          result.shopeePosted ===
          true
      ).length;

    console.log(
      '[Shopee Bulk Reply] FINAL SUMMARY:',
      JSON.stringify(
        {
          requested:
            uniqueIds.length,

          processed:
            results.length,

          posted:
            succeeded,

          failed,

          alreadyReplied,

          shopeePostedButDbFailed,
        },
        null,
        2
      )
    );

    /**
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json(
      {
        success:
          succeeded > 0 ||
          results.length === 0,

        posted:
          succeeded,

        failed,

        alreadyReplied,

        shopeePostedButDbFailed,

        total:
          results.length,

        results,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    /**
     * ========================================================
     * GLOBAL ERROR
     * ========================================================
     */

    const message =
      getErrorMessage(
        error
      );

    console.error(
      '[Shopee Bulk Reply] FATAL ERROR:',
      message
    );

    return NextResponse.json(
      {
        success:
          false,

        posted:
          0,

        failed:
          0,

        total:
          0,

        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}