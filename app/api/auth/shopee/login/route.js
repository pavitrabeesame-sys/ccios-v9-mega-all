// app/api/auth/shopee/login/route.js

import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/services/shopee/AuthService";

export async function GET() {
  try {
    const authUrl = await buildAuthUrl();

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error(
      "[Shopee Login] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to create Shopee authorization URL",
      },
      {
        status: 500,
      }
    );
  }
}