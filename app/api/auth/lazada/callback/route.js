export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

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

  return NextResponse.json({
    success: true,
    brand,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    account: data.account || data.country_user_info,
    full_response: data
  });
}