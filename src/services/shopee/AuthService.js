import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany();

    console.log("========== ACCOUNTS ==========");
    console.log(accounts);

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No Shopee accounts found",
      });
    }

    const results = [];

    for (const account of accounts) {

      console.log("========== ACCOUNT ==========");
      console.log({
        shopId: account.shopId,
        accessTokenExists: !!account.accessToken,
        refreshTokenExists: !!account.refreshToken,
      });

      const url = buildShopApiUrl(
        "/api/v2/product/get_comment",
        String(account.accessToken),
        String(account.shopId),
        {
          cursor: "",
          page_size: 100,
        }
      );

      console.log("REQUEST URL:");
      console.log(url);

      const res = await fetch(url);

      const data = await res.json();

      console.log("RESPONSE:");
      console.log(JSON.stringify(data, null, 2));

      results.push({
        shopId: account.shopId,
        data,
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