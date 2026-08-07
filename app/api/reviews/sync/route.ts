import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { brand, shopId } = await request.json();

    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const accessToken = process.env.SHOPEE_ACCESS_TOKEN;

    // If API credentials are not yet configured in environment variables, 
    // return a structured response indicating setup is required or fallback mock live payload.
    if (!partnerId || !partnerKey || !accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Shopee Open Platform credentials (SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_ACCESS_TOKEN) are missing in environment variables. Please add them in Vercel project settings.'
      }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/item/get_comment'; // Shopee Open API endpoint for ratings/reviews
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId || ''}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const url = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

    const shopeeResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await shopeeResponse.json();

    return NextResponse.json({
      success: true,
      reviews: data.response?.comment_list || []
    });

  } catch (error: any) {
    console.error('Shopee Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
