import { getToken, setToken, tokenStore } from './tokenStore';
import crypto from "crypto";

// Shopee Open Platform v2 integration.
// Docs: https://open.shopee.com/documents
//
// Setup needed (see README):
// 1. Register an app at https://open.shopee.com/ â†’ get PARTNER_ID + PARTNER_KEY
// 2. Set SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY / SHOPEE_HOST in env vars
// 3. Authorize your shop by visiting /api/auth/shopee â€” this redirects you to
//    Shopee, you approve, and it comes back with a shop_id + tokens.
//
// NOTE ON TOKEN STORAGE: this file uses a simple in-memory store as a starting
// point. Vercel serverless functions are stateless between requests, so tokens
// WILL be lost on cold starts. For real production use, swap `tokenStore`
// below for a persistent store (Vercel KV, Upstash Redis, or your own DB) â€”
// the get/set/has methods are the only thing you need to replace.

const PARTNER_ID = process.env.SHOPEE_PARTNER_ID;
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY;
const HOST = process.env.SHOPEE_HOST || "https://partner.shopeemobile.com"; // sandbox: https://partner.test-stable.shopeemobile.com

// --- naive in-memory token store (replace for production, see note above) ---
const mem = globalThis.__shopeeTokenStore || (globalThis.__shopeeTokenStore = {});


function sign(baseString) {
  return crypto.createHmac("sha256", PARTNER_KEY).update(baseString).digest("hex");
}

export function isConfigured() {
  return Boolean(PARTNER_ID && PARTNER_KEY);
}

export function buildAuthUrl(redirectUrl) {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const signature = sign(baseString);
  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);
  url.searchParams.set("redirect", redirectUrl);
  return url.toString();
}

export async function exchangeCodeForToken(code, shopId) {
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const signature = sign(baseString);
  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, shop_id: Number(shopId), partner_id: Number(PARTNER_ID) }),
  });
  const j = await r.json();
  if (j.access_token) {
    tokenStore.set(String(shopId), {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      obtained_at: Date.now(),
      expires_in: j.expire_in,
    });
  }
  return j;
}

async function refreshIfNeeded(shopId) {
  const t = tokenStore.get(shopId);
  if (!t) return null;
  const ageSeconds = (Date.now() - t.obtained_at) / 1000;
  if (ageSeconds < (t.expires_in || 14400) - 120) return t; // still valid, refresh 2 min before expiry

  const path = "/api/v2/auth/access_token/get";
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${PARTNER_ID}${path}${timestamp}`;
  const signature = sign(baseString);
  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);

  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: t.refresh_token, shop_id: Number(shopId), partner_id: Number(PARTNER_ID) }),
  });
  const j = await r.json();
  if (j.access_token) {
    const updated = { access_token: j.access_token, refresh_token: j.refresh_token, obtained_at: Date.now(), expires_in: j.expire_in };
    tokenStore.set(shopId, updated);
    return updated;
  }
  return t;
}

// Calls a Shopee v2 GET endpoint for a specific authorized shop.
export async function shopeeGet(shopId, path, params = {}) {
  if (!isConfigured()) throw new Error("Shopee credentials not configured (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY)");
  const t = await refreshIfNeeded(shopId);
  if (!t) throw new Error(`No Shopee token on file for shop ${shopId}. Authorize it via /api/auth/shopee first.`);

  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${PARTNER_ID}${path}${timestamp}${t.access_token}${shopId}`;
  const signature = sign(baseString);

  const url = new URL(HOST + path);
  url.searchParams.set("partner_id", PARTNER_ID);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", signature);
  url.searchParams.set("access_token", t.access_token);
  url.searchParams.set("shop_id", shopId);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const r = await fetch(url.toString());
  return r.json();
}

