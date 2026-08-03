export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from "next/server";
import { lazadaGet, isConfigured as lazadaConfigured, configuredBrands, LAZADA_BRANDS } from "../../../lib/lazada";
import { getToken } from "../../../lib/tokenStore";

const sampleOrders = [
  { id: "ORD-1001", brand: "RAV Design", product: "Bifold Wallet MB-001", customer: "A. Rahman", status: "processing", total: 89.9, platform: "Shopee" },
];

export async function GET() {
  const orders = [];
  const errors = [];

  if (!lazadaConfigured()) {
    return NextResponse.json({
      _note: "No Shopee/Lazada credentials configured yet â€” showing sample data. See README-shopee-lazada.md to connect real accounts.",
      data: sampleOrders,
    });
  }

  const brands = configuredBrands();
  console.log("[Orders] Configured brands:", brands);

  if (brands.length === 0) {
    return NextResponse.json({
      _note: "Lazada APP_KEY set but no brand refresh tokens found. Check LAZADA_ACCESS_TOKEN_* env vars.",
      data: sampleOrders,
      debug: { LAZADA_BRANDS, envCheck: LAZADA_BRANDS.map(b => ({ brand: b, hasToken:!!process.env[`LAZADA_REFRESH_TOKEN_${b}`] ||!!process.env[`RAV_MAIN_REFRESH_TOKEN`] })) }
    });
  }

  for (const brand of brands) {
    try {
      console.log(`[Orders] Fetching ${brand}...`);
      const j = await lazadaGet(brand, "/orders/get", {
        created_after: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
        sort_by: "created_at",
        sort_direction: "DESC",
      });

      const list = j?.data?.orders || j?.data || [];
      console.log(`[Orders] ${brand} got ${list.length} orders`, j?.code);

      if (j?.code && j.code!== "0") {
        errors.push(`${brand}: ${j.message || j.code}`);
        continue;
      }

      list.forEach((o) =>
        orders.push({
          id: o.order_id || o.order_number,
          order_number: o.order_number,
          brand: brand,
          status: o.statuses?.[0] || o.status,
          total: o.price,
          platform: "Lazada",
          created_at: o.created_at,
        })
      );
    } catch (e) {
      console.error(`[Orders] ${brand} error:`, e);
      errors.push(`Lazada ${brand}: ${e.message}`);
    }
  }

  return NextResponse.json({
    _note: errors.length? `Live data attempted. Issues: ${errors.join(" | ")}` : `Live data from Lazada - ${brands.join(", ")}`,
    count: orders.length,
    countTotal: orders.length,
    data: orders,
    brands: brands,
    errors: errors,
  });
}

