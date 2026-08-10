import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extractShopId(storeName: string): string | null {
  const match = storeName.match(/\((\d+)\)\s*$/);
  if (match) return match[1];

  const fallback = storeName.match(/(\d+)\s*$/);
  return fallback ? fallback[1] : null;
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

export async function POST(req: Request) {
  try {
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

    const reviews = await prisma.review.findMany({
      where: {
        id: {
          in: ids,
        },
        aiReply: {
          not: null,
        },
      },
    });

    if (reviews.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No reviews with AI replies found for the given ids.',
        },
        { status: 400 }
      );
    }

    /*
     * GROUP REVIEWS BY SHOPEE SHOP
     */
    const byShop: Record<string, typeof reviews> = {};
    const skipped: string[] = [];

    for (const review of reviews) {
      if (review.marketplace !== 'SHOPEE') {
        skipped.push(
          `${review.id}: not a Shopee review (${review.marketplace})`
        );
        continue;
      }

      const shopId = extractShopId(review.storeName || '');

      if (!shopId) {
        skipped.push(
          `${review.id}: could not determine shop ID from storeName`
        );
        continue;
      }

      if (!byShop[shopId]) {
        byShop[shopId] = [];
      }

      byShop[shopId].push(review);
    }

    const results: any[] = [];

    /*
     * PROCESS EACH SHOPEE SHOP
     */
    for (const shopId of Object.keys(byShop)) {
      const shopReviews = byShop[shopId];

      console.log(
        `[Shopee Bulk Reply] Processing shop ${shopId} with ${shopReviews.length} review(s)`
      );

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

      /*
       * SHOPEE BATCH REQUEST
       */
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

      const doCall = async (token: string) => {
        const timestamp = Math.floor(Date.now() / 1000);

        const path = '/api/v2/product/reply_comment';

        /*
         * Shopee product API signature:
         *
         * partner_id
         * + path
         * + timestamp
         * + access_token
         * + shop_id
         */
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
        /*
         * FIRST ATTEMPT
         */
        let callResult = await doCall(accessToken);
        let shopeeResponse = callResult.data;

        /*
         * TOKEN / AUTH ERROR
         */
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

            /*
             * SECOND ATTEMPT WITH NEW TOKEN
             */
            callResult = await doCall(accessToken);
            shopeeResponse = callResult.data;
          }
        }

        /*
         * TOP-LEVEL SHOPEE ERROR
         */
        if (
          shopeeResponse?.error ||
          callResult.httpStatus < 200 ||
          callResult.httpStatus >= 300
        ) {
          const errorMessage =
            `${shopeeResponse?.error || 'HTTP_ERROR'}: ${
              shopeeResponse?.message || 'Shopee API request failed'
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

        /*
         * SHOPEE PER-COMMENT RESULT
         */
        const resultList =
          shopeeResponse?.response?.result_list ||
          shopeeResponse?.data?.result_list ||
          [];

        console.log(
          `[Shopee Bulk Reply Result List] shop=${shopId}`,
          JSON.stringify(resultList, null, 2)
        );

        /*
         * If Shopee returned no result list, DO NOT automatically
         * mark everything successful.
         *
         * We need explicit confirmation from Shopee.
         */
        if (!Array.isArray(resultList) || resultList.length === 0) {
          console.error(
            `[Shopee Bulk Reply] No result_list returned for shop ${shopId}`
          );

          for (const r of shopReviews) {
            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error: 'Shopee returned no per-comment result_list',
              shopeeResponse,
            });
          }

          continue;
        }

        /*
         * MATCH EACH REVIEW BY NORMALIZED COMMENT ID
         */
        for (const r of shopReviews) {
          const reviewId = String(r.reviewId);

          const result = resultList.find(
            (item: any) =>
              String(item.comment_id) === reviewId
          );

          /*
           * No matching Shopee result
           */
          if (!result) {
            console.error(
              `[Shopee Reply] No result returned for review ${reviewId}`
            );

            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error: 'Shopee returned no result for this comment',
              shopeeResponse: resultList,
            });

            continue;
          }

          /*
           * Shopee explicitly reported failure
           */
          if (result.fail_error) {
            console.error(
              `[Shopee Reply FAILED] review=${reviewId}`,
              JSON.stringify(result, null, 2)
            );

            results.push({
              id: r.id,
              reviewId: r.reviewId,
              success: false,
              error: {
                failError:
                  result.fail_error || 'UNKNOWN_SHOPEE_ERROR',
                failMessage:
                  result.fail_message ||
                  result.message ||
                  'No failure message returned by Shopee',
              },
              shopeeResponse: result,
            });

            continue;
          }

          /*
           * SUCCESS
           */
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
        console.error(
          `[Shopee Bulk Reply ERROR] shop=${shopId}`,
          err
        );

        for (const r of shopReviews) {
          results.push({
            id: r.id,
            reviewId: r.reviewId,
            success: false,
            error: err?.message || String(err),
          });
        }
      }
    }

    /*
     * SKIPPED REVIEWS
     */
    for (const s of skipped) {
      results.push({
        id: s.split(':')[0],
        success: false,
        error: s,
      });
    }

    const succeeded = results.filter(
      (r) => r.success
    ).length;

    const failed =
      results.length - succeeded;

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
        error: error?.message || String(error),
      },
      {
        status: 500,
      }
    );
  }
}
