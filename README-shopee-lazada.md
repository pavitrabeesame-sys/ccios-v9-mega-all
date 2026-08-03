# Connecting Real Shopee & Lazada Data

Both platforms require registering as a developer/partner, completing an
OAuth-style authorization for your specific shop/seller account, and signing
every API request. This is now wired into the app — here's how to turn it on.

## 1. Shopee

1. Register at https://open.shopee.com/ and create an app.
2. Get your **Partner ID** and **Partner Key** from the app dashboard.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables):
   - `SHOPEE_PARTNER_ID`
   - `SHOPEE_PARTNER_KEY`
   - `SHOPEE_HOST` (leave as `https://partner.shopeemobile.com` for
     production, or use `https://partner.test-stable.shopeemobile.com` for
     sandbox testing)
4. Redeploy, then visit `https://YOUR-APP.vercel.app/api/auth/shopee` in your
   browser. You'll be redirected to Shopee to approve access to your shop.
   On success you'll see a confirmation JSON response.
5. The Orders and Products tabs will now attempt to pull real data for every
   shop you've authorized this way.

**Important limitation:** access tokens expire every 4 hours. The included
`lib/shopee.js` auto-refreshes them, but it stores tokens in memory only —
on Vercel, serverless functions restart (cold start) periodically, which
wipes that memory. For reliable production use, replace the `tokenStore`
object in `lib/shopee.js` with a persistent store such as Vercel KV or
Upstash Redis (swap the get/set/has functions to read/write there instead).

## 2. Lazada

1. Register at https://open.lazada.com/ and create an app.
2. Get your **App Key** and **App Secret**.
3. Add these Environment Variables in Vercel:
   - `LAZADA_APP_KEY`
   - `LAZADA_APP_SECRET`
   - `LAZADA_REGION` (e.g. `my` for Malaysia, `sg`, `th`, `ph`, `vn`, `id`)
4. Redeploy, then visit `https://YOUR-APP.vercel.app/api/auth/lazada` to
   authorize your seller account.
5. The Orders and Products tabs will pull real Lazada data too.

**Same token-persistence caveat as Shopee** — refresh tokens last 30 days,
access tokens shorter, and the in-memory store won't survive cold starts in
production. Swap `lib/lazada.js`'s `tokenStore` for a real datastore before
relying on this long-term.

## 3. What's real vs. sample right now

- `orders` and `products` routes: **wired to call real Shopee/Lazada APIs**
  once you've completed the steps above. Until then, they return clearly
  labeled sample data.
- `customers`, `oos`, `reviews`, `analytics` routes: **still sample data**.
  Shopee/Lazada don't expose a single unified "customers" or "reviews"
  endpoint the same way — those need to be built from order history and
  product review endpoints respectively. Ask if you want these wired up next.
