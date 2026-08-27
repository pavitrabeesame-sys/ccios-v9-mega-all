import { NextResponse } from "next/server";
import {
  replyToShopeeForReview,
  formatShopeeError,
} from "@/services/shopee/ReplyCommentService";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: Request
) {
  try {
    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON request body.",
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

    // ==========================================================
    // VALIDATE REVIEW ID
    // ==========================================================

    if (
      !reviewId ||
      typeof reviewId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "reviewId is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================================
    // VALIDATE REPLY
    // ==========================================================

    if (
      !reply ||
      typeof reply !== "string" ||
      !reply.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "reply is required.",
        },
        {
          status: 400,
        }
      );
    }

    const cleanReply =
      reply
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    console.log(
      "[Shopee Reply API] Review:",
      reviewId
    );

    // ==========================================================
    // DIRECT SHOPEE SERVICE
    // ==========================================================

    const shopeeResponse =
      await replyToShopeeForReview(
        reviewId,
        cleanReply
      );

    // ==========================================================
    // DATABASE UPDATE
    //
    // IMPORTANT:
    // This only happens after Shopee confirms success.
    // ==========================================================

    const { prisma: db } =
      await import(
        "@/lib/prisma"
      );

    await db.review.update({
      where: {
        id: reviewId,
      },

      data: {
        aiReply:
          cleanReply,

        finalReply:
          cleanReply,

        status:
          "REPLIED",

        repliedAt:
          new Date(),

        repliedBy:
          "AI",
      },
    });

    console.log(
      "[Shopee Reply API] DATABASE UPDATED:",
      reviewId
    );

    return NextResponse.json(
      {
        success: true,

        reviewId,

        shopId:
          shopeeResponse.shopId,

        shopeeReviewId:
          shopeeResponse.commentId,

        reply:
          cleanReply,

        status:
          "REPLIED",

        shopeeResponse:
          shopeeResponse.response,
      },
      {
        status: 200,
      }
    );
  } catch (error: unknown) {
    const message =
      formatShopeeError(
        error
      );

    console.error(
      "[Shopee Reply API] ERROR:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}