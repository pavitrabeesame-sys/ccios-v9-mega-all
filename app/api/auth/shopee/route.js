import { NextResponse } from "next/server";
import { buildAuthUrl, isConfigured } from "../../../../lib/shopee";

export async function GET(request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Set SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY in your environment variables first." },
      { status: 400 }
    );
  }
  const origin = new URL(request.url).origin;
  const redirectUrl = `${origin}/api/auth/shopee/callback`;
  return NextResponse.redirect(buildAuthUrl(redirectUrl));
}
