import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extractShopId(storeName: string): string | null {
  const match = storeName.match(/\((\d+)\)\s*$/);
  return match ? match[1] : null;
}

async function refreshAccessToken(partnerId: string, partnerKey: string, refreshToken: string, shopId: number) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/auth/access_token/get';
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: Number(partnerId), refresh_token: refreshToken, shop_id: Number(shopId) })
    });
    const data = await res.json();
    if (data.access_token) {
      return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
    }
  } catch (e) {
    console.error(`Failed to refresh token for shop ${shopId}:`, e);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;

    if (!partnerId || !partnerKey) {
      return NextResponse.json({ success: false, error: 'Missing Shopee API credentials.' }, { status: 400 });
    }

    const { ids } = await req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No review ids provided.' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { id: { in: ids }, aiReply: { not: null } },
    });

    if (reviews.length === 0) {
      return NextResponse.json({ success: false, error: 'No reviews with AI replies found for the given ids.' }, { status: 400 });
    }

    // Group reviews by shop (marketplace = SHOPEE only for now)
    const byShop: Record<string, typeof reviews> = {};
    const skipped: string[] = [];

    for (const review of reviews) {
      if (review.marketplace !== 'SHOPEE') {
        skipped.push(`${review.id}: not a Shopee review (${review.marketplace})`);
        continue;
      }
      const shopId = extractShopId(review.storeName || '');
      if (!shopId) {
        skipped.push(`${review.id}: could not determine shop ID from storeName`);
        continue;
      }
      if (!byShop[shopId]) byShop[shopId] = [];
      byShop[shopId].push(review);
    }

    const results: any[] = [];

    for (const shopId of Object.keys(byShop)) {
      const shopReviews = byShop[shopId];
      const account = await prisma.shopeeAccount.findUnique({ where: { shopId: BigInt(shopId) } });

      if (!account || !account.accessToken) {
        for (const r of shopReviews) {
          results.push({ id: r.id, success: false, error: 'No Shopee account/token for this shop' });
        }
        continue;
      }

      let accessToken = account.accessToken;
      const refreshToken = account.refreshToken;

      const commentList = shopReviews.map(r => ({
        comment_id: Number(r.reviewId),
        comment: r.aiReply,
      }));

      const doCall = async (token: string) => {
        const timestamp = Math.floor(Date.now() / 1000);
        const path = '/api/v2/product/reply_comment';
        const baseString = `${partnerId}${path}${timestamp}${token}${shopId}`;
        const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
        const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${token}&shop_id=${shopId}&sign=${sign}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment_list: commentList }),
        });
        return res.json();
      };

      try {
        let shopeeResponse = await doCall(accessToken);

        const errorText = `${shopeeResponse.error || ''} ${shopeeResponse.message || ''}`.toLowerCase();
        if (errorText.includes('token') || errorText.includes('auth')) {
          if (refreshToken) {
            const refreshed = await refreshAccessToken(partnerId, partnerKey, refreshToken, Number(shopId));
            if (refreshed) {
              accessToken = refreshed.accessToken;
              await prisma.shopeeAccount.updateMany({
                where: { shopId: BigInt(shopId) },
                data: { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken },
              });
              shopeeResponse = await doCall(accessToken);
            }
          }
        }

        if (shopeeResponse.error) {
          for (const r of shopReviews) {
            results.push({ id: r.id, success: false, error: `${shopeeResponse.error}: ${shopeeResponse.message || ''}` });
          }
          continue;
        }

        // Shopee returns a result list indicating per-comment success/failure
        const resultList = shopeeResponse.response?.result_list || [];
        const succeededIds = new Set(
          resultList.filter((r: any) => !r.fail_error).map((r: any) => String(r.comment_id))
        );

        for (const r of shopReviews) {
          const ok = resultList.length === 0 ? true : succeededIds.has(r.reviewId);
          if (ok) {
            await prisma.review.update({
              where: { id: r.id },
              data: { status: 'REPLIED', repliedAt: new Date(), finalReply: r.aiReply || '' },
            });
          }
          results.push({ id: r.id, success: ok, error: ok ? null : 'Shopee reported failure for this comment' });
        }
      } catch (err: any) {
        for (const r of shopReviews) {
          results.push({ id: r.id, success: false, error: err.message });
        }
      }
    }

    for (const s of skipped) {
      results.push({ id: s.split(':')[0], success: false, error: s });
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.length - succeeded;

    return NextResponse.json({
      success: true,
      posted: succeeded,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('REPLY ALL ERROR', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
