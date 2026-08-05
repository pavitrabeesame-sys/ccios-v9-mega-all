export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSign(path, params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret).update(path + sorted).digest('hex').toUpperCase();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const brand = (searchParams.get('state') || 'RAV').toUpperCase();

  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 });

  const appKey = process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_APP_SECRET;

  const timestamp = Date.now().toString();
  const params = {
    app_key: appKey,
    timestamp,
    sign_method: 'sha256',
    code,
  };

  params.sign = generateSign('/auth/token/create', params, appSecret);

  const tokenUrl = `https://auth.lazada.com/rest/auth/token/create?${new URLSearchParams(params).toString()}`;

  console.log('[Lazada] Token URL', tokenUrl);

  const res = await fetch(tokenUrl, { method: 'POST' });
  const data = await res.json();

  if (!data.access_token && data.data?.access_token) {
    // some versions nest inside data
    data.access_token = data.data.access_token;
    data.refresh_token = data.data.refresh_token;
    data.account = data.data.account;
  }

  if (!data.access_token) {
    return NextResponse.json({ success: false, brand, error: data, params_sent: params }, { status: 400 });
  }

  // Extract seller ID and expiration info from response
  const userInfo = data.country_user_info?.[0] || data.account || {};
  const sellerId = userInfo.seller_id || userInfo.account_id || data.account_id;
  const expireIn = data.expires_in || data.data?.expires_in || 2592000;

  // Automatically save tokens to the LazadaAccount table in Prisma
  if (sellerId) {
    try {
      await prisma.lazadaAccount.upsert({
        where: { sellerId: String(sellerId) },
        update: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expireIn: Number(expireIn),
          appKey: appKey,
          updatedAt: new Date(),
        },
        create: {
          sellerId: String(sellerId),
          appKey: appKey,
          appSecret: appSecret || '',
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expireIn: Number(expireIn),
        },
      });
      console.log(`[Lazada] Successfully saved tokens for seller ID: ${sellerId}`);
    } catch (dbError) {
      console.error('[Lazada] Database Save Error:', dbError);
    }
  }

  return NextResponse.json({
    success: true,
    brand,
    sellerId: sellerId || 'unknown',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    account: data.account || data.country_user_info,
    full_response: data
  });
}