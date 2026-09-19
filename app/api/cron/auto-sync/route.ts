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
    console.log('[Auto-Sync Cron] Starting daily review sync and auto-approval workflow...');
    
    const pendingReviews = await db.review.findMany({
      where: {
        status: ReviewStatus.PENDING,
      },
      take: 10, // Limit to 10 items per run to prevent Vercel runtime timeouts
    });

    let autoApprovedCount = 0;
    let flaggedCount = 0;

    for (const review of pendingReviews) {
      const rating = review.rating || 5;
      const reviewText = review.reviewText || '';
      const isProblematic = rating <= 3 || hasNegativeIntent(reviewText);

      if (!isProblematic) {
        const defaultReply = `Thank you for supporting ${review.brand || 'us'}! We're thrilled you love your purchase and hope to serve you again soon! ✨`;
        const replyText = review.aiReply || defaultReply;

        try {
          const shopeeAccount = await db.shopeeAccount.findFirst({
            where: { shopId: String(review.shopId) },
          });

          if (shopeeAccount && shopeeAccount.accessToken) {
            const partnerId = Number(SHOPEE_PARTNER_ID);
            const apiPath = '/api/v2/product/reply_comment';
            const timestamp = Math.floor(Date.now() / 1000);
            const accessToken = shopeeAccount.accessToken;
            const shopId = String(shopeeAccount.shopId);
            const sign = generateShopeeSign(partnerId, SHOPEE_PARTNER_KEY, apiPath, timestamp, accessToken, shopId);

            const shopeeUrl = `${SHOPEE_HOST}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;
            const commentId = Number(review.reviewId);

            const shopeeResponse = await fetch(shopeeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                comment_list: [{ comment_id: commentId, comment: replyText }],
              }),
            });

            const shopeeResult = await shopeeResponse.json();

            if (!shopeeResult.error) {
              await db.review.update({
                where: { id: review.id },
                data: {
                  finalReply: replyText,
                  status: ReviewStatus.REPLIED,
                  approvedBy: 'AUTO_CRON',
                  repliedBy: 'NOVA AI Auto-Pilot',
                  repliedAt: new Date(),
                },
              });
              autoApprovedCount++;
              continue;
            }
          }
        } catch (apiErr) {
          console.error(`[Auto-Sync] Failed auto-reply for review ${review.id}:`, apiErr);
        }
      } else {
        flaggedCount++;
      }
    }

    console.log(`[Auto-Sync Cron] Completed. Auto-replied: ${autoApprovedCount}, Flagged for manual edit: ${flaggedCount}`);
    return NextResponse.json({
      success: true,
      message: 'Daily cron sync and auto-approval executed successfully.',
      autoApprovedCount,
      flaggedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Auto-Sync Cron Fatal Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}