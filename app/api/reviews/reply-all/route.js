import { NextResponse } from "next/server";
import replyToShopee from "@/src/ai/reply/replyToShopee";

export const dynamic = "force-dynamic";

export async function POST() {

  try {

    const results = await replyToShopee();

    return NextResponse.json({
      success: true,
      total: results.length,
      results,
    });

  } catch (err) {

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );

  }

}