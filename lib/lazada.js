import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const LAZADA_BRANDS = [
  "RAV",
  "NICOLE",
  "OBERMAIN",
  "HUSHPUPPIES",
  "BHPC"
];

export function isConfigured() {
  return Boolean(
    process.env.LAZADA_APP_KEY &&
    process.env.LAZADA_APP_SECRET
  );
}

export function configuredBrands() {
  return LAZADA_BRANDS.filter(
    brand =>
      process.env[`LAZADA_${brand}_REFRESH_TOKEN`] ||
      process.env[`LAZADA_REFRESH_TOKEN_${brand}`]
  );
}

function generateSign(path, params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret).update(path + sorted).digest('hex').toUpperCase();
}

async function refreshAccessToken(account) {
  const appKey = process.env.LAZADA_APP_KEY || account.appKey;
  const appSecret = process.env.LAZADA_APP_SECRET || account.appSecret;
  
  const timestamp = Date.now().toString();
  const params = {
    app_key: appKey,
    timestamp,
    sign_method: 'sha256',
    refresh_token: account.refreshToken,
  };

  params.sign = generateSign('/auth/token/refresh', params, appSecret);
  const url = `https://auth.lazada.com/rest/auth/token/refresh?${new URLSearchParams(params).toString()}`;

  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();

  if (data.access_token || data.data?.access_token) {
    const newAccessToken = data.access_token || data.data.access_token;
    const newRefreshToken = data.refresh_token || data.data?.refresh_token || account.refreshToken;
    const expireIn = data.expires_in || data.data?.expires_in || account.expireIn;

    await prisma.lazadaAccount.update({
      where: { sellerId: account.sellerId },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expireIn: Number(expireIn),
        updatedAt: new Date(),
      },
    });
    return newAccessToken;
  }
  throw new Error(`Failed to refresh Lazada token: ${JSON.stringify(data)}`);
}

export async function lazadaGet(brandOrSellerId, apiPath, queryParams = {}) {
  const appKey = process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_APP_SECRET;

  // Find account in Prisma database by sellerId or brand name
  let account = await prisma.lazadaAccount.findFirst({
    where: {
      OR: [
        { sellerId: brandOrSellerId },
        { brand: { equals: brandOrSellerId, mode: 'insensitive' } },
      ],
    },
  });

  if (!account) {
    // Fallback: grab the first available Lazada account in DB
    account = await prisma.lazadaAccount.findFirst();
  }

  if (!account || !account.accessToken) {
    throw new Error(`${brandOrSellerId}: No Lazada account found in database. Please complete authorization via /api/auth/lazada first.`);
  }

  // Check token expiration buffer
  const tokenAge = Date.now() - new Date(account.updatedAt).getTime();
  const expireMs = (account.expireIn || 2592000) * 1000;
  let accessToken = account.accessToken;

  if (tokenAge > expireMs - 300000) {
    try {
      accessToken = await refreshAccessToken(account);
    } catch (err) {
      console.error('[Lazada] Token refresh warning, attempting with current token:', err);
    }
  }

  const timestamp = Date.now().toString();
  const params = {
    app_key: appKey || account.appKey,
    access_token: accessToken,
    timestamp,
    sign_method: 'sha256',
    ...queryParams,
  };

  const secret = appSecret || account.appSecret;
  params.sign = generateSign(apiPath, params, secret);

  const gatewayUrl = `https://api.lazada.com/rest${apiPath}?${new URLSearchParams(params).toString()}`;

  const res = await fetch(gatewayUrl);
  const data = await res.json();

  if (data.code && data.code !== '0' && data.code !== 0) {
    throw new Error(`Lazada API Error (${data.code}): ${data.message || JSON.stringify(data)}`);
  }

  return data;
}