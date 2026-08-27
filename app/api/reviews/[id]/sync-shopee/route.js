import { prisma as db } from '@/lib/prisma';
import {
  replyShopeeReview,
} from '@/services/shopee/ReviewService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request,
  { params }
) {
  try {
    const { id } =
      await params;

    /*
    ========================================================
    FIND REVIEW
    ========================================================
    */

    const review =
      await db.review.findUnique({
        where: {
          id,
        },
      });

    if (!review) {
      return Response.json(
        {
          success: false,

          error:
            'Review not found',
        },
        {
          status: 404,
        }
      );
    }

    /*
    ========================================================
    VALIDATION
    ========================================================
    */

    if (
      review.marketplace !==
      'SHOPEE'
    ) {
      return Response.json(
        {
          success: false,

          error:
            `This review belongs to ${review.marketplace}, not Shopee.`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !review.reviewId
    ) {
      return Response.json(
        {
          success: false,

          error:
            'Shopee review ID is missing.',
        },
        {
          status: 400,
        }
      );
    }

    if (
      !review.finalReply ||
      !review.finalReply.trim()
    ) {
      return Response.json(
        {
          success: false,

          error:
            'No final reply is available for this review.',
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    SHOP ID
    ========================================================
    */

    if (!review.shopId) {
      return Response.json(
        {
          success: false,

          error:
            'Shopee shop ID is missing from this review.',
        },
        {
          status: 400,
        }
      );
    }

    const shopId =
      review.shopId.toString();

    /*
    ========================================================
    FIND SHOPEE ACCOUNT
    ========================================================
    */

    const account =
      await db.shopeeAccount.findUnique({
        where: {
          shopId:
            BigInt(shopId),
        },
      });

    if (!account) {
      return Response.json(
        {
          success: false,

          error:
            `No Shopee account found for shop ${shopId}.`,
        },
        {
          status: 404,
        }
      );
    }

    if (
      !account.accessToken
    ) {
      return Response.json(
        {
          success: false,

          error:
            `Shopee access token is missing for shop ${shopId}.`,
        },
        {
          status: 401,
        }
      );
    }

    /*
    ========================================================
    PUBLISH REPLY
    ========================================================
    */

    console.log(
      `[Shopee Sync] Publishing reply`
    );

    console.log({
      reviewDatabaseId:
        review.id,

      reviewId:
        review.reviewId,

      shopId,

      brand:
        review.brand,

      reply:
        review.finalReply,
    });

    const result =
      await replyShopeeReview(
        {
          shopId,

          accessToken:
            account.accessToken,

          refreshToken:
            account.refreshToken,

          accountId:
            account.id,
        },
        review.reviewId,
        review.finalReply
      );

    /*
    ========================================================
    FAILED
    ========================================================
    */

    if (
      !result.success
    ) {
      return Response.json(
        {
          success: false,

          error:
            result.error ||
            'Shopee rejected the reply.',

          status:
            result.status ||
            'FAILED',
        },
        {
          status: 400,
        }
      );
    }

    /*
    ========================================================
    UPDATE DATABASE
    ========================================================
    */

    await db.review.update({
      where: {
        id,
      },

      data: {
        status:
          'REPLIED',
      },
    });

    /*
    ========================================================
    SUCCESS
    ========================================================
    */

    return Response.json({
      success: true,

      message:
        'Review reply published to Shopee successfully.',

      reviewId:
        review.reviewId,

      shopId,

      status:
        'REPLIED',
    });
  } catch (error) {
    console.error(
      '[Shopee Reply Sync Error]:',
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error.message ||
          'Internal Server Error',
      },
      {
        status: 500,
      }
    );
  }
}