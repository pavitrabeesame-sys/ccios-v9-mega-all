export const dynamic = 'force-dynamic'; // ADD THIS
export const revalidate = 0;

import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/src/services/shopee/AuthService";
import { saveToken } from "@/src/services/shopee/TokenService";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const shopId = searchParams.get("shop_id");

    if (!code || !shopId) {
      return NextResponse.json(
        { success: false, error: "Missing code or shop_id" },
        { status: 400 }
      );
    }

    const result = await exchangeCodeForToken(code, shopId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error, message: result.message },
        { status: 400 }
      );
    }

    await saveToken({
      shopId: Number(shopId), // FIX: make sure it's number for DB
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expireIn: result.expire_in,
    });

    // Optional: redirect to dashboard instead of json
    // return NextResponse.redirect(new URL('/marketplaces', request.url))

    return NextResponse.json({
      success: true,
      shopId,
      message: "Shopee authorization completed successfully.",
    });
  } catch (error) {
    console.error("[Shopee Callback] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}