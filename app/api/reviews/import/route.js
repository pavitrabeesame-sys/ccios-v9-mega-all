import { NextResponse } from "next/server";
import { syncShopeeReviews } from "@/src/services/shopee/SyncService";

export async function POST() {

  try {

    const result = await syncShopeeReviews(
      process.env.MAIN_SHOP_ID
    );

    return NextResponse.json({
      success: true,
      ...result,
    });

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