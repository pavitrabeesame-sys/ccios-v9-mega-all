export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

import {
  exchangeCodeForToken,
} from "@/services/shopee/AuthService";

import {
  saveToken,
} from "@/services/shopee/TokenService";


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // ============================================================
    // 1. GET AUTHORIZATION CODE
    // ============================================================

    const code = searchParams.get("code");

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


    // ============================================================
    // 2. EXCHANGE CODE FOR SHOPEE TOKEN
    // ============================================================

    const result = await exchangeCodeForToken(code);

    console.log(
      "[Shopee OAuth] Token exchange successful"
    );

    console.log(
      "[Shopee OAuth] Shops:",
      result.shop_id_list
    );


    // ============================================================
    // 3. VALIDATE SHOPEE RESPONSE
    // ============================================================

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopee returned an empty authorization response.",
        },
        {
          status: 500,
        }
      );
    }

    if (!result.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopee did not return an access token.",
        },
        {
          status: 500,
        }
      );
    }

    if (!result.refresh_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopee did not return a refresh token.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !Array.isArray(result.shop_id_list) ||
      result.shop_id_list.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopee did not return any shop IDs.",
        },
        {
          status: 500,
        }
      );
    }


    // ============================================================
    // 4. SAVE EVERY SHOPEE SHOP
    // ============================================================

    const savedShops = [];
    const failedShops = [];

    for (const shopId of result.shop_id_list) {
      try {
        if (
          shopId === null ||
          shopId === undefined ||
          String(shopId).trim() === ""
        ) {
          console.error(
            "[Shopee OAuth] Invalid shopId:",
            shopId
          );

          failedShops.push({
            shopId: null,
            error: "Invalid shopId",
          });

          continue;
        }


        const normalizedShopId = String(shopId).trim();


        console.log(
          `[Shopee OAuth] Saving shop ${normalizedShopId}`
        );


        // ========================================================
        // SAVE / UPDATE SHOPEE ACCOUNT
        // ========================================================

        await saveToken({
          shopId: normalizedShopId,

          accessToken:
            result.access_token,

          refreshToken:
            result.refresh_token,

          expireIn:
            Number(result.expire_in || 0),
        });


        // ========================================================
        // SUCCESS
        // ========================================================

        savedShops.push(normalizedShopId);

        console.log(
          `[Shopee OAuth] Shop ${normalizedShopId} saved successfully`
        );

      } catch (shopError) {
        console.error(
          `[Shopee OAuth] Failed saving shop ${shopId}:`,
          shopError
        );

        failedShops.push({
          shopId: String(shopId),
          error:
            shopError?.message ||
            "Failed to save Shopee account",
        });
      }
    }


    // ============================================================
    // 5. IF NOTHING WAS SAVED
    // ============================================================

    if (savedShops.length === 0) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Shopee authorization succeeded, but no Shopee accounts could be saved.",

          shops:
            result.shop_id_list || [],

          savedShops,

          failedShops,
        },
        {
          status: 500,
        }
      );
    }


    // ============================================================
    // 6. SUCCESS RESPONSE
    // ============================================================

    return NextResponse.json(
      {
        success: true,

        shops:
          result.shop_id_list,

        savedShops,

        failedShops,

        accessTokenSaved: true,

        refreshTokenSaved: true,

        message:
          failedShops.length > 0
            ? "Shopee authorization completed with some shop errors."
            : "Shopee authorization successful. All shops were saved.",
      },
      {
        status: 200,
      }
    );

  } catch (err) {

    // ============================================================
    // GLOBAL ERROR
    // ============================================================

    console.error(
      "[Shopee OAuth] Callback error:",
      err
    );

    return NextResponse.json(
      {
        success: false,

        error:
          err?.message ||
          "Shopee authorization failed.",

        details:
          process.env.NODE_ENV === "development"
            ? String(err?.stack || "")
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}