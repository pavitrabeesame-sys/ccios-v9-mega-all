import { NextResponse } from "next/server";
import { getReviews } from "../../../../src/services/shopee/ReviewService";

export async function GET(request) {

  try {

    const { searchParams } = new URL(request.url);

    const shopId = searchParams.get("shop_id");
    const accessToken = searchParams.get("access_token");

    if (!shopId || !accessToken) {

      return NextResponse.json(
        {
          success: false,
          error: "shop_id and access_token are required.",
        },
        {
          status: 400,
        }
      );

    }

    const reviews = await getReviews(
      shopId,
      accessToken
    );

    return NextResponse.json({
      success: true,
      reviews,
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