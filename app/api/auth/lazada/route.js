export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get('brand') || 'RAV';
  
  const clientId = process.env.LAZADA_APP_KEY;
  const redirectUri = process.env.LAZADA_REDIRECT_URI || 'https://ccios-v9-mega-all-lzlu.vercel.app/api/auth/lazada/callback';
  
  const authUrl = `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&state=${brand}`;
  
  return NextResponse.redirect(authUrl);
}