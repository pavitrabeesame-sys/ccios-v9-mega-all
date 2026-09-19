import { NextResponse } from 'next/server';
import { prisma as db } from '@/lib/prisma';
import { ReviewStatus } from '@prisma/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SHOPEE_PARTNER_ID = String(process.env.SHOPEE_PARTNER_ID || '').trim().replace(/['"]/g, '');
const SHOPEE_PARTNER_KEY = String(process.env.SHOPEE_PARTNER_KEY || '').trim().replace(/['"]/g, '');
const SHOPEE_HOST = (process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com').replace(/\/$/, '');

function generateShopeeSign(partnerId: number, partnerKey: string, apiPath: string, timestamp: number, accessToken: string = '', shopId: string = ''): string {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

const NEGATIVE_KEYWORDS = [
  'damage', 'broken', 'defect', 'wrong', 'bad', 'poor', 'late', 
  'slow', 'horrible', 'worst', 'scam', 'return', 'refund', 'missing', 'rosak', 'teruk'
];

function hasNegativeIntent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some((word) => lower.includes(word));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('[Auto-Sync Cron] Starting single-page batched review sync...');

    // Find active Shopee accounts to sync page-by-page
    const accounts = await db.shopeeAccount.findMany({
      where: { accessToken: { not: null } },
      take: 1, // Process one account/page rotation per execution to stay well within timeouts
    });

    if (accounts.length === 0) {
      return NextResponse.json({ success: true, message: 'No active Shopee accounts found for sync.' });
    }

    const shopeeAccount = accounts[0];
    const shopId = String(shopeeAccount.shopId);
    const currentPage = shopeeAccount.nextReviewPage ?? 1;

    console.log(`[Smart Sync][Shopee] ${shopId} — processing page ${currentPage}`);

    const partnerId = Number(SHOPEE_PARTNER_ID);
    const apiPath = '/api/v2/seller/get_unrated_order_list'; // or your review list endpoint
    const timestamp = Math.floor(Date.now() / 1000);
    const accessToken = shopeeAccount.accessToken!;
    const sign = generateShopeeSign(partnerId, SHOPEE_PARTNER_KEY, apiPath, timestamp, accessToken, shopId);

    // Fetch single page from Shopee API
    const shopeeUrl = `${SHOPEE_HOST}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}&page_no=${currentPage}&page_size=20`;

    const res = await fetch(shopeeUrl);
    const data = await res.json();

    let hasMorePages = false;
    let autoApprovedCount = 0;
    let flaggedCount = 0;

    if (!data.error && data.response) {
      hasMorePages = data.response.has_next_page ?? false;
      const reviewsList = data.response.comment_list || data.response.list || [];

      for (const item of reviewsList) {
        const rating = item.rating || 5;
        const reviewText = item.comment || '';
        const isProblematic = rating <= 3 || hasNegativeIntent(reviewText);

        if (!isProblematic) {
          const defaultReply = `Thank you for supporting us! We're thrilled you love your purchase and hope to serve you again soon! ✨`;
          
          try {
            const replyPath = '/api/v2/product/reply_comment';
            const replySign = generateShopeeSign(partnerId, SHOPEE_PARTNER_KEY, replyPath, timestamp, accessToken, shopId);
            const replyUrl = `${SHOPEE_HOST}${replyPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${replySign}&access_token=${accessToken}&shop_id=${shopId}`;

            const replyRes = await fetch(replyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                comment_list: [{ comment_id: item.comment_id, comment: defaultReply }],
              }),
            });

            const replyResult = await replyRes.json();
            if (!replyResult.error) {
              autoApprovedCount++;
            }
          } catch (err) {
            console.error(`[Auto-Sync] Failed replying to comment ${item.comment_id}:`, err);
          }
        } else {
          flaggedCount++;
        }
      }
    }

    // Advance cursor or reset to page 1 if complete
    if (hasMorePages) {
      await db.shopeeAccount.update({
        where: { id: shopeeAccount.id },
        data: { nextReviewPage: currentPage + 1 },
      });
    } else {
      await db.shopeeAccount.update({
        where: { id: shopeeAccount.id },
        data: { nextReviewPage: 1 },
      });
    }

    console.log(`[Auto-Sync Cron] Page ${currentPage} completed for shop ${shopId}. Replied: ${autoApprovedCount}, Flagged: ${flaggedCount}`);
    
    return NextResponse.json({
      success: true,
      shopId,
      processedPage: currentPage,
      hasMorePages,
      autoApprovedCount,
      flaggedCount,
    });
  } catch (error: any) {
    console.error('[Auto-Sync Cron Fatal Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}