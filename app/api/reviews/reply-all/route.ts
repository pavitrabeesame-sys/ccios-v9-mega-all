import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function POST(req: Request) {
  try {
    // =========================================================
    // SHOPEE CREDENTIALS
    // =========================================================

    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;

    if (!partnerId || !partnerKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing Shopee API credentials.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // REQUEST BODY
    // =========================================================

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No review ids provided.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // LOAD ONLY ELIGIBLE SHOPEE REVIEWS
    // =========================================================

    const reviews = await prisma.review.findMany({
      where: {
        id: {
          in: ids,
        },

        marketplace: 'SHOPEE',

        status: {
          not: 'REPLIED',
        },

        aiReply: {
          not: null,
        },

        shopId: {
          not: null,
        },
      },
    });

    // =========================================================
    // SAFETY FILTER
    //
    // Do not send replies containing placeholder text.
    // =========================================================

    const eligibleReviews = reviews.filter((review) => {
      const reply = (review.aiReply || '').trim();

      if (!reply) {
        return false;
      }

      // Reject known placeholders and any bracketed placeholder text.
const placeholders = [
  '[Company Name]',
  '[Your Company Name]',
  '[Customer Service Team]',
  '[Your Customer Service Team]',
  '[Customer Service]',
];

const hasKnownPlaceholder = placeholders.some((placeholder) =>
  reply.includes(placeholder)
);

const hasBracketPlaceholder = /\[[^\]]+\]/.test(reply);

return !hasKnownPlaceholder && !hasBracketPlaceholder;
    });

    // =========================================================
    // NO ELIGIBLE REVIEWS
    // =========================================================

    if (eligibleReviews.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No eligible Shopee reviews found. Reviews must have an AI reply, a Shopee shop ID, must not already be REPLIED, and must not contain placeholder text.',
        },
        { status: 400 }
      );
    }

    // =========================================================
    // GROUP REVIEWS BY SHOPEE SHOP
    //
    // IMPORTANT:
    // Use review.shopId directly.
    // NEVER determine shop from storeName.
    // =========================================================

    const byShop: Record<string, typeof reviews> = {};
    const skipped: string[] = [];

    for (const review of eligibleReviews) {
      if (review.marketplace !== 'SHOPEE') {
        skipped.push(
          `${review.id}: not a Shopee review (${review.marketplace})`
        );
        continue;
      }

      const shopId = review.shopId
        ? String(review.shopId)
        : null;

      if (!shopId) {
        skipped.push(
          `${review.id}: no Shopee shop ID assigned to review`
        );
        continue;
      }

      if (!byShop[shopId]) {
        byShop[shopId] = [];
      }

      byShop[shopId].push(review);
    }

    const results: any[] = [];

    // =========================================================
    // PROCESS EACH SHOPEE SHOP SEPARATELY
    // =========================================================

    for (const shopId of Object.keys(byShop)) {
      const shopReviews = byShop[shopId];

      console.log(
        `[Shopee Bulk Reply] Processing shop ${shopId} with ${shopReviews.length} review(s)`
      );

      // =======================================================
      // LOAD SHOPEE ACCOUNT FOR THIS EXACT SHOP
      // =======================================================

      const account = await prisma.shopeeAccount.findUnique({
        where: {
          shopId: BigInt(shopId),
        },
      });

      if (!account || !account.accessToken) {
        console.error(
          `[Shopee Bulk Reply] No account/token for shop ${shopId}`
        );

        for (const r of shopReviews) {
          results.push({
            id: r.id,
            reviewId: r.reviewId,
            success: false,
            error: 'No Shopee account/token for this shop',
          });
        }

        continue;
      }

      let accessToken = account.accessToken;
      const refreshToken = account.refreshToken;

      // =======================================================
      // BUILD SHOPEE COMMENT LIST
      // =======================================================

      const commentList = shopReviews.map((r) => ({
        comment_id: Number(r.reviewId),
        comment: r.aiReply,
      }));

      console.log(
        `[Shopee Bulk Reply] Shop ${shopId} comment list:`,
        JSON.stringify(
          commentList.map((x) => ({
            comment_id: x.comment_id,
            comment_length: x.comment?.length || 0,
          })),
          null,
          2
        )
      );

      // =======================================================
      // SHOPEE API CALL
      // =======================================================

      const doCall = async (token: string) => {
        const timestamp = Math.floor(Date.now() / 1000);

        const path = '/api/v2/product/reply_comment';

        const baseString =
          `${partnerId}${path}${timestamp}${token}${shopId}`;

        const sign = crypto
          .createHmac('sha256', partnerKey)
          .update(baseString)
          .digest('hex');

        const url =
          `https://partner.shopeemobile.com${path}` +
          `?partner_id=${partnerId}` +
          `&timestamp=${timestamp}` +
          `&access_token=${token}` +
          `&shop_id=${shopId}` +
          `&sign=${sign}`;

        console.log(
          `[Shopee Bulk Reply] Calling reply_comment for shop ${shopId}`
        );

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            comment_list: commentList,
          }),
        });

        const text = await res.text();

        let data: any;

        try {
          data = JSON.parse(text);
        } catch {
          data = {
            error: 'INVALID_JSON_RESPONSE',
            message: text,
          };
        }

        console.log(
          `[Shopee Bulk Reply Response] shop=${shopId} http=${res.status}`,
          JSON.stringify(data, null, 2)
        );

        return {
          httpStatus: res.status,
          data,
        };
      };

      try {
        // =====================================================
        // FIRST ATTEMPT
        // =====================================================

        let callResult = await doCall(accessToken);
        let shopeeResponse = callResult.data;

        // =====================================================
        // TOKEN / AUTH ERROR
        // =====================================================

        const errorText =
          `${shopeeResponse?.error || ''} ${
            shopeeResponse?.message || ''
          }`.toLowerCase();

        const tokenError =
          errorText.includes('token') ||
          errorText.includes('auth') ||
          errorText.includes('access_token') ||
          errorText.includes('access token');

        if (tokenError && refreshToken) {
          console.log(
            `[Shopee Bulk Reply] Token error detected for shop ${shopId}. Refreshing token...`
          );

          const refreshed = await refreshAccessToken(
            partnerId,
            partnerKey,
            refreshToken,
            Number(shopId)
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

            // =================================================
            // SECOND ATTEMPT WITH NEW TOKEN
            // =================================================

            callResult = await doCall(accessToken);
            shopeeResponse = callResult.data;
          }
        }

        // =====================================================
        // TOP-LEVEL SHOPEE ERROR
        // =====================================================

        if (
          shopeeResponse?.error ||
          callResult.httpStatus < 200 ||
          callResult.httpStatus >= 300
        ) {
          const errorMessage =
            `${shopeeResponse?.error || 'HTTP_ERROR'}: ${
              shopeeResponse?.message ||
              'Shopee API request failed'
            }`;

          console.error(
            `[Shopee Bulk Reply FAILED] shop=${shopId}`,
            JSON.stringify(
              {
                httpStatus: callResult.httpStatus,
                error: shopeeResponse?.error,
                message: shopeeResponse?.message,
                response: shopeeResponse,
              },
              null,
              2
            )
          );

          for (const r of shopReviews) {
            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error: errorMessage,
              shopeeResponse,
            });
          }

          continue;
        }

        // =====================================================
        // SHOPEE PER-COMMENT RESULT
        // =====================================================

        const resultList =
          shopeeResponse?.response?.result_list ||
          shopeeResponse?.data?.result_list ||
          [];

        console.log(
          `[Shopee Bulk Reply Result List] shop=${shopId}`,
          JSON.stringify(resultList, null, 2)
        );

        // =====================================================
        // NO RESULT LIST = DO NOT ASSUME SUCCESS
        // =====================================================

        if (
          !Array.isArray(resultList) ||
          resultList.length === 0
        ) {
          console.error(
            `[Shopee Bulk Reply] No result_list returned for shop ${shopId}`
          );

          for (const r of shopReviews) {
            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error:
                'Shopee returned no per-comment result_list',
              shopeeResponse,
            });
          }

          continue;
        }

        // =====================================================
        // MATCH EACH REVIEW BY SHOPEE COMMENT ID
        // =====================================================

        for (const r of shopReviews) {
          const reviewId = String(r.reviewId);

          const result = resultList.find(
            (item: any) =>
              String(item.comment_id) === reviewId
          );

          // ===================================================
          // NO MATCH
          // ===================================================

          if (!result) {
            console.error(
              `[Shopee Reply] No result returned for review ${reviewId}`
            );

            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error:
                'Shopee returned no result for this comment',
              shopeeResponse: resultList,
            });

            continue;
          }

          // ===================================================
          // SHOPEE EXPLICIT FAILURE
          // ===================================================

          if (result.fail_error) {
            const failError = String(
              result.fail_error
            );

            const failMessage = String(
              result.fail_message ||
                result.message ||
                'No failure message returned by Shopee'
            );

            // =================================================
            // DUPLICATE REQUEST
            //
            // Shopee says the review was already replied to.
            // Treat this as ALREADY REPLIED instead of failure.
            // =================================================

            if (
              failError ===
              'product.duplicate_request'
            ) {
              console.log(
                `[Shopee Reply ALREADY REPLIED] review=${reviewId}`
              );

              await prisma.review.update({
                where: {
                  id: r.id,
                },

                data: {
                  status: 'REPLIED',

                  repliedAt:
                    r.repliedAt || new Date(),

                  finalReply:
                    r.finalReply ||
                    r.aiReply ||
                    '',
                },
              });

              results.push({
                id: r.id,
                reviewId: r.reviewId,
                success: true,
                alreadyReplied: true,
                error: null,
                message: failMessage,
              });

              continue;
            }

            // =================================================
            // REAL SHOPEE FAILURE
            // =================================================

            console.error(
              `[Shopee Reply FAILED] review=${reviewId}`,
              JSON.stringify(
                result,
                null,
                2
              )
            );

            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,

              error: {
                failError,
                failMessage,
              },

              shopeeResponse: result,
            });

            continue;
          }

          // ===================================================
          // SUCCESS
          // ===================================================

          await prisma.review.update({
            where: {
              id: r.id,
            },

            data: {
              status: 'REPLIED',
              repliedAt: new Date(),
              finalReply: r.aiReply || '',
            },
          });

          results.push({
            id: r.id,
            reviewId: r.reviewId,
            success: true,
            error: null,
          });

          console.log(
            `[Shopee Reply SUCCESS] review=${reviewId}`
          );
        }
      } catch (err: any) {
        // =====================================================
        // SHOP-LEVEL ERROR
        // =====================================================

        console.error(
          `[Shopee Bulk Reply ERROR] shop=${shopId}`,
          err
        );

        for (const r of shopReviews) {
          results.push({
            id: r.id,
            reviewId: r.reviewId,
            success: false,
            error:
              err?.message ||
              String(err),
          });
        }
      }
    }

    // =========================================================
    // SKIPPED REVIEWS
    // =========================================================

    for (const s of skipped) {
      results.push({
        id: s.split(':')[0],
        success: false,
        error: s,
      });
    }

    // =========================================================
    // SUMMARY
    // =========================================================

    const succeeded = results.filter(
      (r) => r.success
    ).length;

    const failed =
      results.length - succeeded;

    // =========================================================
    // RESPONSE
    // =========================================================

    return NextResponse.json({
      success: true,
      posted: succeeded,
      failed,
      total: results.length,
      results,
    });
  } catch (error: any) {
    console.error(
      'REPLY ALL ERROR',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}