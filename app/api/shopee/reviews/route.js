import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { buildShopApiUrl } from "@/src/services/shopee/AuthService";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany();

    console.log("========== SHOPEE ACCOUNTS ==========");
    console.log(
      JSON.stringify(
        accounts,
        (_, value) =>
          typeof value === "bigint" ? value.toString() : value,
        2
      )
    );

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No Shopee accounts found.",
      });
    }

    const results = [];

    for (const account of accounts) {
      const shopId = account.shopId.toString();

      console.log("========== SHOP ==========");
      console.log({
        shopId,
        accessToken: account.accessToken ? "EXISTS" : "MISSING",
        refreshToken: account.refreshToken ? "EXISTS" : "MISSING",
      });

      if (!account.accessToken) {
        results.push({
          shopId,
          success: false,
          error: "Missing accessToken",
        });
        continue;
      }

      const url = buildShopApiUrl(
        "/api/v2/product/get_comment",
        account.accessToken,
        shopId,
        {
          cursor: "",
          page_size: 100,
        }
      );

      console.log("REQUEST URL:");
      console.log(url);

      const response = await fetch(url);
      const data = await response.json();

      console.log("RESPONSE:");
      console.log(JSON.stringify(data, null, 2));

      results.push({
        shopId,
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