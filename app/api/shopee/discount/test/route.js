import { NextResponse } from "next/server";

import {
  getDiscountList,
  getDiscount,
  getAllDiscountItems
} from "../../../../../src/services/shopee/DiscountService";


export const dynamic = "force-dynamic";


// ========================================
// GET
// ========================================

export async function GET(request) {

  try {

    const {
      searchParams
    } = new URL(request.url);


    const shopId =
      searchParams.get("shopId");


    const discountId =
      searchParams.get("discountId");


    const all =
      searchParams.get("all");


    // ====================================
    // VALIDATE SHOP ID
    // ====================================

    if (!shopId) {

      return NextResponse.json(
        {
          success: false,
          error:
            "shopId is required"
        },
        {
          status: 400
        }
      );

    }


    // ====================================
    // GET DISCOUNT LIST
    // ====================================

    if (!discountId) {

      const discounts =
        await getDiscountList(
          shopId
        );

      return NextResponse.json({

        success: true,

        shopId,

        discounts

      });

    }


    // ====================================
    // GET ALL ITEMS / MODELS
    // ====================================

    if (all === "true") {

      const discount =
        await getAllDiscountItems(
          shopId,
          discountId
        );

      return NextResponse.json({

        success: true,

        shopId,

        discountId,

        discount

      });

    }


    // ====================================
    // GET FIRST PAGE
    // ====================================

    const discount =
      await getDiscount(
        shopId,
        discountId,
        1,
        50
      );


    return NextResponse.json({

      success: true,

      shopId,

      discountId,

      discount

    });


  } catch (error) {

    console.error(
      "DISCOUNT TEST ERROR:",
      error
    );


    return NextResponse.json(

      {
        success: false,

        error:
          error.message ||
          "Unknown error"

      },

      {
        status: 500
      }

    );

  }

}