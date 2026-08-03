import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

// =========================
// GET ALL STORES
// =========================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const page = Number(searchParams.get("page")) || 1;
    const limit = 10;

    const where = {
      OR: [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    };

    const total = await prisma.store.count({
      where,
    });

    const stores = await prisma.store.findMany({
      where,

      include: {
        company: true,
        orders: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: stores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load stores.",
      },
      {
        status: 500,
      }
    );

  }
}

// =========================
// CREATE STORE
// =========================
export async function POST(request) {

  try {

    const body = await request.json();

    if (!body.name || !body.companyId || !body.marketplace) {

      return NextResponse.json(
        {
          success: false,
          message: "Please complete all required fields.",
        },
        {
          status: 400,
        }
      );

    }

    const store = await prisma.store.create({

      data: {

        name: body.name,

        marketplace: body.marketplace,

        companyId: body.companyId,

      },

    });

    return NextResponse.json({

      success: true,

      data: store,

    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create store.",
      },
      {
        status: 500,
      }
    );

  }

}