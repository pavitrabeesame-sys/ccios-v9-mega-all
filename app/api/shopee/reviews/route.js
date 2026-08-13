import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * ============================================================
 * SHOPEE SHOP → BRAND
 * ============================================================
 */

const SHOP_BRANDS = {
  "74401016": "RAV",
  "115383763": "RAV",
  "170808053": "JOHN_LANGFORD",
  "170811257": "BHPC",
  "282544493": "HUSH",
  "469553987": "OBERMAIN",
  "1637647671": "OBERMAIN",
  "1747523033": "OBERMAIN",
  "1747523036": "OBERMAIN",
  "190669704": "NICOLE",
  "66854646": "NICOLE",
  "1770621264": "RAV",
  "1770621271": "RAV",
};

function getBrand(shopId) {
  return SHOP_BRANDS[String(shopId)] || "BHPC";
}

function cleanText(value, fallback = "") {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value).trim();
}

function bigintOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany();

    console.log("========== SHOPEE ACCOUNTS ==========");

    console.log(
      JSON.stringify(
        accounts,
        (_, value) =>
          typeof value === "bigint"
            ? value.toString()
            : value,
        2
      )
    );

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No Shopee accounts found.",
      });
    }

    const results = [];

    /**
     * ========================================================
     * PROCESS EVERY SHOP
     * ========================================================
     */

    for (const account of accounts) {
      const shopId = account.shopId.toString();
      const shopIdBigInt = BigInt(shopId);

      const brand = getBrand(shopId);

      const storeName =
        `${brand} Official Store (${shopId})`;

      console.log("");
      console.log("========================================");
      console.log(`SHOP: ${shopId}`);
      console.log(`BRAND: ${brand}`);
      console.log("========================================");

      if (!account.accessToken) {
        results.push({
          shopId,
          brand,
          success: false,
          error: "Missing accessToken",
        });

        continue;
      }

      /**
       * ======================================================
       * SHOPEE API
       * ======================================================
       */

      const url = buildShopApiUrl(
        "/api/v2/product/get_comment",
        account.accessToken,
        shopId,
        {
          cursor: "",
          page_size: 100,
        }
      );

      console.log(
        `[Shopee Reviews] Fetching shop=${shopId} brand=${brand}`
      );

      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        results.push({
          shopId,
          brand,
          success: false,
          error:
            data?.message ||
            `Shopee HTTP ${response.status}`,
          data,
        });

        continue;
      }

      /**
       * ======================================================
       * API ERROR
       * ======================================================
       */

      if (data?.error) {
        results.push({
          shopId,
          brand,
          success: false,
          error:
            data.message ||
            data.error,
          data,
        });

        continue;
      }

      const comments =
        Array.isArray(
          data?.response?.item_comment_list
        )
          ? data.response.item_comment_list
          : [];

      let created = 0;
      let updated = 0;
      let synced = 0;

      /**
       * ======================================================
       * SAVE REVIEWS
       * ======================================================
       */

      for (const review of comments) {
        const reviewId =
          cleanText(
            review?.comment_id,
            `${shopId}-${Date.now()}-${synced}`
          );

        const productSku =
          review?.item_id !== undefined &&
          review?.item_id !== null
            ? String(review.item_id)
            : "";

        const rating =
          Number(
            review?.rating_star ??
            review?.rating ??
            5
          );

        const reviewText =
          cleanText(
            review?.comment,
            ""
          );

        const customerName =
          cleanText(
            review?.buyer_username,
            "Shopee Buyer"
          );

        const orderNumber =
          review?.order_sn
            ? String(review.order_sn)
            : null;

        const productName =
          cleanText(
            review?.item_name ||
              review?.product_name ||
              review?.model_name,
            productSku
              ? `Shopee Product ${productSku}`
              : "Unknown Product"
          );

        /**
         * ------------------------------------------------------
         * CHECK EXISTING REVIEW
         * ------------------------------------------------------
         */

        const existing =
          await prisma.review.findUnique({
            where: {
              reviewId,
            },
            select: {
              id: true,
              shopId: true,
              brand: true,
              marketplace: true,
              aiReply: true,
              finalReply: true,
              status: true,
            },
          });

        /**
         * ------------------------------------------------------
         * UPDATE EXISTING
         * ------------------------------------------------------
         *
         * IMPORTANT:
         * We update shopId/brand even for legacy records.
         *
         * We DO NOT reset:
         * - aiReply
         * - finalReply
         * - status
         * - approvedBy
         * - repliedBy
         * - repliedAt
         */

        if (existing) {
          await prisma.review.update({
            where: {
              reviewId,
            },

            data: {
              marketplace: "SHOPEE",

              shopId:
                shopIdBigInt,

              brand,

              storeName,

              orderNumber,

              productName,

              productSku,

              customerName,

              rating,

              reviewText,
            },
          });

          updated++;

          console.log(
            `[Shopee Reviews UPDATED] shop=${shopId} brand=${brand} review=${reviewId}`
          );
        } else {
          /**
           * ----------------------------------------------------
           * CREATE NEW
           * ----------------------------------------------------
           */

          await prisma.review.create({
            data: {
              reviewId,

              marketplace:
                "SHOPEE",

              shopId:
                shopIdBigInt,

              brand,

              storeName,

              orderNumber,

              productName,

              productSku,

              customerName,

              rating,

              reviewText,

              status:
                "PENDING",
            },
          });

          created++;

          console.log(
            `[Shopee Reviews CREATED] shop=${shopId} brand=${brand} review=${reviewId}`
          );
        }

        synced++;
      }

      /**
       * ======================================================
       * DATABASE VERIFICATION
       * ======================================================
       */

      const databaseCount =
        await prisma.review.count({
          where: {
            marketplace:
              "SHOPEE",

            shopId:
              shopIdBigInt,

            brand,

          },
        });

      const nullShopCount =
        await prisma.review.count({
          where: {
            marketplace:
              "SHOPEE",

            brand,

            shopId:
              null,
          },
        });

      console.log(
        "========================================"
      );

      console.log(
        `[Shopee Reviews COMPLETE] shop=${shopId}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] brand=${brand}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] API=${comments.length}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] created=${created}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] updated=${updated}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] database=${databaseCount}`
      );

      console.log(
        `[Shopee Reviews COMPLETE] NULL shopId for brand=${brand}: ${nullShopCount}`
      );

      console.log(
        "========================================"
      );

      results.push({
        shopId,
        brand,
        success: true,
        apiCount: comments.length,
        synced,
        created,
        updated,
        databaseCount,
        nullShopCount,
      });
    }

    /**
     * ========================================================
     * FINAL GLOBAL CHECK
     * ========================================================
     */

    const remainingNullShopReviews =
      await prisma.review.findMany({
        where: {
          marketplace:
            "SHOPEE",

          shopId:
            null,
        },

        select: {
          id: true,
          reviewId: true,
          brand: true,
          storeName: true,
          orderNumber: true,
          productSku: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    /**
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return NextResponse.json({
      success: true,

      results,

      summary: {
        shopsProcessed:
          accounts.length,

        totalCreated:
          results.reduce(
            (sum, r) =>
              sum + (r.created || 0),
            0
          ),

        totalUpdated:
          results.reduce(
            (sum, r) =>
              sum + (r.updated || 0),
            0
          ),

        remainingNullShopReviews:
          remainingNullShopReviews.length,
      },

      remainingNullShopReviewSamples:
        remainingNullShopReviews.slice(
          0,
          100
        ),
    });
  } catch (err) {
    console.error(
      "[Shopee Reviews ERROR]",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          String(err),
      },
      {
        status: 500,
      }
    );
  }
}