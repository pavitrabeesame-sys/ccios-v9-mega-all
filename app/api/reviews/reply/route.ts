import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import crypto from 'crypto';
import { getValidToken } from '@/src/services/shopee/TokenService';
import { validateReply } from '@/src/lib/ai/reply-validator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================
// SHOPEE REPLY COMMENT API
// ============================================================

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

// ============================================================
// HELPERS
// ============================================================

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

// ============================================================
// SHOPEE SIGNATURE
// ============================================================

function createSignature({
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

// ============================================================
// FIND SHOPEE ACCOUNT
// ============================================================

async function findShopeeAccount(
  shopId: unknown
) {
  if (
    shopId === null ||
    shopId === undefined ||
    String(shopId).trim() === ''
  ) {
    throw new Error(
      'Review does not contain a shopId.'
    );
  }

  const shopIdString =
    String(shopId).trim();

  let numericShopId: bigint;

  try {
    numericShopId = BigInt(shopIdString);
  } catch {
    throw new Error(
      `Invalid shopId "${shopIdString}".`
    );
  }

  const account =
    await db.shopeeAccount.findUnique({
      where: {
        shopId: numericShopId,
      },
    });

  if (!account) {
    throw new Error(
      `No ShopeeAccount found for shopId ${shopIdString}.`
    );
  }

  const validToken =
    await getValidToken(shopIdString);

  if (
    !validToken ||
    !validToken.accessToken
  ) {
    throw new Error(
      `Unable to obtain a valid Shopee access token for shopId ${shopIdString}.`
    );
  }

  return {
    ...account,

    accessToken:
      validToken.accessToken,

    refreshToken:
      validToken.refreshToken,

    expireIn:
      validToken.expireIn,
  };
}

// ============================================================
// CALL SHOPEE REPLY COMMENT
// ============================================================

async function callShopeeReplyComment({
  account,
  commentId,
  comment,
}: {
  account: any;
  commentId: number;
  comment: string;
}) {
  validateShopeeConfig();

  const timestamp =
    Math.floor(Date.now() / 1000);

  const shopId =
    String(account.shopId);

  const accessToken =
    String(account.accessToken);

  if (!accessToken) {
    throw new Error(
      `Shopee account ${shopId} has no valid access token.`
    );
  }

  const signature =
    createSignature({
      partnerId:
        SHOPEE_PARTNER_ID,

      partnerKey:
        SHOPEE_PARTNER_KEY,

      path:
        SHOPEE_REPLY_PATH,

      timestamp,

      accessToken,

      shopId,
    });

  const url =
    SHOPEE_HOST +
    SHOPEE_REPLY_PATH +
    '?partner_id=' +
    encodeURIComponent(
      SHOPEE_PARTNER_ID
    ) +
    '&timestamp=' +
    encodeURIComponent(
      timestamp
    ) +
    '&access_token=' +
    encodeURIComponent(
      accessToken
    ) +
    '&shop_id=' +
    encodeURIComponent(
      shopId
    ) +
    '&sign=' +
    encodeURIComponent(
      signature
    );

  console.log(
    '[Shopee Reply] Calling Shopee API'
  );

  console.log(
    '[Shopee Reply] Shop:',
    shopId
  );

  console.log(
    '[Shopee Reply] Comment ID:',
    String(commentId)
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
            comment_list: [
              {
                comment_id:
                  Number(commentId),

                comment:
                  String(comment),
              },
            ],
          }),
      }
    );

  const rawText =
    await response.text();

  let data: any;

  try {
    data = JSON.parse(rawText);
  } catch {
    data = rawText;
  }

  console.log(
    '[Shopee Reply] HTTP status:',
    response.status
  );

  console.log(
    '[Shopee Reply] Response:',
    JSON.stringify(data)
  );

  // ==========================================================
  // HTTP ERROR
  // ==========================================================

  if (!response.ok) {
    throw new Error(
      `Shopee HTTP ${response.status}: ${
        typeof data === 'string'
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  // ==========================================================
  // BUSINESS ERROR
  // ==========================================================

  if (
    data &&
    typeof data === 'object'
  ) {
    const responseData =
      data;

    const error =
      responseData.error;

    const message =
      responseData.message;

    const requestId =
      responseData.request_id;

    // ========================================================
    // TOP LEVEL ERROR
    // ========================================================

    if (
      error &&
      String(error).toLowerCase() !== '0'
    ) {
      throw new Error(
        `Shopee reply failed: ${String(error)}${
          message
            ? ` - ${String(message)}`
            : ''
        }${
          requestId
            ? ` (request_id: ${String(requestId)})`
            : ''
        }`
      );
    }

    // ========================================================
    // RESULT LIST
    // ========================================================

    const resultList =
      Array.isArray(
        responseData?.response?.result_list
      )
        ? responseData.response.result_list
        : [];

    // ========================================================
    // DUPLICATE REPLY
    //
    // Shopee may return:
    // product.duplicate_request
    //
    // This means the comment has already been replied to.
    // Treat it as synchronized success.
    // ========================================================

    const duplicateResult =
      resultList.find(
        (item: any) =>
          item &&
          String(
            item.fail_error || ''
          ).toLowerCase() ===
            'product.duplicate_request'
      );

    if (duplicateResult) {
      console.log(
        '[Shopee Reply] Comment already replied:',
        String(commentId)
      );

      return {
        ...data,

        _alreadyReplied: true,

        _commentId:
          String(commentId),
      };
    }

    // ========================================================
    // OTHER RESULT LIST FAILURE
    // ========================================================

    const failedResult =
      resultList.find(
        (item: any) =>
          item &&
          (
            item.fail_error ||
            item.fail_message ||
            item.error ||
            item.failed
          )
      );

    if (failedResult) {
      const failure =
        failedResult.fail_error ||
        failedResult.error ||
        failedResult.failed ||
        'unknown_error';

      throw new Error(
        `Shopee reply failed: ${String(
          failure
        )}${
          failedResult.fail_message
            ? ` - ${String(
                failedResult.fail_message
              )}`
            : ''
        }${
          requestId
            ? ` (request_id: ${String(
                requestId
              )})`
            : ''
        }`
      );
    }

    // ========================================================
    // MESSAGE ERROR
    // ========================================================

    if (message) {
      const lowerMessage =
        String(message).toLowerCase();

      if (
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('denied') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('error') ||
        lowerMessage.includes('fail')
      ) {
        throw new Error(
          `Shopee reply failed: ${String(message)}${
            requestId
              ? ` (request_id: ${String(
                  requestId
                )})`
              : ''
          }`
        );
      }
    }
  }

  return data;
}

// ============================================================
// POST
// ============================================================

export async function POST(
  request: Request
) {
  try {
    // ========================================================
    // PARSE REQUEST
    // ========================================================

    let body: any;

    try {
      body =
        await request.json();
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

    const reviewId =
      body?.reviewId;

    const reply =
      body?.reply;

    // ========================================================
    // VALIDATE REVIEW ID
    // ========================================================

    if (
      !reviewId ||
      typeof reviewId !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'reviewId is required.',
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // VALIDATE REPLY INPUT
    // ========================================================

    if (
      !reply ||
      typeof reply !== 'string' ||
      !reply.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'reply is required.',
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // LOAD REVIEW
    // ========================================================

    console.log(
      '[Shopee Reply] Loading review:',
      reviewId
    );

    const review =
      await db.review.findUnique({
        where: {
          id: reviewId,
        },
      });

    if (!review) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Review ${reviewId} was not found.`,
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // MARKETPLACE
    // ========================================================

    if (
      String(
        review.marketplace
      ).toUpperCase() !== 'SHOPEE'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Review ${reviewId} is not a Shopee review.`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // SHOPEE REVIEW ID
    // ========================================================

    if (
      review.reviewId === null ||
      review.reviewId === undefined ||
      String(
        review.reviewId
      ).trim() === ''
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Review ${reviewId} does not contain a Shopee reviewId.`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // SHOP ID
    // ========================================================

    if (
      review.shopId === null ||
      review.shopId === undefined ||
      String(
        review.shopId
      ).trim() === ''
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Review ${reviewId} does not contain shopId.`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // VALIDATE REPLY
    //
    // IMPORTANT:
    // This happens BEFORE we obtain the token and BEFORE
    // we call Shopee.
    // ========================================================

    const validation =
      validateReply(
        reply,
        {
          comment:
            String(
              review.comment || ''
            ),

          rating:
            typeof review.rating === 'number'
              ? review.rating
              : Number(review.rating),
        }
      );

    if (!validation.valid) {
      console.warn(
        '[Shopee Reply] Reply validation failed:',
        {
          reviewId,
          code:
            validation.code,
          reason:
            validation.reason,
        }
      );

      return NextResponse.json(
        {
          success: false,

          error:
            validation.reason ||
            'Reply failed validation.',

          validationCode:
            validation.code,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // USE VALIDATED/CLEANED REPLY
    // ========================================================

    const cleanReply =
      validation.cleanedReply ||
      reply.trim().replace(/\s+/g, ' ');

    // ========================================================
    // DATABASE ALREADY REPLIED
    //
    // Do this AFTER validating input but BEFORE calling Shopee.
    // ========================================================

    if (
      String(
        review.status
      ).toUpperCase() === 'REPLIED' &&
      (
        review.finalReply ||
        review.aiReply
      )
    ) {
      const existingReply =
        String(
          review.finalReply ||
          review.aiReply
        ).trim();

      console.log(
        '[Shopee Reply] Already REPLIED in database:',
        review.id
      );

      return NextResponse.json(
        {
          success: true,

          alreadyReplied:
            true,

          reviewId:
            review.id,

          shopeeReviewId:
            review.reviewId,

          shopId:
            String(review.shopId),

          reply:
            existingReply,

          status:
            'REPLIED',

          source:
            'DATABASE',
        },
        {
          status: 200,
        }
      );
    }

    // ========================================================
    // FIND SHOPEE ACCOUNT
    // ========================================================

    const account =
      await findShopeeAccount(
        review.shopId
      );

    // ========================================================
    // COMMENT ID
    // ========================================================

    const commentId =
      Number(review.reviewId);

    if (
      !Number.isSafeInteger(commentId) ||
      commentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            `Invalid Shopee reviewId/commentId: ${String(
              review.reviewId
            )}`,
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // CALL SHOPEE
    // ========================================================

    const shopeeResponse =
      await callShopeeReplyComment({
        account,

        commentId,

        comment:
          cleanReply,
      });

    // ========================================================
    // DETERMINE ALREADY REPLIED
    // ========================================================

    const alreadyReplied =
      Boolean(
        shopeeResponse?._alreadyReplied
      );

    // ========================================================
    // SAVE DATABASE
    // ========================================================

    await db.review.update({
      where: {
        id:
          review.id,
      },

      data: {
        aiReply:
          cleanReply,

        finalReply:
          cleanReply,

        status:
          'REPLIED',

        repliedAt:
          alreadyReplied
            ? (
                review.repliedAt ||
                new Date()
              )
            : new Date(),

        repliedBy:
          'AI',
      },
    });

    // ========================================================
    // SUCCESS
    // ========================================================

    console.log(
      alreadyReplied
        ? '[Shopee Reply] ALREADY REPLIED — DATABASE SYNCHRONIZED:'
        : '[Shopee Reply] SUCCESS:',
      review.id
    );

    return NextResponse.json(
      {
        success: true,

        alreadyReplied,

        reviewId:
          review.id,

        shopeeReviewId:
          review.reviewId,

        shopId:
          String(review.shopId),

        reply:
          cleanReply,

        status:
          'REPLIED',

        source:
          alreadyReplied
            ? 'SHOPEE_ALREADY_REPLIED'
            : 'SHOPEE_API',

        shopeeResponse,
      },
      {
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message =
      getErrorMessage(error);

    console.error(
      '[Shopee Reply] ERROR:',
      message
    );

    return NextResponse.json(
      {
        success: false,

        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}