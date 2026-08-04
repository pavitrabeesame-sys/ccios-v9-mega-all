import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/src/services/shopee/AuthService";

export async function GET() {
  try {
    const redirectUrl =
      `${process.env.NEXTAUTH_URL}/api/auth/shopee/callback`;

    export function buildAuthUrl(redirectUrl) {
  const { partnerId } = getConfig();

  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  const base = `${partnerId}${path}${timestamp}`;
  const signature = sign(base);

  console.log("========== SHOPEE AUTH ==========");
  console.log("HOST:", HOST);
  console.log("Partner ID:", partnerId);
  console.log("Timestamp:", timestamp);
  console.log("Base:", base);
  console.log("Signature:", signature);
  console.log("Redirect:", redirectUrl);

  return buildUrl(path, {
    partner_id: partnerId,
    timestamp,
    sign: signature,
    redirect: redirectUrl,
  });
}