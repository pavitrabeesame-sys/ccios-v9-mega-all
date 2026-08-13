import { NextResponse } from "next/server";
import { createAuthURL } from "../../../../src/services/shopee/AuthService";

export const dynamic = 'force-dynamic';
export async function GET() {

  try {

    const url = createAuthURL();

    return NextResponse.json({
      success: true,
      url,
    });

  } catch (error) {

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