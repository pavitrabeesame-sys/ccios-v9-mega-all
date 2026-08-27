import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * ============================================================
 * CCIOS — SHOPEE BULK REVIEW REPLY
 * ============================================================
 *
 * Endpoint:
 *
 * POST /api/reviews/reply-all
 *
 * Body:
 *
 * {
 *   "ids": [
 *     "DATABASE_REVIEW_ID_1",
 *     "DATABASE_REVIEW_ID_2"
 *   ]
 * }
 *
 * IMPORTANT SHOPEE LIMIT:
 *
 * reply_comment accepts:
 *
 *     minimum: 1
 *     maximum: 100
 *
 * Therefore every shop is automatically split into batches
 * of maximum 100 comments.
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
 * Shopee maximum comment_list size.
 */
const SHOPEE_MAX_BATCH_SIZE = 100;

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

type ReviewRecord =
  Awaited<
    ReturnType<
      typeof prisma.review.findMany
    >
  >[number];

type ShopeeComment = {
  comment_id: number;
  comment: string;
};

type EligibleReview = {
  review: ReviewRecord;
  comment: ShopeeComment;
};

type ShopeeResult = {
  comment_id?: number | string;
  fail_error?: string | null;
  fail_message?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

type ShopeeApiResponse = {
  error?: string | null;
  message?: string | null;
  response?: {
    result_list?: ShopeeResult[];
    [key: string]: unknown;
  };
  data?: {
    result_list?: ShopeeResult[];
    [key: string]: unknown;
  };
  result_list?: ShopeeResult[];
  [key: string]: unknown;
};

type ShopeeCallResult = {
  httpStatus: number;
  ok: boolean;
  data: ShopeeApiResponse;
};

type ReplyResult = {
  id: string;
  reviewId?: string | number | null;
  success: boolean;
  skipped?: boolean;
  alreadyReplied?: boolean;
  shopeePosted?: boolean;
  batch?: number;
  error?: string | {
    failError: string;
    failMessage: string;
  } | null;
  message?: string;
  shopeeResponse?: unknown;
};

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
 * CONFIG VALIDATION
 * ============================================================
 */

function validateShopeeConfig(): void {
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
}): string {
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
}): string {
  const params =
    new URLSearchParams({
      partner_id:
        SHOPEE_PARTNER_ID,

      timestamp:
        String(timestamp),

      access_token:
        accessToken,

      shop_id:
        shopId,

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
 * PLACEHOLDER VALIDATION
 * ============================================================
 */

function containsPlaceholder(
  reply: string
): boolean {
  const knownPlaceholders = [
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
    knownPlaceholders.some(
      (placeholder) =>
        reply.includes(placeholder)
    );

  /**
   * Reject generic bracket placeholders:
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
 * VALIDATE AI REPLY
 * ============================================================
 */

function validateReply(
  value: unknown
): {
  valid: boolean;
  reply: string;
  reason?: string;
} {
  const reply =
    cleanReply(value);

  if (!reply) {
    return {
      valid: false,
      reply,
      reason:
        'AI reply is empty.',
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

  if (
    containsPlaceholder(reply)
  ) {
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
 * SPLIT ARRAY INTO BATCHES
 * ============================================================
 */

function chunkArray<T>(
  items: T[],
  size: number
): T[][] {
  const batches: T[][] = [];

  for (
    let i = 0;
    i < items.length;
    i += size
  ) {
    batches.push(
      items.slice(
        i,
        i + size
      )
    );
  }

  return batches;
}

/**
 * ============================================================
 * EXTRACT RESULT LIST
 * ============================================================
 */

function extractResultList(
  data: ShopeeApiResponse
): ShopeeResult[] {
  const resultList =
    data?.response
      ?.result_list ??
    data?.data
      ?.result_list ??
    data?.result_list ??
    [];

  if (
    !Array.isArray(
      resultList
    )
  ) {
    return [];
  }

  return resultList;
}

/**
 * ============================================================
 * TOP LEVEL SHOPEE ERROR
 * ============================================================
 */

function getShopeeTopLevelError(
  data: ShopeeApiResponse
): string | null {
  if (
    !data ||
    typeof data !== 'object'
  ) {
    return null;
  }

  const error =
    data.error;

  const message =
    data.message;

  if (
    error &&
    String(error)
      .toLowerCase() !== '0'
  ) {
    return (
      `${String(error)}` +
      `${
        message
          ? `: ${String(message)}`
          : ''
      }`
    );
  }

  return null;
}

/**
 * ============================================================
 * CALL SHOPEE REPLY API
 * ============================================================
 */

async function callShopeeBulkReply({
  shopId,
  accessToken,
  commentList,
}: {
  shopId: string;
  accessToken: string;
  commentList: ShopeeComment[];
}): Promise<ShopeeCallResult> {
  validateShopeeConfig();

  if (
    commentList.length < 1
  ) {
    throw new Error(
      'Cannot call Shopee reply_comment with an empty comment_list.'
    );
  }

  if (
    commentList.length >
    SHOPEE_MAX_BATCH_SIZE
  ) {
    throw new Error(
      `Shopee comment_list cannot exceed ${SHOPEE_MAX_BATCH_SIZE} items. Received ${commentList.length}.`
    );
  }

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
    '[Shopee Bulk Reply] Calling Shopee API'
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
      (item) =>
        item.comment_id
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

  let data: ShopeeApiResponse;

  try {
    data =
      JSON.parse(
        rawText
      ) as ShopeeApiResponse;
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
 * UPDATE REVIEW AFTER SHOPEE SUCCESS
 * ============================================================
 */

async function markReviewReplied(
  review: ReviewRecord
): Promise<void> {
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

    let body: unknown;

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
     * EXTRACT IDS
     * ========================================================
     */

    const ids =
      (
        body as {
          ids?: unknown;
        }
      )?.ids;

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
     * ========================================================
     * CLEAN IDS
     * ========================================================
     */

    const uniqueIds =
      Array.from(
        new Set(
          ids
            .filter(
              (
                id: unknown
              ): id is string =>
                typeof id ===
                  'string' &&
                id.trim()
                  .length > 0
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
            in:
              uniqueIds,
          },

          marketplace:
            'SHOPEE',

          status: {
            not:
              'REPLIED',
          },

          aiReply: {
            not:
              null,
          },

          shopId: {
            not:
              null,
          },
        },
      });

    console.log(
      `[Shopee Bulk Reply] Loaded eligible DB candidates: ${reviews.length}`
    );

    /**
     * ========================================================
     * RESULTS
     * ========================================================
     */

    const results: ReplyResult[] =
      [];

    /**
     * ========================================================
     * VALIDATE REVIEWS
     * ========================================================
     */

    const eligibleReviews:
      EligibleReview[] =
      [];

    for (
      const review of
        reviews
    ) {
      /**
       * Validate AI reply.
       */

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

        continue;
      }

      /**
       * Validate Shopee review/comment ID.
       */

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

        continue;
      }

      /**
       * Validate shop ID.
       */

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

        continue;
      }

      /**
       * Convert comment ID.
       */

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

        continue;
      }

      /**
       * Build strongly typed eligible record.
       */

      eligibleReviews.push({
        review,

        comment: {
          comment_id:
            commentId,

          comment:
            validation.reply,
        },
      });
    }

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
            false,

          posted:
            0,

          failed:
            results.length,

          alreadyReplied:
            0,

          shopeePostedButDbFailed:
            0,

          total:
            results.length,

          results,

          message:
            'No eligible Shopee reviews found.',
        },
        {
          status: 200,
        }
      );
    }

    /**
     * ========================================================
     * GROUP BY EXACT SHOP ID
     * ========================================================
     *
     * Review.shopId is the source of truth.
     *
     * NEVER use:
     *
     * - storeName
     * - brand name
     * - marketplace display name
     *
     * ========================================================
     */

    const byShop =
      new Map<
        string,
        EligibleReview[]
      >();

    for (
      const item of
        eligibleReviews
    ) {
      const shopId =
        String(
          item.review.shopId
        ).trim();

      if (
        !byShop.has(shopId)
      ) {
        byShop.set(
          shopId,
          []
        );
      }

      const shopItems =
        byShop.get(
          shopId
        );

      if (shopItems) {
        shopItems.push(
          item
        );
      }
    }

    console.log(
      `[Shopee Bulk Reply] Shops to process: ${byShop.size}`
    );

    /**
     * ========================================================
     * PROCESS EACH SHOP
     * ========================================================
     */

    for (
      const [
        shopId,
        shopItems,
      ] of byShop
    ) {
      console.log(
        '============================================================'
      );

      console.log(
        `[Shopee Bulk Reply] Processing shop=${shopId} reviews=${shopItems.length}`
      );

      /**
       * ======================================================
       * LOAD ACCESS TOKEN
       * ======================================================
       *
       * We intentionally use:
       *
       * prisma.shopeeAccount
       *
       * instead of ShopService so this route has no dependency
       * on a possibly different token service API.
       *
       * ======================================================
       */

      let accessToken: string;

      try {
        const account =
          await prisma.shopeeAccount.findUnique({
            where: {
              shopId:
                BigInt(
                  shopId
                ),
            },
          });

        if (!account) {
          throw new Error(
            `No Shopee account found for shop ${shopId}.`
          );
        }

        if (
          !account.accessToken
        ) {
          throw new Error(
            `Shopee account ${shopId} has no access token.`
          );
        }

        accessToken =
          String(
            account.accessToken
          ).trim();

        if (
          !accessToken
        ) {
          throw new Error(
            `Shopee account ${shopId} has an empty access token.`
          );
        }

        console.log(
          `[Shopee Bulk Reply] Token loaded successfully shop=${shopId}`
        );
      } catch (error) {
        const message =
          getErrorMessage(
            error
          );

        console.error(
          `[Shopee Bulk Reply] Token error shop=${shopId}:`,
          message
        );

        for (
          const item of
            shopItems
        ) {
          results.push({
            id:
              item.review.id,

            reviewId:
              item.review.reviewId,

            success:
              false,

            error:
              `Unable to obtain Shopee access token: ${message}`,
          });
        }

        continue;
      }

      /**
       * ======================================================
       * SPLIT SHOP INTO MAX 100
       * ======================================================
       */

      const batches =
        chunkArray(
          shopItems,
          SHOPEE_MAX_BATCH_SIZE
        );

      console.log(
        `[Shopee Bulk Reply] shop=${shopId} total=${shopItems.length} batches=${batches.length}`
      );

      /**
       * ======================================================
       * PROCESS EACH 100-ITEM BATCH
       * ======================================================
       */

      for (
        let batchIndex = 0;
        batchIndex <
        batches.length;
        batchIndex++
      ) {
        const batch =
          batches[
            batchIndex
          ];

        const batchNumber =
          batchIndex + 1;

        console.log(
          '------------------------------------------------------------'
        );

        console.log(
          `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber}/${batches.length} size=${batch.length}`
        );

        /**
         * Safety check.
         */

        if (
          batch.length === 0
        ) {
          console.warn(
            `[Shopee Bulk Reply] Skipping empty batch shop=${shopId} batch=${batchNumber}`
          );

          continue;
        }

        if (
          batch.length >
          SHOPEE_MAX_BATCH_SIZE
        ) {
          console.error(
            `[Shopee Bulk Reply] INTERNAL ERROR: batch too large shop=${shopId} size=${batch.length}`
          );

          for (
            const item of
              batch
          ) {
            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error:
                `Internal error: batch contains ${batch.length} items. Maximum is ${SHOPEE_MAX_BATCH_SIZE}.`,
            });
          }

          continue;
        }

        /**
         * ====================================================
         * BUILD COMMENT LIST
         * ====================================================
         */

        const commentList:
          ShopeeComment[] =
          batch.map(
            (
              item: EligibleReview
            ): ShopeeComment =>
              item.comment
          );

        console.log(
          `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber} sending ${commentList.length} comments`
        );

        console.log(
          `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber} comment IDs:`,
          commentList.map(
            (
              item: ShopeeComment
            ) =>
              item.comment_id
          )
        );

        /**
         * ====================================================
         * CALL SHOPEE
         * ====================================================
         */

        let callResult:
          ShopeeCallResult;

        try {
          callResult =
            await callShopeeBulkReply(
              {
                shopId,

                accessToken,

                commentList,
              }
            );
        } catch (error) {
          const message =
            getErrorMessage(
              error
            );

          console.error(
            `[Shopee Bulk Reply] API call error shop=${shopId} batch=${batchNumber}:`,
            message
          );

          for (
            const item of
              batch
          ) {
            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error:
                message,
            });
          }

          continue;
        }

        const shopeeResponse =
          callResult.data;

        /**
         * ====================================================
         * HTTP ERROR
         * ====================================================
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
            `[Shopee Bulk Reply] HTTP failure shop=${shopId} batch=${batchNumber}`,
            JSON.stringify(
              shopeeResponse,
              null,
              2
            )
          );

          for (
            const item of
              batch
          ) {
            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error:
                errorMessage,

              shopeeResponse,
            });
          }

          continue;
        }

        /**
         * ====================================================
         * TOP LEVEL BUSINESS ERROR
         * ====================================================
         */

        const topLevelError =
          getShopeeTopLevelError(
            shopeeResponse
          );

        if (
          topLevelError
        ) {
          console.error(
            `[Shopee Bulk Reply] Business failure shop=${shopId} batch=${batchNumber}: ${topLevelError}`
          );

          /**
           * IMPORTANT:
           *
           * If Shopee says common.batch_api_all_failed,
           * we MUST inspect result_list.
           *
           * So do NOT immediately mark all records failed.
           *
           * Continue into result_list processing.
           */

          const preliminaryResultList =
            extractResultList(
              shopeeResponse
            );

          if (
            preliminaryResultList.length ===
            0
          ) {
            for (
              const item of
                batch
            ) {
              results.push({
                id:
                  item.review.id,

                reviewId:
                  item.review.reviewId,

                success:
                  false,

                batch:
                  batchNumber,

                error:
                  topLevelError,

                shopeeResponse,
              });
            }

            continue;
          }

          console.log(
            `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber} top-level failure contains result_list=${preliminaryResultList.length}; processing individual results`
          );
        }

        /**
         * ====================================================
         * EXTRACT PER COMMENT RESULTS
         * ====================================================
         */

        const resultList =
          extractResultList(
            shopeeResponse
          );

        console.log(
          `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber} result count=${resultList.length}`
        );

        console.log(
          `[Shopee Bulk Reply] shop=${shopId} batch=${batchNumber} result list:`,
          JSON.stringify(
            resultList,
            null,
            2
          )
        );

        /**
         * ====================================================
         * NO RESULT LIST
         * ====================================================
         */

        if (
          resultList.length ===
          0
        ) {
          const errorMessage =
            topLevelError ||
            'Shopee returned no per-comment result_list.';

          for (
            const item of
              batch
          ) {
            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error:
                errorMessage,

              shopeeResponse,
            });
          }

          continue;
        }

        /**
         * ====================================================
         * MATCH EACH COMMENT
         * ====================================================
         */

        for (
          const item of
            batch
        ) {
          const reviewId =
            String(
              item.review.reviewId
            );

          /**
           * Strongly typed result.
           */

          const result: ShopeeResult | undefined =
            resultList.find(
              (
                resultItem: ShopeeResult
              ): boolean =>
                String(
                  resultItem.comment_id
                ) ===
                reviewId
            );

          /**
           * ==================================================
           * NO RESULT FOR COMMENT
           * ==================================================
           */

          if (!result) {
            console.error(
              `[Shopee Reply] No result returned for review=${reviewId} shop=${shopId} batch=${batchNumber}`
            );

            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error:
                'Shopee returned no result for this comment.',

              shopeeResponse:
                resultList,
            });

            continue;
          }

          /**
           * ==================================================
           * EXTRACT FAILURE
           * ==================================================
           */

          const failError =
            result.fail_error
              ? String(
                  result.fail_error
                )
              : '';

          const failMessage =
            result.fail_message
              ? String(
                  result.fail_message
                )
              : String(
                  result.message ||
                    ''
                );

          /**
           * ==================================================
           * PER COMMENT FAILURE
           * ==================================================
           */

          if (
            failError ||
            failMessage
          ) {
            /**
             * ----------------------------------------------
             * DUPLICATE REQUEST
             * ----------------------------------------------
             *
             * Shopee already has a reply for this comment.
             *
             * Treat as synchronized successfully.
             */

            if (
              failError ===
              'product.duplicate_request'
            ) {
              console.log(
                `[Shopee Reply ALREADY REPLIED] review=${reviewId} shop=${shopId} batch=${batchNumber}`
              );

              try {
                await markReviewReplied(
                  item.review
                );

                results.push({
                  id:
                    item.review.id,

                  reviewId:
                    item.review.reviewId,

                  success:
                    true,

                  alreadyReplied:
                    true,

                  batch:
                    batchNumber,

                  error:
                    null,

                  message:
                    failMessage ||
                    'Shopee reports this comment was already replied to.',
                });
              } catch (
                dbError
              ) {
                const dbMessage =
                  getErrorMessage(
                    dbError
                  );

                results.push({
                  id:
                    item.review.id,

                  reviewId:
                    item.review.reviewId,

                  success:
                    false,

                  alreadyReplied:
                    true,

                  batch:
                    batchNumber,

                  error:
                    `Shopee says already replied, but database update failed: ${dbMessage}`,
                });
              }

              continue;
            }

            /**
             * ----------------------------------------------
             * REAL SHOPEE FAILURE
             * ----------------------------------------------
             */

            console.error(
              `[Shopee Reply FAILED] review=${reviewId} shop=${shopId} batch=${batchNumber}`,
              JSON.stringify(
                result,
                null,
                2
              )
            );

            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              batch:
                batchNumber,

              error: {
                failError:
                  failError ||
                  'UNKNOWN_ERROR',

                failMessage:
                  failMessage ||
                  'Shopee did not provide a failure message.',
              },

              shopeeResponse:
                result,
            });

            continue;
          }

          /**
           * ==================================================
           * SHOPEE SUCCESS
           * ==================================================
           *
           * No fail_error/fail_message means Shopee accepted
           * this comment.
           */

          try {
            await markReviewReplied(
              item.review
            );

            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                true,

              alreadyReplied:
                false,

              batch:
                batchNumber,

              error:
                null,
            });

            console.log(
              `[Shopee Reply SUCCESS] review=${reviewId} shop=${shopId} batch=${batchNumber}`
            );
          } catch (
            dbError
          ) {
            const dbMessage =
              getErrorMessage(
                dbError
              );

            console.error(
              `[Shopee Reply] Database update failed after Shopee success review=${reviewId} shop=${shopId}:`,
              dbMessage
            );

            results.push({
              id:
                item.review.id,

              reviewId:
                item.review.reviewId,

              success:
                false,

              shopeePosted:
                true,

              batch:
                batchNumber,

              error:
                `Shopee reply succeeded, but database update failed: ${dbMessage}`,
            });
          }
        }

        /**
         * ====================================================
         * SMALL DELAY BETWEEN BATCHES
         * ====================================================
         *
         * Helps avoid unnecessarily hammering the API when
         * thousands of reviews are being processed.
         */

        if (
          batchIndex <
          batches.length - 1
        ) {
          await new Promise(
            (
              resolve
            ) =>
              setTimeout(
                resolve,
                150
              )
          );
        }
      }
    }

    /**
     * ========================================================
     * REQUESTED IDS THAT WERE NOT LOADED
     * ========================================================
     */

    const loadedIds =
      new Set(
        reviews.map(
          (
            review: ReviewRecord
          ) =>
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
        (
          result: ReplyResult
        ) =>
          result.success ===
          true
      ).length;

    const failed =
      results.filter(
        (
          result: ReplyResult
        ) =>
          result.success !==
          true
      ).length;

    const alreadyReplied =
      results.filter(
        (
          result: ReplyResult
        ) =>
          result.alreadyReplied ===
          true
      ).length;

    const shopeePostedButDbFailed =
      results.filter(
        (
          result: ReplyResult
        ) =>
          result.shopeePosted ===
          true
      ).length;

    console.log(
      '============================================================'
    );

    console.log(
      '[Shopee Bulk Reply] FINAL SUMMARY:'
    );

    console.log(
      JSON.stringify(
        {
          requested:
            uniqueIds.length,

          loaded:
            reviews.length,

          eligible:
            eligibleReviews.length,

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

    console.log(
      '============================================================'
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

        requested:
          uniqueIds.length,

        loaded:
          reviews.length,

        eligible:
          eligibleReviews.length,

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