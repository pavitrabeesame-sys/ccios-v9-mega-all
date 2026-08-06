export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { lazadaGet } from "@/lib/lazada";

export async function GET() {
  try {
    const result = await lazadaGet(
      "RAV",
      "/seller/get"
    );

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('[Lazada Test Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}