export const dynamic = "force-dynamic";

export const revalidate = 0;

import { NextResponse } from "next/server";

import {
  exchangeCodeForToken,
} from "@/src/services/shopee/AuthService";

import {
  saveToken,
} from "@/src/services/shopee/TokenService";

export async function GET(request) {

  try {

    const { searchParams } =
      new URL(request.url);

    const code =
      searchParams.get("code");

    if (!code) {

      return NextResponse.json(
        {
          success: false,
          error: "Missing authorization code",
        },
        {
          status: 400,
        }
      );

    }

    const result =
      await exchangeCodeForToken(code);

    for (const shopId of result.shop_id_list || []) {

      await saveToken({

        shopId,

        accessToken:
          result.access_token,

        refreshToken:
          result.refresh_token,

        expireIn:
          result.expire_in,

      });

    }

    return NextResponse.json({

      success: true,

      shops:
        result.shop_id_list,

      message:
        "Shopee authorization successful.",

    });

  }

  catch (err) {

    console.error(err);

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