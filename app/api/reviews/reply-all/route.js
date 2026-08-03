import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { replyComment } from "../../../../src/services/shopee/ReplyService";

export async function POST() {

  try {

    const reviews = await prisma.review.findMany({

      where: {

        status: "APPROVED",

        marketplace: "SHOPEE",

      },

      include: {

        store: {

          include: {

            shopeeShop: true,

          },

        },

      },

    });

    let success = 0;

    let failed = 0;

    const errors = [];

    for (const review of reviews) {

      try {

        if (!review.store?.shopeeShop) {

          failed++;

          errors.push({

            reviewId: review.reviewId,

            error: "Shopee shop not connected",

          });

          continue;

        }

        await replyComment({

          shopId:
            review.store.shopeeShop.shopId,

          commentId:
            review.reviewId,

          reply:
            review.aiReply,

        });

        await prisma.review.update({

          where: {

            id: review.id,

          },

          data: {

            status: "REPLIED",

            repliedAt: new Date(),

            finalReply: review.aiReply,

          },

        });

        success++;

      } catch (err) {

        failed++;

        errors.push({

          reviewId: review.reviewId,

          error: err.message,

        });

      }

    }

    return NextResponse.json({

      success: true,

      total: reviews.length,

      replied: success,

      failed,

      errors,

    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(

      {

        success: false,

        error: error.message,

      },

      {

        status: 500,

      }

    );

  }

}