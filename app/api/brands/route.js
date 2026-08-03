import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

// =========================
// GET ALL BRANDS
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
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    };

    const total = await prisma.brand.count({
      where,
    });

    const brands = await prisma.brand.findMany({
      where,

      include: {
        company: true,
        products: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: brands,
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
        message: "Failed to load brands.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// CREATE BRAND
// =========================
export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.name || !body.code || !body.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Please fill all required fields.",
        },
        {
          status: 400,
        }
      );
    }

    const exists = await prisma.brand.findFirst({
      where: {
        OR: [
          {
            name: body.name,
          },
          {
            code: body.code,
          },
        ],
      },
    });

    if (exists) {
      return NextResponse.json(
        {
          success: false,
          message: "Brand already exists.",
        },
        {
          status: 400,
        }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description || "",
        companyId: body.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create brand.",
      },
      {
        status: 500,
      }
    );
  }
}