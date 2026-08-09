import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReviewStatus } from '@prisma/client';
import crypto from 'crypto';

function generateShopeeSign(
  partnerId: number,
  partnerKey: string,
  apiPath: string,
  timestamp: number,
  accessToken: string = '',
  shopId: string = ''
): string {
  const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
  return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { customReply, approvedBy } = body;

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      include: { shopeeAccount: true }, // Ensure shopeeAccount relation is fetched if available
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const replyText = customReply || review.aiReply;

    if (!replyText) {
      return NextResponse.json({ error: 'No reply text provided' }, { status: 400 });
    }

    // 1. Resolve Shopee Credentials
    const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
    const partnerKey = process.env.SHOPEE_PARTNER_KEY || '';
    const host = process.env.SHOPEE_HOST || 'https://partner.shopeemobile.com';

    // Fetch account by shopId associated with the review or default account
    let shopeeAccount = review.shopeeAccount;
    if (!shopeeAccount && review.shopId) {
      shopeeAccount = await prisma.shopeeAccount.findFirst({
        where: { shopId: String(review.shopId) },
      });
    }

    if (!shopeeAccount) {
      shopeeAccount = await prisma.shopeeAccount.findFirst();
    }

    const shopId = String(shopeeAccount?.shopId || review.shopId || '');
    const accessToken = shopeeAccount?.accessToken || '';

    if (!shopId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing Shopee authentication details for this store' },
        { status: 400 }
      );
    }

    // 2. Build Shopee v2 Reply Endpoint
    const apiPath = '/api/v2/product/reply_comment';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);

    const cleanHost = host.replace(/\/+$/, '');
    const shopeeUrl = `${cleanHost}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&access_token=${accessToken}&shop_id=${shopId}`;

    // Target comment_id (uses review.reviewId or review.commentId)
    const commentId = Number(review.reviewId || (review as any).commentId);

    // 3. Call Shopee Open API
    const shopeeResponse = await fetch(shopeeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_list: [
          {
            comment_id: commentId,
            comment: replyText,
          },
        ],
      }),
    });

    const shopeeResult = await shopeeResponse.json();

    if (shopeeResult.error && shopeeResult.error !== '') {
      console.error('Shopee Reply API Error:', shopeeResult);
      return NextResponse.json(
        { error: shopeeResult.message || shopeeResult.error || 'Failed to post reply to Shopee' },
        { status: 400 }
      );
    }

    // 4. Update Database Status
    const updated = await prisma.review.update({
      where: { id: params.id },
      data: {
        finalReply: replyText,
        status: ReviewStatus.REPLIED,
        approvedBy: approvedBy || 'SYSTEM',
        repliedBy: approvedBy || 'CS Team',
        repliedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: updated, shopeeResult });
  } catch (error: any) {
    console.error('Error posting review reply:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process reply' },
      { status: 500 }
    );
  }
}