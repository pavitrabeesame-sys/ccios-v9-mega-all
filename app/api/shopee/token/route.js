import { NextResponse } from "next/server";
import { getToken as getAccessToken } from "../../../../src/services/shopee/TokenService";

export async function POST(request) {

  try {

    const { code, shopId } = await request.json();

    const token = await getAccessToken(code, shopId);

    return NextResponse.json({
      success: true,
      token,
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