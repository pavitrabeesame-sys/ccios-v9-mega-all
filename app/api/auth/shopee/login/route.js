import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/src/services/shopee/AuthService";

export async function GET() {
  try {
    const redirectUrl =
      `${process.env.NEXTAUTH_URL}/api/auth/shopee/callback`;

    const authUrl = buildAuthUrl(redirectUrl);

    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}