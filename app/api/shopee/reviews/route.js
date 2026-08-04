import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany();

    const results = [];

    for (const account of accounts) {
      const url = buildShopApiUrl(
        "/api/v2/product/get_comment",
        account.accessToken,
        account.shopId,
        {
          cursor: "",
          page_size: 100,
        }
      );

      console.log("Fetching:", account.shopId);

      const res = await fetch(url);

      const data = await res.json();

      results.push({
        shopId: account.shopId,
        response: data,
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (err) {
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